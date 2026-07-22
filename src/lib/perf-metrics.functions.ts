import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPerfMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isMaster, error } = await supabase.rpc("is_master", { _user_id: userId });
    if (error) throw new Error("Falha ao validar permissão");
    if (!isMaster) throw new Error("Acesso restrito ao perfil MASTER");

    const { snapshotMetrics } = await import("./perf-metrics.server");
    return snapshotMetrics();
  });
