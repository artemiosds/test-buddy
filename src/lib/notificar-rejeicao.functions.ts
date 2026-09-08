import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACOES, ensurePermission } from "./authz.server";

const Schema = z.object({
  frequencia_id: z.string().uuid(),
  status: z.enum(["rejeitada", "devolvida", "com_pendencias"]).default("rejeitada"),
  profissional_nome: z.string().optional().nullable(),
  justificativa: z.string().optional().nullable(),
});

/**
 * Avisa a unidade (sino + e-mail) que um lançamento da folha foi rejeitado
 * ou devolvido para correção.
 */
export const notificarRejeicaoLinha = createServerFn({ method: "POST" })
  .validator((d: z.infer<typeof Schema>) => Schema.parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.FREQUENCIA_REJEITAR);

    const { notificarRejeicaoFolha } = await import("./notificar-rejeicao.server");
    return await notificarRejeicaoFolha({
      frequenciaId: data.frequencia_id,
      status: data.status,
      profissionalNome: data.profissional_nome ?? null,
      justificativa: data.justificativa ?? null,
      autorId: userId,
    });
  });
