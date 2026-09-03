import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Schema = z.object({
  frequencia_id: z.string().uuid(),
  profissional_nome: z.string().max(200).optional(),
  motivo: z.string().max(2000).optional(),
});

/**
 * Notifica os responsáveis da unidade quando uma linha individual de
 * profissional é rejeitada na tela de Aprovações.
 */
export const notificarRejeicaoLinha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Schema.parse(d))
  .handler(async ({ data, context }) => {
    const { notificarRejeicaoFrequencia } = await import("./notificar-rejeicao.server");
    return await notificarRejeicaoFrequencia({
      frequenciaId: data.frequencia_id,
      escopo: "linha",
      status: "rejeitada",
      motivo: data.motivo ?? null,
      profissionalNome: data.profissional_nome ?? null,
      criadoPor: context.userId,
    });
  });
