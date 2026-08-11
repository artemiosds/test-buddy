import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { profissionalSchema } from "./schemas/profissional.schema";

export const saveProfissionalComplete = createServerFn({ method: "POST" })
  .inputValidator((data) => profissionalSchema.parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    // A RPC é SECURITY DEFINER e valida permissões via auth.uid();
    // por isso deve ser chamada com o client do usuário autenticado,
    // nunca com o client admin (onde auth.uid() é NULL).
    const { data: result, error } = await context.supabase.rpc("save_profissional_complete", {
      p_payload: data,
    });

    if (error) {
      console.error("[saveProfissionalComplete] RPC Error:", error);
      throw new Error((error as any).message || "Erro ao salvar profissional no banco de dados.");
    }

    return result;
  });

export const arquivarProfissional = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("arquivar_profissional", {
      _id: data.id,
    });

    if (error) {
      console.error("[arquivarProfissional] RPC Error:", error);
      throw new Error((error as any).message || "Erro ao arquivar profissional.");
    }

    return { success: true };
  });
