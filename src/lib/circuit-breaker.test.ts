import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CircuitBreaker,
  CircuitOpenError,
  withBreaker,
  getBreaker,
  listBreakers,
  __resetAllBreakersForTests,
} from "./circuit-breaker";

describe("CircuitBreaker", () => {
  beforeEach(() => {
    __resetAllBreakersForTests();
    vi.useRealTimers();
  });

  it("abre após atingir o threshold de falhas na janela", async () => {
    const b = new CircuitBreaker("t1", { failureThreshold: 3, cooldownMs: 100 });
    const failing = () => Promise.reject(new Error("boom"));
    for (let i = 0; i < 3; i++) {
      await expect(b.execute(failing)).rejects.toThrow("boom");
    }
    expect(b.snapshot().state).toBe("open");
    await expect(b.execute(failing)).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it("passa para meia-abertura após o cooldown e fecha ao ter sucesso", async () => {
    vi.useFakeTimers();
    const b = new CircuitBreaker("t2", { failureThreshold: 2, cooldownMs: 1_000 });
    await expect(b.execute(() => Promise.reject(new Error("x")))).rejects.toThrow();
    await expect(b.execute(() => Promise.reject(new Error("x")))).rejects.toThrow();
    expect(b.snapshot().state).toBe("open");
    vi.setSystemTime(Date.now() + 1_500);
    const result = await b.execute(() => Promise.resolve("ok"));
    expect(result).toBe("ok");
    expect(b.snapshot().state).toBe("closed");
  });

  it("reabre em falha na meia-abertura", async () => {
    vi.useFakeTimers();
    const b = new CircuitBreaker("t3", { failureThreshold: 1, cooldownMs: 500 });
    await expect(b.execute(() => Promise.reject(new Error("e")))).rejects.toThrow();
    expect(b.snapshot().state).toBe("open");
    vi.setSystemTime(Date.now() + 600);
    await expect(b.execute(() => Promise.reject(new Error("e")))).rejects.toThrow();
    expect(b.snapshot().state).toBe("open");
    expect(b.snapshot().totalTrips).toBe(2);
  });

  it("withBreaker aciona fallback quando circuito está aberto", async () => {
    const key = "wb1";
    getBreaker(key, { failureThreshold: 1, cooldownMs: 60_000 });
    await expect(withBreaker(key, () => Promise.reject(new Error("nope")))).rejects.toThrow("nope");
    const val = await withBreaker(key, () => Promise.reject(new Error("nope")), {
      fallback: () => "safe",
    });
    expect(val).toBe("safe");
  });

  it("listBreakers expõe snapshot registrado", async () => {
    getBreaker("saude.eventos");
    getBreaker("saude.sla");
    const snap = listBreakers();
    expect(snap.map((s) => s.key).sort()).toEqual(["saude.eventos", "saude.sla"]);
  });
});
