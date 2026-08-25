import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureMaster } from "./authz.server";

/**
 * Reenvia (retroativamente) as notificações de abertura de uma competência.
 */
export const reenviarNotificacoesCompetencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ competencia_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureMaster(context.supabase, context.userId);
    const { notificarNovaCompetencia } = await import("./notificar-competencia.server");
    return await notificarNovaCompetencia(data.competencia_id, context.userId);
  });
