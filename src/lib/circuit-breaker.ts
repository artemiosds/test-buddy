/**
 * Disjuntor (circuit breaker) para RPCs instáveis — Sublote 8B.
 *
 * Regra:
 *  - 5 falhas dentro de 30s → circuito ABERTO por 60s.
 *  - Após o cooldown → MEIA-ABERTURA: a próxima chamada é o "teste".
 *    - Sucesso do teste → volta a FECHADO (janela de falhas zera).
 *    - Falha do teste → volta a ABERTO por mais 60s.
 *  - Enquanto ABERTO, `execute()` rejeita imediatamente com
 *    `CircuitOpenError` (sem tocar na RPC) — o chamador pode aplicar fallback.
 *
 * Transições disparam `logger.warn` e notificam subscribers para o painel
 * `/saude`. Escopo: cliente (browser). Não substitui retry/backoff — atua no
 * nível acima, evitando que um serviço já degradado seja martelado.
 */
import { logger } from "./logger";

export type BreakerState = "closed" | "open" | "half_open";

export interface BreakerSnapshot {
  key: string;
  state: BreakerState;
  failures: number;
  lastFailureAt: number | null;
  openedAt: number | null;
  nextAttemptAt: number | null;
  totalTrips: number;
}

export interface BreakerConfig {
  /** Nº de falhas na janela para abrir. Default 5. */
  failureThreshold?: number;
  /** Janela deslizante de contagem de falhas (ms). Default 30_000. */
  rollingWindowMs?: number;
  /** Tempo em ABERTO antes da meia-abertura (ms). Default 60_000. */
  cooldownMs?: number;
}

export class CircuitOpenError extends Error {
  readonly code = "CIRCUIT_OPEN";
  constructor(public readonly breakerKey: string, public readonly nextAttemptAt: number) {
    super(`Circuit '${breakerKey}' is open`);
    this.name = "CircuitOpenError";
  }
}

export class CircuitBreaker {
  private state: BreakerState = "closed";
  private failures: number[] = []; // timestamps
  private lastFailureAt: number | null = null;
  private openedAt: number | null = null;
  private nextAttemptAt: number | null = null;
  private totalTrips = 0;
  private halfOpenInFlight = false;

  readonly failureThreshold: number;
  readonly rollingWindowMs: number;
  readonly cooldownMs: number;

  constructor(readonly key: string, cfg: BreakerConfig = {}) {
    this.failureThreshold = cfg.failureThreshold ?? 5;
    this.rollingWindowMs = cfg.rollingWindowMs ?? 30_000;
    this.cooldownMs = cfg.cooldownMs ?? 60_000;
  }

  snapshot(): BreakerSnapshot {
    return {
      key: this.key,
      state: this.state,
      failures: this.failures.length,
      lastFailureAt: this.lastFailureAt,
      openedAt: this.openedAt,
      nextAttemptAt: this.nextAttemptAt,
      totalTrips: this.totalTrips,
    };
  }

  /** Executa `fn` respeitando o estado do disjuntor. */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();

    if (this.state === "open") {
      if (this.nextAttemptAt !== null && now >= this.nextAttemptAt) {
        this.transition("half_open");
      } else {
        throw new CircuitOpenError(this.key, this.nextAttemptAt ?? now + this.cooldownMs);
      }
    }

    if (this.state === "half_open") {
      if (this.halfOpenInFlight) {
        // Só uma requisição de teste por vez.
        throw new CircuitOpenError(this.key, now);
      }
      this.halfOpenInFlight = true;
      try {
        const out = await fn();
        this.onSuccess();
        return out;
      } catch (err) {
        this.onFailure();
        throw err;
      } finally {
        this.halfOpenInFlight = false;
      }
    }

    // closed
    try {
      const out = await fn();
      this.onSuccess();
      return out;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    if (this.state !== "closed") {
      this.transition("closed");
    }
    this.failures = [];
    this.openedAt = null;
    this.nextAttemptAt = null;
  }

  private onFailure() {
    const now = Date.now();
    this.lastFailureAt = now;

    if (this.state === "half_open") {
      this.trip(now);
      return;
    }

    const cutoff = now - this.rollingWindowMs;
    this.failures = this.failures.filter((t) => t >= cutoff);
    this.failures.push(now);
    if (this.failures.length >= this.failureThreshold) {
      this.trip(now);
    }
  }

  private trip(now: number) {
    this.totalTrips += 1;
    this.openedAt = now;
    this.nextAttemptAt = now + this.cooldownMs;
    this.transition("open");
  }

  private transition(next: BreakerState) {
    const prev = this.state;
    if (prev === next) return;
    this.state = next;
    logger.warn("circuit-breaker:transition", {
      key: this.key,
      from: prev,
      to: next,
      failures: this.failures.length,
      nextAttemptAt: this.nextAttemptAt,
    });
    for (const cb of subscribers) {
      try { cb(); } catch { /* ignore */ }
    }
  }

  /** Reseta o disjuntor manualmente (uso em testes/operacional). */
  reset() {
    this.failures = [];
    this.openedAt = null;
    this.nextAttemptAt = null;
    this.halfOpenInFlight = false;
    if (this.state !== "closed") this.transition("closed");
  }
}

// ---------- Registro global ----------

const registry = new Map<string, CircuitBreaker>();
const subscribers = new Set<() => void>();

export function getBreaker(key: string, cfg?: BreakerConfig): CircuitBreaker {
  let b = registry.get(key);
  if (!b) {
    b = new CircuitBreaker(key, cfg);
    registry.set(key, b);
  }
  return b;
}

export function listBreakers(): BreakerSnapshot[] {
  return Array.from(registry.values()).map((b) => b.snapshot());
}

export function subscribeBreakers(cb: () => void): () => void {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}

/**
 * Wrapper conveniente: aplica o disjuntor e, se aberto, chama `fallback`
 * quando fornecido (fallback degradado seguro). Sem fallback, re-lança o erro.
 */
export async function withBreaker<T>(
  key: string,
  fn: () => Promise<T>,
  opts: { fallback?: () => T | Promise<T>; config?: BreakerConfig } = {},
): Promise<T> {
  const breaker = getBreaker(key, opts.config);
  try {
    return await breaker.execute(fn);
  } catch (err) {
    if (err instanceof CircuitOpenError && opts.fallback) {
      return await opts.fallback();
    }
    throw err;
  }
}

/** Reset all breakers — apenas para uso em testes. */
export function __resetAllBreakersForTests() {
  registry.clear();
  subscribers.clear();
}