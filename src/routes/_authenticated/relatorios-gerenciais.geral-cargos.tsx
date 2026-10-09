import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, FileType, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KpiCard } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { BotaoRelatorioAbnt } from "@/components/relatorios-gerenciais/botao-relatorio-abnt";
import {
  getGeralCargos,
  type AfastamentoPorLocal,
  type AgrupamentoCargos,
  type LinhaCargo,
  type ModoGeralCargos,
} from "@/lib/geral-cargos";
import { exportarGeralCargosXlsx } from "@/lib/geral-cargos-export";
import { exportarGeralCargosDocx } from "@/lib/geral-cargos-docx";
import { gerarParecerGeralCargos, parecerReserva } from "@/lib/geral-cargos-parecer.functions";
import { listarDePara } from "@/lib/cargo-categorias";
import {
  listarDeParaFuncoes,
  parseDeParaFuncoes,
  type DeParaFuncoes,
} from "@/lib/funcao-categorias";
import { usePermissions } from "@/hooks/use-permissions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ListChecks } from "lucide-react";

const BLOCOS_OPC = [
  { k: "unidades", l: "Servidores por unidade" },
  { k: "cargos", l: "Servidores por cargo" },
  { k: "funcoes", l: "Servidores por função" },
  { k: "medicos", l: "Quadro médico" },
  { k: "cruzamento", l: "Composição de cargos por unidade" },
  { k: "setores", l: "Setores por unidade" },
  { k: "afastamentos", l: "Afastamentos e ausências" },
] as const;


export const Route = createFileRoute("/_authenticated/relatorios-gerenciais/geral-cargos")({
  errorComponent: ErrorComponent,
  component: GeralCargosPage,
});

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function useCompetencias() {
  return useQuery({
    queryKey: ["geral-cargos", "competencias"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competencias")
        .select("id, mes, ano")
        .is("deleted_at", null)
        .order("ano", { ascending: false })
        .order("mes", { ascending: false })
        .limit(36);
      if (error) throw error;
      return (data ?? []).map((c) => ({
        id: c.id,
        label: `${MESES[(c.mes ?? 1) - 1]}/${c.ano}`,
      }));
    },
  });
}

function TabelaAfastLocal({
  titulo,
  colLocal,
  linhas,
  nota,
}: {
  titulo: string;
  colLocal: string;
  linhas: AfastamentoPorLocal[];
  nota?: string;
}) {
  const total = linhas.reduce((s, l) => s + l.qtd, 0);
  const pctLocal = (q: number) =>
    total > 0 ? `${((q / total) * 100).toFixed(1).replace(".", ",")}%` : "—";

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h2>
      <div className="overflow-auto rounded-md border bg-card">
        <table className="w-full table-auto text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-2">{colLocal}</th>
              <th className="p-2 text-right">Qtd</th>
              <th className="p-2 text-right">%</th>
              <th className="p-2">Principais tipos</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <EmptyState
                    title="Nenhum afastamento registrado"
                    description="Todos os cadastros estão dentro dos ativos."
                  />
                </td>
              </tr>
            )}
            {linhas.map((l) => (
              <tr key={l.chave} className="border-t">
                <td className="p-2 font-medium">{l.nome}</td>
                <td className="p-2 text-right tabular-nums">{l.qtd}</td>
                <td className="p-2 text-right tabular-nums">{pctLocal(l.qtd)}</td>
                <td className="p-2 text-xs text-muted-foreground">{l.tipos.join(" · ") || "—"}</td>
              </tr>
            ))}
            {linhas.length > 0 && (
              <tr className="border-t bg-muted/30 font-semibold">
                <td className="p-2">TOTAL ({linhas.length})</td>
                <td className="p-2 text-right tabular-nums">{total}</td>
                <td className="p-2 text-right tabular-nums">100,0%</td>
                <td className="p-2" />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {nota && <p className="text-xs text-muted-foreground">{nota}</p>}
    </section>
  );
}

