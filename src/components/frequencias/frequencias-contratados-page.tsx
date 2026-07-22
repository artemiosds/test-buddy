import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  listarFolhaContratados,
  salvarFolhaContratados,
  enviarFolhaContratados,
} from "@/lib/frequencias-contratados.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Save, Send, Search, FileSpreadsheet, FileDown, Download,
  Palmtree, HeartPulse, AlertOctagon, Ban, ArrowRightLeft, Filter as FilterIcon,
} from "lucide-react";
import { useCurrentUser, usePermissions } from "@/hooks/use-permissions";
import { useCompetenciaAtiva } from "@/hooks/use-competencia-ativa";
import type { Database } from "@/integrations/supabase/types";
import { gerarExcelFolhaContratados, type ItemContratado } from "@/lib/excel-folha-contratados";
import { gerarFolhaContratadosOficial } from "@/lib/pdf-folha-contratados-oficial";
import { gerarFolhaContratadosModeloCer } from "@/lib/pdf-folha-contratados-modelo-cer";
import { gerarExcelFolhaContratadosModeloCer } from "@/lib/excel-folha-contratados-modelo-cer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useConferenciaProfissionais, mergeConferencia } from "@/hooks/use-conferencia";
import {
  SituacaoResumo, SituacaoFilter, ProfissionalNomeCell, SituacaoBadge,
  ProfissionalEdicaoModal, type SituacaoFilterValue,
} from "@/components/shared/gerencial";
import {
  contarSituacoes, derivarSituacao, type ProfConferencia,
} from "@/lib/situacao-funcional";
import {
  ErpGridProvider, ErpTbody, NumberCell, TextCell,
  KpiFolhaBar, InconsistenciasPanel, frozenLeftMap, type FrozenCol,
} from "@/components/erp-grid";
import {
  FolhaBreadcrumb, ResumoDiasFaltasAtt, useSelectedErpRow,
} from "@/components/frequencias/resumo-dias-faltas-att";

type StatusFreq = Database["public"]["Enums"]["status_frequencia"];

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

type LinhaState = {
  profissional_id: string;
  status: StatusFreq;
  dias_trabalhados: number;
  dias_falta: number;
  atestado: number;
  he_50: number;
  he_100: number;
  adn: number;
  plantoes: number;
  sobreaviso: number;
  incentivo: number;
  observacoes: string;
  _dirty?: boolean;
};

const CAMPOS_NUM = ["dias_trabalhados","dias_falta","atestado","he_50","he_100","adn","plantoes","sobreaviso","incentivo"] as const;

/** Formata dados bancários em uma única linha limpa, sem prefixos duplicados. */
function formatContaBancaria(
  banco?: string | null,
  agencia?: string | null,
  conta?: string | null,
): string {
  const parts: string[] = [];
  if (banco) parts.push(String(banco).trim());
  if (agencia) parts.push(`AG: ${String(agencia).replace(/^\s*AG[:\s]*/i, "").trim()}`);
  if (conta) parts.push(`CC: ${String(conta).replace(/^\s*CC[:\s]*/i, "").trim()}`);
  return parts.length ? parts.join(" | ") : "—";
}

