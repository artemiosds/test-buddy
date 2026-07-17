import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
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

  // ---- Sublote GP: breakdowns e alertas usados pelo Dashboard Executivo. ----
  // Todas as queries respeitam RLS (nenhum bypass); dados de leitura direta
  // de `profissionais`/`unidades`/`setores`, agregados no cliente.

  const statusBreakdown = useQuery({
    queryKey: ["analytics", "statusBreakdown", filters.unidadeId, filters.setorId],
    staleTime,
    queryFn: async () => {
      let q = supabase.from("profissionais").select("status").is("deleted_at", null).limit(5000);
      if (filters.unidadeId) q = q.eq("unidade_id", filters.unidadeId);
      if (filters.setorId) q = q.eq("setor_id", filters.setorId);
      const { data, error } = await q;
      if (error) throw error;
      const acc: Record<string, number> = {};
      for (const r of data ?? []) {
        const s = (r as { status: string | null }).status ?? "indefinido";
        acc[s] = (acc[s] ?? 0) + 1;
      }
      return acc;
    },
  });

  const vinculoBreakdown = useQuery({
    queryKey: ["analytics", "vinculoBreakdown", filters.unidadeId, filters.setorId],
    staleTime,
    queryFn: async () => {
      let q = supabase
        .from("profissionais")
        .select("vinculo:vinculos(natureza)")
        .is("deleted_at", null)
        .limit(5000);
      if (filters.unidadeId) q = q.eq("unidade_id", filters.unidadeId);
      if (filters.setorId) q = q.eq("setor_id", filters.setorId);
      const { data, error } = await q;
      if (error) throw error;
      let efetivos = 0;
      let temporarios = 0;
      let outros = 0;
      for (const r of (data ?? []) as Array<{ vinculo: { natureza: string | null } | null }>) {
        const nat = r.vinculo?.natureza ?? null;
        if (nat === "efetivo") efetivos += 1;
        else if (nat === "temporario") temporarios += 1;
        else outros += 1;
      }
      return { efetivos, temporarios, outros };
    },
  });

  const alertas = useQuery({
    queryKey: ["analytics", "alertas"],
    staleTime,
    queryFn: async () => {
      const headCount = async (
        table: "profissionais" | "unidades",
        col: string,
      ) => {
        const { count, error } = await supabase
          .from(table)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .select("id", { count: "exact", head: true } as any)
          .is("deleted_at", null)
          .is(col, null);
        if (error) throw error;
        return count ?? 0;
      };

      const [semUnidade, semSetor, semCargo, semFuncao, unidadesSemGestor] = await Promise.all([
        headCount("profissionais", "unidade_id"),
        headCount("profissionais", "setor_id"),
        headCount("profissionais", "cargo_id"),
        headCount("profissionais", "funcao_id"),
        headCount("unidades", "responsavel_nome"),
      ]);

      // Setores vazios: setores ativos sem nenhum profissional vinculado.
      const [setoresRes, profSetoresRes] = await Promise.all([
        supabase.from("setores").select("id").is("deleted_at", null).limit(2000),
        supabase
          .from("profissionais")
          .select("setor_id")
          .is("deleted_at", null)
          .not("setor_id", "is", null)
          .limit(5000),
      ]);
      if (setoresRes.error) throw setoresRes.error;
      if (profSetoresRes.error) throw profSetoresRes.error;
      const ocupados = new Set(
        (profSetoresRes.data ?? [])
          .map((r) => (r as { setor_id: string | null }).setor_id)
          .filter((v): v is string => !!v),
      );
      const setoresVazios = (setoresRes.data ?? []).filter(
        (s) => !ocupados.has((s as { id: string }).id),
      ).length;

      return { semUnidade, semSetor, semCargo, semFuncao, unidadesSemGestor, setoresVazios };
    },
  });

  const distribuicaoUnidade = useQuery({
    queryKey: ["analytics", "distribuicaoUnidade"],
    staleTime,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("unidade_id, unidades(nome, sigla)")
        .is("deleted_at", null)
        .not("unidade_id", "is", null)
        .limit(5000);
      if (error) throw error;
      const map = new Map<string, { id: string; nome: string; sigla: string | null; total: number }>();
      for (const r of (data ?? []) as Array<{
        unidade_id: string | null;
        unidades: { nome: string; sigla: string | null } | null;
      }>) {
        if (!r.unidade_id) continue;
        const cur = map.get(r.unidade_id) ?? {
          id: r.unidade_id,
          nome: r.unidades?.nome ?? "—",
          sigla: r.unidades?.sigla ?? null,
          total: 0,
        };
        cur.total += 1;
        map.set(r.unidade_id, cur);
      }
      return Array.from(map.values()).sort((a, b) => b.total - a.total);
    },
  });

  const distribuicaoCargo = useQuery({
    queryKey: ["analytics", "distribuicaoCargo"],
    staleTime,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("cargo_id, cargos(nome)")
        .is("deleted_at", null)
        .not("cargo_id", "is", null)
        .limit(5000);
      if (error) throw error;
      const map = new Map<string, { id: string; nome: string; total: number }>();
      for (const r of (data ?? []) as Array<{
        cargo_id: string | null;
        cargos: { nome: string } | null;
      }>) {
        if (!r.cargo_id) continue;
        const cur = map.get(r.cargo_id) ?? { id: r.cargo_id, nome: r.cargos?.nome ?? "—", total: 0 };
        cur.total += 1;
        map.set(r.cargo_id, cur);
      }
      return Array.from(map.values()).sort((a, b) => b.total - a.total);
    },
  });

  const distribuicaoSetor = useQuery({
    queryKey: ["analytics", "distribuicaoSetor"],
    staleTime,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("setor_id, setores(nome)")
        .is("deleted_at", null)
        .not("setor_id", "is", null)
        .limit(5000);
      if (error) throw error;
      const map = new Map<string, { id: string; nome: string; total: number }>();
      for (const r of (data ?? []) as Array<{
        setor_id: string | null;
        setores: { nome: string } | null;
      }>) {
        if (!r.setor_id) continue;
        const cur = map.get(r.setor_id) ?? { id: r.setor_id, nome: r.setores?.nome ?? "—", total: 0 };
        cur.total += 1;
        map.set(r.setor_id, cur);
      }
      return Array.from(map.values()).sort((a, b) => b.total - a.total);
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
          "status, total_profissionais, total_faltas, total_horas_extras, competencia_unidades!inner(unidade_id, unidades!inner(id, nome, sigla))",
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

  // 9D: memoiza agregações — só recomputa quando o array de linhas muda de
  // referência (React Query estabiliza a referência entre renders).
  const aggregates = useMemo(() => {
    const rows = frequencias.data ?? [];
    return {
      frequenciasEnviadas: countByStatus(rows, STATUS_ENVIADAS),
      frequenciasPendentes: countByStatus(rows, STATUS_PENDENTES),
      frequenciasAprovadas: countByStatus(rows, STATUS_APROVADAS),
      totalHorasExtras: sumField(rows, "total_horas_extras"),
      totalFaltas: sumField(rows, "total_faltas"),
      ranking: buildRanking(rows),
    };
  }, [frequencias.data]);
  const {
    frequenciasEnviadas,
    frequenciasPendentes,
    frequenciasAprovadas,
    totalHorasExtras,
    totalFaltas,
    ranking,
  } = aggregates;

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
    statusBreakdown,
    vinculoBreakdown,
    alertas,
    distribuicaoUnidade,
    distribuicaoCargo,
    distribuicaoSetor,
    refetch: () => Promise.all([
      totalProfessionals.refetch(),
      totalUnidades.refetch(),
      totalSetores.refetch(),
      totalCargos.refetch(),
      totalFuncoes.refetch(),
      pendencias.refetch(),
      frequencias.refetch(),
      statusBreakdown.refetch(),
      vinculoBreakdown.refetch(),
      alertas.refetch(),
      distribuicaoUnidade.refetch(),
      distribuicaoCargo.refetch(),
      distribuicaoSetor.refetch(),
    ]),
    lastUpdated: Date.now(),
  };
}
