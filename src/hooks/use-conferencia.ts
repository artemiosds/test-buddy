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

      // Pendências abertas — via frequencia_profissional (schema atual não
      // liga pendências direto ao profissional). Best-effort: se falhar,
      // seguimos apenas com os alertas cadastrais.
      let pendSet = new Set<string>();
      try {
        const { data: fp } = await supabase
          .from("frequencia_profissional")
          .select("profissional_id, frequencia_pendencias!left(id, status)")
          .in("profissional_id", ids);
        for (const row of (fp ?? []) as Array<{
          profissional_id: string | null;
          frequencia_pendencias?: Array<{ status: string | null }> | null;
        }>) {
          if (!row.profissional_id) continue;
          const abertas = (row.frequencia_pendencias ?? []).some(
            (p) => p.status && !["resolvida", "cancelada"].includes(p.status),
          );
          if (abertas) pendSet.add(row.profissional_id);
        }
      } catch {
        pendSet = new Set();
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
/** Retorna `v` se for uma string não-vazia; caso contrário `null`. */
function nn(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export function mergeConferencia(
  base: ProfConferencia,
  map: Map<string, ProfConferencia> | undefined,
): ProfConferencia {
  if (!map) return base;
  const extra = map.get(base.id);
  if (!extra) return base;
  // Considera strings vazias ("") como ausentes — muitos registros importados
  // gravaram "" no lugar de NULL nos campos bancários/cadastrais.
  return {
    ...extra,
    ...base,
    tem_pendencia: extra.tem_pendencia ?? base.tem_pendencia,
    situacao_funcional: nn(base.situacao_funcional) ?? nn(extra.situacao_funcional),
    cpf:            nn(base.cpf)            ?? nn(extra.cpf),
    banco:          nn(base.banco)          ?? nn(extra.banco),
    agencia:        nn(base.agencia)        ?? nn(extra.agencia),
    conta_corrente: nn(base.conta_corrente) ?? nn(extra.conta_corrente),
    cargo:          nn(base.cargo)          ?? nn(extra.cargo),
    funcao:         nn(base.funcao)         ?? nn(extra.funcao),
    setor:          nn(base.setor)          ?? nn(extra.setor),
  };
}