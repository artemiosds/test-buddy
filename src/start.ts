import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { logger } from "./lib/logger";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    logger.error("request.unhandled", { error });
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const requestLoggingMiddleware = createMiddleware().server(async ({ next, request }) => {
  const started = Date.now();
  let status = 0;
  try {
    const res = await next();
    // `next()` retorna um objeto opaco; usamos qualquer status disponível.
    const maybe = res as unknown as { response?: Response };
    status = maybe.response?.status ?? 200;
    return res;
  } catch (err) {
    status = 500;
    throw err;
  } finally {
    try {
      const url = new URL(request.url);
      logger.info("http.request", {
        method: request.method,
        path: url.pathname,
        status,
        duration_ms: Date.now() - started,
      });
    } catch {
      /* ignore logging failures */
    }
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [requestLoggingMiddleware, errorMiddleware],
}));
