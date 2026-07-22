/**
 * Structured logger — Sublote 6A.
 *
 * - JSON one-line output no server (workerd-friendly).
 * - Saída legível no browser (via console nativo, apenas para dev).
 * - Redaction determinística de campos sensíveis conhecidos.
 * - Sem PII em produção: em qualquer contexto, redigimos email/cpf/token/etc.
 *
 * Este é o único ponto autorizado a chamar `console.*` no projeto.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: unknown;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "senha",
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "apikey",
  "api_key",
  "email",
  "cpf",
  "rg",
  "telefone",
  "phone",
  "secret",
  "service_role_key",
  "supabase_service_role_key",
  "mfa_backup_codes",
  "backup_codes",
]);

const REDACTED = "[REDACTED]";
const MAX_DEPTH = 6;

export function redact(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth > MAX_DEPTH) return "[MaxDepth]";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (Array.isArray(value)) {
    return value.map((v) => redact(v, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = REDACTED;
      } else {
        out[k] = redact(v, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function envMinLevel(): LogLevel {
  // Server: process.env; Browser: import.meta.env.DEV
  try {
    if (typeof process !== "undefined" && process.env?.LOG_LEVEL) {
      const lvl = process.env.LOG_LEVEL.toLowerCase() as LogLevel;
      if (lvl in LEVEL_WEIGHT) return lvl;
    }
  } catch {
    /* ignore */
  }
  try {
    if (
      typeof import.meta !== "undefined" &&
      (import.meta as { env?: { DEV?: boolean } }).env?.DEV
    ) {
      return "debug";
    }
  } catch {
    /* ignore */
  }
  return "info";
}

function isServer(): boolean {
  return typeof window === "undefined";
}

function emit(level: LogLevel, message: string, context?: LogContext) {
  const min = envMinLevel();
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[min]) return;

  const payload = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(context ? { ctx: redact(context) as Record<string, unknown> } : {}),
  };

  if (isServer()) {
    // Uma linha JSON: fácil de parsear em pipelines de log
    const line = JSON.stringify(payload);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
    return;
  }

  // Browser: format legível, mantendo objeto para inspeção
  const prefix = `[${level.toUpperCase()}] ${message}`;
  if (level === "error") console.error(prefix, payload.ctx ?? "");
  else if (level === "warn") console.warn(prefix, payload.ctx ?? "");
  else if (level === "debug") console.debug(prefix, payload.ctx ?? "");
  else console.info(prefix, payload.ctx ?? "");
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: LogContext) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit("error", msg, ctx),
};

/**
 * Instala handlers globais no browser para capturar erros não tratados.
 * Idempotente. Deve ser chamado uma única vez no boot do cliente.
 */
export function installBrowserErrorHandlers() {
  if (isServer()) return;
  const w = window as unknown as { __loggerInstalled?: boolean };
  if (w.__loggerInstalled) return;
  w.__loggerInstalled = true;

  window.addEventListener("error", (event) => {
    logger.error("window.onerror", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    logger.error("unhandledrejection", {
      reason: event.reason,
    });
  });
}
