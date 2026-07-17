// Lógica pura de agregação usada por useAnalytics.
// Extraída para permitir testes unitários sem tocar Supabase/React Query.
// Sublote 5B (Onda 5) — cobertura Vitest.

export type FrequenciaRow = {
  id: string;
  status: string;
  total_profissionais: number | null;
  total_faltas: number | null;
  total_horas_extras: number | null;
  competencia_unidades: {
    competencia_id: string;
    unidade_id: string;
    unidades: { id: string; nome: string; sigla: string | null };
  };
};

export type RankingRow = {
  unidade_id: string;
  unidade_nome: string;
  unidade_sigla: string | null;
  total_profissionais: number;
  total_faltas: number;
  total_horas_extras: number;
  aprovadas: number;
  total_folhas: number;
};

export const STATUS_ENVIADAS = ["enviada", "em_analise", "com_pendencias"] as const;
export const STATUS_PENDENTES = ["rascunho"] as const;
export const STATUS_APROVADAS = ["aprovada"] as const;

export function countByStatus(rows: readonly FrequenciaRow[], statuses: readonly string[]): number {
  const set = new Set(statuses);
  return rows.reduce((acc, r) => (set.has(r.status) ? acc + 1 : acc), 0);
}

export function sumField(
  rows: readonly FrequenciaRow[],
  field: "total_faltas" | "total_horas_extras",
): number {
  return rows.reduce((acc, r) => acc + Number(r[field] ?? 0), 0);
}

export function buildRanking(rows: readonly FrequenciaRow[]): RankingRow[] {
  const map = new Map<string, RankingRow>();
  for (const r of rows) {
    const u = r.competencia_unidades.unidades;
    const cur = map.get(u.id) ?? {
      unidade_id: u.id,
      unidade_nome: u.nome,
      unidade_sigla: u.sigla,
      total_profissionais: 0,
      total_faltas: 0,
      total_horas_extras: 0,
      aprovadas: 0,
      total_folhas: 0,
    };
    cur.total_profissionais += Number(r.total_profissionais ?? 0);
    cur.total_faltas += Number(r.total_faltas ?? 0);
    cur.total_horas_extras += Number(r.total_horas_extras ?? 0);
    cur.total_folhas += 1;
    if (r.status === "aprovada") cur.aprovadas += 1;
    map.set(u.id, cur);
  }
  return Array.from(map.values()).sort(
    (a, b) => b.total_horas_extras - a.total_horas_extras,
  );
}