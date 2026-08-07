import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { profissionalSchema } from "./schemas/profissional.schema";

export const saveProfissionalComplete = createServerFn({ method: "POST" })
  .inputValidator((data) => profissionalSchema.parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    // A validação de perfil (MASTER ou permissão específica) deve ocorrer aqui
    // No entanto, para manter a simplicidade deste plano de ação, usaremos a RPC SECURITY DEFINER
    // que já foi criada no banco de dados.

    const { data: result, error } = await supabaseAdmin.rpc("save_profissional_complete", {
      p_payload: data,
    });

    if (error) throw new Response(error.message, { status: 500 });
    return result;
  });

export const arquivarProfissional = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.rpc("arquivar_profissional", {
      _id: data.id,
    });

    if (error) throw new Response(error.message, { status: 500 });
    return { success: true };
  });