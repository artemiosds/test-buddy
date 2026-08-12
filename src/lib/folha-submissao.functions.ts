import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACOES, ensurePermission } from "./authz.server";
import { garantirCompetenciaUnidade } from "./competencia-unidade.server";

const Schema = z.object({
  competencia_id: z.string().uuid(),
  unidade_id: z.string().uuid(),
  setor_id: z.string().uuid().optional(),
});

/**
 * Resolve o identificador da SUBMISSÃO da folha (competência + unidade), que é
 * a linha em `competencia_unidades` já usada pelo fluxo de aprovação.
 *
 * Esse id é o `entidade_id` dos documentos de justificativa
 * (`documentos.tipo_entidade = 'frequencia_submissao'`). O recorte por vínculo
 * (efetivos/contratados) vai em `metadata.folha`.
 *
 * Não altera status, cálculo ou fluxo de aprovação — apenas garante que a
 * ligação competência↔unidade exista (ela normalmente já é criada por trigger).
 */
export const obterSubmissaoFolha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof Schema>) => Schema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.FREQUENCIA_VISUALIZAR);

    const cuId = await garantirCompetenciaUnidade({
      competencia_id: data.competencia_id,
      unidade_id: data.unidade_id,
      userId
    });


    if (data.setor_id) {
      const { data: freqId } = await supabase
        .from("frequencias")
        .select("id")
        .eq("competencia_unidade_id", cuId)
        .eq("setor_id", data.setor_id)
        .maybeSingle();
      
      if (freqId) return { submissao_id: freqId.id };
    }

    return { submissao_id: cuId };
  });
