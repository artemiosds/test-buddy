
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Hook para monitorar alterações na tabela de profissionais em tempo real.
 * Invalida o cache do TanStack Query para manter a listagem e os KPIs sincronizados
 * entre diferentes usuários (Diretor, Master, Gestor).
 */
export function useProfessionalRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Escuta mudanças na tabela de profissionais
    const channel = supabase
      .channel("profissionais-realtime-changes")
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT, UPDATE, DELETE
          schema: "public",
          table: "profissionais",
        },
        (payload) => {
          console.log("[Realtime] Profissional alterado:", payload);
          
          // Invalida todas as queries relacionadas a profissionais
          // Isso garante que a listagem, contagens e o dossiê sejam atualizados
          queryClient.invalidateQueries({
            queryKey: ["profissionais"],
          });
          
          // Invalida também os KPIs específicos se existirem
          queryClient.invalidateQueries({
            queryKey: ["profissionais-kpi"],
          });

          // Invalida os lookups caso o nome de alguém tenha mudado (ex: gestores)
          queryClient.invalidateQueries({
            queryKey: ["profissionais-gestor-opt"],
          });
          queryClient.invalidateQueries({
             queryKey: ["profissionais-gestor-ids"]
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
