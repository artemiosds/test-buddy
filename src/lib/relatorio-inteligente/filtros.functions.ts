import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const getFiltrosRelatorio = createServerFn({ method: "GET" })
  .handler(async () => {
    const [unidades, cargos, vinculos] = await Promise.all([
      supabase.from("unidades").select("id, nome").is("deleted_at", null).order("nome"),
      supabase.from("cargos").select("id, nome").is("deleted_at", null).order("nome"),
      supabase.from("vinculos").select("id, nome").is("deleted_at", null).order("nome"),
    ]);

    return {
      unidades: unidades.data ?? [],
      cargos: cargos.data ?? [],
      vinculos: vinculos.data ?? [],
    };
  });
