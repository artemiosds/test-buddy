import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertMaster(supabase: { rpc: (fn: string) => Promise<{ data: unknown }> }) {
  const { data } = await supabase.rpc("get_my_user_context");
  const ctx = data as
    | { perfil_codigo?: string; perfil_nome?: string; is_master?: boolean }
    | null;

  const isMaster =
    !!ctx?.is_master ||
    ctx?.perfil_codigo?.toUpperCase() === "MASTER" ||
    ctx?.perfil_nome?.toUpperCase() === "MASTER";

  if (!isMaster) {
    throw new Error("Apenas usuários MASTER podem alterar o modo manutenção");
  }
}

export const ativarModoManutencao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ avisoId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMaster(supabase as never);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { aplicarModoManutencao } = await import("@/lib/manutencao.server");

    const { data: aviso, error } = await supabaseAdmin
      .from("avisos_mural")
      .select("id, tipo")
      .eq("id", data.avisoId)
      .maybeSingle();

    if (error || !aviso) throw new Error("Aviso não encontrado");
    if (aviso.tipo !== "manutencao") {
      throw new Error("Apenas avisos do tipo 'manutencao' podem ativar o modo");
    }

    await aplicarModoManutencao(data.avisoId, userId);
    return { success: true };
  });

export const desativarModoManutencao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertMaster(supabase as never);

    const { aplicarModoManutencao } = await import("@/lib/manutencao.server");
    await aplicarModoManutencao(null, userId);
    return { success: true };
  });

/**
 * Estado público do modo manutenção.
 * Em caso de falha retorna `erro: true` para que o cliente adote
 * comportamento fail-safe (bloquear na dúvida).
 */
export const verificarEstadoManutencao = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { obterEstadoManutencao } = await import("@/lib/manutencao.server");
    const estado = await obterEstadoManutencao();
    return { ...estado, erro: false };
  } catch (error) {
    console.error("[Manutencao] Falha ao verificar estado:", error);
    return { modo_manutencao_ativo: false, aviso: null, erro: true };
  }
});
