import { getRequest } from "@tanstack/react-start/server";

type FrequencyBackgroundExecutionContext = {
  waitUntil: (promise: Promise<unknown>) => void;
};

// Request-scoped storage avoids cross-request races between concurrent edits.
const contextsByRequest = new WeakMap<Request, FrequencyBackgroundExecutionContext>();

export function registerFrequencyBackgroundExecutionContext(
  request: Request,
  candidate: unknown,
): void {
  if (!candidate || typeof candidate !== "object") return;
  const waitUntil = (candidate as { waitUntil?: unknown }).waitUntil;
  if (typeof waitUntil !== "function") return;

  contextsByRequest.set(request, candidate as FrequencyBackgroundExecutionContext);
}

export function getFrequencyBackgroundExecutionContext():
  | FrequencyBackgroundExecutionContext
  | null {
  try {
    return contextsByRequest.get(getRequest()) ?? null;
  } catch {
    // Node/Vercel runtimes may not expose a Cloudflare-style ExecutionContext.
    // Callers must await synchronization when no reliable background context exists.
    return null;
  }
}
