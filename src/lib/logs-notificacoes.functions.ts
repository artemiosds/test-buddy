import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureMaster } from "./authz.server";

export const getLogsNotificacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    
    // Apenas Master pode ver logs
    await ensureMaster(supabase, userId);

    const { data, error } = await supabase
      .from("logs_notificacoes")
      .select("*")
      .order("data_envio", { ascending: false })
      .limit(500);

    if (error) throw new Error(error.message);
    return data;
  });
