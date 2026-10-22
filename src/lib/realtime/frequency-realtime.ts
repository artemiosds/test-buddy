import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createInvalidationBatch } from "./invalidation-batch";

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
    const batch = createInvalidationBatch((keys) => {
      for (const queryKey of keys) void qc.invalidateQueries({ queryKey });
    });
    const scope = competenciaId ? [competenciaId, ...(unidadeId ? [unidadeId] : [])] : [];
    const analyticsKeys = [["analytics", "summary"], ["analytics", "frequencias-aggregated"]];

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
        // Status, permissions and dashboards remain fresh, once per burst.
        batch.add([
          ["frequencia-resumo", ...scope],
          ["folha-contratados", ...scope],
          ["folha-efetivos", ...scope],
          ["folha-contratados-consolidado", ...(competenciaId ? [competenciaId] : [])],
          ["folha-efetivos-consolidado", ...(competenciaId ? [competenciaId] : [])],
          ...analyticsKeys,
        ]);
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
        // Filtro manual se não houver frequenciaId no payload (ou se for INSERT sem filtro de query)
        if (frequenciaId && ![payload.new, payload.old].some((row) => (row as Record<string, unknown>).frequencia_id === frequenciaId)) return;
        batch.add([["folha-efetivos", ...scope], ["folha-efetivos-consolidado", ...(competenciaId ? [competenciaId] : [])], ...analyticsKeys]);
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
        if (frequenciaId && ![payload.new, payload.old].some((row) => (row as Record<string, unknown>).frequencia_id === frequenciaId)) return;
        batch.add([["folha-contratados", ...scope], ["folha-contratados-consolidado", ...(competenciaId ? [competenciaId] : [])], ...analyticsKeys]);
      }
    );

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log(`[Realtime] Subscribed successfully to ${channelName}`);
      }
    });

    channelRef.current = channel;

    return () => {
      batch.dispose();
      if (channelRef.current) {
        console.log(`[Realtime] Unsubscribing from ${channelName}`);
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [context.competenciaId, context.unidadeId, context.frequenciaId, qc]);
}
