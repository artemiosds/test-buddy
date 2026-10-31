import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, options?: unknown) => Promise<Response> | Response;
};

type RuntimeExecutionContext = {
  waitUntil?: (promise: Promise<unknown>) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRuntimeExecutionContext(value: unknown): value is RuntimeExecutionContext {
  return isRecord(value) && typeof value.waitUntil === "function";
}

function findRuntimeExecutionContext(options: unknown, runtimeContext: unknown): RuntimeExecutionContext | null {
  if (isRuntimeExecutionContext(runtimeContext)) return runtimeContext;
  if (!isRecord(options)) return null;

  if (isRuntimeExecutionContext(options.executionContext)) return options.executionContext;

  const requestContext = isRecord(options.context) ? options.context : null;
  if (requestContext) {
    if (isRuntimeExecutionContext(requestContext.executionContext)) return requestContext.executionContext;
    if (isRuntimeExecutionContext(requestContext.cloudflareContext)) return requestContext.cloudflareContext;
    const cloudflare = isRecord(requestContext.cloudflare) ? requestContext.cloudflare : null;
    if (cloudflare && isRuntimeExecutionContext(cloudflare.context)) return cloudflare.context;
  }

  const cloudflare = isRecord(options.cloudflare) ? options.cloudflare : null;
  if (cloudflare && isRuntimeExecutionContext(cloudflare.context)) return cloudflare.context;
  return null;
}

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, options: unknown, runtimeContext: unknown) {
    try {
      const handler = await getServerEntry();
      const executionContext = findRuntimeExecutionContext(options, runtimeContext);
      let handlerOptions = options;

      if (executionContext) {
        const currentOptions = isRecord(options) ? options : {};
        const currentContext = isRecord(currentOptions.context) ? currentOptions.context : {};
        handlerOptions = {
          ...currentOptions,
          context: {
            ...currentContext,
            frequencyBackgroundExecutionContext: executionContext,
          },
        };
      }

      const response = await handler.fetch(request, handlerOptions);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
