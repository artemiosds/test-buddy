/**
 * Ponte entre os painéis gerenciais e o motor ABNT (`src/lib/relatorio-abnt.ts`).
 *
 * Recebe apenas dados JÁ carregados na tela (KPIs, tabelas e gráficos) e monta
 * a configuração do relatório — nenhuma consulta nova, nenhuma regra de negócio
 * própria: os números do PDF são exatamente os exibidos na página.
 */
import type { AbntBloco, AbntGrafico, AbntKpi, AbntRelatorio } from "@/lib/relatorio-abnt";
import {
  KPI_LABEL,
  ehAfastado,
  ehAtivo,
  ehDesligado,
  type KpisForcaTrabalho,
} from "@/lib/kpis-forca-trabalho";
import {
  SITUACAO_LABEL,
  SITUACAO_ORDER,
  derivarSituacao,
  type SituacaoFuncional,
} from "@/lib/situacao-funcional";

/** Configuração aceita pelo `BotaoRelatorioAbnt` (sem o emissor). */
export type PainelAbnt = Omit<AbntRelatorio<never>, "emitidoPor">;

export type PainelAbntEntrada = {
  arquivo: string;
  titulo: string;
  subtitulo?: string;
  orientacao?: "portrait" | "landscape";
  filtros?: Array<{ label: string; valor: string }>;
  kpis?: AbntKpi[];
  resumo?: string[];
  blocos?: AbntBloco[];
  graficos?: AbntGrafico[];
  notas?: string[];
  registros?: number;
};

/**
 * Fechamento institucional padrão dos painéis: assinatura única na última
 * página, com carimbo e box de fé pública (nunca repetido a cada página).
 */
export function relatorioPainelAbnt(e: PainelAbntEntrada): PainelAbnt {
  return {
    arquivo: e.arquivo,
    titulo: e.titulo,
    subtitulo: e.subtitulo,
    orientacao: e.orientacao ?? "portrait",
    filtros: e.filtros,
    kpis: e.kpis,
    resumo: e.resumo,
    blocos: (e.blocos ?? []).map((b) => ({ keepTogether: true, ...b })),
    graficos: e.graficos,
    graficosApos: true,
    notas: e.notas,
    colunas: [],
    linhas: [],
    registros: e.registros ?? 0,
    fechamentoUnico: true,
    margemTabela: { top: 35, bottom: 25, left: 14, right: 14 },
  };
}

/** Indicadores da força de trabalho na ordem oficial. */
export function kpisAbnt(
  k: KpisForcaTrabalho,
  extras: AbntKpi[] = [],
  omitir: Array<keyof KpisForcaTrabalho> = [],
): AbntKpi[] {
  const ordem: Array<keyof KpisForcaTrabalho> = [
    "total",
    "ativos",
    "disponiveis",
    "feriasLicencaPremio",
    "afastados",
    "desligados",
  ];
  const base = ordem
    .filter((key) => !omitir.includes(key))
    .map((key) => ({ label: KPI_LABEL[key], valor: k[key].toLocaleString("pt-BR") }));
  return [...base, ...extras];
}

/* --------------------------------------------------- situações detalhadas */

export type GrupoRotulo = "Ativos" | "Fora de escala" | "Afastados" | "Desligados";

export function grupoRotulo(s: SituacaoFuncional): GrupoRotulo {
  if (s === "ferias" || s === "licenca_premio") return "Fora de escala";
  if (ehDesligado(s)) return "Desligados";
  if (ehAfastado(s)) return "Afastados";
  if (ehAtivo(s)) return "Ativos";
  return "Afastados";
}

export type LinhaSituacao = {
  key: SituacaoFuncional;
  label: string;
  grupo: GrupoRotulo;
  total: number;
  percentual: number;
};

/**
 * Detalhamento por situação com TODAS as situações do cadastro — inclusive as
 * zeradas, para que nenhuma situação (ex.: "Afastado por Laudo") fique
 * invisível nos painéis.
 */
export function detalharSituacoes(
  rows: { status?: string | null; situacao_funcional?: string | null }[] | null | undefined,
): LinhaSituacao[] {
  const acc = new Map<SituacaoFuncional, number>();
  let total = 0;
  for (const r of rows ?? []) {
    const s = derivarSituacao({
      id: "",
      status: r.status ?? null,
      situacao_funcional: r.situacao_funcional ?? null,
    });
    acc.set(s, (acc.get(s) ?? 0) + 1);
    total += 1;
  }
  return SITUACAO_ORDER.map((key) => {
    const qtd = acc.get(key) ?? 0;
    return {
      key,
      label: SITUACAO_LABEL[key],
      grupo: grupoRotulo(key),
      total: qtd,
      percentual: total > 0 ? (qtd / total) * 100 : 0,
    };
  });
}

/** Bloco ABNT do detalhamento por situação (mesma lista exibida na tela). */
export function blocoSituacoes(linhas: LinhaSituacao[], titulo = "Detalhamento por situação"): AbntBloco {
  const total = linhas.reduce((a, l) => a + l.total, 0);
  return {
    titulo,
    nota: "Todas as situações previstas no cadastro do profissional, inclusive as sem registros no escopo atual.",
    head: ["Situação", "Grupo", "Quantidade", "% do total"],
    body: linhas.map((l) => [
      l.label,
      l.grupo,
      l.total.toLocaleString("pt-BR"),
      `${l.percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
    ]),
    foot: ["Total", "—", total.toLocaleString("pt-BR"), "100%"],
    align: ["left", "left", "right", "right"],
    keepTogether: false,
  };
}
