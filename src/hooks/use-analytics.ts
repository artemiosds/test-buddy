import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompetenciaAtiva } from "@/hooks/use-competencia-ativa";
import { usePermissions } from "@/hooks/use-permissions";
import {
  buildRanking,
  countByStatus,
  STATUS_APROVADAS,
  STATUS_ENVIADAS,
  STATUS_PENDENTES,
  sumField,
  type FrequenciaRow,
} from "@/lib/analytics-aggregations";

export type AnalyticsFilters = {
  competenciaId?: string | null;
  secretariaId?: string | null;
  unidadeId?: string | null;
  setorId?: string | null;
  cargoId?: string | null;
  funcaoId?: string | null;
  vinculoId?: string | null;
  status?: string | null;
};

export function useAnalytics(filters: AnalyticsFilters, options?: { staleTime?: number }) {
  const { data: competenciaAtiva } = useCompetenciaAtiva();
  const canSee = usePermissions().has;

  const staleTime = options?.staleTime ?? 60_000;
  const competenciaId = filters.competenciaId ?? competenciaAtiva?.id ?? null;

  const totalProfessionals = useQuery({
    queryKey: ["analytics", "totalProfessionals", filters],
    staleTime,
    queryFn: async () => {
      const q = supabase.from("profissionais").select("id", { head: true, count: "exact" }).is("deleted_at", null);
      if (filters.unidadeId) q.eq("unidade_id", filters.unidadeId);
      if (filters.setorId) q.eq("setor_id", filters.setorId);
      if (filters.cargoId) q.eq("cargo_id", filters.cargoId);
      if (filters.funcaoId) q.eq("funcao_id", filters.funcaoId);
      if (filters.vinculoId) q.eq("vinculo_id", filters.vinculoId);
      if (filters.status) q.eq("status", filters.status as never);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!canSee && true,
  });

  const totalUnidades = useQuery({
    queryKey: ["analytics", "totalUnidades", filters.secretariaId],
    staleTime,
    queryFn: async () => {
      const { count, error } = await supabase.from("unidades").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "ativa");
      if (error) throw error;
      return count ?? 0;
    },
    enabled: true,
  });

  const totalSetores = useQuery({
    queryKey: ["analytics", "totalSetores"],
    staleTime,
    queryFn: async () => {
      const { count, error } = await supabase.from("setores").select("id", { count: "exact", head: true }).is("deleted_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const totalCargos = useQuery({
    queryKey: ["analytics", "totalCargos"],
    staleTime,
    queryFn: async () => {
      const { count, error } = await supabase.from("cargos").select("id", { count: "exact", head: true }).is("deleted_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const totalFuncoes = useQuery({
    queryKey: ["analytics", "totalFuncoes"],
    staleTime,
    queryFn: async () => {
      const { count, error } = await supabase.from("funcoes").select("id", { count: "exact", head: true }).is("deleted_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const pendencias = useQuery({
    queryKey: ["analytics", "pendencias", filters],
    staleTime,
    queryFn: async () => {
      const q = supabase
        .from("frequencia_pendencias")
        .select("id, frequencias!inner(competencia_unidades!inner(unidade_id))", { count: "exact", head: true })
        .is("deleted_at", null);

      if (filters.unidadeId) {
        q.eq("frequencias.competencia_unidades.unidade_id" as never, filters.unidadeId);
      }

      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Frequências da competência filtrada (todas linhas com totais pré-agregados).
  // Fonte: `frequencias.total_profissionais/total_faltas/total_horas_extras` já
  // agregados por unidade+competência+tipo. RLS restringe por unidade do usuário.
  const frequencias = useQuery({
    queryKey: [
      "analytics",
      "frequencias",
      competenciaId,
      filters.unidadeId ?? null,
    ],
    staleTime,
    enabled: !!competenciaId,
    queryFn: async () => {
      let q = supabase
        .from("frequencias")
        .select(
          "id, status, total_profissionais, total_faltas, total_horas_extras, competencia_unidades!inner(competencia_id, unidade_id, unidades!inner(id, nome, sigla))",
        )
        .is("deleted_at", null)
        .eq("competencia_unidades.competencia_id", competenciaId as string);
      if (filters.unidadeId) {
        q = q.eq("competencia_unidades.unidade_id", filters.unidadeId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as FrequenciaRow[];
    },
  });

  const rows = frequencias.data ?? [];
  const frequenciasEnviadas = countByStatus(rows, STATUS_ENVIADAS);
  const frequenciasPendentes = countByStatus(rows, STATUS_PENDENTES);
  const frequenciasAprovadas = countByStatus(rows, STATUS_APROVADAS);
  const totalHorasExtras = sumField(rows, "total_horas_extras");
  const totalFaltas = sumField(rows, "total_faltas");
  const ranking = buildRanking(rows);

  return {
    competenciaAtiva,
    competenciaId,
    totalProfessionals,
    totalUnidades,
    totalSetores,
    totalCargos,
    totalFuncoes,
    pendencias,
    frequencias,
    frequenciasEnviadas,
    frequenciasPendentes,
    frequenciasAprovadas,
    totalHorasExtras,
    totalFaltas,
    ranking,
    refetch: () => Promise.all([
      totalProfessionals.refetch(),
      totalUnidades.refetch(),
      totalSetores.refetch(),
      totalCargos.refetch(),
      totalFuncoes.refetch(),
      pendencias.refetch(),
      frequencias.refetch(),
    ]),
    lastUpdated: Date.now(),
  };
}
