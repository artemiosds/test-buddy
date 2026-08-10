import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type FrequenciaRow = {
  id: string;
  status: Database["public"]["Enums"]["status_frequencia"];
  tipo: Database["public"]["Enums"]["tipo_frequencia"];
  total_profissionais: number;
  total_dias_trabalhados: number;
  total_faltas: number;
  total_horas_extras: number;
  competencia_unidade?: {
    unidade_id: string;
    competencia_id: string;
    unidades?: { id: string; nome: string; sigla: string | null } | null;
    competencia?: { id: string; ano: number; mes: number; status: string } | null;
  } | null;
};

export const STATUS_APROVADAS = ["aprovada", "arquivada"];
export const STATUS_ENVIADAS = ["enviada", "em_analise"];
export const STATUS_PENDENTES = ["enviada", "em_analise", "com_pendencias", "devolvida"];

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

export function countByStatus(rows: FrequenciaRow[], statusList: string[]) {
  return rows.filter((r) => statusList.includes(r.status)).length;
}

export function sumField(rows: FrequenciaRow[], field: keyof FrequenciaRow) {
  return rows.reduce((acc, curr) => acc + (Number(curr[field]) || 0), 0);
}

export function buildRanking(rows: FrequenciaRow[]): RankingRow[] {
  const map = new Map<string, RankingRow>();
  for (const r of rows) {
    const uid = r.competencia_unidade?.unidade_id;
    if (!uid) continue;
    const existing = map.get(uid);
    if (existing) {
      existing.total_profissionais += r.total_profissionais;
      existing.total_faltas += r.total_faltas;
      existing.total_horas_extras += r.total_horas_extras;
      existing.total_folhas += 1;
      if (STATUS_APROVADAS.includes(r.status)) existing.aprovadas += 1;
    } else {
      map.set(uid, {
        unidade_id: uid,
        unidade_nome: r.competencia_unidade?.unidades?.nome || "Desconhecida",
        unidade_sigla: r.competencia_unidade?.unidades?.sigla || null,
        total_profissionais: r.total_profissionais,
        total_faltas: r.total_faltas,
        total_horas_extras: r.total_horas_extras,
        aprovadas: STATUS_APROVADAS.includes(r.status) ? 1 : 0,
        total_folhas: 1,
      });
    }
  }
  return Array.from(map.values());
}

export type AggregationParams = {
  competenciaId?: string | null;
  unidadeId?: string | null;
  tipo?: string | null;
};

export type AggregatedSummary = {
  totalFolhas: number;
  totalProfissionais: number;
  totalDiasTrabalhados: number;
  totalFaltas: number;
  totalHorasExtras: number;
  totalAprovadas: number;
  totalPendentes: number;
  linhas: FrequenciaRow[];
};

/**
 * Camada única de agregação de frequências.
 * Resolve a causa raiz de KPIs zerados em rascunho ao contar dinamicamente 
 * os detalhes quando a folha pai ainda não foi consolidada.
 */
export async function getAggregatedFrequencies(params: AggregationParams): Promise<AggregatedSummary> {
  let q = supabase
    .from("frequencias")
    .select(`
      id, 
      status, 
      tipo,
      total_profissionais, 
      total_dias_trabalhados, 
      total_faltas, 
      total_horas_extras,
      competencia_unidade:competencia_unidades!inner(
        unidade_id, 
        competencia_id,
        unidades(id, nome, sigla),
        competencia:competencias(id, ano, mes, status)
      )
    `)
    .is("deleted_at", null);

  if (params.competenciaId && params.competenciaId !== "all") {
    q = q.eq("competencia_unidade.competencia_id", params.competenciaId);
  }
  if (params.unidadeId && params.unidadeId !== "all") {
    q = q.eq("competencia_unidade.unidade_id", params.unidadeId);
  }
  if (params.tipo && params.tipo !== "all") {
    q = q.eq("tipo", params.tipo as any);
  }

  const { data: rawFolhas, error } = await q;
  if (error) throw error;

  const folhas = (rawFolhas ?? []) as unknown as FrequenciaRow[];

  const summary: AggregatedSummary = {
    totalFolhas: folhas.length,
    totalProfissionais: 0,
    totalDiasTrabalhados: 0,
    totalFaltas: 0,
    totalHorasExtras: 0,
    totalAprovadas: 0,
    totalPendentes: 0,
    linhas: [],
  };

  if (folhas.length === 0) return summary;

  // Processamento de cada folha para decidir se usa snapshot ou dinâmico
  const processadas = await Promise.all(folhas.map(async (f) => {
    const isConsolidado = ["enviada", "em_analise", "com_pendencias", "devolvida", "aprovada", "rejeitada", "arquivada"].includes(f.status);
    
    if (isConsolidado) {
      return f;
    }

    // Se rascunho, buscar detalhes
    const dynamicData = {
      total_profissionais: 0,
      total_dias_trabalhados: 0,
      total_faltas: 0,
      total_horas_extras: 0,
    };

    if (f.tipo === "contratados") {
      const { data: det } = await supabase
        .from("frequencias_contratados")
        .select("dias_trabalhados, dias_falta, he_50, he_100")
        .eq("competencia_id", (f.competencia_unidade as any).competencia_id)
        .eq("unidade_id", (f.competencia_unidade as any).unidade_id)
        .is("deleted_at", null);
        
      if (det) {
        dynamicData.total_profissionais = det.length;
        dynamicData.total_dias_trabalhados = det.reduce((acc, curr) => acc + (Number(curr.dias_trabalhados) || 0), 0);
        dynamicData.total_faltas = det.reduce((acc, curr) => acc + (Number(curr.dias_falta) || 0), 0);
        dynamicData.total_horas_extras = det.reduce((acc, curr) => acc + (Number(curr.he_50) || 0) + (Number(curr.he_100) || 0), 0);
      }
    } else {
      const { data: det } = await supabase
        .from("frequencia_profissional")
        .select("dias_trabalhados, faltas_injustificadas, faltas_justificadas, he_50, he_100")
        .eq("frequencia_id", f.id)
        .is("deleted_at", null);

      if (det) {
        dynamicData.total_profissionais = det.length;
        dynamicData.total_dias_trabalhados = det.reduce((acc, curr) => acc + (Number(curr.dias_trabalhados) || 0), 0);
        dynamicData.total_faltas = det.reduce((acc, curr) => acc + (Number(curr.faltas_injustificadas) || 0) + (Number(curr.faltas_justificadas) || 0), 0);
        dynamicData.total_horas_extras = det.reduce((acc, curr) => acc + (Number(curr.he_50) || 0) + (Number(curr.he_100) || 0), 0);
      }
    }

    return {
      ...f,
      ...dynamicData
    };
  }));

  summary.linhas = processadas;

  // Agregação final baseada nas linhas normalizadas
  for (const l of processadas) {
    summary.totalProfissionais += l.total_profissionais;
    summary.totalDiasTrabalhados += l.total_dias_trabalhados;
    summary.totalFaltas += l.total_faltas;
    summary.totalHorasExtras += l.total_horas_extras;
    
    if (STATUS_APROVADAS.includes(l.status)) summary.totalAprovadas++;
    else summary.totalPendentes++;
  }

  return summary;
}
