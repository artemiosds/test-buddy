import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACOES, ensurePermission } from "./authz.server";

const Schema = z.object({
  competencia_id: z.string().uuid(),
  unidade_id: z.string().uuid(),
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

    const { data: cu, error } = await supabase
      .from("competencia_unidades")
      .select("id")
      .eq("competencia_id", data.competencia_id)
      .eq("unidade_id", data.unidade_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (cu?.id) return { submissao_id: cu.id as string };

    const { data: novo, error: iErr } = await supabase
      .from("competencia_unidades")
      .insert({
        competencia_id: data.competencia_id,
        unidade_id: data.unidade_id,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (iErr) throw new Error(iErr.message);
    return { submissao_id: (novo as { id: string }).id };
  });
