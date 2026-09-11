/**
 * Regra institucional ÚNICA dos indicadores de força de trabalho.
 *
 * Todos os painéis (Visão Geral do Sistema, Dashboards Executivos, Sala de
 * Situação, Situação Funcional, Centro de Controle, Quadro de Lotação,
 * Distribuição por Setor) e os relatórios gerenciais devem derivar os números
 * daqui — nunca de contas locais próprias.
 *
 *   TOTAL GERAL .............. todos os cadastros com deleted_at IS NULL
 *   ATIVOS ................... ativo + férias + licença prêmio (vínculo vigente)
 *   DISPONÍVEL PARA ESCALA ... apenas "ativo" (exercício pleno)
 *   FÉRIAS / LIC. PRÊMIO ..... ativos fora da escala
 *   AFASTADOS ................ afastamento/licença legal com vínculo suspenso
 *   DESLIGADOS ............... desligado + inativo (fora do quadro)
 */

import {
  ATIVOS_STATUS,
  DISPONIVEL_STATUS,
  derivarSituacao,
  type SituacaoFuncional,
} from "./situacao-funcional";

/** Situações que contam como AFASTADO (nunca em Ativos nem em Disponível). */
export const AFASTADOS_STATUS = [
  "afastado",
  "afastado_laudo",
  "atestado",
  "afastamento_inss",
  "licenca",
  "licenca_sem_vencimento",
  "licenca_maternidade",
  "licenca_saude",
  "licenca_luto",
  "licenca_estudo",
  "falta_pad",
  "vacancia",
  "cedido",
] as const satisfies readonly SituacaoFuncional[];

/** Fora do quadro. */
export const DESLIGADOS_STATUS = ["desligado", "inativo"] as const satisfies readonly SituacaoFuncional[];

/** Ativos que não podem ser escalados hoje. */
export const FERIAS_LP_STATUS = ["ferias", "licenca_premio"] as const satisfies readonly SituacaoFuncional[];

export type KpisForcaTrabalho = {
  /** Todos os cadastros considerados. */
  total: number;
  /** ativo + férias + licença prêmio. */
  ativos: number;
  /** Apenas "ativo". */
  disponiveis: number;
  /** Férias + licença prêmio. */
  feriasLicencaPremio: number;
  /** Afastamentos/licenças legais. */
  afastados: number;
  /** Desligados/inativos. */
  desligados: number;
};

export const KPIS_ZERO: KpisForcaTrabalho = {
  total: 0,
  ativos: 0,
  disponiveis: 0,
  feriasLicencaPremio: 0,
  afastados: 0,
  desligados: 0,
};

export const KPI_LABEL = {
  total: "Total de Profissionais",
  ativos: "Ativos",
  disponiveis: "Disponível p/ Escala",
  feriasLicencaPremio: "Férias / Licença Prêmio",
  afastados: "Afastados",
  desligados: "Desligados",
} as const;

const inList = (list: readonly string[], s: string) => list.includes(s);

export function ehAtivo(situacao: SituacaoFuncional): boolean {
  return inList(ATIVOS_STATUS as readonly string[], situacao);
}

export function ehDisponivel(situacao: SituacaoFuncional): boolean {
  return inList(DISPONIVEL_STATUS as readonly string[], situacao);
}

export function ehAfastado(situacao: SituacaoFuncional): boolean {
  return inList(AFASTADOS_STATUS as readonly string[], situacao);
}

export function ehDesligado(situacao: SituacaoFuncional): boolean {
  return inList(DESLIGADOS_STATUS as readonly string[], situacao);
}

/**
 * Deriva os indicadores a partir de uma distribuição `situação -> quantidade`
 * (por exemplo o `status_breakdown` da RPC de resumo).
 */
export function kpisDoBreakdown(
  breakdown: Record<string, number> | null | undefined,
): KpisForcaTrabalho {
  const out: KpisForcaTrabalho = { ...KPIS_ZERO };
  for (const [raw, qtdRaw] of Object.entries(breakdown ?? {})) {
    const qtd = Number(qtdRaw) || 0;
    if (!qtd) continue;
    const s = derivarSituacao({ id: "", situacao_funcional: raw });
    out.total += qtd;
    if (ehAtivo(s)) out.ativos += qtd;
    if (ehDisponivel(s)) out.disponiveis += qtd;
    if (inList(FERIAS_LP_STATUS as readonly string[], s)) out.feriasLicencaPremio += qtd;
    if (ehAfastado(s)) out.afastados += qtd;
    if (ehDesligado(s)) out.desligados += qtd;
  }
  return out;
}

/**
 * Deriva os indicadores a partir das linhas do cadastro. Preferência
 * `situacao_funcional` e queda para `status` — igual à tela de Profissionais.
 */
export function kpisDeProfissionais(
  rows: { status?: string | null; situacao_funcional?: string | null }[] | null | undefined,
): KpisForcaTrabalho {
  const out: KpisForcaTrabalho = { ...KPIS_ZERO };
  for (const r of rows ?? []) {
    const s = derivarSituacao({
      id: "",
      status: r.status ?? null,
      situacao_funcional: r.situacao_funcional ?? null,
    });
    out.total += 1;
    if (ehAtivo(s)) out.ativos += 1;
    if (ehDisponivel(s)) out.disponiveis += 1;
    if (inList(FERIAS_LP_STATUS as readonly string[], s)) out.feriasLicencaPremio += 1;
    if (ehAfastado(s)) out.afastados += 1;
    if (ehDesligado(s)) out.desligados += 1;
  }
  return out;
}

/** Formato devolvido pela RPC `get_dashboard_summary` (`kpis_situacao`). */
export type KpisSituacaoRpc = {
  total?: number | null;
  ativos?: number | null;
  disponiveis?: number | null;
  ferias_licenca_premio?: number | null;
  afastados?: number | null;
  desligados?: number | null;
} | null;

export function kpisDaRpc(k: KpisSituacaoRpc): KpisForcaTrabalho {
  return {
    total: k?.total ?? 0,
    ativos: k?.ativos ?? 0,
    disponiveis: k?.disponiveis ?? 0,
    feriasLicencaPremio: k?.ferias_licenca_premio ?? 0,
    afastados: k?.afastados ?? 0,
    desligados: k?.desligados ?? 0,
  };
}
