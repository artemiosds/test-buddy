import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RealtimeContext = {
  competenciaId?: string;
  unidadeId?: string;
  frequenciaId?: string;
};

/**
 * Hook para sincronização multiusuário seletiva em tempo real.
 * 
 * Implementa Supabase Realtime monitorando alterações em frequências e detalhes,
 * invalidando apenas queryKeys específicas para evitar refetch global e
 * garantir paridade entre usuários (Diretor -> Master/Gestor).
 */
export function useFrequencyRealtime(context: RealtimeContext) {
  const qc = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const { competenciaId, unidadeId, frequenciaId } = context;
    
    // Precisamos de pelo menos um identificador de contexto para não assinar eventos globais
    if (!competenciaId && !unidadeId && !frequenciaId) return;

    // Nome do canal baseado no contexto para evitar colisões
    const channelName = `freq-realtime-${frequenciaId || `${competenciaId}-${unidadeId}`}`;
    
    console.log(`[Realtime] Subscribing to ${channelName}`, context);

    const channel = supabase.channel(channelName);

    // 1. Monitorar Tabela 'frequencias' (Parent)
    // Filtramos pelo frequencia_id se disponível, ou aguardamos eventos da unidade/competência
    let freqFilter = "";
    if (frequenciaId) freqFilter = `id=eq.${frequenciaId}`;
    
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "frequencias",
        filter: freqFilter || undefined,
      },
      (payload) => {
        console.log("[Realtime] Frequência alterada:", payload);
        
        // Se mudou o status, precisamos atualizar as permissões e botões
        qc.invalidateQueries({ queryKey: ["frequencia-resumo"] });
        qc.invalidateQueries({ queryKey: ["folha-contratados"] });
        qc.invalidateQueries({ queryKey: ["folha-efetivos"] });
        qc.invalidateQueries({ queryKey: ["analytics", "summary"] });
        qc.invalidateQueries({ queryKey: ["analytics", "frequencias-aggregated"] });
      }
    );

    // 2. Monitorar 'frequencia_profissional' (Efetivos)
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "frequencia_profissional",
      },
      (payload) => {
        const data = (payload.new || payload.old) as any;
        // Filtro manual se não houver frequenciaId no payload (ou se for INSERT sem filtro de query)
        if (frequenciaId && data.frequencia_id !== frequenciaId) return;

        console.log("[Realtime] Detalhe Efetivo alterado:", payload);
        
        // Invalida apenas o que for afetado
        qc.invalidateQueries({ queryKey: ["folha-efetivos"] });
        qc.invalidateQueries({ queryKey: ["analytics", "frequencias-aggregated"] });
        qc.invalidateQueries({ queryKey: ["analytics", "summary"] });
      }
    );

    // 3. Monitorar 'frequencias_contratados' (Contratados)
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "frequencias_contratados",
      },
      (payload) => {
        const data = (payload.new || payload.old) as any;
        if (frequenciaId && data.frequencia_id !== frequenciaId) return;

        console.log("[Realtime] Detalhe Contratado alterado:", payload);
        
        qc.invalidateQueries({ queryKey: ["folha-contratados"] });
        qc.invalidateQueries({ queryKey: ["analytics", "frequencias-aggregated"] });
        qc.invalidateQueries({ queryKey: ["analytics", "summary"] });
      }
    );

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log(`[Realtime] Subscribed successfully to ${channelName}`);
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        console.log(`[Realtime] Unsubscribing from ${channelName}`);
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [context.competenciaId, context.unidadeId, context.frequenciaId, qc]);
}
