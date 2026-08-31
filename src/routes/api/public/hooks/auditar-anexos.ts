import { createFileRoute } from "@tanstack/react-router";
import { autorizarCron } from "@/lib/cron-auth.server";

/**
 * Auditoria diária de integridade dos anexos (chamada por pg_cron 1x/dia).
 *
 * Verifica no R2 (HEAD) todo documento ativo vinculado a frequências/submissões
 * e alerta os Administradores Master (notificação + e-mail) se algum binário
 * estiver ausente. Exige o header `x-cron-secret`; sem `DEADLINE_CRON_SECRET`
 * a rota responde 503 (fail-closed).
 */
export const Route = createFileRoute("/api/public/hooks/auditar-anexos")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const negado = autorizarCron(request);
        if (negado) return negado.response;

        const { auditarAnexosSubmissoes } = await import("@/lib/auditoria-anexos.server");
        const r = await auditarAnexosSubmissoes();

        return Response.json(
          {
            ok: true,
            verificados: r.verificados,
            ausentes: r.ausentes.length,
            masters_notificados: r.masters_notificados,
            emails_enviados: r.emails_enviados,
            timestamp: new Date().toISOString(),
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
} as any);
