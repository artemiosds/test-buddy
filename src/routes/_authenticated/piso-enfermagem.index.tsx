import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import {
  getResumoConsolidacao,
  reprocessarCompetenciaConsolidada,
  reprocessarRegistroConsolidado,
} from "@/lib/piso-consolidacao.functions";
import { STATUS_CONSOLIDACAO_LABEL, STATUS_CONSOLIDACAO_VARIANTE } from "@/lib/piso-consolidacao";
import { gerarPlanilhaOficialPiso } from "@/lib/piso-planilha.functions";
import { baixarPlanilhaPiso } from "@/lib/piso-planilha-cliente";
import { OfflineButton } from "@/components/shared/OfflineButton";
import {
  listarModelosPlanilha,
  obterModeloPlanilha,
} from "@/lib/planilha-modelos.functions";
import { baixarPeloModeloSalvo } from "@/lib/planilha-modelo-cliente";

import {
  Upload,
  Download,
  AlertTriangle,
  Users,
  CheckCircle2,
  Clock,
  CalendarRange,
  FileBarChart,
  Settings,
  RefreshCw,
  Stethoscope,
  Wrench,
  HeartPulse,
  BadgeCheck,
  Sparkles,
  History,
  ShieldCheck,
  FileSpreadsheet,
} from "lucide-react";


import { DataTable } from "@/components/shared/DataTable";
import { PermissionGate } from "@/components/permission-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterBar } from "@/components/shared/FilterBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { KpiCard } from "@/components/shared/KpiCard";
import { PisoDataGrid, type GridColumn } from "@/components/piso/piso-data-grid";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
  LabelList,

} from "recharts";

import { downloadXlsx, type XlsxColumn } from "@/lib/xlsx-export";
import { formatCPF, formatDateTime } from "@/lib/formatters";
import { useUnidadesLookup, useCargosLookup, useVinculosLookup } from "@/hooks/use-lookups";
import {
  listPisoElegiveis,
  getPisoDashboardGestao,
  listCompetenciasConsolidadas,
  listPisoPendencias,
} from "@/lib/piso-gestao.functions";
import { listHistoricoImportacoes } from "@/lib/piso-enfermagem.functions";
import { PisoDetalheSheet, fmtBRL, type LinhaPiso } from "@/components/piso/piso-detalhe-sheet";

export const Route = createFileRoute("/_authenticated/piso-enfermagem/")({ errorComponent: ErrorComponent,
  component: () => (
    <PermissionGate
      permission="piso.visualizar"
      fallback={
        <div className="p-6 text-sm text-muted-foreground">
          Sem permissão para visualizar o Piso Nacional da Enfermagem.
        </div>
      }
    >
      <PisoIndex />
    </PermissionGate>
  ),
});

const CATEGORIAS = [
  { value: "ENFERMEIRO", label: "Enfermeiro" },
  { value: "TECNICO_ENFERMAGEM", label: "Técnico de Enfermagem" },
  { value: "AUXILIAR_ENFERMAGEM", label: "Auxiliar de Enfermagem" },
] as const;

const SITUACOES = [
  "ativo",
  "licenca",
  "ferias",
  "cedido",
  "afastado",
  "desligado",
] as const;

const CORES = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];

const rotuloCategoria = (c: string) =>
  CATEGORIAS.find((x) => x.value === c)?.label ?? c.replaceAll("_", " ");

type LinhaGrid = LinhaPiso & {
  cargo_id: string | null;
  unidade_id: string | null;
  setor: string | null;
  setor_id: string | null;
  vinculo: string | null;
  vinculo_id: string | null;
  situacao_funcional: string | null;
  competencia: string | null;
  atualizado_em: string | null;
};

function StatusPiso({ r }: { r: LinhaGrid }) {
  if (r.status_importacao !== "importado")
    return <Badge variant="secondary">Aguardando Importação</Badge>;
  return r.divergencia ? (
    <Badge variant="outline" className="border-amber-500/40 text-amber-600">
      Divergente
    </Badge>
  ) : (
    <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">
      Importado
    </Badge>
  );
}

