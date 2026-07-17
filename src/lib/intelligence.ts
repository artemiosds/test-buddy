// Sublote 12A — Núcleo de Inteligência Gerencial.
// Funções puras — recebem dados já agregados por `useAnalytics` e produzem
// classificações/insights determinísticos. Sem novas queries; sem IA.

import { INTELLIGENCE_THRESHOLDS as T } from "./intelligence-thresholds";

export type SemaforoNivel = "ok" | "atencao" | "critico";

export type SemaforoInput = {
  totalProfessionals: number;
  afastados: number;
  pendencias: number;
  /** Profissionais sem lotação (união aproximada de unidade/setor/cargo/função — usa o maior valor). */
  semLotacao: number;
  unidadesSemGestor: number;
  horasExtras: number;
  /** Frequências pendentes do período (competência) ativo. */
  frequenciasPendentes?: number;
};

export type SemaforoResult = {
  nivel: SemaforoNivel;
  motivos: string[];
  contagemAlertas: number;
};

export function classifySemaforo(input: SemaforoInput): SemaforoResult {
  const motivos: string[] = [];
  let nivel: SemaforoNivel = "ok";

  const bump = (novo: SemaforoNivel) => {
    if (novo === "critico") nivel = "critico";
    else if (novo === "atencao" && nivel === "ok") nivel = "atencao";
  };

  // Regra de classificação — "Status da Força de Trabalho":
  //  🔴 Crítico  se pendências vencidas > 0  OU  unidades sem gestor > 0
  //  🟡 Atenção se profissionais sem lotação > 0  OU  frequências pendentes > 0
  //  🟢 Regular caso contrário
  // Observação: o backend expõe `pendências abertas` (não separa "vencidas"),
  // e o painel usa esse valor como aproximação segura — melhor errar para o
  // lado de sinalizar do que ocultar.
  if (input.pendencias > 0) {
    motivos.push(`${input.pendencias} pendência(s) em aberto`);
    bump("critico");
  }
  if (input.unidadesSemGestor > 0) {
    motivos.push(`${input.unidadesSemGestor} unidade(s) sem gestor`);
    bump("critico");
  }
  if (input.semLotacao > 0) {
    motivos.push(`${input.semLotacao} profissional(is) sem lotação (unidade/setor/cargo/função)`);
    bump("atencao");
  }
  if ((input.frequenciasPendentes ?? 0) > 0) {
    motivos.push(`${input.frequenciasPendentes} frequência(s) pendente(s) no período ativo`);
    bump("atencao");
  }
  // `T` (thresholds), `afastados` e `horasExtras` ficam disponíveis mas não
  // alteram o semáforo — mantidos por compatibilidade com o restante da UI.
  void T;
  void input.afastados;
  void input.horasExtras;
  void input.totalProfessionals;

  return { nivel, motivos, contagemAlertas: motivos.length };
}

// -------- Tendências --------

export type TendenciaValor = {
  atual: number;
  anterior: number;
  variacaoAbs: number;
  variacaoPct: number | null; // null quando anterior=0
  direcao: "sobe" | "cai" | "estavel";
};

export function computeTendencia(atual: number, anterior: number): TendenciaValor {
  const variacaoAbs = atual - anterior;
  const variacaoPct = anterior === 0 ? null : (variacaoAbs / anterior) * 100;
  const direcao: TendenciaValor["direcao"] =
    variacaoAbs > 0 ? "sobe" : variacaoAbs < 0 ? "cai" : "estavel";
  return { atual, anterior, variacaoAbs, variacaoPct, direcao };
}

// -------- Integridade Cadastral --------

export type IntegridadeCampo = {
  chave: string;
  label: string;
  faltantes: number;
};

export type IntegridadeResult = {
  total: number;
  camposFaltantes: IntegridadeCampo[];
  totalPendencias: number; // soma faltantes (com repetição por campo)
  cadastrosCompletos: number;
  percentual: number; // 100% quando não há faltantes
  nivel: SemaforoNivel;
};

export function computeIntegridade(input: {
  total: number;
  faltas: Record<string, number>;
  labels: Record<string, string>;
  cadastrosIncompletos?: number;
}): IntegridadeResult {
  const campos: IntegridadeCampo[] = Object.entries(input.faltas).map(([k, v]) => ({
    chave: k,
    label: input.labels[k] ?? k,
    faltantes: v,
  }));
  const totalPendencias = campos.reduce((s, c) => s + c.faltantes, 0);
  const incompletos =
    input.cadastrosIncompletos ??
    Math.min(input.total, Math.max(...campos.map((c) => c.faltantes), 0));
  const completos = Math.max(0, input.total - incompletos);
  const percentual =
    input.total === 0 ? 100 : Math.round((completos / input.total) * 100);

  let nivel: SemaforoNivel = "ok";
  if (percentual < T.integridadeCritico) nivel = "critico";
  else if (percentual < T.integridadeAtencao) nivel = "atencao";

  return {
    total: input.total,
    camposFaltantes: campos.sort((a, b) => b.faltantes - a.faltantes),
    totalPendencias,
    cadastrosCompletos: completos,
    percentual,
    nivel,
  };
}