function TabelaCargos({ linhas, titulo, coluna = "Nome do cargo" }: { linhas: LinhaCargo[]; titulo: string; coluna?: string }) {
  const tot = useMemo(
    () => ({
      efetivos: linhas.reduce((a, l) => a + l.efetivos, 0),
      prestadores: linhas.reduce((a, l) => a + l.prestadores, 0),
      ativos: linhas.reduce((a, l) => a + l.ativos, 0),
      disponivel: linhas.reduce((a, l) => a + l.disponivel, 0),
      total: linhas.reduce((a, l) => a + l.total, 0),
    }),
    [linhas],
  );

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h2>
      <div className="overflow-auto rounded-md border bg-card">
        <table className="w-full table-auto text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-2">{coluna}</th>
              <th className="p-2 text-right">Efetivos</th>
              <th className="p-2 text-right">Prestadores</th>
              <th className="p-2 text-right">Ativos</th>
              <th className="p-2 text-right">Disponível</th>
              <th className="p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    title="Nenhum cargo encontrado"
                    description="Ajuste o modo ou o agrupamento."
                  />
                </td>
              </tr>
            )}
            {linhas.map((l) => (
              <tr key={l.chave} className="border-t">
                <td className="p-2 font-medium">{l.nome}</td>
                <td className="p-2 text-right tabular-nums">{l.efetivos}</td>
                <td className="p-2 text-right tabular-nums">{l.prestadores}</td>
                <td className="p-2 text-right tabular-nums">{l.ativos}</td>
                <td className="p-2 text-right tabular-nums">{l.disponivel}</td>
                <td className="p-2 text-right tabular-nums">{l.total}</td>
              </tr>
            ))}
            {linhas.length > 0 && (
              <tr className="border-t bg-muted/30 font-semibold">
                <td className="p-2">TOTAL ({linhas.length})</td>
                <td className="p-2 text-right tabular-nums">{tot.efetivos}</td>
                <td className="p-2 text-right tabular-nums">{tot.prestadores}</td>
                <td className="p-2 text-right tabular-nums">{tot.ativos}</td>
                <td className="p-2 text-right tabular-nums">{tot.disponivel}</td>
                <td className="p-2 text-right tabular-nums">{tot.total}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Manutenção do De-Para de funções — as equivalências usadas quando
 * "categoria consolidada" está ativa. Grava em
 * `municipio_config.parametros.funcoes_depara`, junto dos demais parâmetros
 * (não sobrescreve folha financeira, prazos nem assinatura de PDF).
 */
function DeParaFuncoesEditor() {
  const qc = useQueryClient();
  const { has } = usePermissions();
  const podeEditar = has("configuracao.editar");
  const [rascunho, setRascunho] = useState<DeParaFuncoes>({});
  const [salvando, setSalvando] = useState(false);

  const { data: config } = useQuery({
    queryKey: ["municipio-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipio_config")
        .select("id, parametros")
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: cadastro = [] } = useQuery({
    queryKey: ["funcoes-cadastro-depara"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcoes")
        .select("id, nome")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; nome: string }>;
    },
  });

  const salvo = useMemo(() => parseDeParaFuncoes(config?.parametros), [config]);
  useEffect(() => setRascunho(salvo), [salvo]);

  /** Funções cadastradas + qualquer equivalência salva (nada se perde). */
  const nomes = useMemo(() => {
    const conjunto = new Set(cadastro.map((f) => f.nome));
    for (const k of Object.keys(salvo)) conjunto.add(k);
    return Array.from(conjunto).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [cadastro, salvo]);

  const categorias = useMemo(
    () =>
      Array.from(new Set(Object.values(rascunho).map((v) => v.trim()).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, "pt-BR"),
      ),
    [rascunho],
  );
  const agrupadas = useMemo(() => listarDeParaFuncoes(rascunho), [rascunho]);
  const equivalencias = Object.keys(salvo).length;

  async function salvar() {
    if (!config?.id) {
      toast.error("Abra a Configuração Municipal antes de salvar as equivalências.");
      return;
    }
    const limpo: DeParaFuncoes = {};
    for (const [nome, categoria] of Object.entries(rascunho)) {
      const c = (categoria ?? "").trim();
      if (c) limpo[nome] = c;
    }
    setSalvando(true);
    try {
      const parametros = {
        ...(((config.parametros ?? {}) as Record<string, unknown>) || {}),
        funcoes_depara: limpo,
      };
      const { error } = await supabase
        .from("municipio_config")
        .update({ parametros: parametros as unknown as never })
        .eq("id", config.id);
      if (error) throw error;
      toast.success("De-Para de funções salvo.");
      qc.invalidateQueries({ queryKey: ["municipio-config"] });
      qc.invalidateQueries({ queryKey: ["geral-cargos"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar o De-Para de funções.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <details className="rounded-md border bg-card p-3">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        De-Para de funções ({agrupadas.length} categorias consolidadas · {equivalencias}{" "}
        equivalências salvas)
      </summary>

      {podeEditar ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Escreva o nome da categoria em cada função. Nomes iguais se somam na mesma linha da
            lista; deixe em branco para a função continuar com o próprio nome.
          </p>
          <div className="max-h-[420px] overflow-auto rounded-md border">
            <table className="w-full table-auto text-sm">
              <thead className="sticky top-0 bg-muted/40 text-left">
                <tr>
                  <th className="p-2">Função cadastrada</th>
                  <th className="p-2 w-[320px]">Categoria consolidada</th>
                </tr>
              </thead>
              <tbody>
                {nomes.length === 0 && (
                  <tr>
                    <td colSpan={2} className="p-3 text-center text-muted-foreground">
                      Nenhuma função cadastrada.
                    </td>
                  </tr>
                )}
                {nomes.map((nome) => (
                  <tr key={nome} className="border-t">
                    <td className="p-2 font-medium">{nome}</td>
                    <td className="p-2">
                      <Input
                        list="depara-funcoes-categorias"
                        value={rascunho[nome] ?? ""}
                        placeholder="manter nome próprio"
                        className="h-8 text-sm"
                        onChange={(e) =>
                          setRascunho((prev) => ({ ...prev, [nome]: e.target.value }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <datalist id="depara-funcoes-categorias">
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => void salvar()} disabled={salvando}>
              {salvando ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              Salvar equivalências
            </Button>
            <span className="text-xs text-muted-foreground">
              Nada é alterado no cadastro dos profissionais.
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-3 overflow-auto">
          <table className="w-full table-auto text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-2">Categoria consolidada</th>
                <th className="p-2">Funções cadastradas</th>
              </tr>
            </thead>
            <tbody>
              {agrupadas.length === 0 && (
                <tr>
                  <td colSpan={2} className="p-3 text-center text-muted-foreground">
                    Nenhuma equivalência cadastrada — cada função aparece pelo próprio nome.
                  </td>
                </tr>
              )}
              {agrupadas.map((g) => (
                <tr key={g.categoria} className="border-t">
                  <td className="p-2 font-medium">{g.categoria}</td>
                  <td className="p-2 text-xs">{g.funcoes.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        A consolidação é apenas de leitura: a função cadastrada de cada profissional permanece
        exatamente como está no cadastro.
      </p>
    </details>
  );
}

function GeralCargosPage() {
  const [modo, setModo] = useState<ModoGeralCargos>("ativos");
  const [agrupamento, setAgrupamento] = useState<AgrupamentoCargos>("categoria");
  const [sempreRecente, setSempreRecente] = useState(true);
  const [competenciaId, setCompetenciaId] = useState<string | null>(null);
  const [gerandoWord, setGerandoWord] = useState(false);
  const [blocosSel, setBlocosSel] = useState<Set<string>>(
    () => new Set(BLOCOS_OPC.map((b) => b.k)),
  );
  const inclui = (k: string) => blocosSel.has(k);
  const alternarBloco = (k: string) =>
    setBlocosSel((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  /** Dados filtrados pelos blocos escolhidos (para o Word). */
  const dadosSel = () => {
    const d = data!;
    return {
      ...d,
      unidades: inclui("unidades") ? d.unidades : [],
      cargos: inclui("cargos") ? d.cargos : [],
      funcoes: inclui("funcoes") ? d.funcoes : [],
      medicos: inclui("medicos") ? d.medicos : [],
      cruzamento: inclui("cruzamento") ? d.cruzamento : [],
      setoresPorUnidade: inclui("setores") ? d.setoresPorUnidade : [],
      afastamentos: inclui("afastamentos") ? d.afastamentos : [],
      afastamentosPorUnidade: inclui("afastamentos") ? d.afastamentosPorUnidade : [],
      afastamentosPorSetor: inclui("afastamentos") ? d.afastamentosPorSetor : [],
    };
  };


  const { data: competencias = [] } = useCompetencias();
  const competencia = sempreRecente
    ? (competencias[0]?.label ?? "Cadastro atual")
    : (competencias.find((c) => c.id === competenciaId)?.label ??
      competencias[0]?.label ??
      "Cadastro atual");

  const { data, isLoading } = useQuery({
    queryKey: ["geral-cargos", modo, agrupamento],
    queryFn: () => getGeralCargos(modo, agrupamento),
    staleTime: 60_000,
  });

  const dePara = useMemo(() => listarDePara(), []);
  const agrupLabel = agrupamento === "categoria" ? "categoria consolidada" : "cargo exato";
  const funcaoLabel = agrupamento === "categoria" ? "categoria consolidada" : "função exata";

  const escopoLabel =
    modo === "ativos"
      ? "Escopo: Somente Ativos (ativo + férias + licença prêmio)"
      : "Escopo: Geral (Quadro Completo)";

  const ASSINATURA = {
    nome: "Secretário(a) Municipal de Saúde",
    cargo: "Secretário(a) Municipal de Saúde",
    orgao: "Secretaria Municipal de Saúde de Oriximiná",
  };
  const CARIMBO = {
    nome: "Thays Mara Oliveira Farias",
    cargo: "Diretora Administrativa",
    decreto: "Decreto nº 045/2025",
  };

  const pedirParecer = useServerFn(gerarParecerGeralCargos);

  async function obterParecer() {
    const d = data!;
    const payload = {
      escopo: modo,
      competencia,
      total: d.total,
      ativos: d.ativos,
      disponivel: d.disponivel,
      efetivos: d.efetivosAtivos,
      prestadores: d.prestadoresAtivos,
      prestadoresServico: d.prestadoresServicoAtivos,
      comissionados: d.comissionadosAtivos,
      terceirizados: d.terceirizadosAtivos,
      afastamentos: d.afastamentos.map((a) => ({
        label: a.label,
        qtd: a.qtd,
        cargos: a.cargos.slice(0, 6),
      })),
      afastamentosUnidades: d.afastamentosPorUnidade
        .slice(0, 5)
        .map((u) => ({ nome: u.nome, qtd: u.qtd })),
      topCargos: [...d.cargos]
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map((c) => ({ nome: c.nome, total: c.total })),
    };
    try {
      const r = await pedirParecer({ data: payload });
      return {
        titulo: "Parecer Técnico Gerencial (Quadro da Força de Trabalho)",
        paragrafos: r.paragrafos,
        ...(r.ia
          ? { rodape: "Parecer elaborado com apoio de inteligência artificial sobre os dados consolidados desta emissão." }
          : { rodape: r.aviso ?? "Parecer não assinado por IA nesta emissão." }),
      };
    } catch {
      return {
        titulo: "Parecer Técnico Gerencial (Quadro da Força de Trabalho)",
        paragrafos: parecerReserva(payload),
        rodape: "Parecer não assinado por IA nesta emissão (serviço indisponível).",
      };
    }
  }

  const pct = (parte: number, todo: number) =>
    todo > 0 ? `${((parte / todo) * 100).toFixed(1).replace(".", ",")}%` : "—";

  function kpisRelatorio() {
    const d = data!;
    const base = [
      { label: "Ativos", valor: d.ativos },
      { label: "Disponível para escala", valor: d.disponivel },
      { label: "Efetivos", valor: d.efetivosAtivos },
      { label: "Prestadores/Contratados", valor: d.prestadoresAtivos },
      { label: "% de disponibilidade", valor: pct(d.disponivel, d.ativos) },
    ];
    return modo === "ativos" ? base : [{ label: "Total de cadastros", valor: d.total }, ...base];
  }

  /** Resumo executivo determinístico (sumarização, sem IA). */
  function resumoExecutivo() {
    const d = data!;
    const maiorUnidade = d.unidades[0];
    const maiorCargo = [...d.cargos, ...d.medicos].sort((a, b) => b.total - a.total)[0];
    const proporcao = [...d.unidades]
      .filter((u) => u.total >= 10)
      .sort((a, b) => b.prestadores / b.total - a.prestadores / a.total)[0];
    const partes: string[] = [];
    partes.push(
      `${modo === "ativos" ? "Somente Ativos" : "Quadro completo"}: ${d.ativos.toLocaleString("pt-BR")} profissionais ativos, ` +
        `dos quais ${d.disponivel.toLocaleString("pt-BR")} estão disponíveis para escala (${pct(d.disponivel, d.ativos)} de disponibilidade).`,
    );
    if (maiorUnidade)
      partes.push(
        `Maior lotação: ${maiorUnidade.sigla ? `${maiorUnidade.nome} (${maiorUnidade.sigla})` : maiorUnidade.nome}, ` +
          `com ${maiorUnidade.total.toLocaleString("pt-BR")} profissionais (${maiorUnidade.efetivos} efetivos e ${maiorUnidade.prestadores} prestadores/contratados).`,
      );
    if (maiorCargo)
      partes.push(
        `Cargo mais numeroso: ${maiorCargo.nome}, com ${maiorCargo.total.toLocaleString("pt-BR")} profissionais ` +
          `(${maiorCargo.efetivos} efetivos e ${maiorCargo.prestadores} prestadores/contratados).`,
      );
    if (proporcao)
      partes.push(
        `Maior dependência de prestadores/contratados: ${proporcao.nome}, com ${pct(proporcao.prestadores, proporcao.total)} do seu quadro ` +
          `fora do vínculo efetivo.`,
      );
    partes.push(
      `Composição geral do vínculo: ${d.efetivosAtivos.toLocaleString("pt-BR")} efetivos (${pct(d.efetivosAtivos, d.efetivosAtivos + d.prestadoresAtivos)}) ` +
        `e ${d.prestadoresAtivos.toLocaleString("pt-BR")} prestadores/contratados (${pct(d.prestadoresAtivos, d.efetivosAtivos + d.prestadoresAtivos)}).`,
    );
    return partes;
  }

  function blocosRelatorio() {
    const d = dadosSel();
    const soma = <T,>(lista: T[], f: (x: T) => number) => lista.reduce((a, x) => a + f(x), 0);

    const cabecalho5 = (primeira: string) => [
      primeira,
      "Efetivos",
      "Prestadores",
      "Ativos",
      "Disponível",
      "Total",
    ];

    const blocos: Array<{
      titulo: string;
      nota?: string;
      head: string[];
      body: Array<Array<string | number>>;
      foot?: Array<string | number>;
      keepTogether?: boolean;
      alertas?: string[];
      align?: Array<"left" | "center" | "right">;
      larguras?: Array<number | undefined>;
    }> = [];

    /* ---------------------------------------- 3 Servidores por unidade */
    if (d.unidades.length)
      blocos.push({
        titulo: "3 Servidores por unidade",
        head: cabecalho5("Unidade / Setor"),
        body: d.unidades.map((u) => [
          u.sigla ? `${u.nome} (${u.sigla})` : u.nome,
          u.efetivos,
          u.prestadores,
          u.ativos,
          u.disponivel,
          u.total,
        ]),
        foot: [
          `TOTAL GERAL (${d.unidades.length})`,
          soma(d.unidades, (u) => u.efetivos),
          soma(d.unidades, (u) => u.prestadores),
          soma(d.unidades, (u) => u.ativos),
          soma(d.unidades, (u) => u.disponivel),
          soma(d.unidades, (u) => u.total),
        ],
      });

    /* ------------------------------------------ 4 Servidores por cargo */
    if (d.cargos.length)
      blocos.push({
        titulo: `4 Servidores por cargo (${agrupLabel})`,
        nota: "Lista completa, sem recorte de Top 10, com as cinco métricas em todas as linhas.",
        head: cabecalho5("Cargo"),
        body: d.cargos.map((c) => [
          c.nome,
          c.efetivos,
          c.prestadores,
          c.ativos,
          c.disponivel,
          c.total,
        ]),
        foot: [
          `TOTAL GERAL (${d.cargos.length})`,
          soma(d.cargos, (c) => c.efetivos),
          soma(d.cargos, (c) => c.prestadores),
          soma(d.cargos, (c) => c.ativos),
          soma(d.cargos, (c) => c.disponivel),
          soma(d.cargos, (c) => c.total),
        ],
      });

    /* ------------------------------------------- 4-A Servidores por função */
    if (d.funcoes.length)
      blocos.push({
        titulo: `4-A Servidores por função (${funcaoLabel})`,
        nota: "Função (designação/função gratificada) informada no cadastro de cada profissional.",
        head: cabecalho5("Função"),
        body: d.funcoes.map((c) => [c.nome, c.efetivos, c.prestadores, c.ativos, c.disponivel, c.total]),
        foot: [
          `TOTAL GERAL (${d.funcoes.length})`,
          soma(d.funcoes, (c) => c.efetivos),
          soma(d.funcoes, (c) => c.prestadores),
          soma(d.funcoes, (c) => c.ativos),
          soma(d.funcoes, (c) => c.disponivel),
          soma(d.funcoes, (c) => c.total),
        ],
      });

    /* ----------------------------------- 5 Quadro médico — especialidades */
    if (d.medicos.length)
      blocos.push({
        titulo: "5 Quadro médico — especialidades",
        head: cabecalho5("Especialidade"),
        body: d.medicos.map((m) => [
          m.nome,
          m.efetivos,
          m.prestadores,
          m.ativos,
          m.disponivel,
          m.total,
        ]),
        foot: [
          `TOTAL GERAL (${d.medicos.length})`,
          soma(d.medicos, (m) => m.efetivos),
          soma(d.medicos, (m) => m.prestadores),
          soma(d.medicos, (m) => m.ativos),
          soma(d.medicos, (m) => m.disponivel),
          soma(d.medicos, (m) => m.total),
        ],
      });

    /* --------------------------------- 6 Cruzamento unidade × cargo */
    d.cruzamento.forEach((c, i) => {
      if (!c.cargos.length) return;
      blocos.push({
        titulo: `6.${i + 1} Composição de cargos — ${c.unidade}`,
        nota: `Quadro total da unidade: ${c.total.toLocaleString("pt-BR")} profissionais · cinco cargos mais numerosos.`,
        head: ["Cargo", "Efetivos", "Prestadores", "Total", "% da unidade"],
        body: c.cargos.map((x) => [
          x.nome,
          x.efetivos,
          x.prestadores,
          x.total,
          pct(x.total, c.total),
        ]),
        keepTogether: true,
      });
    });

    /* --------------------------------- 6-B Setores por unidade */
    d.setoresPorUnidade.forEach((s, i) => {
      if (!s.setores.length) return;
      const totE = soma(s.setores, (x) => x.efetivos);
      const totP = soma(s.setores, (x) => x.prestadores);
      const totT = soma(s.setores, (x) => x.total);
      blocos.push({
        titulo: `6-B.${i + 1} Setores vinculados — ${s.unidade}`,
        nota: `${s.setores.length} setor(es) cadastrado(s) · quadro quantitativo de servidores por setor.`,
        head: ["Nome do setor", "Efetivos", "Prestadores/Contratados", "Total"],
        body: s.setores.map((x) => [x.nome, x.efetivos, x.prestadores, x.total]),
        foot: ["TOTAL DA UNIDADE", totE, totP, totT],
        align: ["left", "right", "right", "right"],
        larguras: [95, undefined, 42, undefined],
        keepTogether: true,
      });
    });


    /* --------------------------------- 8 Afastamentos e ausências */
    const totalAfast = soma(d.afastamentos, (a) => a.qtd);
    if (d.afastamentos.length) {
      const doisMaiores = soma(d.afastamentos.slice(0, 2), (a) => a.qtd);
      blocos.push({
        titulo: "8 Afastamentos e ausências",
        head: [
          "Tipo de afastamento",
          "Quantidade",
          "% dos afastamentos",
          "Cargos mais afetados",
        ],
        body: [
          ...d.afastamentos.map((a) => [
            a.label,
            a.qtd,
            pct(a.qtd, totalAfast),
            a.cargos.join(" · ") || "—",
          ]),
          [
            "Concentração nos 2 maiores tipos",
            doisMaiores,
            pct(doisMaiores, totalAfast),
            d.afastamentos
              .slice(0, 2)
              .map((a) => a.label)
              .join(" · "),
          ],
        ],
        foot: ["TOTAL", totalAfast, "100,0%", ""],
      });
    }

    /* --------------------------- 8-A Afastamentos por unidade */
    if (d.afastamentosPorUnidade.length) {
      blocos.push({
        titulo: "8-A Afastamentos e ausências por unidade",
        nota: "Mesma base do bloco 8: registros fora dos ativos, distribuídos pela unidade de lotação.",
        head: ["Unidade", "Quantidade", "% dos afastamentos", "Principais tipos"],
        body: d.afastamentosPorUnidade.map((u) => [
          u.nome,
          u.qtd,
          pct(u.qtd, totalAfast),
          u.tipos.join(" · ") || "—",
        ]),
        foot: ["TOTAL", totalAfast, "100,0%", ""],
        align: ["left", "right", "right", "left"],
        keepTogether: true,
      });
    }

    /* --------------------------- 8-B Afastamentos por setor */
    if (d.afastamentosPorSetor.length) {
      blocos.push({
        titulo: "8-B Afastamentos e ausências por setor",
        nota: "Setor é um agrupamento complementar e opcional; a linha “Sem setor informado” é apenas informativa.",
        head: ["Setor", "Quantidade", "% dos afastamentos", "Principais tipos"],
        body: d.afastamentosPorSetor.map((s) => [
          s.nome,
          s.qtd,
          pct(s.qtd, totalAfast),
          s.tipos.join(" · ") || "—",
        ]),
        foot: ["TOTAL", totalAfast, "100,0%", ""],
        align: ["left", "right", "right", "left"],
        keepTogether: true,
      });
    }

    return blocos;
  }

  async function relatorioAbnt() {
    const d = data!;
    const parecer = await obterParecer();

    return {
      arquivo: `geral-cargos-${modo}`,
      titulo: "Relatório Geral de Cargos",
      subtitulo: `${escopoLabel} · ${agrupLabel} · ${competencia}`,
      orientacao: "landscape" as const,
      filtros: [
        { label: "Escopo", valor: modo === "ativos" ? "Somente Ativos" : "Geral (Quadro Completo)" },
        { label: "Agrupamento", valor: agrupLabel },
        { label: "Competência", valor: competencia },
      ],
      kpis: kpisRelatorio(),
      resumo: resumoExecutivo(),
      blocos: blocosRelatorio(),
      graficosApos: true,
      graficos: [
        {
          tipo: "barras" as const,
          titulo: "7 Cargos com maior quantitativo (Top 10)",
          dados: [...d.cargos, ...d.medicos].map((c) => ({ label: c.nome, valor: c.total })),
          limite: 10,
        },
        {
          tipo: "rosca" as const,
          titulo: "7.1 Efetivos x Prestadores/Contratados",
          dados: [
            { label: "Efetivos", valor: d.efetivosAtivos },
            { label: "Prestadores/Contratados", valor: d.prestadoresAtivos },
          ],
        },
        {
          tipo: "barras" as const,
          titulo: "7.2 Unidades com maior quantitativo (Top 8)",
          dados: d.unidades.map((u) => ({ label: u.sigla ?? u.nome, valor: u.total })),
          limite: 8,
        },
      ],
      colunas: [],
      linhas: [] as never[],
      registros: modo === "ativos" ? d.ativos : d.total,
      notas: [
        "ATIVOS = ativo + férias + licença prêmio. DISPONÍVEL PARA ESCALA = apenas ativo.",
        "Cargos consolidados por De-Para gerencial; o cargo cadastrado de cada profissional permanece inalterado.",
        modo === "ativos"
          ? "Este documento considera exclusivamente profissionais ativos; o quadro completo está disponível no modo Geral."
          : "Este documento considera o quadro completo de cadastros, inclusive afastados e vacâncias.",
      ],
      parecer,
      fechamentoUnico: true,
      assinaturaFinal: { nome: ASSINATURA.cargo, cargo: ASSINATURA.orgao },
      carimboFinal: CARIMBO,
      margemTabela: { top: 35, bottom: 25, left: 14, right: 14 },
    };
  }

  async function baixarWord() {
    if (!data) return;
    setGerandoWord(true);
    try {
      const parecer = await obterParecer();
      await exportarGeralCargosDocx(dadosSel(), {
        modo,
        competencia,
        agrupamento: agrupLabel,
        escopo: escopoLabel,
        parecer,
        assinatura: ASSINATURA,
        carimbo: CARIMBO,
      });
      toast.success("Documento Word gerado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar o documento Word.");
    } finally {
      setGerandoWord(false);
    }
  }


  return (
    <div className="space-y-5">
      {/* ---------------------------------------------------------- controles */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Competência (referência)</Label>
          <Select
            value={competenciaId ?? competencias[0]?.id ?? ""}
            onValueChange={(v) => {
              setCompetenciaId(v);
              setSempreRecente(false);
            }}
            disabled={!competencias.length}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Cadastro atual" />
            </SelectTrigger>
            <SelectContent>
              {competencias.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-muted-foreground">
          <Checkbox
            checked={sempreRecente}
            onCheckedChange={(v) => setSempreRecente(Boolean(v))}
          />
          sempre a mais recente
        </label>

        <Tabs value={modo} onValueChange={(v) => setModo(v as ModoGeralCargos)}>
          <TabsList>
            <TabsTrigger value="ativos" className="text-xs">
              Ativos {data ? `(${data.ativos})` : ""}
            </TabsTrigger>
            <TabsTrigger value="geral" className="text-xs">
              Geral — todos {data ? `(${data.total})` : ""}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs value={agrupamento} onValueChange={(v) => setAgrupamento(v as AgrupamentoCargos)}>
          <TabsList>
            <TabsTrigger value="categoria" className="text-xs">
              categoria consolidada
            </TabsTrigger>
            <TabsTrigger value="cargo" className="text-xs">
              cargo/função exato
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="ml-auto flex gap-2 pb-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" disabled={!data}>
                <ListChecks className="mr-1 h-4 w-4" />
                Conteúdo ({blocosSel.size}/{BLOCOS_OPC.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-2">
              <p className="text-sm font-medium">O que sai no Excel, PDF e Word</p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" className="h-7 text-xs"
                  onClick={() => setBlocosSel(new Set(BLOCOS_OPC.map((b) => b.k)))}>
                  Completo
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs"
                  onClick={() => setBlocosSel(new Set())}>
                  Limpar
                </Button>
              </div>
              {BLOCOS_OPC.map((b) => (
                <label key={b.k} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={inclui(b.k)} onCheckedChange={() => alternarBloco(b.k)} />
                  {b.l}
                </label>
              ))}
              <p className="text-xs text-muted-foreground">Indicadores e resumo sempre saem.</p>
            </PopoverContent>
          </Popover>
          <Button
            size="sm"
            variant="outline"
            disabled={!data}
            onClick={() =>
              data &&
                exportarGeralCargosXlsx(data, {
                  modo,
                  competencia,
                  agrupamento: agrupLabel,
                  agrupamentoFuncoes: funcaoLabel,
                  blocos: blocosSel,
                })
            }
          >
            <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
          </Button>
          <BotaoRelatorioAbnt relatorio={relatorioAbnt} disabled={!data} label="PDF" />
          <Button
            size="sm"
            variant="outline"
            disabled={!data || gerandoWord}
            onClick={() => void baixarWord()}
          >
            {gerandoWord ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <FileType className="mr-1 h-4 w-4" />
            )}
            Word
          </Button>

        </div>
      </div>

      {isLoading && (
        <div className="rounded-md border bg-card p-6 text-center text-muted-foreground">
          Carregando…
        </div>
      )}

      {data && (
        <>
          {/* ------------------------------------------------------- bloco 1 */}
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard label="Total de cadastros" value={data.total} />
            <KpiCard
              label="Ativos"
              value={data.ativos}
              hint="ativo + férias + licença prêmio"
              tone="success"
            />
            <KpiCard
              label="Disponível para escala"
              value={data.disponivel}
              hint="apenas ativo"
              tone="warning"
            />
          </div>
          <div className="rounded-md border bg-card p-3 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Efetivos ativos</span>{" "}
              {data.efetivosAtivos} ·{" "}
              <span className="font-medium text-foreground">Prestadores/Contratados</span>{" "}
              {data.prestadoresAtivos} (Prestadores de Serviços {data.prestadoresServicoAtivos} ·
              Comissionado {data.comissionadosAtivos} · Terceirizado {data.terceirizadosAtivos})
            </p>
            <p>{data.foraDeEscala} em férias/licença prêmio (ativos, fora de escala)</p>
            <p>
              {data.foraDosAtivos} fora dos ativos:{" "}
              {data.afastamentos.map((a) => `${a.label} ${a.qtd}`).join(" · ") || "—"}
            </p>
          </div>

          {/* ------------------------------------------------------- bloco 2 */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Servidores na Secretaria de Saúde
            </h2>
            <div className="overflow-auto rounded-md border bg-card">
              <table className="w-full table-auto text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="p-2">Local</th>
                    <th className="p-2 text-right">Efetivos</th>
                    <th className="p-2 text-right">Prestadores/Contratados</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.unidades.map((u) => (
                    <tr key={u.id} className="border-t">
                      <td className="p-2 font-medium">
                        {u.nome}
                        {u.sigla ? (
                          <span className="ml-1 text-xs text-muted-foreground">({u.sigla})</span>
                        ) : null}
                      </td>
                      <td className="p-2 text-right tabular-nums">{u.efetivos}</td>
                      <td className="p-2 text-right tabular-nums">
                        {u.prestadores}
                        {u.prestadores > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({u.prestadores_servico}/{u.comissionados}/{u.terceirizados})
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-right tabular-nums">{u.total}</td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted/30 font-semibold">
                    <td className="p-2">TOTAL</td>
                    <td className="p-2 text-right tabular-nums">
                      {data.unidades.reduce((a, u) => a + u.efetivos, 0)}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {data.unidades.reduce((a, u) => a + u.prestadores, 0)}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {data.unidades.reduce((a, u) => a + u.total, 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Detalhe da coluna Prestadores/Contratados: (Prestadores de Serviços / Comissionado /
              Terceirizado).
            </p>
          </section>

          {/* ---------------------------------------------------- blocos 3 e 4 */}
          <TabelaCargos
            linhas={data.cargos}
            titulo={`Lista de cargos (${agrupLabel})`}
          />
          <TabelaCargos
            linhas={data.funcoes}
            titulo={`Lista de funções (${funcaoLabel})`}
            coluna="Nome da função"
          />
          <TabelaCargos
            linhas={data.medicos}
            titulo="Específicos médicos: clínicos e especialistas"
          />

          {/* ------------------------------------------------------- bloco 5 */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Afastamentos e ausências
            </h2>
            <div className="overflow-auto rounded-md border bg-card">
              <table className="w-full table-auto text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="p-2">Tipo</th>
                    <th className="p-2 text-right">Qtd</th>
                    <th className="p-2">Principais cargos afetados</th>
                  </tr>
                </thead>
                <tbody>
                  {data.afastamentos.length === 0 && (
                    <tr>
                      <td colSpan={3}>
                        <EmptyState
                          title="Nenhum afastamento registrado"
                          description="Todos os cadastros estão dentro dos ativos."
                        />
                      </td>
                    </tr>
                  )}
                  {data.afastamentos.map((a) => (
                    <tr key={a.situacao} className="border-t">
                      <td className="p-2 font-medium">{a.label}</td>
                      <td className="p-2 text-right tabular-nums">{a.qtd}</td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {a.cargos.join(" · ") || "—"}
                      </td>
                    </tr>
                  ))}
                  {data.afastamentos.length > 0 && (
                    <tr className="border-t bg-muted/30 font-semibold">
                      <td className="p-2">TOTAL</td>
                      <td className="p-2 text-right tabular-nums">
                        {data.afastamentos.reduce((s, a) => s + a.qtd, 0)}
                      </td>
                      <td className="p-2" />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ------------------------------- afastamentos por unidade e setor */}
          <TabelaAfastLocal
            titulo="Afastamentos e ausências por unidade"
            colLocal="Unidade"
            linhas={data.afastamentosPorUnidade}
          />
          <TabelaAfastLocal
            titulo="Afastamentos e ausências por setor"
            colLocal="Setor"
            linhas={data.afastamentosPorSetor}
            nota="Setor é agrupamento complementar e opcional — “Sem setor informado” é apenas informativo."
          />

          {/* -------------------------------------------- conferência De-Para */}
          <details className="rounded-md border bg-card p-3">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              De-Para de cargos aplicado ({dePara.length} equivalências)
            </summary>
            <div className="mt-3 overflow-auto">
              <table className="w-full table-auto text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="p-2">Categoria consolidada</th>
                    <th className="p-2">Grupo</th>
                    <th className="p-2">Cargo cadastrado</th>
                  </tr>
                </thead>
                <tbody>
                  {dePara.map((d) => (
                    <tr key={`${d.categoria}-${d.cargo}`} className="border-t">
                      <td className="p-2 font-medium">{d.categoria}</td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {d.grupo === "medico" ? "Médico" : "Geral"}
                      </td>
                      <td className="p-2 text-xs">{d.cargo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              A consolidação é apenas de leitura: o cargo cadastrado de cada profissional permanece
              exatamente como está no cadastro.
            </p>
          </details>

          <DeParaFuncoesEditor />
        </>
      )}
    </div>
  );
}
