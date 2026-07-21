import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProfConferencia } from "@/lib/situacao-funcional";

/**
 * Busca dados de conferência (situação funcional, dados cadastrais e
 * bancários) para uma lista de profissionais visíveis na tela.
 *
 * Consulta apenas a tabela `profissionais` (RLS já aplicada) e a contagem
 * de pendências abertas — não altera nenhum server function nem regra
 * de negócio.
 */
export function useConferenciaProfissionais(ids: string[]) {
  const key = [...ids].sort().join(",");
  return useQuery({
    queryKey: ["conferencia-profissionais", key],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: profs } = await supabase
        .from("profissionais")
        .select(
          "id, cpf, banco, agencia, conta_corrente, matricula, status, situacao_funcional, cargo_id, funcao_id, setor_id, unidade_id, cargos(nome), funcoes(nome), setores!profissionais_setor_id_fkey(nome)",
        )
        .in("id", ids);

      // Pendências abertas por profissional (via frequencia_profissional).
      const { data: pends } = await supabase
        .from("frequencia_pendencias")
        .select("profissional_id")
        .in("profissional_id", ids)
        .is("resolvida_em", null);

      const pendSet = new Set<string>();
      for (const row of pends ?? []) {
        const pid = (row as { profissional_id: string | null }).profissional_id;
        if (pid) pendSet.add(pid);
      }

      const map = new Map<string, ProfConferencia>();
      for (const p of profs ?? []) {
        const row = p as Record<string, unknown> & {
          cargos?: { nome: string | null } | null;
          funcoes?: { nome: string | null } | null;
          setores?: { nome: string | null } | null;
        };
        const id = String(row.id);
        map.set(id, {
          id,
          cpf: (row.cpf as string | null) ?? null,
          banco: (row.banco as string | null) ?? null,
          agencia: (row.agencia as string | null) ?? null,
          conta_corrente: (row.conta_corrente as string | null) ?? null,
          matricula: (row.matricula as string | null) ?? null,
          status: (row.status as string | null) ?? null,
          situacao_funcional: (row.situacao_funcional as string | null) ?? null,
          cargo_id: (row.cargo_id as string | null) ?? null,
          funcao_id: (row.funcao_id as string | null) ?? null,
          setor_id: (row.setor_id as string | null) ?? null,
          unidade_id: (row.unidade_id as string | null) ?? null,
          cargo: row.cargos?.nome ?? null,
          funcao: row.funcoes?.nome ?? null,
          setor: row.setores?.nome ?? null,
          tem_pendencia: pendSet.has(id),
        });
      }
      return map;
    },
  });
}

/** Enriquece um `ProfConferencia` parcial (o que já veio do servidor da folha/piso)
 *  com o mapa retornado pela hook. Mantém tudo que já estava. */
export function mergeConferencia(
  base: ProfConferencia,
  map: Map<string, ProfConferencia> | undefined,
): ProfConferencia {
  if (!map) return base;
  const extra = map.get(base.id);
  if (!extra) return base;
  return { ...extra, ...base, tem_pendencia: extra.tem_pendencia ?? base.tem_pendencia,
    situacao_funcional: base.situacao_funcional ?? extra.situacao_funcional,
    cpf: base.cpf ?? extra.cpf,
    banco: base.banco ?? extra.banco,
    agencia: base.agencia ?? extra.agencia,
    conta_corrente: base.conta_corrente ?? extra.conta_corrente,
    cargo: base.cargo ?? extra.cargo,
    funcao: base.funcao ?? extra.funcao,
    setor: base.setor ?? extra.setor,
  };
}