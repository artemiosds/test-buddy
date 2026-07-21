import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export type DocMetadata = {
  ip: string | null;
  timestampConfiavel: string;
  timestampFonte: string;
};

/**
 * Retorna IP do cliente (via headers do proxy) e timestamp confiável.
 * Tenta NTP público (timeapi.io) com fallback para relógio do servidor.
 */
export const capturarMetadadosDocumento = createServerFn({ method: "GET" }).handler(
  async (): Promise<DocMetadata> => {
    const req = getRequest();
    const h = req?.headers;
    const ip =
      h?.get("cf-connecting-ip") ??
      h?.get("x-real-ip") ??
      h?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null;

    let ts = new Date().toISOString();
    let fonte = "servidor";
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const r = await fetch("https://timeapi.io/api/time/current/zone?timeZone=UTC", {
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (r.ok) {
        const j = (await r.json()) as { dateTime?: string };
        if (j.dateTime) {
          ts = new Date(j.dateTime + "Z").toISOString();
          fonte = "timeapi.io";
        }
      }
    } catch {
      /* fallback silencioso */
    }
    return { ip, timestampConfiavel: ts, timestampFonte: fonte };
  },
);
