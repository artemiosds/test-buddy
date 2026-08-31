import { createFileRoute } from "@tanstack/react-router";
import { autorizarCron } from "@/lib/cron-auth.server";

/**
 * Lembrete diário do Mural de Avisos (chamado por pg_cron 1x/dia).
 * Exige o header `x-cron-secret`; sem `DEADLINE_CRON_SECRET` a rota responde 503.
 * Reenvia apenas avisos urgentes/fixados ativos e dentro do prazo, sem duplicar
 * para quem já recebeu o mesmo aviso no dia.
 */
export const Route = createFileRoute("/api/public/hooks/mural-lembretes")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const negado = autorizarCron(request);
        if (negado) return negado.response;

        const { enviarLembretesDiariosMural } = await import("@/lib/mural-lembretes.server");
        const resultado = await enviarLembretesDiariosMural();

        return Response.json(
          { ok: true, ...resultado, timestamp: new Date().toISOString() },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
} as any);
