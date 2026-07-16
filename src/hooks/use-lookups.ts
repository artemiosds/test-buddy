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
      if (opts?.status) q = q.eq("status", opts.status as never);
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

// ---------- Profissionais (lookup enxuto) ----------

export type ProfissionalLookup = {
  id: string;
  nome_completo: string;
  cpf: string | null;
  matricula: string | null;
};

export function useProfissionaisLookup(opts?: { unidadeId?: string | null; limit?: number }) {
  return useQuery({
    queryKey: ["lookup", "profissionais", opts?.unidadeId ?? null, opts?.limit ?? 500],
    staleTime: FIVE_MIN,
    queryFn: async () => {
      let q = supabase
        .from("profissionais")
        .select("id, nome_completo, cpf, matricula")
        .order("nome_completo")
        .limit(opts?.limit ?? 500);
      if (opts?.unidadeId) q = q.eq("unidade_id", opts.unidadeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ProfissionalLookup[];
    },
  });
}

// ---------- Usuários (lookup enxuto) ----------

export type UsuarioLookup = { id: string; nome: string | null; email: string };

export function useUsuariosLookup() {
  return useQuery({
    queryKey: ["lookup", "usuarios"],
    staleTime: FIVE_MIN,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nome, email")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as UsuarioLookup[];
    },
  });
}

// ---------- Feriados / Calendário institucional ----------

export type FeriadoLookup = {
  id: string;
  data: string;
  descricao: string | null;
  tipo: string | null;
};

export function useFeriadosLookup(opts?: { ano?: number }) {
  return useQuery({
    queryKey: ["lookup", "feriados", opts?.ano ?? null],
    staleTime: FIVE_MIN,
    queryFn: async () => {
      let q = supabase
        .from("calendario_institucional")
        .select("id, data, descricao, tipo")
        .order("data");
      if (opts?.ano) {
        q = q.gte("data", `${opts.ano}-01-01`).lte("data", `${opts.ano}-12-31`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as FeriadoLookup[];
    },
  });
}

// ---------- Assinaturas institucionais ----------

export type AssinaturaLookup = {
  id: string;
  cargo_titulo: string | null;
  nome_exibicao: string | null;
  unidade_id: string | null;
  ativo: boolean | null;
};

export function useAssinaturasLookup(opts?: { unidadeId?: string | null; ativasOnly?: boolean }) {
  return useQuery({
    queryKey: ["lookup", "assinaturas", opts?.unidadeId ?? null, !!opts?.ativasOnly],
    staleTime: FIVE_MIN,
    queryFn: async () => {
      let q = supabase
        .from("assinaturas_institucionais")
        .select("id, cargo_titulo, nome_exibicao, unidade_id, ativo")
        .order("cargo_titulo");
      if (opts?.unidadeId) q = q.eq("unidade_id", opts.unidadeId);
      if (opts?.ativasOnly) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AssinaturaLookup[];
    },
  });
}