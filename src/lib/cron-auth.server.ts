/**
 * Autenticação das rotas de cron sob `/api/public/*`.
 *
 * Regra fail-closed: se `DEADLINE_CRON_SECRET` não estiver configurado no
 * ambiente, a rota inteira é bloqueada (503, erro de configuração). Nunca
 * "protege por padrão desligado" — uma env var esquecida jamais vira porta
 * aberta silenciosa.
 */
export type CronAuthFalha = { response: Response };

export function autorizarCron(request: Request): CronAuthFalha | null {
  const secret = process.env.DEADLINE_CRON_SECRET;

  if (!secret || secret.length < 16) {
    console.error(
      "[cron-auth] DEADLINE_CRON_SECRET ausente ou fraco — rota bloqueada por segurança.",
    );
    return {
      response: Response.json(
        { error: "cron_secret_not_configured" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  const provided = request.headers.get("x-cron-secret");
  if (!provided || provided !== secret) {
    return {
      response: Response.json(
        { error: "unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  return null;
}
