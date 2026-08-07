import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACOES, ensurePermission } from "./authz.server";

const VincularAnexoSchema = z.object({
  documento_id: z.string().uuid(),
  frequencia_id: z.string().uuid(),
  observacoes: z.string().optional(),
});

/**
 * Registra a vinculação de um anexo a uma ação de aprovação específica.
 * Atualmente, os anexos são vinculados à 'frequencia_submissao' (competência_unidade_id),
 * mas esta função permite estender o rastreamento para auditorias específicas.
 */
export const vincularAnexoAprovacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof VincularAnexoSchema>) => VincularAnexoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.FREQUENCIA_APROVAR);

    const { error } = await supabase
      .from("documentos")
      .update({
        metadata: {
          vincular_aprovacao_id: data.frequencia_id,
          observacao_anexo: data.observacoes,
          viculado_por: userId,
          vinculado_em: new Date().toISOString()
        }
      } as never)
      .eq("id", data.documento_id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