// -------- Insights determinísticos --------

export type Insight = {
  id: string;
  tipo: "concentracao" | "risco" | "melhoria" | "informativo";
  texto: string;
};

export function generateInsights(input: {
  totalProfessionals: number;
  distribuicaoUnidade: Array<{ id: string; nome: string; sigla?: string | null; total: number }>;
  distribuicaoSetor: Array<{ id: string; nome: string; total: number }>;
  distribuicaoCargo?: Array<{ id: string; nome: string; total: number }>;
  rankingHe: Array<{ unidade_id: string; unidade_nome: string; total_horas_extras: number }>;
  totalHorasExtras: number;
  afastados: number;
  tendenciaPendencias?: TendenciaValor;
  tendenciaHoras?: TendenciaValor;
  alertas?: {
    semUnidade: number;
    semSetor: number;
    unidadesSemGestor: number;
    setoresSemResponsavel: number;
  };
}): Insight[] {
  const out: Insight[] = [];
  const total = Math.max(0, input.totalProfessionals);

  // Concentração por unidade
  if (input.distribuicaoUnidade.length > 0 && total > 0) {
    const top = input.distribuicaoUnidade[0];
    const pct = (top.total / total) * 100;
    if (pct >= T.concentracaoRelevantePct) {
      out.push({
        id: "conc-unidade",
        tipo: "concentracao",
        texto: `${top.sigla ? `${top.sigla} — ` : ""}${top.nome} concentra ${pct.toFixed(1)}% dos profissionais da Secretaria.`,
      });
    }
  }

  // Concentração por setor
  if (input.distribuicaoSetor.length > 0 && total > 0) {
    const top = input.distribuicaoSetor[0];
    const pct = (top.total / total) * 100;
    if (pct >= T.concentracaoRelevantePct) {
      out.push({
        id: "conc-setor",
        tipo: "concentracao",
        texto: `O setor ${top.nome} concentra ${pct.toFixed(1)}% dos profissionais.`,
      });
    }
  }

  // Horas extras concentradas
  if (input.rankingHe.length > 0 && input.totalHorasExtras > 0) {
    const top = input.rankingHe[0];
    const pct = (top.total_horas_extras / input.totalHorasExtras) * 100;
    if (pct >= T.concentracaoRelevantePct) {
      out.push({
        id: "conc-he",
        tipo: "risco",
        texto: `${top.unidade_nome} concentrou ${pct.toFixed(1)}% das horas extras da competência.`,
      });
    }
  }

  // Afastados relevantes
  if (total > 0 && input.afastados > 0) {
    const pct = (input.afastados / total) * 100;
    if (pct >= T.afastadosAtencaoPct) {
      out.push({
        id: "risco-afast",
        tipo: "risco",
        texto: `${pct.toFixed(1)}% dos profissionais estão afastados — acima do limite operacional saudável.`,
      });
    }
  }

  // Tendência de pendências
  if (input.tendenciaPendencias) {
    const t = input.tendenciaPendencias;
    if (t.direcao === "cai" && Math.abs(t.variacaoAbs) >= 1) {
      out.push({
        id: "trend-pend-melhor",
        tipo: "melhoria",
        texto: `Pendências reduziram ${Math.abs(t.variacaoAbs)} em relação à competência anterior.`,
      });
    } else if (t.direcao === "sobe" && t.variacaoAbs >= 1) {
      out.push({
        id: "trend-pend-pior",
        tipo: "risco",
        texto: `Pendências aumentaram ${t.variacaoAbs} em relação à competência anterior.`,
      });
    }
  }

  // Tendência de horas extras
  if (input.tendenciaHoras) {
    const t = input.tendenciaHoras;
    if (t.direcao === "sobe" && t.variacaoPct !== null && t.variacaoPct >= 10) {
      out.push({
        id: "trend-he-pior",
        tipo: "risco",
        texto: `Horas extras cresceram ${t.variacaoPct.toFixed(1)}% em relação à competência anterior.`,
      });
    } else if (t.direcao === "cai" && t.variacaoPct !== null && t.variacaoPct <= -10) {
      out.push({
        id: "trend-he-melhor",
        tipo: "melhoria",
        texto: `Horas extras caíram ${Math.abs(t.variacaoPct).toFixed(1)}% em relação à competência anterior.`,
      });
    }
  }

  // Alertas estruturais
  if (input.alertas && input.alertas.unidadesSemGestor > 0) {
    out.push({
      id: "sem-gestor",
      tipo: "risco",
      texto: `${input.alertas.unidadesSemGestor} unidade(s) operam sem gestor formalmente cadastrado.`,
    });
  }

  return out;
}