export function FrequenciasContratadosPage() {
  const qc = useQueryClient();
  const { has } = usePermissions();
  const { data: me } = useCurrentUser();
  const { data: compAtiva } = useCompetenciaAtiva();

  const [competenciaId, setCompetenciaId] = useState<string>("");
  const [unidadeId, setUnidadeId] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [cargoFilter, setCargoFilter] = useState<string>("todos");
  const [funcaoFilter, setFuncaoFilter] = useState<string>("todos");
  const [setorFilter, setSetorFilter] = useState<string>("todos");
  const [situacaoFilter, setSituacaoFilter] = useState<SituacaoFilterValue>("todas");
  const [pendFilter, setPendFilter] = useState<
    "todos" | "sem_conta" | "sem_cargo" | "sem_lotacao" | "sem_matricula" | "sem_cpf"
  >("todos");
  const [dossieProf, setDossieProf] = useState<ProfConferencia | null>(null);
  const [dossieOpen, setDossieOpen] = useState(false);

  const { data: cargosOpts } = useQuery({
    queryKey: ["cargos-filter"],
    queryFn: async () => {
      const { data } = await supabase.from("cargos").select("id, nome")
        .is("deleted_at", null).eq("status", "ativa").order("nome");
      return data ?? [];
    },
  });
  const { data: funcoesOpts } = useQuery({
    queryKey: ["funcoes-filter"],
    queryFn: async () => {
      const { data } = await supabase.from("funcoes").select("id, nome")
        .is("deleted_at", null).eq("status", "ativa").order("nome");
      return data ?? [];
    },
  });
  const { data: setoresOpts } = useQuery({
    queryKey: ["setores-filter", unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data } = await supabase.from("setores").select("id, nome")
        .eq("unidade_id", unidadeId).is("deleted_at", null).order("nome");
      return data ?? [];
    },
  });
  useEffect(() => { setSetorFilter("todos"); }, [unidadeId]);

  // Competências
  const { data: competencias } = useQuery({
    queryKey: ["comps-contratados"],
    queryFn: async () => {
      const { data } = await supabase
        .from("competencias")
        .select("id, ano, mes, status")
        .is("deleted_at", null)
        .order("ano", { ascending: false })
        .order("mes", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!competenciaId && compAtiva?.id) setCompetenciaId(compAtiva.id);
    else if (!competenciaId && competencias?.length) setCompetenciaId(competencias[0].id);
  }, [compAtiva, competencias, competenciaId]);

  const compSel = competencias?.find((c) => c.id === competenciaId);
  const compFechada = compSel?.status === "encerrada" || compSel?.status === "arquivada";

  // Unidades visíveis
  const isGestor = !!me?.is_master || !!me?.acesso_todas_unidades;
  const { data: unidades } = useQuery({
    queryKey: ["unidades-contratados", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const q = supabase
        .from("unidades")
        .select("id, nome, sigla, tipo_unidade")
        .is("deleted_at", null)
        .eq("status", "ativa")
        .order("nome");
      const { data } = await q;
      return data ?? [];
    },
  });

  // Se Diretor/Administrativo, força a unidade vinculada
  const { data: minhasUnidades } = useQuery({
    queryKey: ["minhas-unidades", me?.id],
    enabled: !!me && !isGestor,
    queryFn: async () => {
      const { data } = await supabase
        .from("usuario_unidades")
        .select("unidade_id, unidades(id, nome, sigla, tipo_unidade)")
        .eq("usuario_id", me!.id)
        .is("deleted_at", null);
      return (data ?? []).map((r: any) => r.unidades).filter(Boolean);
    },
  });

  useEffect(() => {
    if (unidadeId) return;
    if (!isGestor && minhasUnidades?.length) setUnidadeId(minhasUnidades[0].id);
    else if (isGestor && unidades?.length) setUnidadeId(unidades[0].id);
  }, [isGestor, unidades, minhasUnidades, unidadeId]);

  const unidadesVisiveis = isGestor ? (unidades ?? []) : (minhasUnidades ?? []);
  const unidadeSel = (unidadesVisiveis as any[]).find((u) => u.id === unidadeId);

  // Folha
  const carregar = useServerFn(listarFolhaContratados);
  const { data: folha, isFetching } = useQuery({
    queryKey: ["folha-contratados", competenciaId, unidadeId],
    enabled: !!competenciaId && !!unidadeId,
    queryFn: () => carregar({ data: { competencia_id: competenciaId, unidade_id: unidadeId } }),
  });

  // Estado local editável
  const [linhas, setLinhas] = useState<Record<string, LinhaState>>({});
  useEffect(() => {
    if (!folha) return;
    const next: Record<string, LinhaState> = {};
    for (const item of folha) {
      const l = item.linha;
      next[item.profissional.id] = {
        profissional_id: item.profissional.id,
        status: (l?.status as StatusFreq) ?? "rascunho",
        dias_trabalhados: Number(l?.dias_trabalhados ?? 0),
        dias_falta: Number(l?.dias_falta ?? 0),
        atestado: Number(l?.atestado ?? 0),
        he_50: Number(l?.he_50 ?? 0),
        he_100: Number(l?.he_100 ?? 0),
        adn: Number(l?.adn ?? 0),
        plantoes: Number(l?.plantoes ?? 0),
        sobreaviso: Number(l?.sobreaviso ?? 0),
        incentivo: Number.isFinite(Number(l?.incentivo)) ? Number(l?.incentivo) : 0,
        observacoes: l?.observacoes ?? "",
      };
    }
    setLinhas(next);
  }, [folha]);

  const canEdit =
    !compFechada &&
    has("frequencia.editar");

  function readonlyLinha(l: LinhaState | undefined) {
    if (!l) return true;
    if (!canEdit) return true;
    // Após enviada/aprovada/em análise, campos ficam somente leitura
    return !(l.status === "rascunho" || l.status === "rejeitada");
  }

  function updateCampo(pid: string, campo: keyof LinhaState, valor: number | string) {
    setLinhas((prev) => {
      const cur = prev[pid];
      if (!cur) return prev;
      let v: any = valor;
      if (CAMPOS_NUM.includes(campo as any)) {
        const n = typeof valor === "number" ? valor : Number(valor);
        v = isNaN(n) || n < 0 ? 0 : n;
      }
      return { ...prev, [pid]: { ...cur, [campo]: v, _dirty: true } };
    });
  }

  const salvarFn = useServerFn(salvarFolhaContratados);
  const enviarFn = useServerFn(enviarFolhaContratados);

  const mSalvar = useMutation({
    mutationFn: async () => {
      const dirtyList = Object.values(linhas).filter((l) => l._dirty);
      if (!dirtyList.length) return { ok: true, sem_alteracoes: true };
      return salvarFn({
        data: {
          competencia_id: competenciaId,
          unidade_id: unidadeId,
          linhas: dirtyList.map((l) => ({
            profissional_id: l.profissional_id,
            dias_trabalhados: l.dias_trabalhados,
            dias_falta: l.dias_falta,
            atestado: l.atestado,
            he_50: l.he_50,
            he_100: l.he_100,
            adn: l.adn,
            plantoes: l.plantoes,
            sobreaviso: l.sobreaviso,
            incentivo: l.incentivo,
            observacoes: l.observacoes || null,
          })),
        },
      });
    },
    onSuccess: (r: any) => {
      if (r?.sem_alteracoes) toast.info("Nenhuma alteração para salvar.");
      else toast.success("Rascunho salvo.");
      qc.invalidateQueries({ queryKey: ["folha-contratados", competenciaId, unidadeId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  const mEnviar = useMutation({
    mutationFn: async () => {
      // salva antes se houver alterações
      const dirtyList = Object.values(linhas).filter((l) => l._dirty);
      if (dirtyList.length) {
        await salvarFn({
          data: {
            competencia_id: competenciaId,
            unidade_id: unidadeId,
            linhas: dirtyList.map((l) => ({
              profissional_id: l.profissional_id,
              dias_trabalhados: l.dias_trabalhados,
              dias_falta: l.dias_falta, atestado: l.atestado,
              he_50: l.he_50, he_100: l.he_100, adn: l.adn,
              plantoes: l.plantoes, sobreaviso: l.sobreaviso,
              incentivo: l.incentivo,
              observacoes: l.observacoes || null,
            })),
          },
        });
      }
      return enviarFn({ data: { competencia_id: competenciaId, unidade_id: unidadeId } });
    },
    onSuccess: (r: any) => {
      toast.success(`Enviado para aprovação (${r?.enviadas ?? 0} linhas).`);
      qc.invalidateQueries({ queryKey: ["folha-contratados", competenciaId, unidadeId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao enviar."),
  });

  // Exportação PDF / Excel — só liberadas quando toda a folha estiver aprovada.
  const folhaAprovada = useMemo(() => {
    if (!folha?.length) return false;
    return folha.every((it: any) => it.linha?.status === "aprovada");
  }, [folha]);

  function mapExportItens(): ItemContratado[] {
    // Respeita os filtros aplicados na tela (competência já vem embutida
    // na consulta; cargo/função/setor/situação/busca são aplicados em
    // `filtradas` + `linhasFinais`). Assim, o PDF/Excel exportam somente
    // as linhas visíveis atualmente na tabela.
    const visiveis = linhasFinais.map((x) => x.it);
    return visiveis.map((it: any) => ({
      profissional: {
        matricula: it.profissional.matricula,
        nome: it.profissional.nome,
        cpf: it.profissional.cpf ?? null,
        cargo: it.profissional.cargo,
        setor: it.profissional.setor,
        banco: it.profissional.banco,
        agencia: it.profissional.agencia,
        conta_corrente: it.profissional.conta_corrente,
      },
      linha: it.linha,
    }));
  }

  async function handleExportarExcel() {
    if (!compSel) return;
    try {
      await gerarExcelFolhaContratados({
        competencia: { mes: compSel.mes as number, ano: compSel.ano as number },
        unidadeNome: unidadeSel ? `${unidadeSel.sigla ? unidadeSel.sigla + " — " : ""}${unidadeSel.nome}` : "",
        itens: mapExportItens(),
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar Excel.");
    }
  }

  async function handleExportarPdf() {
    if (!compSel) return;
    try {
      await gerarFolhaContratadosOficial({
        competencia: { mes: compSel.mes as number, ano: compSel.ano as number },
        unidadeNome: unidadeSel ? `${unidadeSel.sigla ? unidadeSel.sigla + " — " : ""}${unidadeSel.nome}` : "",
        itens: mapExportItens(),
        emitidoPor: me?.nome_completo ?? me?.email ?? "—",
        unidadeId: unidadeSel?.id ?? null,
        secretariaId: me?.secretaria_id ?? null,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar PDF.");
    }
  }

  async function handleExportarPdfModeloCer() {
    if (!compSel) return;
    try {
      await gerarFolhaContratadosModeloCer({
        competencia: { mes: compSel.mes as number, ano: compSel.ano as number },
        unidadeNome: unidadeSel ? `${unidadeSel.sigla ? unidadeSel.sigla + " — " : ""}${unidadeSel.nome}` : "",
        itens: mapExportItens(),
        emitidoPor: me?.nome_completo ?? me?.email ?? "—",
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar PDF (Modelo Gestão-SMS).");
    }
  }

  async function handleExportarExcelModeloCer() {
    if (!compSel) return;
    try {
      await gerarExcelFolhaContratadosModeloCer({
        competencia: { mes: compSel.mes as number, ano: compSel.ano as number },
        unidadeNome: unidadeSel ? `${unidadeSel.sigla ? unidadeSel.sigla + " — " : ""}${unidadeSel.nome}` : "",
        itens: mapExportItens(),
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar Excel (Modelo Gestão-SMS).");
    }
  }

  const filtradas = useMemo(() => {
    if (!folha) return [];
    const q = busca.trim().toLowerCase();
    return folha.filter((it: any) => {
      const p = it.profissional;
      if (cargoFilter !== "todos" && p.cargo_id !== cargoFilter) return false;
      if (funcaoFilter !== "todos" && p.funcao_id !== funcaoFilter) return false;
      if (setorFilter !== "todos" && p.setor_id !== setorFilter) return false;
      if (pendFilter !== "todos") {
        const semConta = !p.banco || !p.agencia || !p.conta_corrente;
        if (pendFilter === "sem_conta"     && !semConta)      return false;
        if (pendFilter === "sem_cargo"     && p.cargo)        return false;
        if (pendFilter === "sem_lotacao"   && p.setor)        return false;
        if (pendFilter === "sem_matricula" && p.matricula)    return false;
        if (pendFilter === "sem_cpf"       && p.cpf)          return false;
      }
      if (!q) return true;
      return p.nome.toLowerCase().includes(q)
        || (p.matricula ?? "").toLowerCase().includes(q)
        || (p.cpf ?? "").toLowerCase().includes(q)
        || (p.cargo ?? "").toLowerCase().includes(q);
    });
  }, [folha, busca, cargoFilter, funcaoFilter, setorFilter, pendFilter]);

  const idsPagina = useMemo(
    () => filtradas.map((it: any) => it.profissional.id as string),
    [filtradas],
  );
  const { data: confMap } = useConferenciaProfissionais(idsPagina);

  const linhasConferencia = useMemo(
    () =>
      filtradas.map((it: any) => {
        const base: ProfConferencia = {
          id: it.profissional.id,
          nome: it.profissional.nome,
          matricula: it.profissional.matricula ?? null,
          cpf: it.profissional.cpf ?? null,
          cargo: it.profissional.cargo ?? null,
          setor: it.profissional.setor ?? null,
          banco: it.profissional.banco ?? null,
          agencia: it.profissional.agencia ?? null,
          conta_corrente: it.profissional.conta_corrente ?? null,
          cargo_id: it.profissional.cargo_id ?? null,
          funcao_id: it.profissional.funcao_id ?? null,
          setor_id: it.profissional.setor_id ?? null,
          vinculo: "Contratado",
        };
        return { it, conf: mergeConferencia(base, confMap) };
      }),
    [filtradas, confMap],
  );

  const linhasFinais = useMemo(
    () =>
      situacaoFilter === "todas"
        ? linhasConferencia
        : linhasConferencia.filter((x) => derivarSituacao(x.conf) === situacaoFilter),
    [linhasConferencia, situacaoFilter],
  );

  // Lotação = nome da unidade selecionada, exceto quando a unidade for do
  // tipo UBS ("Atenção Básica") — nesse caso mostramos o setor do
  // profissional. Regra pedida pela SMS: só a Atenção Básica é
  // gerenciada por setor; nas demais a lotação é a própria unidade.
  const tipoUnidade = String((unidadeSel as any)?.tipo_unidade ?? "").toUpperCase();
  const isAtencaoBasica =
    tipoUnidade === "UBS" ||
    tipoUnidade.includes("ATEN") /* ATENÇÃO BÁSICA / ATENCAO BASICA */;
  const lotacaoDe = (conf: ProfConferencia): { label: string; full: string } | null => {
    if (isAtencaoBasica) {
      const full = conf.setor ?? null;
      if (!full) return null;
      const sigla = (conf as any).setor_sigla ?? null;
      return { label: sigla || full, full };
    }
    const uNome = (unidadeSel as any)?.nome ?? conf.setor ?? null;
    if (!uNome) return null;
    const uSigla = (unidadeSel as any)?.sigla ?? null;
    return { label: uSigla || uNome, full: uNome };
  };

  const rowsConf = useMemo(() => linhasConferencia.map((x) => x.conf), [linhasConferencia]);

  function openDossie(p: ProfConferencia) {
    setDossieProf(p);
    setDossieOpen(true);
  }

  if (!has("frequencia.visualizar")) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-2">Acesso negado</h1>
        <p className="text-muted-foreground">Você não tem permissão para visualizar frequências.</p>
      </div>
    );
  }

  /* ------- ERP grid derivados de UI ------- */
  const FROZEN: FrozenCol[] = [
    { key: "num",       label: "Nº",           width: 40  },
    { key: "matricula", label: "Matrícula",    width: 96  },
    { key: "nome",      label: "Nome",         width: 240 },
    { key: "cpf",       label: "CPF",          width: 120 },
  ];
  const L = frozenLeftMap(FROZEN);
  const colKeysAll = useMemo(() => [...CAMPOS_NUM] as string[], []);
  const rowIdsAll = useMemo(
    () => linhasFinais.map((x: any) => x.it.profissional.id as string),
    [linhasFinais],
  );
  // 3 (Nº/Matrícula/Nome) + CPF + Cargo + Lotação
  // + CAMPOS_NUM (Dias, Faltas, ATT, HE50, HE100, ADN, Plantões, Sobreavisos, Incentivo)
  // + Conta + Observações + Status
  const colCount = 3 + 3 + CAMPOS_NUM.length + 3;

  const totCampo = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const k of colKeysAll) acc[k] = 0;
    for (const { it } of linhasFinais) {
      const l = linhas[it.profissional.id]; if (!l) continue;
      for (const k of colKeysAll) {
        const v = Number((l as any)[k] ?? 0);
        if (Number.isFinite(v)) acc[k] += v;
      }
    }
    return acc;
  }, [linhasFinais, linhas, colKeysAll]);

  const kpi = useMemo(() => {
    const sit = contarSituacoes(rowsConf);
    return {
      total: rowsConf.length,
      ativos: sit.ativos,
      ferias: sit.ferias,
      licenca: sit.licenca,
      afastados: sit.afastados,
      pendencias: sit.pendencias,
      naoElegiveis: sit.nao_elegiveis ?? 0,
      totalHE50: totCampo.he_50 ?? 0,
      totalHE100: totCampo.he_100 ?? 0,
      totalPlantoes: totCampo.plantoes ?? 0,
      totalFaltas: totCampo.dias_falta ?? 0,
    };
  }, [rowsConf, totCampo]);

  const handlePaste = useCallback(
    (rowId: string, colKey: string, matrix: string[][]) => {
      const rStart = rowIdsAll.indexOf(rowId);
      const cStart = colKeysAll.indexOf(colKey);
      if (rStart < 0 || cStart < 0) return;
      setLinhas((prev) => {
        const next = { ...prev };
        let touched = 0;
        matrix.forEach((row, dr) => {
          row.forEach((cell, dc) => {
            const rId = rowIdsAll[rStart + dr];
            const cKey = colKeysAll[cStart + dc];
            if (!rId || !cKey) return;
            const cur = next[rId]; if (!cur) return;
            const raw = String(cell ?? "").trim().replace(/\./g, "").replace(",", ".");
            const n = Number(raw.replace(/[^\d.-]/g, ""));
            if (!Number.isFinite(n)) return;
            next[rId] = { ...cur, [cKey]: n, _dirty: true };
            touched++;
          });
        });
        if (touched) toast.success(`${touched} valor(es) colado(s).`);
        return next;
      });
    },
    [rowIdsAll, colKeysAll],
  );

  const validateFalta   = (v: number) => (v > 31 ? "Faltas acima de 31 dias" : null);
  const validateHoras   = (v: number) => (v > 400 ? "Valor incomum (> 400h)" : null);
  const validateGeneric = (v: number) => (v < 0 ? "Valor negativo" : null);

  function focarLinha(rowId: string) {
    const tr = document.querySelector<HTMLTableRowElement>(
      `.erp-grid tr[data-row-id="${rowId.replace(/"/g, "")}"]`,
    );
    tr?.scrollIntoView({ block: "center", behavior: "smooth" });
    tr?.querySelector<HTMLInputElement>(".erp-cell-input")?.focus();
  }

  const [selectedRowId] = useSelectedErpRow();

  /** Ícone antes do nome conforme situação funcional. */
  function IconeSituacao({ situ }: { situ: string }) {
    const cls = "h-3.5 w-3.5 shrink-0";
    if (situ === "ferias")    return <Palmtree     className={cn(cls, "text-info")} />;
    if (situ === "licenca")   return <HeartPulse   className={cn(cls, "text-warning-soft-foreground")} />;
    if (situ === "afastado")  return <AlertOctagon className={cn(cls, "text-destructive")} />;
    if (situ === "cedido")    return <ArrowRightLeft className={cn(cls, "text-warning-soft-foreground")} />;
    if (situ === "desligado" || situ === "inativo")
      return <Ban className={cn(cls, "text-muted-foreground")} />;
    return null;
  }

  const PEND_OPTS: Array<{ id: typeof pendFilter; label: string }> = [
    { id: "todos",         label: "Sem pendências" },
    { id: "sem_conta",     label: "Sem conta bancária" },
    { id: "sem_cargo",     label: "Sem cargo" },
    { id: "sem_lotacao",   label: "Sem lotação" },
    { id: "sem_matricula", label: "Sem matrícula" },
    { id: "sem_cpf",       label: "Sem CPF" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <FolhaBreadcrumb current="Folha Pagamento — Contratados" />
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">Frequência — Contratados</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Folha de contratados no formato HMO — uma linha por profissional, com dados bancários para conferência da folha de pagamento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => mSalvar.mutate()}
            disabled={!canEdit || mSalvar.isPending}
          >
            <Save className="mr-1.5 h-4 w-4" /> Salvar rascunho
          </Button>
          <Button
            onClick={() => mEnviar.mutate()}
            disabled={!canEdit || !has("frequencia.enviar") || mEnviar.isPending || !folha?.length}
          >
            <Send className="mr-1.5 h-4 w-4" /> Enviar para aprovação
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="secondary"
                    onClick={handleExportarPdf}
                    disabled={!folhaAprovada}
                  >
                    <FileDown className="mr-1.5 h-4 w-4" /> PDF Oficial
                  </Button>
                </span>
              </TooltipTrigger>
              {!folhaAprovada && (
                <TooltipContent>Disponível somente após aprovação</TooltipContent>
              )}
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    onClick={handleExportarExcel}
                    disabled={!folhaAprovada}
                  >
                    <Download className="mr-1.5 h-4 w-4" /> Exportar Excel
                  </Button>
                </span>
              </TooltipTrigger>
              {!folhaAprovada && (
                <TooltipContent>Disponível somente após aprovação</TooltipContent>
              )}
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="secondary"
                    onClick={handleExportarPdfModeloCer}
                  >
                    <FileDown className="mr-1.5 h-4 w-4" /> PDF Modelo Gestão-SMS
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Réplica do modelo oficial da SMS (com brasões)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    onClick={handleExportarExcelModeloCer}
                  >
                    <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Excel Modelo Gestão-SMS
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Réplica do modelo oficial da SMS (com brasões)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground">Competência</label>
          <Select value={competenciaId} onValueChange={setCompetenciaId}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {competencias?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {MESES[(c.mes ?? 1) - 1]}/{c.ano}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Unidade</label>
          {isGestor ? (
            <Select value={unidadeId} onValueChange={setUnidadeId}>
              <SelectTrigger><SelectValue placeholder="Selecionar unidade" /></SelectTrigger>
              <SelectContent>
                {unidadesVisiveis.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.sigla ? `${u.sigla} — ` : ""}{u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-10 flex items-center px-3 rounded-md border bg-muted/40 text-sm">
              {unidadesVisiveis[0]
                ? `${unidadesVisiveis[0].sigla ? unidadesVisiveis[0].sigla + " — " : ""}${unidadesVisiveis[0].nome}`
                : "Nenhuma unidade vinculada"}
            </div>
          )}
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Buscar</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, matrícula ou cargo" className="pl-8" />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Cargo</label>
          <Select value={cargoFilter} onValueChange={setCargoFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {cargosOpts?.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Função</label>
          <Select value={funcaoFilter} onValueChange={setFuncaoFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {funcoesOpts?.map((f: any) => (
                <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Setor</label>
          <Select value={setorFilter} onValueChange={setSetorFilter} disabled={!unidadeId}>
            <SelectTrigger><SelectValue placeholder={unidadeId ? "Todos" : "Selecione uma unidade"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {setoresOpts?.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {compFechada && (
        <div className="rounded-md border border-warning/40 bg-warning-soft text-warning-soft-foreground text-sm px-3 py-2">
          Competência encerrada — folha em modo somente leitura.
        </div>
      )}

      <KpiFolhaBar k={kpi} />
      <ResumoDiasFaltasAtt
        totais={{
          dias: totCampo.dias_trabalhados ?? 0,
          faltas: totCampo.dias_falta ?? 0,
          att: totCampo.atestado ?? 0,
        }}
        selecionado={(() => {
          if (!selectedRowId) return null;
          const l = linhas[selectedRowId];
          const p = rowsConf.find((r) => r.id === selectedRowId);
          if (!l || !p) return null;
          return {
            nome: p.nome ?? "—",
            valores: {
              dias: Number(l.dias_trabalhados ?? 0),
              faltas: Number(l.dias_falta ?? 0),
              att: Number(l.atestado ?? 0),
            },
          };
        })()}
      />
      <div className="space-y-2 rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <InconsistenciasPanel rows={rowsConf} onGoto={focarLinha} />
        </div>
        <SituacaoFilter value={situacaoFilter} onChange={setSituacaoFilter} />
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterIcon className="mr-0.5 h-3.5 w-3.5 text-muted-foreground" />
          {PEND_OPTS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setPendFilter(o.id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs ring-1 transition",
                pendFilter === o.id
                  ? "bg-primary text-primary-foreground ring-primary"
                  : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="erp-grid">
        <ErpGridProvider rowIds={rowIdsAll} colKeys={colKeysAll} onPaste={handlePaste}>
          <table>
            <thead>
              <tr>
                <th className="erp-sticky" style={{ width: 40, textAlign: "center", left: L.num }}>Nº</th>
                <th className="erp-sticky" style={{ width: 96, textAlign: "center", left: L.matricula }}>Matrícula</th>
                <th className="erp-sticky" style={{ width: 240, textAlign: "left", left: L.nome }}>Nome</th>
                <th className="erp-sticky erp-sticky-last" style={{ textAlign: "center", width: 120, left: L.cpf }}>CPF</th>
                <th style={{ textAlign: "left", minWidth: 140 }}>Cargo</th>
                <th style={{ textAlign: "left", minWidth: 140 }}>Lotação</th>
                <th style={{ textAlign: "center", width: 48 }}>Dias</th>
                <th style={{ textAlign: "center", width: 48 }}>Faltas</th>
                <th style={{ textAlign: "center", width: 48 }}>ATT</th>
                <th style={{ textAlign: "center", width: 48 }}>HE 50%</th>
                <th style={{ textAlign: "center", width: 48 }}>HE 100%</th>
                <th style={{ textAlign: "center", width: 48 }}>ADN</th>
                <th style={{ textAlign: "center", width: 48 }}>Plantões</th>
                <th style={{ textAlign: "center", width: 48 }}>Sobreavisos</th>
                <th style={{ textAlign: "center", width: 48 }}>Incentivo</th>
                <th style={{ textAlign: "left", minWidth: 200, whiteSpace: "nowrap" }}>Conta</th>
                <th style={{ textAlign: "center", width: 96 }}>Observações</th>
                <th style={{ textAlign: "center", width: 110 }}>Status</th>
              </tr>
            </thead>
            <ErpTbody>
              {isFetching && (
                <tr><td colSpan={colCount} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr>
              )}
              {!isFetching && linhasFinais.length === 0 && (
                <tr><td colSpan={colCount} className="px-3 py-6 text-center text-muted-foreground">
                  Nenhum profissional contratado nesta unidade.
                </td></tr>
              )}
              {linhasFinais.map(({ it, conf }, idx) => {
                const p = it.profissional;
                const l = linhas[p.id];
                if (!l) return null;
                const ro = readonlyLinha(l);
                const situ = derivarSituacao(conf);
                const semConta = !p.banco && !p.agencia && !p.conta_corrente;
                const semContaConf =
                  !conf.banco && !conf.agencia && !conf.conta_corrente;
                return (
                  <tr key={p.id} data-row-id={p.id} data-situacao={situ}>
                    <td
                      className="erp-sticky text-center text-muted-foreground font-mono tabular-nums"
                      style={{ width: 40, left: L.num }}
                    >
                      {idx + 1}
                    </td>
                    <td className="erp-sticky text-center font-mono" style={{ width: 96, left: L.matricula }}>
                      {p.matricula ?? "—"}
                    </td>
                    <td className="erp-sticky font-medium text-slate-900" style={{ width: 240, left: L.nome }}>
                      <div className="flex items-center gap-1.5">
                        <IconeSituacao situ={situ} />
                        <div className="min-w-0 flex-1 truncate">
                          <ProfissionalNomeCell prof={conf} onOpenDossie={openDossie} />
                        </div>
                      </div>
                    </td>
                    <td className="erp-sticky erp-sticky-last text-center text-muted-foreground font-mono" style={{ width: 120, left: L.cpf }}>{p.cpf ?? "—"}</td>
                    <td className="text-slate-700 truncate" style={{ maxWidth: 200 }} title={p.cargo ?? undefined}>{p.cargo ?? "—"}</td>
                    {(() => {
                      const lot = lotacaoDe(conf);
                      return (
                        <td className="text-slate-700 truncate" style={{ maxWidth: 200 }} title={lot?.full ?? undefined}>{lot?.label ?? "—"}</td>
                      );
                    })()}
                    {CAMPOS_NUM.map((c) => {
                      const isDias  = c === "dias_trabalhados";
                      const isFalta = c === "dias_falta";
                      const isHora  = c === "he_50" || c === "he_100" || c === "adn";
                      return (
                        <td key={c} className="text-center font-mono">
                          <NumberCell
                            rowId={p.id} colKey={c}
                            value={(() => { const v = Number((l as any)[c] ?? 0); return Number.isFinite(v) ? v : 0; })()}
                            disabled={ro}
                            decimals={0}
                            validate={isDias ? validateFalta : isFalta ? validateFalta : isHora ? validateHoras : validateGeneric}
                            onChange={(v) => updateCampo(p.id, c, v)}
                          />
                        </td>
                      );
                    })}
                    <td
                      className={cn(
                        "whitespace-nowrap text-[12px]",
                        semContaConf ? "text-destructive" : "text-slate-700",
                      )}
                      title={semContaConf ? undefined : formatContaBancaria(conf.banco, conf.agencia, conf.conta_corrente)}
                    >
                      {semContaConf ? "—" : formatContaBancaria(conf.banco, conf.agencia, conf.conta_corrente)}
                    </td>
                    <td className="text-center">
                      <TextCell
                        rowId={p.id}
                        value={l.observacoes ?? ""}
                        disabled={ro}
                        onChange={(v) => updateCampo(p.id, "observacoes", v)}
                        placeholder="—"
                      />
                    </td>
                    <td className="text-center">
                      <StatusBadge domain="frequencia" value={l.status ?? "rascunho"} />
                    </td>
                  </tr>
                );
              })}
            </ErpTbody>
            <tfoot>
              <tr>
                <td className="erp-sticky" style={{ width: 40, left: L.num }}></td>
                <td className="erp-sticky" style={{ width: 96, left: L.matricula }}></td>
                <td className="erp-sticky" style={{ width: 240, left: L.nome }}>Totais</td>
                <td className="erp-sticky erp-sticky-last" style={{ width: 120, left: L.cpf }}></td>
                <td colSpan={2}></td>
                {CAMPOS_NUM.map((c) => (
                  <td key={c} className="text-center font-mono">
                    {(totCampo[c] ?? 0).toLocaleString("pt-BR")}
                  </td>
                ))}
                <td></td>
                <td></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </ErpGridProvider>
      </div>

      <p className="text-xs text-muted-foreground">
        A coluna <strong>Conta</strong> (Banco / AG / CC) e <strong>CPF</strong> são somente leitura —
        são atualizados no cadastro do profissional. A coluna <strong>Dias</strong> vem zerada
        por padrão e deve ser preenchida manualmente pelo Diretor/Gestor (0 a 31).
      </p>

      <ProfissionalEdicaoModal
        prof={dossieProf}
        linha={dossieProf ? linhas[dossieProf.id] : undefined}
        open={dossieOpen}
        onOpenChange={setDossieOpen}
        canEdit={canEdit}
        statusValue={dossieProf ? linhas[dossieProf.id]?.status : undefined}
        onStatusChange={(v) => {
          if (!dossieProf) return;
          updateCampo(dossieProf.id, "status" as keyof LinhaState, v);
        }}
        campos={[
          { key: "dias_trabalhados", label: "Dias Trabalhados", min: 0, max: 31 },
          { key: "dias_falta", label: "Faltas", min: 0, max: 31 },
          { key: "atestado", label: "Atestado (ATT)", min: 0, max: 31 },
          { key: "he_50", label: "HE 50%" },
          { key: "he_100", label: "HE 100%" },
          { key: "adn", label: "Adic. Noturno" },
          { key: "plantoes", label: "Plantões" },
          { key: "sobreaviso", label: "Sobreaviso" },
          { key: "incentivo", label: "Incentivo" },
        ]}
        onChangeCampo={(campo, valor) => {
          if (!dossieProf) return;
          updateCampo(dossieProf.id, campo as keyof LinhaState, valor);
        }}
        onSave={async () => {
          await mSalvar.mutateAsync();
          setDossieOpen(false);
        }}
        saving={mSalvar.isPending}
      />
    </div>
  );
}
