import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("sonner", () => {
  const toast: any = vi.fn(() => "id");
  toast.loading = vi.fn(() => "loading-id");
  toast.dismiss = vi.fn();
  toast.success = vi.fn();
  toast.error = vi.fn();
  return { toast };
});

vi.mock("./logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { withRetry } from "./retry-mutation";
import { toast } from "sonner";
import { logger } from "./logger";

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("retorna imediatamente quando o primeiro attempt sucede", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const wrapped = withRetry(fn, { operation: "op.test" });
    await expect(wrapped(undefined)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(toast.loading).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("faz retry com backoff exponencial e sucede na segunda tentativa", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("net")).mockResolvedValue("ok");
    const wrapped = withRetry(fn, { operation: "op.test" });
    const promise = wrapped(undefined);
    // primeiro delay = 1s
    await vi.advanceTimersByTimeAsync(1000);
    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(toast.loading).toHaveBeenCalledTimes(1);
    expect(toast.dismiss).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      "op.test.retry_sucesso",
      expect.objectContaining({ tentativa: 2 }),
    );
  });

  it("desiste após 3 tentativas e loga erro definitivo com requestId", async () => {
    const err = new Error("indisponivel");
    const fn = vi.fn().mockRejectedValue(err);
    const wrapped = withRetry(fn, { operation: "op.test" });
    const promise = wrapped(undefined);
    promise.catch(() => {}); // evita unhandledrejection
    // delays acumulados: 1s + 2s
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(promise).rejects.toThrow("indisponivel");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(logger.error).toHaveBeenCalledWith(
      "op.test.retry_esgotado",
      expect.objectContaining({
        operation: "op.test",
        tentativas: 3,
        requestId: expect.any(String),
      }),
    );
  });

  it("respeita attempts=1 (sem retry)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("x"));
    const wrapped = withRetry(fn, { operation: "op.test", attempts: 1 });
    await expect(wrapped(undefined)).rejects.toThrow("x");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
