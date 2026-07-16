import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompetenciaAtiva } from "@/hooks/use-competencia-ativa";
import { usePermissions } from "@/hooks/use-permissions";

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
      return (data ?? []) as Array<{
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
      }>;
    },
  });

  const rows = frequencias.data ?? [];
  const countBy = (statuses: string[]) => rows.filter((r) => statuses.includes(r.status)).length;
  const sumBy = (field: "total_faltas" | "total_horas_extras") =>
    rows.reduce((acc, r) => acc + Number(r[field] ?? 0), 0);

  const frequenciasEnviadas = countBy(["enviada", "em_analise", "com_pendencias"]);
  const frequenciasPendentes = countBy(["rascunho"]);
  const frequenciasAprovadas = countBy(["aprovada"]);
  const totalHorasExtras = sumBy("total_horas_extras");
  const totalFaltas = sumBy("total_faltas");

  // Ranking por unidade: agrega múltiplas linhas de `frequencias` (tipo efetivo/contratado)
  // por unidade. Ordena por total de horas extras desc.
  type RankingRow = {
    unidade_id: string;
    unidade_nome: string;
    unidade_sigla: string | null;
    total_profissionais: number;
    total_faltas: number;
    total_horas_extras: number;
    aprovadas: number;
    total_folhas: number;
  };
  const rankingMap = new Map<string, RankingRow>();
  for (const r of rows) {
    const u = r.competencia_unidades.unidades;
    const cur = rankingMap.get(u.id) ?? {
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
    rankingMap.set(u.id, cur);
  }
  const ranking = Array.from(rankingMap.values()).sort(
    (a, b) => b.total_horas_extras - a.total_horas_extras,
  );

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
