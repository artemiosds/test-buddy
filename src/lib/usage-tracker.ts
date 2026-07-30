// Sublote 6D — Métricas de uso anônimas.
// Envia eventos via RPC public.track_uso (SECURITY DEFINER) que anonimiza a
// origem (hash diário do uid) e nunca grava identificadores pessoais.
// Nunca derruba a UI: falhas apenas são logadas.

import { supabase } from "@/integrations/supabase/client";
import { logger } from "./logger";

export const USO_EVENTOS = {
  PAGE_VIEW: "page_view",
  ACTION: "action",
  EXPORT: "export",
  FEATURE: "feature",
} as const;

export type UsoEvento = (typeof USO_EVENTOS)[keyof typeof USO_EVENTOS] | string;

// Deduplica page_view por rota dentro de curto intervalo (evita spam de StrictMode/HMR).
let lastPageViewRoute: string | null = null;
let lastPageViewAt = 0;

export async function trackUso(
  evento: UsoEvento,
  opts: { rota?: string | null; contexto?: Record<string, unknown> } = {},
) {
  try {
    const { error } = await supabase.rpc("track_uso", {
      _evento: evento,
      _rota: opts.rota ?? undefined,
      _contexto: (opts.contexto ?? {}) as never,
    });
    if (error) {
      logger.warn("usage_tracker.rpc_error", { evento, message: error.message });
    }
  } catch (e) {
    logger.warn("usage_tracker.exception", { evento, message: (e as Error).message });
  }
}

export function trackPageView(rota: string, contexto?: Record<string, unknown>) {
  const now = Date.now();
  if (lastPageViewRoute === rota && now - lastPageViewAt < 2000) return;
  lastPageViewRoute = rota;
  lastPageViewAt = now;
  void trackUso(USO_EVENTOS.PAGE_VIEW, { rota, contexto });
}

export function trackAction(nome: string, contexto?: Record<string, unknown>) {
  void trackUso(USO_EVENTOS.ACTION, { contexto: { nome, ...(contexto ?? {}) } });
}

export function trackExport(formato: "csv" | "pdf" | string, contexto?: Record<string, unknown>) {
  void trackUso(USO_EVENTOS.EXPORT, { contexto: { formato, ...(contexto ?? {}) } });
}
