import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompetenciaAtiva } from "@/hooks/use-competencia-ativa";
import { usePermissions } from "@/hooks/use-permissions";
import {
  STATUS_APROVADAS,
  STATUS_PENDENTES,
  getAggregatedFrequencies,
  buildRanking,
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
  tipo?: "contratados" | "efetivos" | "all";
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
        vinculo_breakdown: Record<string, number>;
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

  const frequenciasAggregated = useQuery({
    queryKey: ["analytics", "frequencias-aggregated", competenciaId, filters.unidadeId, filters.tipo],
    staleTime,
    gcTime,
    enabled: !!competenciaId,
    queryFn: () => getAggregatedFrequencies({
      competenciaId,
      unidadeId: filters.unidadeId,
      tipo: filters.tipo ?? "all"
    }),
  });

  const frequencias = frequenciasAggregated.data?.linhas ?? [];

  const totals = {
    profissionais: frequenciasAggregated.data?.totalProfissionais ?? 0,
    faltas: frequenciasAggregated.data?.totalFaltas ?? 0,
    horasExtras: frequenciasAggregated.data?.totalHorasExtras ?? 0,
    folhasAprovadas: frequenciasAggregated.data?.totalAprovadas ?? 0,
    folhasPendentes: frequenciasAggregated.data?.totalPendentes ?? 0,
    totalFolhas: frequenciasAggregated.data?.totalFolhas ?? 0,
  };

  const ranking = buildRanking(frequencias);

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
    data: summary.data?.status_breakdown ?? {
      afastado: 0,
      ativo: 0,
      desligado: 0,
      ferias: 0,
      licenca: 0,
    },
    isLoading: summary.isLoading,
    isSuccess: summary.isSuccess,
    isError: summary.isError,
  };

  const vinculoBreakdown = {
    data: summary.data?.vinculo_breakdown ?? {},
    isLoading: summary.isLoading,
    isSuccess: summary.isSuccess,
    isError: summary.isError,
  };

  const distribuicaoUnidade = {
    data: summary.data?.top_unidades ?? [],
    isLoading: summary.isLoading,
    isSuccess: summary.isSuccess,
    isError: summary.isError,
  };

  const distribuicaoCargo = {
    data: summary.data?.top_cargos ?? [],
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
      let qProf = supabase
        .from("profissionais")
        .select(`
          id, 
          nome_completo, 
          cpf,
          unidade_id, 
          setor_id, 
          situacao_funcional,
          unidades(id, nome, sigla), 
          setores!profissionais_setor_id_fkey(id, nome, status),
          cargos(id, nome),
          funcoes(id, nome)
        `)
        .is("deleted_at", null)
        .not("unidade_id", "is", null)
        .limit(10000);
      
      if (filters.unidadeId) qProf = qProf.eq("unidade_id", filters.unidadeId);
      
      let qSectors = supabase
        .from("setores")
        .select("id, nome, status")
        .is("deleted_at", null);
      
      const [profRes, sectorsRes] = await Promise.all([qProf, qSectors]);
      
      if (profRes.error) throw profRes.error;
      if (sectorsRes.error) throw sectorsRes.error;

      const professionals = profRes.data || [];
      const sectors = sectorsRes.data || [];

      const profWithSetor = professionals.filter(p => !!p.setor_id);
      const profWithoutSetor = professionals.filter(p => !p.setor_id);
      
      const unidadesMap = new Map<string, {
        id: string;
        nome: string;
        sigla: string | null;
        total: number;
        comSetor: number;
        semSetor: number;
        setoresUtilizados: Set<string>;
      }>();

      for (const p of professionals) {
        const u = p.unidades as any;
        if (!u) continue;
        const uid = u.id;
        if (!unidadesMap.has(uid)) {
          unidadesMap.set(uid, {
            id: uid,
            nome: u.nome,
            sigla: u.sigla,
            total: 0,
            comSetor: 0,
            semSetor: 0,
            setoresUtilizados: new Set(),
          });
        }
        const stats = unidadesMap.get(uid)!;
        stats.total++;
        if (p.setor_id) {
          stats.comSetor++;
          stats.setoresUtilizados.add(p.setor_id);
        } else {
          stats.semSetor++;
        }
      }

      const totalDistribuicao = {
        totalSectors: sectors.length,
        sectorsInUse: new Set(profWithSetor.map(p => p.setor_id)).size,
        totalProfessionals: professionals.length,
        withSetor: profWithSetor.length,
        withoutSetor: profWithoutSetor.length,
      };

      return {
        totalDistribuicao,
        unidades: Array.from(unidadesMap.values()).map(u => ({
          ...u,
          setoresCount: u.setoresUtilizados.size
        })),
        raw: { professionals, sectors }
      };
    },
    enabled: !!canSee,
  });

  return {
    totalProfessionals,
    totalUnidades,
    totalSetores,
    totalCargos,
    totalFuncoes,
    pendencias,
    summary,
    frequencias,
    ranking,
    totals,
    integridade,
    alertas,
    rhKpis,
    statusBreakdown,
    vinculoBreakdown,
    distribuicaoUnidade,
    distribuicaoCargo,
    frequenciasAnterior,
    pendenciasAnterior,
    equipeProfissionais,
    distribuicaoSetor,
    loading:
      totalProfessionals.isLoading ||
      totalUnidades.isLoading ||
      summary.isLoading ||
      frequenciasAggregated.isLoading,
    refetch: async () => {
      await Promise.all([
        totalProfessionals.refetch(),
        totalUnidades.refetch(),
        summary.refetch(),
        frequenciasAggregated.refetch()
      ]);
    },
    competenciaId
  };
}
