import { useQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hooks de lookup — listas curtas e estáveis usadas em filtros e selects.
 * Fonte única de verdade para as consultas simples de cadastros.
 *
 * Convenções:
 *  - `staleTime: 5 min`, sem refetch em foco.
 *  - Retornam apenas colunas mínimas (id/nome/sigla/…) para bundle enxuto.
 *  - `select` sempre exclui `deleted_at` quando a coluna existe.
 */

const FIVE_MIN = 5 * 60_000;

export type LookupOption = { id: string; nome: string; sigla?: string | null };

// ---------- Unidades ----------

export type UnidadeLookup = { id: string; nome: string; sigla: string | null };

export const unidadesLookupOptions = (opts?: { ativasOnly?: boolean }) =>
  queryOptions({
    queryKey: ["lookup", "unidades", { ativas: !!opts?.ativasOnly }],
    staleTime: FIVE_MIN,
    queryFn: async () => {
      let q = supabase
        .from("unidades")
        .select("id, nome, sigla")
        .is("deleted_at", null)
        .order("nome");
      if (opts?.ativasOnly) q = q.eq("status", "ativa");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as UnidadeLookup[];
    },
  });

export function useUnidadesLookup(opts?: { ativasOnly?: boolean }) {
  return useQuery(unidadesLookupOptions(opts));
}

// ---------- Setores ----------

export type SetorLookup = { id: string; nome: string; unidade_id: string | null };

export function useSetoresLookup(opts?: { unidadeId?: string | null }) {
  return useQuery({
    queryKey: ["lookup", "setores", opts?.unidadeId ?? null],
    staleTime: FIVE_MIN,
    queryFn: async () => {
      let q = supabase
        .from("setores")
        .select("id, nome, unidade_id")
        .is("deleted_at", null)
        .order("nome");
      if (opts?.unidadeId) q = q.eq("unidade_id", opts.unidadeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SetorLookup[];
    },
  });
}

// ---------- Cargos / Funções / Vínculos ----------

export function useCargosLookup() {
  return useQuery({
    queryKey: ["lookup", "cargos"],
    staleTime: FIVE_MIN,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargos")
        .select("id, nome")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as LookupOption[];
    },
  });
}

export function useFuncoesLookup() {
  return useQuery({
    queryKey: ["lookup", "funcoes"],
    staleTime: FIVE_MIN,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcoes")
        .select("id, nome")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as LookupOption[];
    },
  });
}

export function useVinculosLookup() {
  return useQuery({
    queryKey: ["lookup", "vinculos"],
    staleTime: FIVE_MIN,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vinculos")
        .select("id, nome")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as LookupOption[];
    },
  });
}

// ---------- Competências ----------

export type CompetenciaLookup = {
  id: string;
  mes: number;
  ano: number;
  status: string | null;
};

export function useCompetenciasLookup(opts?: { status?: string | null }) {
  return useQuery({
    queryKey: ["lookup", "competencias", opts?.status ?? null],
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase
        .from("competencias")
        .select("id, mes, ano, status")
        .is("deleted_at", null)
        .order("ano", { ascending: false })
        .order("mes", { ascending: false });
      if (opts?.status) q = q.eq("status", opts.status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CompetenciaLookup[];
    },
  });
}

// ---------- Tipos de unidade ----------

export function useTiposUnidadeLookup() {
  return useQuery({
    queryKey: ["lookup", "tipos-unidade"],
    staleTime: FIVE_MIN,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_unidade")
        .select("id, nome")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as LookupOption[];
    },
  });
}