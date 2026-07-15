import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompetenciaAtiva } from "@/hooks/use-competencia-ativa";
import { useCurrentUser, usePermissions } from "@/hooks/use-permissions";

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
  const { data: me } = useCurrentUser();

  const canSee = usePermissions().has;

  const staleTime = options?.staleTime ?? 60_000;

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

  // Indicators that require aggregated queries (prepared for implementation)
  const prepared = {
    frequencies: {
      prepared: true,
      reason:
        "Frequências (enviadas/pendentes/aprovadas) require aggregated queries or RPCs on the backend. Marked as prepared for implementation; see PR notes.",
    },
    extraHours: {
      prepared: true,
      reason:
        "Total de horas extras prioritized but requires SUM aggregation (preferred via view/RPC). Prepared for implementation.",
    },
    charts: {
      prepared: true,
      reason:
        "Charts by unit/sector/vinculo require GROUP BY aggregations. Prefer backend view/RPC. Marked prepared.",
    },
    ranking: {
      prepared: true,
      reason: "Ranking requires aggregated indicators per unit; prefer backend aggregation.",
    },
  } as const;

  return {
    competenciaAtiva,
    totalProfessionals,
    totalUnidades,
    totalSetores,
    totalCargos,
    totalFuncoes,
    pendencias,
    prepared,
    refetch: () => Promise.all([
      totalProfessionals.refetch(),
      totalUnidades.refetch(),
      totalSetores.refetch(),
      totalCargos.refetch(),
      totalFuncoes.refetch(),
      pendencias.refetch(),
    ]),
    lastUpdated: Date.now(),
  };
}