function PisoIndex() {
  // ----------------------------- estado de filtros -----------------------------
  const [competencia, setCompetencia] = useState<string | null>(null);
  const [unidadeId, setUnidadeId] = useState("");
  const [cargoId, setCargoId] = useState("");
  const [categoria, setCategoria] = useState("");
  const [vinculoId, setVinculoId] = useState("");
  const [situacao, setSituacao] = useState("");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [statusImportacao, setStatusImportacao] = useState<
    "todos" | "importado" | "pendente" | "divergente"
  >("todos");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [detalhe, setDetalhe] = useState<LinhaPiso | null>(null);
  const [detalheOpen, setDetalheOpen] = useState(false);

  const unidadesQ = useUnidadesLookup({ ativasOnly: true });
  const cargosQ = useCargosLookup();
  const vinculosQ = useVinculosLookup();

  const compQ = useQuery({
    queryKey: ["piso", "competencias-consolidadas"],
    queryFn: () => listCompetenciasConsolidadas(),
  });
  const competenciaAtiva = competencia ?? compQ.data?.competencias?.[0] ?? null;

  const listaQ = useQuery({
    queryKey: [
      "piso",
      "elegiveis",
      competenciaAtiva,
      categoria,
      unidadeId,
      cargoId,
      vinculoId,
      situacao,
      cpf,
      statusImportacao,
      nome,
      page,
      pageSize,
    ],
    queryFn: () =>
      listPisoElegiveis({
        data: {
          competencia: competenciaAtiva,
          categoria: categoria || null,
          unidade_id: unidadeId || null,
          cargo_id: cargoId || null,
          vinculo_id: vinculoId || null,
          situacao: situacao || null,
          cpf: cpf || null,
          statusImportacao,
          busca: nome || null,
          page,
          pageSize,
        },
      }),
  });

  const dashQ = useQuery({
    queryKey: ["piso", "dashboard-gestao", competenciaAtiva],
    queryFn: () => getPisoDashboardGestao({ data: { competencia: competenciaAtiva } }),
  });

  const pendQ = useQuery({
    queryKey: ["piso", "pendencias", competenciaAtiva],
    queryFn: () => listPisoPendencias({ data: { competencia: competenciaAtiva } }),
  });

  const histQ = useQuery({
    queryKey: ["piso", "historico-importacoes"],
    queryFn: () => listHistoricoImportacoes({ data: { page: 1, pageSize: 50 } }),
  });

  const consolQ = useQuery({
    queryKey: ["piso", "consolidacao-resumo"],
    queryFn: () => getResumoConsolidacao({ data: {} }),
  });

  // Modelos de planilha salvos: quando existe um modelo (ex.: "UBS"), o arquivo
  // baixado é gerado pelo motor de clone com a estrutura, colunas e fórmulas do
  // modelo — e não pelo gerador fixo antigo.
  const modelosQ = useQuery({
    queryKey: ["piso", "planilha-modelos"],
    queryFn: () => listarModelosPlanilha({ data: { modulo: "piso" } }),
  });
  const [modeloSel, setModeloSel] = useState<string>("auto");

  function resolverModelo(tipo: string, preferidoId?: string | null) {
    const modelos = (modelosQ.data?.modelos ?? []) as {
      id: string;
      nome: string;
      vinculo: string | null;
      padrao: boolean;
    }[];
    // Modelo registrado na própria importação tem prioridade absoluta.
    if (preferidoId) {
      const doHistorico = modelos.find((m) => m.id === preferidoId);
      if (doHistorico) return doHistorico;
    }
    if (modeloSel === "legado") return null;
    if (modeloSel !== "auto") return modelos.find((m) => m.id === modeloSel) ?? null;
    return (
      modelos.find((m) => m.padrao && m.vinculo === tipo) ??
      modelos.find((m) => m.padrao && !m.vinculo) ??
      null
    );
  }

  /** Entrega o arquivo: pelo modelo salvo quando houver, senão pelo gerador legado. */
  async function entregar(
    r: Awaited<ReturnType<typeof gerarPlanilhaOficialPiso>>,
    tipo: string,
    filename?: string,
    modeloIdPreferido?: string | null,
  ) {
    if (r.origem_modelo === "UBS_SAUDE" || r.origem_modelo === "HMO_SAUDE") {
      baixarPlanilhaPiso(r, filename);
      return;
    }
    const escolhido = resolverModelo(tipo, modeloIdPreferido);
    if (!escolhido) {
      baixarPlanilhaPiso(r, filename);
      return;
    }
    const modelo = await obterModeloPlanilha({ data: { id: escolhido.id } });
    const resumo = await baixarPeloModeloSalvo({
      modeloBase64: String(modelo.arquivo_base64),
      colunasModelo: (modelo.colunas ?? []) as string[],
      linhas: r.linhas,
      filename: filename ?? r.filename,
    });
    if (resumo.colunasModeloSemDado.length > 0) {
      toast.warning(
        `Colunas do modelo sem dado consolidado: ${resumo.colunasModeloSemDado.join(", ")}. ` +
          "Elas mantiveram o valor ou a fórmula do próprio modelo.",
        { duration: 10000 },
      );
    }
    if (resumo.linhasSemCasamento.length > 0) {
      toast.warning(
        `${resumo.linhasSemCasamento.length} pessoa(s) sem correspondência no modelo "${escolhido.nome}". ` +
          "Receberam apenas as colunas calculadas.",
        { duration: 10000 },
      );
    }
  }

  const gerarMut = useMutation({
    mutationFn: (tipo: "contratados" | "efetivos" | "calculo_piso") =>
      gerarPlanilhaOficialPiso({
        data: {
          competencia: competenciaAtiva ?? "",
          tipo,
          unidade_id: unidadeId || null,
          categoria: categoria || null,
        },
      }),
    onSuccess: async (r, tipo) => {
      await entregar(r, tipo);
      const modelo = resolverModelo(tipo);
      toast.success(
        `Planilha gerada com ${r.total} profissional(is)` +
          (modelo ? ` no modelo "${modelo.nome}".` : "."),
      );
    },
    onError: (e: unknown) =>
      toast.error(
        e instanceof Error && e.message
          ? `Falha ao gerar a planilha: ${e.message}`
          : "Falha ao gerar a planilha. Tente novamente.",
      ),
  });

  const sanitizar = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w]+/g, "-")
      .replace(/^-|-$/g, "")
      .toUpperCase()
      .slice(0, 40);

  const [baixandoUnidade, setBaixandoUnidade] = useState<string | null>(null);
  const [baixandoHist, setBaixandoHist] = useState<string | null>(null);

  async function baixarImportacao(
    hist: {
      id: string;
      nome_arquivo?: string | null;
      competencia?: string | null;
      modelo_planilha_id?: string | null;
    },
    tipo: "contratados" | "efetivos" | "calculo_piso",
  ) {
    setBaixandoHist(hist.id);
    try {
      const r = await gerarPlanilhaOficialPiso({
        data: {
          competencia: hist.competencia || "",
          tipo,
          historico_id: hist.id,
        },
      });
      if (!r.total) {
        toast.error("Nenhum profissional consolidado nesta importação.");
        return;
      }
      const sufixo = sanitizar(String(hist.nome_arquivo ?? "IMPORTACAO").replace(/\.[^.]+$/, ""));
      await entregar(
        r,
        tipo,
        r.filename.replace(/\.xlsx$/i, `-${sufixo}.xlsx`),
        (hist.modelo_planilha_id as string | null) ?? null,
      );
      toast.success(`Arquivo gerado com ${r.total} profissional(is).`);
    } catch (e) {
      toast.error(
        e instanceof Error && e.message
          ? `Falha ao gerar o arquivo: ${e.message}`
          : "Falha ao gerar o arquivo desta importação.",
      );
    } finally {
      setBaixandoHist(null);
    }
  }



  async function baixarPorUnidade(
    tipo: "contratados" | "efetivos" | "calculo_piso",
    alvo?: { id: string; nome: string },
  ) {
    const lista = alvo ? [alvo] : (unidadesQ.data ?? []).map((u) => ({ id: u.id, nome: u.nome }));
    if (!lista.length) {
      toast.error("Nenhuma unidade disponível.");
      return;
    }
    setBaixandoUnidade(alvo?.id ?? "todas");
    let gerados = 0;
    let vazias = 0;
    try {
      for (const u of lista) {
        try {
          const r = await gerarPlanilhaOficialPiso({
            data: {
              competencia: competenciaAtiva ?? "",
              tipo,
              unidade_id: u.id,
              categoria: categoria || null,
            },
          });
          if (!r.total) {
            vazias++;
            continue;
          }
          await entregar(r, tipo, r.filename.replace(/\.xlsx$/i, `-${sanitizar(u.nome)}.xlsx`));
          gerados++;
          await new Promise((res) => setTimeout(res, 350));
        } catch {
          toast.error(`Falha ao gerar a planilha da unidade ${u.nome}.`);
        }
      }
      if (gerados) {
        toast.success(
          `${gerados} arquivo(s) gerado(s)${vazias ? ` · ${vazias} unidade(s) sem elegíveis` : ""}.`,
        );
      } else {
        toast.error("Nenhum profissional elegível nas unidades selecionadas.");
      }
    } finally {
      setBaixandoUnidade(null);
    }
  }

  const [baixandoPiso, setBaixandoPiso] = useState<string | null>(null);

  /** "2026-07" -> "JULHO" */
  function rotuloMesLocal(comp: string) {
    const m = /^(\d{4})-(\d{2})/.exec((comp ?? "").trim());
    const meses = [
      "JANEIRO",
      "FEVEREIRO",
      "MARCO",
      "ABRIL",
      "MAIO",
      "JUNHO",
      "JULHO",
      "AGOSTO",
      "SETEMBRO",
      "OUTUBRO",
      "NOVEMBRO",
      "DEZEMBRO",
    ];
    return m ? (meses[Number(m[2]) - 1] ?? comp) : comp;
  }

  /** Planilha oficial de envio (layout "piso-enfermagem"), sem fórmulas, por CPF. */
  async function baixarPisoEnfermagem(comp: string) {
    setBaixandoPiso(comp);
    try {
      const r = await gerarPlanilhaOficialPiso({
        data: { competencia: comp, tipo: "piso_enfermagem" },
      });
      if (!r.total) {
        toast.error("Nenhum profissional consolidado nesta competência.");
        return;
      }
      baixarPlanilhaPiso(r);
      toast.success(`Planilha gerada com ${r.total} profissional(is).`);
    } catch (e) {
      toast.error(
        e instanceof Error && e.message
          ? `Falha ao gerar a planilha: ${e.message}`
          : "Falha ao gerar a planilha oficial.",
      );
    } finally {
      setBaixandoPiso(null);
    }
  }


  const reprocessarComp = useMutation({
    mutationFn: (comp: string) =>
      reprocessarCompetenciaConsolidada({ data: { competencia: comp } }),
    onSuccess: (r) => {
      toast.success(`Competência reprocessada: ${r.processados} registro(s).`);
      consolQ.refetch();
      listaQ.refetch();
      dashQ.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reprocessarReg = useMutation({
    mutationFn: (profissionalId: string) =>
      reprocessarRegistroConsolidado({
        data: { profissional_id: profissionalId, competencia: competenciaAtiva },
      }),
    onSuccess: () => {
      toast.success("Registro reprocessado.");
      consolQ.refetch();
      listaQ.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (listaQ.data?.rows ?? []) as unknown as LinhaGrid[];
  const resumo = listaQ.data?.resumo;

  function atualizarTudo() {
    listaQ.refetch();
    dashQ.refetch();
    pendQ.refetch();
    compQ.refetch();
    histQ.refetch();
  }

  function limparFiltros() {
    setUnidadeId("");
    setCargoId("");
    setCategoria("");
    setVinculoId("");
    setSituacao("");
    setNome("");
    setCpf("");
    setStatusImportacao("todos");
    setPage(1);
  }

  const [colunasVisiveis, setColunasVisiveis] = useState<string[]>([]);

  function abrirDetalhe(l: LinhaGrid) {
    setDetalhe(l);
    setDetalheOpen(true);
  }

  // ----------------------------- colunas da grade -----------------------------
  const cols: GridColumn<LinhaGrid>[] = useMemo(
    () => [
      {
        key: "nome",
        header: "Nome",
        width: 240,
        sortValue: (r) => r.nome,
        cell: (r) => <span className="font-medium">{r.nome}</span>,
      },
      {
        key: "cpf",
        header: "CPF",
        width: 130,
        sortValue: (r) => r.cpf ?? "",
        cell: (r) => <span className="font-mono text-xs">{formatCPF(r.cpf)}</span>,
      },
      {
        key: "matricula",
        header: "Matrícula",
        width: 110,
        sortValue: (r) => r.matricula ?? "",
        cell: (r) => r.matricula ?? "—",
      },
      {
        key: "cargo",
        header: "Cargo",
        width: 170,
        sortValue: (r) => r.cargo ?? "",
        cell: (r) => r.cargo ?? "—",
      },
      {
        key: "categoria",
        header: "Categoria",
        width: 170,
        sortValue: (r) => r.categoria,
        cell: (r) => rotuloCategoria(r.categoria),
      },
      {
        key: "unidade",
        header: "Unidade",
        width: 190,
        sortValue: (r) => r.unidade ?? "",
        cell: (r) => r.unidade ?? "—",
      },
      {
        key: "setor",
        header: "Setor",
        width: 170,
        sortValue: (r) => r.setor ?? "",
        cell: (r) => r.setor ?? "—",
      },
      {
        key: "carga",
        header: "Carga horária",
        width: 110,
        align: "right",
        sortValue: (r) => r.carga_horaria ?? 0,
        cell: (r) => (r.carga_horaria ? `${r.carga_horaria}h` : "—"),
      },
      {
        key: "vinculo",
        header: "Vínculo",
        width: 140,
        sortValue: (r) => r.vinculo ?? "",
        cell: (r) => r.vinculo ?? "—",
      },
      {
        key: "situacao",
        header: "Situação",
        width: 120,
        sortValue: (r) => r.situacao_funcional ?? "",
        cell: (r) => (r.situacao_funcional ?? "—").replaceAll("_", " "),
      },
      {
        key: "salario_base",
        header: "Salário base",
        width: 130,
        align: "right",
        sortValue: (r) => r.salario_base ?? 0,
        cell: (r) => (r.salario_base != null ? fmtBRL(r.salario_base) : "—"),
      },
      {
        key: "insalubridade",
        header: "Insalubridade",
        width: 130,
        align: "right",
        sortValue: (r) => r.insalubridade ?? 0,
        cell: (r) => (r.insalubridade != null ? fmtBRL(r.insalubridade) : "—"),
      },
      {
        key: "auxilio",
        header: "Auxílio Financeiro Piso",
        width: 170,
        align: "right",
        sortValue: (r) => r.auxilio_financeiro ?? 0,
        cell: (r) => (r.auxilio_financeiro != null ? fmtBRL(r.auxilio_financeiro) : "—"),
      },
      {
        key: "total",
        header: "Valor total",
        width: 140,
        align: "right",
        sortValue: (r) => r.total_remuneracao,
        cell: (r) => <span className="font-semibold">{fmtBRL(r.total_remuneracao)}</span>,
      },
      {
        key: "status",
        header: "Status",
        width: 120,
        sortValue: (r) => (r.divergencia ? "divergente" : r.status_importacao),
        cell: (r) => <StatusPiso r={r} />,
      },
      {
        key: "competencia",
        header: "Competência",
        width: 120,
        sortValue: (r) => r.competencia ?? "",
        cell: (r) => r.competencia ?? "—",
      },
      {
        key: "atualizado",
        header: "Última atualização",
        width: 160,
        hiddenByDefault: true,
        sortValue: (r) => r.atualizado_em ?? "",
        cell: (r) => formatDateTime(r.atualizado_em),
      },
    ],
    [],
  );

  function exportar() {
    const base = selecionados.length
      ? rows.filter((r) => selecionados.includes(r.profissional_id))
      : rows;
    const todas: (XlsxColumn<LinhaGrid> & { key: string })[] = [
      { key: "nome", header: "Nome", value: (r) => r.nome, largura: 34 },
      { key: "cpf", header: "CPF", value: (r) => r.cpf, largura: 16 },
      { key: "matricula", header: "Matrícula", value: (r) => r.matricula, largura: 14 },
      { key: "cargo", header: "Cargo", value: (r) => r.cargo, largura: 26 },
      {
        key: "categoria",
        header: "Categoria",
        value: (r) => rotuloCategoria(r.categoria),
        largura: 22,
      },
      { key: "unidade", header: "Unidade", value: (r) => r.unidade, largura: 28 },
      { key: "setor", header: "Setor", value: (r) => r.setor ?? "", largura: 22 },
      {
        key: "carga",
        header: "Carga horária",
        value: (r) => r.carga_horaria ?? "",
        tipo: "numero",
        largura: 13,
      },
      { key: "vinculo", header: "Vínculo", value: (r) => r.vinculo ?? "", largura: 16 },
      { key: "situacao", header: "Situação", value: (r) => r.situacao_funcional ?? "", largura: 16 },
      {
        key: "salario_base",
        header: "Salário base",
        value: (r) => r.salario_base ?? "",
        tipo: "moeda",
        largura: 15,
      },
      {
        key: "insalubridade",
        header: "Insalubridade",
        value: (r) => r.insalubridade ?? "",
        tipo: "moeda",
        largura: 15,
      },
      {
        key: "auxilio",
        header: "Auxílio financeiro piso",
        value: (r) => r.auxilio_financeiro ?? "",
        tipo: "moeda",
        largura: 18,
      },
      {
        key: "total",
        header: "Valor total",
        value: (r) => r.total_remuneracao,
        tipo: "moeda",
        largura: 16,
      },
      {
        key: "status",
        header: "Status",
        value: (r) => (r.status_importacao === "importado" ? "Importado" : "Aguardando Importação"),
        largura: 20,
      },
      { key: "competencia", header: "Competência", value: (r) => r.competencia ?? "", largura: 14 },
      {
        key: "atualizado",
        header: "Última atualização",
        value: (r) => formatDateTime(r.atualizado_em),
        largura: 20,
      },
    ];
    const visiveis = colunasVisiveis.length ? colunasVisiveis : todas.map((c) => c.key);
    const c = todas.filter((col) => visiveis.includes(col.key));
    if (c.length === 0) return;
    const suf = competenciaAtiva ? `-${competenciaAtiva}` : "";
    downloadXlsx(`piso-enfermagem${suf}`, base, c, {
      sheetName: "Profissionais",
      titulo: `Piso Nacional da Enfermagem — Profissionais${competenciaAtiva ? ` — Competência ${competenciaAtiva}` : ""}`,
    });
  }



  const semCadastro = !listaQ.isLoading && (resumo?.totalCadastro ?? 0) === 0;
  const historico = (histQ.data?.rows ?? []) as Record<string, unknown>[];

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* ----------------------------- 1. Cabeçalho ----------------------------- */}
      <Card className="flex flex-wrap items-center justify-between gap-3 border-border p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-primary" />
            <h1 className="truncate text-xl font-bold tracking-tight">
              Piso Nacional da Enfermagem
            </h1>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <CalendarRange className="h-4 w-4" />
            <span>Competência:</span>
            <Badge variant="outline" className="font-mono">
              {competenciaAtiva ?? "não selecionada"}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={competenciaAtiva ?? "__none__"}
            onValueChange={(v) => {
              setCompetencia(v === "__none__" ? null : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[190px]">
              <SelectValue placeholder="Alterar competência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem competência</SelectItem>
              {(compQ.data?.competencias ?? []).map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <PermissionGate permission="piso.importar">
            <Button asChild size="sm">
              <Link to="/piso-enfermagem/importar-contratados">
                <Upload className="mr-2 h-4 w-4" /> Importar Contratados
              </Link>
            </Button>
          </PermissionGate>
          <PermissionGate permission="piso.importar">
            <Button asChild size="sm" variant="secondary">
              <Link to="/piso-enfermagem/importar-efetivos">
                <Upload className="mr-2 h-4 w-4" /> Importar Efetivos
              </Link>
            </Button>
          </PermissionGate>
          <PermissionGate permission="piso.importar">
            <Button asChild variant="outline" size="sm">
              <Link to="/piso-enfermagem/importar">
                <Upload className="mr-2 h-4 w-4" /> Importação avançada
              </Link>
            </Button>
          </PermissionGate>


          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText("https://gemini.google.com/app");
                toast.success("Link copiado! Cole na barra do navegador para abrir o Chat IA.");
              } catch (err) {
                toast.error("Erro ao copiar link. Por favor, copie manualmente: https://gemini.google.com/app");
              }
            }}
            title="Copiar link do Gemini para abrir manualmente"
          >
            <Sparkles className="mr-2 h-4 w-4" /> Chat IA
          </Button>

          <Select value={modeloSel} onValueChange={setModeloSel}>
            <SelectTrigger className="h-9 w-[230px]">
              <SelectValue placeholder="Modelo da planilha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Modelo salvo (automático)</SelectItem>
              <SelectItem value="legado">Formato antigo do sistema</SelectItem>
              {(modelosQ.data?.modelos ?? []).map((m: any) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nome}
                  {m.vinculo ? ` · ${m.vinculo}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>



          <Button
            size="sm"
            variant="default"
            disabled={!competenciaAtiva || gerarMut.isPending}
            onClick={() => gerarMut.mutate("contratados")}
          >
            <Download className="mr-2 h-4 w-4" />
            {gerarMut.isPending && gerarMut.variables === "contratados"
              ? "Gerando..."
              : "Baixar Planilha (3)"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!competenciaAtiva || gerarMut.isPending}
            onClick={() => gerarMut.mutate("efetivos")}
          >
            <Download className="mr-2 h-4 w-4" />
            {gerarMut.isPending && gerarMut.variables === "efetivos"
              ? "Gerando..."
              : "Baixar FOPAG"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!competenciaAtiva || gerarMut.isPending}
            onClick={() => gerarMut.mutate("calculo_piso")}
          >
            <Download className="mr-2 h-4 w-4" />
            {gerarMut.isPending && gerarMut.variables === "calculo_piso"
              ? "Gerando..."
              : "Baixar Cálculo Piso"}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={!competenciaAtiva || !!baixandoUnidade}>
                <Download className="mr-2 h-4 w-4" />
                {baixandoUnidade ? "Gerando..." : "Baixar por unidade"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-96 w-72 overflow-y-auto">
              <DropdownMenuLabel>Um arquivo por unidade</DropdownMenuLabel>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Todas as unidades</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => baixarPorUnidade("contratados")}>
                    Planilha (3)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => baixarPorUnidade("efetivos")}>
                    FOPAG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => baixarPorUnidade("calculo_piso")}>
                    Cálculo Piso
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              {(unidadesQ.data ?? []).map((u) => (
                <DropdownMenuSub key={u.id}>
                  <DropdownMenuSubTrigger className="truncate">{u.nome}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      onClick={() => baixarPorUnidade("contratados", { id: u.id, nome: u.nome })}
                    >
                      Planilha (3)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => baixarPorUnidade("efetivos", { id: u.id, nome: u.nome })}
                    >
                      FOPAG
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => baixarPorUnidade("calculo_piso", { id: u.id, nome: u.nome })}
                    >
                      Cálculo Piso
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>



          <Button asChild variant="outline" size="sm">
            <Link to="/relatorios-piso">
              <FileBarChart className="mr-2 h-4 w-4" /> Relatórios
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/piso-enfermagem/extracao">
              <Settings className="mr-2 h-4 w-4" /> Motor de Extração
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/layouts-importacao">
              <Settings className="mr-2 h-4 w-4" /> Layouts
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/configuracao">
              <Settings className="mr-2 h-4 w-4" /> Configurações
            </Link>
          </Button>

          <Button variant="outline" size="sm" onClick={atualizarTudo}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar dados
          </Button>
        </div>
      </Card>

      {semCadastro ? (
        <EmptyState
          title="Nenhum profissional de enfermagem ativo no cadastro"
          description="Cadastre profissionais com cargos de Enfermeiro, Técnico ou Auxiliar de Enfermagem para que apareçam aqui."
        />
      ) : (
        <>
          {/* --------------------------- 2. Cards superiores --------------------------- */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <KpiCard
              label="Total elegíveis"
              value={(resumo?.elegiveis ?? 0).toLocaleString("pt-BR")}
              icon={<Users className="h-4 w-4" />}
              loading={listaQ.isLoading}
            />
            <KpiCard
              label="Enfermeiros"
              value={(resumo?.enfermeiros ?? 0).toLocaleString("pt-BR")}
              icon={<Stethoscope className="h-4 w-4" />}
              iconTone="info"
              loading={listaQ.isLoading}
            />
            <KpiCard
              label="Técnicos"
              value={(resumo?.tecnicos ?? 0).toLocaleString("pt-BR")}
              icon={<Wrench className="h-4 w-4" />}
              iconTone="info"
              loading={listaQ.isLoading}
            />
            <KpiCard
              label="Auxiliares"
              value={(resumo?.auxiliares ?? 0).toLocaleString("pt-BR")}
              icon={<HeartPulse className="h-4 w-4" />}
              iconTone="info"
              loading={listaQ.isLoading}
            />
            <KpiCard
              label="Efetivos"
              value={(resumo?.efetivos ?? 0).toLocaleString("pt-BR")}
              icon={<BadgeCheck className="h-4 w-4" />}
              iconTone="neutral"
              loading={listaQ.isLoading}
            />
            <KpiCard
              label="Contratados"
              value={(resumo?.contratados ?? 0).toLocaleString("pt-BR")}
              icon={<Users className="h-4 w-4" />}
              iconTone="neutral"
              loading={listaQ.isLoading}
            />
            <KpiCard
              label="Importados"
              value={(resumo?.importados ?? 0).toLocaleString("pt-BR")}
              icon={<CheckCircle2 className="h-4 w-4" />}
              iconTone="success"
              loading={listaQ.isLoading}
              description={competenciaAtiva ?? "Sem competência"}
            />
            <KpiCard
              label="Pendentes"
              value={(resumo?.pendentes ?? 0).toLocaleString("pt-BR")}
              icon={<Clock className="h-4 w-4" />}
              iconTone="warning"
              loading={listaQ.isLoading}
            />
            <KpiCard
              label="Divergências"
              value={(resumo?.divergentes ?? 0).toLocaleString("pt-BR")}
              icon={<AlertTriangle className="h-4 w-4" />}
              iconTone="danger"
              tone={(resumo?.divergentes ?? 0) > 0 ? "danger" : "default"}
              loading={listaQ.isLoading}
            />
          </div>



          {/* ---------------------------- 3. Área de filtros ---------------------------- */}
          <FilterBar
            actions={
              <>
                <Button variant="ghost" size="sm" onClick={limparFiltros}>
                  Limpar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportar}
                  disabled={rows.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" /> Exportar
                </Button>
              </>
            }
          >
            <FilterBar.Field label="Competência">
              <Select
                value={competenciaAtiva ?? "__none__"}
                onValueChange={(v) => {
                  setCompetencia(v === "__none__" ? null : v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem competência</SelectItem>
                  {(compQ.data?.competencias ?? []).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterBar.Field>

            <FilterBar.Field label="Unidade">
              <Select
                value={unidadeId || "__all__"}
                onValueChange={(v) => {
                  setUnidadeId(v === "__all__" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {(unidadesQ.data ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterBar.Field>

            <FilterBar.Field label="Cargo">
              <Select
                value={cargoId || "__all__"}
                onValueChange={(v) => {
                  setCargoId(v === "__all__" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {(cargosQ.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterBar.Field>

            <FilterBar.Field label="Categoria">
              <Select
                value={categoria || "__all__"}
                onValueChange={(v) => {
                  setCategoria(v === "__all__" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterBar.Field>

            <FilterBar.Field label="Vínculo">
              <Select
                value={vinculoId || "__all__"}
                onValueChange={(v) => {
                  setVinculoId(v === "__all__" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {(vinculosQ.data ?? []).map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterBar.Field>

            <FilterBar.Field label="Situação">
              <Select
                value={situacao || "__all__"}
                onValueChange={(v) => {
                  setSituacao(v === "__all__" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {SITUACOES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterBar.Field>

            <FilterBar.Field label="Nome">
              <Input
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  setPage(1);
                }}
                placeholder="Nome ou matrícula…"
              />
            </FilterBar.Field>

            <FilterBar.Field label="CPF">
              <Input
                value={cpf}
                onChange={(e) => {
                  setCpf(e.target.value);
                  setPage(1);
                }}
                placeholder="Somente números"
                inputMode="numeric"
              />
            </FilterBar.Field>

            <FilterBar.Field label="Status">
              <Select
                value={statusImportacao}
                onValueChange={(v) => {
                  setStatusImportacao(v as typeof statusImportacao);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="importado">Importados</SelectItem>
                  <SelectItem value="pendente">Aguardando Importação</SelectItem>
                  <SelectItem value="divergente">Divergentes</SelectItem>
                </SelectContent>
              </Select>
            </FilterBar.Field>
          </FilterBar>

          {/* -------------------------------- 5. Abas -------------------------------- */}
          <Tabs defaultValue="resumo">
            <TabsList className="flex-wrap">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="profissionais">Profissionais</TabsTrigger>
              <TabsTrigger value="consolidacao">Consolidação</TabsTrigger>
              <TabsTrigger value="importacoes">Importações</TabsTrigger>
              <TabsTrigger value="pendencias">
                Pendências
                {(pendQ.data?.rows.length ?? 0) > 0 && (
                  <span className="ml-2 rounded-full bg-amber-500/20 px-1.5 text-xs text-amber-700">
                    {pendQ.data!.rows.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
              <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
              <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
            </TabsList>

            {/* ------------------------ Consolidação ------------------------ */}
            <TabsContent value="consolidacao" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-muted-foreground">
                  Camada consolidada por CPF e competência (Cadastro + Folha + Piso).
                </div>
                <PermissionGate permission="piso.importar">
                  <div className="flex gap-2">
                    <OfflineButton
                      size="sm"
                      disabled={!competenciaAtiva || reprocessarComp.isPending}
                      onClick={() =>
                        competenciaAtiva && reprocessarComp.mutate(competenciaAtiva)
                      }
                      requireOnline
                    >
                      {reprocessarComp.isPending ? "Reprocessando…" : "Reprocessar Competência"}
                    </OfflineButton>
                    <OfflineButton
                      size="sm"
                      variant="outline"
                      disabled={selecionados.length !== 1 || reprocessarReg.isPending}
                      onClick={() => reprocessarReg.mutate(selecionados[0])}
                      requireOnline
                    >
                      Reprocessar Registro
                    </OfflineButton>
                  </div>
                </PermissionGate>
              </div>

              {(consolQ.data?.competencias?.length ?? 0) === 0 ? (
                <EmptyState
                  title="Nenhuma competência consolidada"
                  description="Importe uma folha ou reprocesse uma competência para gerar a camada consolidada."
                />
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="px-3 py-2">Competência</th>
                        <th className="px-3 py-2">Total</th>
                        <th className="px-3 py-2">Consolidados</th>
                        <th className="px-3 py-2">Parciais</th>
                        <th className="px-3 py-2">Pendentes</th>
                        <th className="px-3 py-2">Divergências</th>
                        <th className="px-3 py-2">Erros</th>
                        <th className="px-3 py-2">Último processamento</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {consolQ.data!.competencias.map((c) => (
                        <tr key={c.competencia} className="border-t">
                          <td className="px-3 py-2 font-medium">{c.competencia}</td>
                          <td className="px-3 py-2">{c.total}</td>
                          <td className="px-3 py-2">{c.consolidados}</td>
                          <td className="px-3 py-2">{c.parciais}</td>
                          <td className="px-3 py-2">
                            {c.pendentes + c.semImportacao}
                          </td>
                          <td className="px-3 py-2">{c.divergentes}</td>
                          <td className="px-3 py-2">{c.erros}</td>
                          <td className="px-3 py-2">
                            {c.ultimoProcessamento
                              ? formatDateTime(c.ultimoProcessamento)
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <PermissionGate permission="piso.importar">
                              <OfflineButton
                                size="sm"
                                variant="ghost"
                                disabled={reprocessarComp.isPending}
                                onClick={() => reprocessarComp.mutate(c.competencia)}
                                requireOnline
                              >
                                Reprocessar
                              </OfflineButton>
                            </PermissionGate>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {Object.entries(STATUS_CONSOLIDACAO_LABEL).map(([k, label]) => (
                  <Badge key={k} variant={STATUS_CONSOLIDACAO_VARIANTE[k as keyof typeof STATUS_CONSOLIDACAO_VARIANTE] ?? "outline"}>
                    {label}
                  </Badge>
                ))}
              </div>
            </TabsContent>


            {/* --------------------------- Resumo --------------------------- */}
            <TabsContent value="resumo" className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border p-4">
                <div className="mb-1 text-sm font-medium">Elegíveis por unidade</div>
                <div className="mb-2 text-xs text-muted-foreground">
                  Top 10 unidades com mais profissionais elegíveis
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[...(dashQ.data?.porUnidade ?? [])]
                        .sort((a, b) => b.total - a.total)
                        .slice(0, 10)}
                      layout="vertical"
                      margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
                      barCategoryGap="20%"
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                      <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={170}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v: string) =>
                          v && v.length > 24 ? `${v.slice(0, 23)}…` : (v ?? "—")
                        }
                      />
                      <Tooltip cursor={{ fillOpacity: 0.1 }} />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="total" position="right" style={{ fontSize: 10 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-md border p-4">
                <div className="mb-1 text-sm font-medium">Distribuição por categoria</div>
                <div className="mb-2 text-xs text-muted-foreground">
                  Participação de cada categoria no total de elegíveis
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                      <Pie
                        data={(dashQ.data?.porCategoria ?? []).map((d) => ({
                          ...d,
                          label: rotuloCategoria(d.label),
                        }))}
                        dataKey="total"
                        nameKey="label"
                        cx="50%"
                        cy="45%"
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={2}
                        labelLine={false}
                        label={({ percent }: any) =>
                          percent > 0.05 ? `${Math.round(percent * 100)}%` : ""
                        }
                      >
                        {(dashQ.data?.porCategoria ?? []).map((_, i) => (
                          <Cell key={i} fill={CORES[i % CORES.length]} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any, n: any) => [`${v} profissionais`, n]} />
                      <Legend
                        verticalAlign="bottom"
                        align="center"
                        iconType="circle"
                        wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

              </div>
              <div className="rounded-md border p-4 md:col-span-2">
                <div className="mb-2 text-sm font-medium">Complementação por carga horária</div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashQ.data?.porCargaHoraria ?? []}>
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => fmtBRL(Number(v))} />
                      <Bar dataKey="valor" fill="#16a34a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </TabsContent>

            {/* ------------------------ 4. Tabela principal ------------------------ */}
            <TabsContent value="profissionais" className="space-y-3">
              <PisoDataGrid<LinhaGrid>
                columns={cols}
                rows={rows}
                getRowKey={(r) => r.profissional_id}
                loading={listaQ.isLoading}
                onRowClick={abrirDetalhe}
                selectable
                selected={selecionados}
                onSelectedChange={setSelecionados}
                onVisibleColumnsChange={setColunasVisiveis}
                emptyTitle="Nenhum profissional encontrado"
                emptyDescription="Ajuste os filtros para ver outros resultados."
                toolbar={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportar}
                    disabled={rows.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {selecionados.length > 0 ? "Exportar seleção" : "Exportar"}
                  </Button>
                }
              />
              <Pagination
                page={page}
                pageSize={pageSize}
                total={listaQ.data?.count ?? 0}
                onPageChange={setPage}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setPage(1);
                }}
              />
            </TabsContent>

            {/* --------------------------- Importações --------------------------- */}
            <TabsContent value="importacoes">
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
                <span className="mr-1 text-sm font-medium">Baixar arquivos da competência:</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!competenciaAtiva || gerarMut.isPending}
                  onClick={() => gerarMut.mutate("contratados")}
                >
                  <Download className="mr-2 h-4 w-4" /> Planilha (3)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!competenciaAtiva || gerarMut.isPending}
                  onClick={() => gerarMut.mutate("efetivos")}
                >
                  <Download className="mr-2 h-4 w-4" /> FOPAG
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!competenciaAtiva || gerarMut.isPending}
                  onClick={() => gerarMut.mutate("calculo_piso")}
                >
                  <Download className="mr-2 h-4 w-4" /> Cálculo Piso (modelo oficial)
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!competenciaAtiva || !!baixandoUnidade}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {baixandoUnidade ? "Gerando..." : "Por unidade (arquivos separados)"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-96 w-72 overflow-y-auto">
                    <DropdownMenuLabel>Um arquivo por unidade</DropdownMenuLabel>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Todas as unidades</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => baixarPorUnidade("contratados")}>
                          Planilha (3)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => baixarPorUnidade("efetivos")}>
                          FOPAG
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => baixarPorUnidade("calculo_piso")}>
                          Cálculo Piso
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    {(unidadesQ.data ?? []).map((u) => (
                      <DropdownMenuSub key={u.id}>
                        <DropdownMenuSubTrigger className="truncate">
                          {u.nome}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem
                            onClick={() =>
                              baixarPorUnidade("contratados", { id: u.id, nome: u.nome })
                            }
                          >
                            Planilha (3)
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => baixarPorUnidade("efetivos", { id: u.id, nome: u.nome })}
                          >
                            FOPAG
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              baixarPorUnidade("calculo_piso", { id: u.id, nome: u.nome })
                            }
                          >
                            Cálculo Piso
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {!competenciaAtiva && (
                  <span className="text-xs text-muted-foreground">
                    Selecione uma competência para habilitar os downloads.
                  </span>
                )}
              </div>
              <DataTable<Record<string, unknown>>
                rows={historico}
                getRowKey={(r, i) => String(r.id ?? i)}
                loading={histQ.isLoading}
                emptyTitle="Nenhuma importação registrada"
                emptyDescription="As importações de Piso e FOPAG aparecerão aqui."
                columns={[
                  {
                    key: "arquivo",
                    header: "Arquivo",
                    cell: (r) => String(r.nome_arquivo ?? "—"),
                  },
                  {
                    key: "competencia",
                    header: "Competência",
                    cell: (r) => String(r.competencia ?? "—"),
                  },
                  {
                    key: "data",
                    header: "Data",
                    cell: (r) => formatDateTime(r.data_importacao as string),
                  },
                  {
                    key: "registros",
                    header: "Registros",
                    cell: (r) => String(r.total_registros ?? "—"),
                  },
                  {
                    key: "status",
                    header: "Status",
                    cell: (r) => <Badge variant="secondary">{String(r.status ?? "—")}</Badge>,
                  },
                  {
                    key: "acoes",
                    header: "Baixar",
                    cell: (r) => {
                      const hist = {
                        id: String(r.id ?? ""),
                        nome_arquivo: (r.nome_arquivo as string) ?? null,
                        competencia: (r.competencia as string) ?? null,
                        modelo_planilha_id: (r.modelo_planilha_id as string) ?? null,
                      };
                      return (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={baixandoHist === hist.id || !hist.id}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              {baixandoHist === hist.id ? "Gerando..." : "Baixar"}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Somente esta importação</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => baixarImportacao(hist, "contratados")}
                            >
                              Planilha (3)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => baixarImportacao(hist, "efetivos")}>
                              FOPAG
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => baixarImportacao(hist, "calculo_piso")}
                            >
                              Cálculo Piso
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      );
                    },
                  },
                ]}

              />
            </TabsContent>

            {/* --------------------------- Pendências --------------------------- */}
            <TabsContent value="pendencias">
              {(pendQ.data?.rows.length ?? 0) === 0 ? (
                <EmptyState
                  title="Nenhuma pendência"
                  description="Todas as linhas importadas foram vinculadas com sucesso."
                />
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Tipo</th>
                        <th className="px-3 py-2">Nome no arquivo</th>
                        <th className="px-3 py-2">CPF</th>
                        <th className="px-3 py-2">Detalhe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(pendQ.data?.rows ?? []).map((p: Record<string, unknown>, i: number) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                              {String(p.tipo ?? "").replaceAll("_", " ")}
                            </span>
                          </td>
                          <td className="px-3 py-2">{String(p.nome ?? "—")}</td>
                          <td className="px-3 py-2 font-mono">{String(p.cpf ?? "—")}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {String(p.detalhe ?? "—")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* ---------------------------- Histórico ---------------------------- */}
            <TabsContent value="historico" className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <History className="h-4 w-4" /> Competências já consolidadas. Clique em um
                profissional na aba Profissionais para ver o histórico individual.
              </div>
              {(compQ.data?.competencias ?? []).length === 0 ? (
                <EmptyState
                  title="Nenhuma competência consolidada"
                  description="Importe valores para gerar histórico por competência."
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(compQ.data?.competencias ?? []).map((c) => (
                    <Button
                      key={c}
                      variant={c === competenciaAtiva ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setCompetencia(c);
                        setPage(1);
                      }}
                    >
                      {c}
                    </Button>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ---------------------------- Relatórios ---------------------------- */}
            <TabsContent value="relatorios" className="grid gap-3 md:grid-cols-2">
              <Card className="space-y-2 p-4">
                <div className="text-sm font-medium">Exportação da competência</div>
                <p className="text-sm text-muted-foreground">
                  Gera um CSV com a lista filtrada de profissionais elegíveis e seus valores.
                </p>
                <Button variant="outline" size="sm" onClick={exportar} disabled={!rows.length}>
                  <Download className="mr-2 h-4 w-4" /> Exportar Excel
                </Button>
              </Card>
              <Card className="space-y-2 p-4">
                <div className="text-sm font-medium">Planilha oficial com fórmulas</div>
                <p className="text-sm text-muted-foreground">
                  Reconstrói os modelos oficiais em Excel com fórmulas
                  relativas, linha de totais e extensão automática conforme o número de
                  profissionais da competência {competenciaAtiva ?? "—"}.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!competenciaAtiva || gerarMut.isPending}
                    onClick={() => gerarMut.mutate("contratados")}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Contratados
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!competenciaAtiva || gerarMut.isPending}
                    onClick={() => gerarMut.mutate("efetivos")}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Efetivos (FOPAG)
                  </Button>
                </div>
              </Card>
              <Card className="space-y-2 p-4">
                <div className="text-sm font-medium">Relatórios gerenciais do Piso</div>
                <p className="text-sm text-muted-foreground">
                  Painéis analíticos completos com séries por unidade, categoria e competência.
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link to="/relatorios-piso">
                    <FileBarChart className="mr-2 h-4 w-4" /> Abrir relatórios
                  </Link>
                </Button>
              </Card>
            </TabsContent>


            {/* ---------------------------- Auditoria ---------------------------- */}
            <TabsContent value="auditoria">
              <Card className="mb-4 p-4">
                <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                  <FileBarChart className="h-4 w-4" /> Laudo de auditoria — Planilha oficial do
                  Piso
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Arquivo fiel ao layout de envio (11 colunas, sem fórmulas), chaveado pelo CPF do
                  profissional, com os dados consolidados de efetivos e contratados da competência.
                </p>
                <div className="divide-y rounded-md border">
                  {(consolQ.data?.competencias ?? []).length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">
                      Nenhuma competência consolidada ainda.
                    </div>
                  ) : (
                    (consolQ.data?.competencias ?? []).map((c) => (
                      <div
                        key={`laudo-${c.competencia}`}
                        className="flex flex-wrap items-center justify-between gap-2 p-3"
                      >
                        <div>
                          <div className="text-sm font-medium">
                            PISO DE ENFERMAGEM — {rotuloMesLocal(c.competencia)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {c.competencia} · {c.total} registro(s) · {c.consolidados}{" "}
                            consolidado(s)
                            {c.divergentes ? ` · ${c.divergentes} divergência(s)` : ""}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!!baixandoPiso}
                          onClick={() => baixarPisoEnfermagem(c.competencia)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          {baixandoPiso === c.competencia
                            ? "Gerando..."
                            : `Baixar piso-enfermagem_${rotuloMesLocal(c.competencia)}`}
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4" /> Trilha das operações de importação do módulo.
              </div>

              <DataTable<Record<string, unknown>>
                rows={historico}
                getRowKey={(r, i) => String(r.id ?? i) + "-aud"}
                loading={histQ.isLoading}
                emptyTitle="Sem eventos de auditoria"
                columns={[
                  {
                    key: "data",
                    header: "Data",
                    cell: (r) => formatDateTime(r.data_importacao as string),
                  },
                  {
                    key: "usuario",
                    header: "Usuário",
                    cell: (r) => String(r.usuario_nome ?? r.usuario_id ?? "—"),
                  },
                  {
                    key: "arquivo",
                    header: "Arquivo",
                    cell: (r) => String(r.nome_arquivo ?? "—"),
                  },
                  {
                    key: "status",
                    header: "Status",
                    cell: (r) => <Badge variant="secondary">{String(r.status ?? "—")}</Badge>,
                  },
                  {
                    key: "obs",
                    header: "Observações",
                    cell: (r) => String(r.observacoes ?? r.erros ?? "—"),
                  },
                ]}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      <PisoDetalheSheet linha={detalhe} open={detalheOpen} onOpenChange={setDetalheOpen} />
    </div>
  );
}
