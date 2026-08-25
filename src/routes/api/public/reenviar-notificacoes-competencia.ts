import { createFileRoute } from "@tanstack/react-router";
import { notificarNovaCompetencia } from "@/lib/notificar-competencia.server";

export const Route = createFileRoute("/api/public/reenviar-notificacoes-competencia")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const competenciaId = body.competencia_id || "55d06161-bb13-4e07-9f89-7c6c692d6b84";

        try {
          const result = await notificarNovaCompetencia(competenciaId);
          return new Response(JSON.stringify({ ok: true, result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          return new Response(
            JSON.stringify({ ok: false, error: (error as Error).message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
