// Regras de alerta da Sala de Situação — lógica pura, testável.
// Sublote 5B (Onda 5) — cobertura Vitest.
import type { RankingRow } from "@/lib/analytics-aggregations";

export const ALERT_RULES = {
  // PENDÊNCIA CRÍTICA: aberta/respondida sem tratativa há mais de N dias.
  pendenciaDiasCritico: 7,
  // HORAS EXTRAS ELEVADAS: unidade excedendo N horas na competência.
  heCriticoUnidade: 200,
} as const;

export type PendenciaInput = {
  id: string;
  titulo: string | null;
  status: string;
  created_at: string;
};

export type Alerta = {
  id: string;
  tipo: "pendencia" | "he" | "rascunho";
  titulo: string;
  detalhe: string;
  origem: string;
};

export function filterHeCritico(
  ranking: readonly RankingRow[],
  limite: number = ALERT_RULES.heCriticoUnidade,
): RankingRow[] {
  return ranking.filter((r) => r.total_horas_extras > limite);
}

export function pendenciaEstaCritica(
  createdAt: string | Date,
  now: number = Date.now(),
  diasCritico: number = ALERT_RULES.pendenciaDiasCritico,
): boolean {
  const created =
    typeof createdAt === "string" ? new Date(createdAt).getTime() : createdAt.getTime();
  const dias = Math.floor((now - created) / (24 * 3600 * 1000));
  return dias > diasCritico;
}

export type BuildAlertasArgs = {
  pendencias: readonly PendenciaInput[];
  ranking: readonly RankingRow[];
  frequenciasPendentes: number;
  now?: number;
  limiteHe?: number;
};

export function buildAlertas({
  pendencias,
  ranking,
  frequenciasPendentes,
  now = Date.now(),
  limiteHe = ALERT_RULES.heCriticoUnidade,
}: BuildAlertasArgs): Alerta[] {
  const list: Alerta[] = [];

  for (const p of pendencias) {
    const dias = Math.floor((now - new Date(p.created_at).getTime()) / (24 * 3600 * 1000));
    list.push({
      id: `pend-${p.id}`,
      tipo: "pendencia",
      titulo: p.titulo ?? "Pendência sem título",
      detalhe: `${dias} dias em aberto (status ${p.status})`,
      origem: "frequencia_pendencias",
    });
  }

  for (const u of filterHeCritico(ranking, limiteHe)) {
    list.push({
      id: `he-${u.unidade_id}`,
      tipo: "he",
      titulo: u.unidade_nome,
      detalhe: `${u.total_horas_extras.toLocaleString("pt-BR")}h de HE na competência`,
      origem: "useAnalytics.ranking",
    });
  }

  if (frequenciasPendentes > 0) {
    list.push({
      id: "rascunho-global",
      tipo: "rascunho",
      titulo: "Folhas ainda em rascunho",
      detalhe: `${frequenciasPendentes} folha(s) sem envio na competência atual`,
      origem: "useAnalytics.frequenciasPendentes",
    });
  }

  return list;
}
