import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnitScope } from "@/hooks/use-unit-scope";
import { calcularAniversariantes, type PessoaAniv } from "@/lib/aniversariantes";

/** Aniversariantes ativos no escopo do usuário (diretor: suas unidades; global: rede, ou unidade escolhida). */
export function useAniversariantes(unidadeFiltro?: string | null) {
  const { isGlobal, unidadesPermitidas, isResolved } = useUnitScope();
  const ids = isGlobal ? (unidadeFiltro ? [unidadeFiltro] : null) : unidadesPermitidas;
  const enabled = isResolved && (isGlobal || unidadesPermitidas.length > 0);

  const q = useQuery({
    queryKey: ["aniversariantes", isGlobal, ids],
    enabled,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<PessoaAniv[]> => {
      let query = supabase
        .from("profissionais")
        .select("id, nome_completo, nome_social, data_nascimento, unidade_id, cargo:cargo_id(nome), setor:setor_id(nome), unidade:unidade_id(nome, sigla)")
        .eq("status", "ativo")
        .is("deleted_at", null)
        .not("data_nascimento", "is", null)
        .limit(5000);
      if (ids) query = query.in("unidade_id", ids);
      const { data, error } = await query;
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data ?? []) as any[]).map((p) => ({
        id: p.id,
        nome: p.nome_social || p.nome_completo,
        data_nascimento: p.data_nascimento,
        cargo: p.cargo?.nome ?? null,
        setor: p.setor?.nome ?? null,
        unidade: p.unidade?.sigla || p.unidade?.nome || null,
      }));
    },
  });

  const calc = useMemo(() => calcularAniversariantes(q.data ?? []), [q.data]);
  return { ...calc, isLoading: q.isLoading, error: q.error };
}
