import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompetenciaAtiva } from "@/hooks/use-competencia-ativa";
import { usePermissions } from "@/hooks/use-permissions";
import {
  STATUS_APROVADAS,
  STATUS_ENVIADAS,
  STATUS_PENDENTES,
  type FrequenciaRow,
} from "@/lib/analytics-aggregations";
import { valoresDoFiltroSituacao } from "@/lib/situacao-funcional";

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

type IntegridadeRow = {
  unidade_id: string | null;
  sem_email: number | null;
  sem_telefone: number | null;
  sem_dados_bancarios: number | null;
  sem_matricula: number | null;
  sem_setor: number | null;
  sem_funcao: number | null;
  sem_cargo: number | null;
  total_profissionais: number | null;
  cadastros_incompletos: number | null;
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

export function useAnalytics(filters: AnalyticsFilters, options?: { staleTime?: number }) {
  const { data: competenciaAtiva } = useCompetenciaAtiva();
  const canSee = usePermissions().has;

  const staleTime = options?.staleTime ?? 300_000;
  const gcTime = 1_800_000;
  const competenciaId = (filters.competenciaId ?? competenciaAtiva?.id ?? null) as string | null;

  const totalProfessionals = useQuery({
    queryKey: ["analytics", "totalProfessionals", filters],
    staleTime,
    gcTime,
    queryFn: async () => {
      const q = supabase
        .from("profissionais")
        .select("id", { head: true, count: "exact" })
        .is("deleted_at", null);
      if (filters.unidadeId) q.eq("unidade_id", filters.unidadeId);
      if (filters.setorId) q.eq("setor_id", filters.setorId);
      if (filters.cargoId) q.eq("cargo_id", filters.cargoId);
      if (filters.funcaoId) q.eq("funcao_id", filters.funcaoId);
      if (filters.vinculoId) q.eq("vinculo_id", filters.vinculoId);
      if (filters.status) q.in("status", valoresDoFiltroSituacao(filters.status) as never[]);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!canSee,
  });

  const totalUnidades = useQuery({
    queryKey: ["analytics", "totalUnidades", filters.secretariaId],
    staleTime,
    gcTime,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("unidades")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("status", "ativa");
      if (error) throw error;
      return count ?? 0;
    },
    enabled: true,
  });

  const totalSetores = useQuery({
    queryKey: ["analytics", "totalSetores"],
    staleTime,
    gcTime,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("setores")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const totalCargos = useQuery({
    queryKey: ["analytics", "totalCargos"],
    staleTime,
    gcTime,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("cargos")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const totalFuncoes = useQuery({
    queryKey: ["analytics", "totalFuncoes"],
    staleTime,
    gcTime,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("funcoes")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const pendencias = useQuery({
    queryKey: ["analytics", "pendencias", filters],
    staleTime,
    gcTime,
    queryFn: async () => {
      const q = supabase
        .from("frequencia_pendencias")
        .select("id, frequencias!inner(competencia_unidades!inner(unidade_id))", {
          count: "exact",
          head: true,
        })
        .is("deleted_at", null);

      if (filters.unidadeId) {
        q.eq("frequencias.competencia_unidades.unidade_id" as never, filters.unidadeId);
      }

      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });

  const summary = useQuery({
    queryKey: ["analytics", "summary", competenciaId, filters.unidadeId],
    staleTime,
    gcTime,
    queryFn: async () => {
      if (!competenciaId) return null;
      const { data, error } = await supabase.rpc("get_dashboard_summary", {
        p_competencia_id: competenciaId,
        p_unidade_id: filters.unidadeId || undefined,
      });
      if (error) throw error;
      return data as {
        status_breakdown: Record<string, number>;
        top_unidades: Array<{ id: string; nome: string; sigla: string | null; total: number }>;
        top_cargos: Array<{ id: string; nome: string; total: number }>;
        vinculo_breakdown: { efetivos: number; temporarios: number; outros: number };
        rh_kpis: {
          enviadas: number;
          pendentes: number;
          aprovadas: number;
          total_horas_extras: number;
          total_faltas: number;
        };
      };
    },
    enabled: !!competenciaId,
  });

  const frequencias = useQuery({
    queryKey: ["analytics", "frequencias", competenciaId, filters.unidadeId ?? null],
    staleTime,
    gcTime,
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

  const ranking = useQuery({
    queryKey: ["analytics", "ranking", competenciaId],
    staleTime,
    gcTime,
    enabled: !!competenciaId,
    queryFn: async () => {
      if (!competenciaId) return [];
      const { data, error } = await supabase.rpc("get_ranking_rh", {
        p_competencia_id: competenciaId,
      });
      if (error) throw error;
      return (data || []) as RankingRow[];
    },
  });

  const integridade = useQuery({
    queryKey: ["analytics", "integridade", filters.unidadeId],
    staleTime,
    gcTime,
    queryFn: async () => {
      let q = supabase
        .from("v_integridade_profissionais")
        .select("*");
      
      if (filters.unidadeId) {
        q = q.eq("unidade_id", filters.unidadeId);
      }

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data || []) as IntegridadeRow[];
      const totals = rows.reduce((acc, curr) => ({
        total: acc.total + (curr.total_profissionais || 0),
        cadastrosIncompletos: acc.cadastrosIncompletos + (curr.cadastros_incompletos || 0),
        faltas: {
          cargo: acc.faltas.cargo + (curr.sem_cargo || 0),
          funcao: acc.faltas.funcao + (curr.sem_funcao || 0),
          setor: acc.faltas.setor + (curr.sem_setor || 0),
          unidade: acc.faltas.unidade + (curr.unidade_id ? 0 : (curr.total_profissionais || 0)),
          vinculo: acc.faltas.vinculo + 0,
          matricula: acc.faltas.matricula + (curr.sem_matricula || 0),
          telefone: acc.faltas.telefone + (curr.sem_telefone || 0),
          email: acc.faltas.email + (curr.sem_email || 0),
          banco: acc.faltas.banco + (curr.sem_dados_bancarios || 0),
        }
      }), { 
        total: 0, 
        cadastrosIncompletos: 0, 
        faltas: { cargo: 0, funcao: 0, setor: 0, unidade: 0, vinculo: 0, matricula: 0, telefone: 0, email: 0, banco: 0 } 
      });

      return totals;
    },
  });

  const alertas = useQuery({
    queryKey: ["analytics", "alertas"],
    staleTime,
    gcTime,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_integridade_profissionais")
        .select("*")
        .limit(1000);
      if (error) throw error;
      
      const rows = (data || []) as IntegridadeRow[];

      const totals = rows.reduce((acc, curr) => ({
        semUnidade: acc.semUnidade + (curr.unidade_id ? 0 : (curr.total_profissionais || 0)),
        semSetor: acc.semSetor + (curr.sem_setor || 0),
        semCargo: acc.semCargo + (curr.sem_cargo || 0),
        semFuncao: acc.semFuncao + (curr.sem_funcao || 0),
      }), { semUnidade: 0, semSetor: 0, semCargo: 0, semFuncao: 0 });

      const [unidadesSemGestorRes, setoresSemRespRes] = await Promise.all([
        supabase
          .from("unidades")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .is("responsavel_nome", null),
        supabase
          .from("setores")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .is("gestor_id", null)
          .is("responsavel_nome", null),
      ]);

      return {
        ...totals,
        unidadesSemGestor: unidadesSemGestorRes.count ?? 0,
        setoresSemResponsavel: setoresSemRespRes.count ?? 0,
        setoresVazios: 0,
      };
    },
  });

  const rhKpis = summary.data?.rh_kpis || {
    enviadas: 0,
    pendentes: 0,
    aprovadas: 0,
    total_horas_extras: 0,
    total_faltas: 0,
  };

  const statusBreakdown = {
    data: summary.data?.status_breakdown,
    isLoading: summary.isLoading,
    isSuccess: summary.isSuccess,
    isError: summary.isError,
  };

  const vinculoBreakdown = {
    data: summary.data?.vinculo_breakdown,
    isLoading: summary.isLoading,
    isSuccess: summary.isSuccess,
    isError: summary.isError,
  };

  const distribuicaoUnidade = {
    data: summary.data?.top_unidades,
    isLoading: summary.isLoading,
    isSuccess: summary.isSuccess,
    isError: summary.isError,
  };

  const distribuicaoCargo = {
    data: summary.data?.top_cargos,
    isLoading: summary.isLoading,
    isSuccess: summary.isSuccess,
    isError: summary.isError,
  };

  const previousCompetenciaId = useQuery({
    queryKey: ["analytics", "prevCompetencia", competenciaId],
    staleTime,
    gcTime,
    enabled: !!competenciaId,
    queryFn: async () => {
      const { data: cur } = await supabase
        .from("competencias")
        .select("mes, ano")
        .eq("id", competenciaId as string)
        .maybeSingle();
      if (!cur) return null;
      const mesAnt = cur.mes === 1 ? 12 : cur.mes - 1;
      const anoAnt = cur.mes === 1 ? cur.ano - 1 : cur.ano;
      const { data } = await supabase
        .from("competencias")
        .select("id")
        .eq("mes", mesAnt)
        .eq("ano", anoAnt)
        .maybeSingle();
      return data?.id ?? null;
    },
  });

  const frequenciasAnterior = useQuery({
    queryKey: [
      "analytics",
      "frequenciasAnterior",
      previousCompetenciaId.data,
      filters.unidadeId ?? null,
    ],
    staleTime,
    gcTime,
    enabled: !!previousCompetenciaId.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("frequencias")
        .select(
          "status, total_profissionais, total_faltas, total_horas_extras, competencia_unidades!inner(unidade_id)",
        )
        .is("deleted_at", null)
        .eq("competencia_unidades.competencia_id", previousCompetenciaId.data as string);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const pendenciasAnterior = useQuery({
    queryKey: [
      "analytics",
      "pendenciasAnterior",
      previousCompetenciaId.data,
      filters.unidadeId ?? null,
    ],
    staleTime,
    gcTime,
    enabled: !!previousCompetenciaId.data,
    queryFn: async () => {
      const q = supabase
        .from("frequencia_pendencias")
        .select("id, frequencias!inner(competencia_unidades!inner(competencia_id, unidade_id))", {
          count: "exact",
          head: true,
        })
        .is("deleted_at", null)
        .eq(
          "frequencias.competencia_unidades.competencia_id" as never,
          previousCompetenciaId.data as string,
        );
      if (filters.unidadeId)
        q.eq("frequencias.competencia_unidades.unidade_id" as never, filters.unidadeId);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });

  const equipeProfissionais = useQuery({
    queryKey: ["analytics", "equipeProfissionais", filters],
    staleTime,
    gcTime,
    queryFn: async () => {
      let q = supabase
        .from("profissionais")
        .select(
          "id, nome_completo, matricula, status, unidade:unidades(nome, sigla), setor:setores!profissionais_setor_id_fkey(nome), cargo:cargos(nome), funcao:funcoes(nome)",
        )
        .is("deleted_at", null)
        .order("nome_completo")
        .limit(1000);
      if (filters.unidadeId) q = q.eq("unidade_id", filters.unidadeId);
      if (filters.cargoId) q = q.eq("cargo_id", filters.cargoId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const distribuicaoSetor = useQuery({
    queryKey: ["analytics", "distribuicaoSetor", filters],
    staleTime,
    gcTime,
    queryFn: async () => {
      let q = supabase
        .from("profissionais")
        .select("setor_id, setores!profissionais_setor_id_fkey(nome)")
        .is("deleted_at", null)
        .not("setor_id", "is", null)
        .limit(5000);
      if (filters.unidadeId) q = q.eq("unidade_id", filters.unidadeId);
      const { data, error } = await q;
      if (error) throw error;
      const map = new Map<string, { id: string; nome: string; total: number }>();
      for (const r of (data ?? []) as any[]) {
        if (!r.setor_id) continue;
        const cur = map.get(r.setor_id) ?? { id: r.setor_id, nome: r.setores?.nome ?? "—", total: 0 };
        cur.total += 1;
        map.set(r.setor_id, cur);
      }
      return Array.from(map.values()).sort((a, b) => b.total - a.total);
    },
  });

  const quadroLotacao = useQuery({
    queryKey: ["analytics", "quadroLotacao"],
    staleTime,
    gcTime,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("status, unidade_id, setor_id, cargo_id, funcao_id, unidade:unidades(nome, sigla), setor:setores!profissionais_setor_id_fkey(nome), cargo:cargos(nome), funcao:funcoes(nome)")
        .is("deleted_at", null)
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  return {
    competenciaAtiva,
    competenciaId,
    totalProfessionals,
    totalUnidades,
    totalSetores,
    totalCargos,
    totalFuncoes,
    pendencias,
    summary,
    frequencias,
    ranking: {
      data: ranking.data ?? [],
      isLoading: ranking.isLoading,
      isSuccess: ranking.isSuccess,
      isError: ranking.isError,
      refetch: ranking.refetch,
    },
    integridade,
    alertas,
    frequenciasEnviadas: rhKpis.enviadas,
    frequenciasPendentes: rhKpis.pendentes,
    frequenciasAprovadas: rhKpis.aprovadas,
    totalHorasExtras: rhKpis.total_horas_extras,
    totalFaltas: rhKpis.total_faltas,
    statusBreakdown,
    vinculoBreakdown,
    distribuicaoUnidade,
    distribuicaoCargo,
    distribuicaoSetor,
    equipeProfissionais,
    frequenciasAnterior,
    pendenciasAnterior,
    quadroLotacao,
    // Add missing legacy properties as mocks to avoid breaking dependent pages
    distribuicaoFuncao: { data: [], isLoading: false, isSuccess: true, isError: false },
    refetch: () =>
      Promise.all([
        totalProfessionals.refetch(),
        totalUnidades.refetch(),
        totalSetores.refetch(),
        totalCargos.refetch(),
        totalFuncoes.refetch(),
        pendencias.refetch(),
        summary.refetch(),
        frequencias.refetch(),
        ranking.refetch(),
        alertas.refetch(),
        integridade.refetch(),
        equipeProfissionais.refetch(),
        distribuicaoSetor.refetch(),
        quadroLotacao.refetch(),
      ]),
    lastUpdated: Date.now(),
  };
}
