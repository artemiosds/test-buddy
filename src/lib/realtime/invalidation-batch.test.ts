import { afterEach, describe, expect, it, vi } from "vitest";
import { createInvalidationBatch } from "./invalidation-batch";
afterEach(() => vi.useRealTimers());
describe("realtime invalidations", () => {
  it("coalesces repeated keys and flushes even during a continuous burst", () => {
    vi.useFakeTimers();
    const flush = vi.fn();
    const batch = createInvalidationBatch(flush);
    batch.add([["folha-efetivos", "competencia", "unidade"]]);
    vi.advanceTimersByTime(200);
    batch.add([["folha-efetivos", "competencia", "unidade"], ["analytics", "summary"]]);
    vi.advanceTimersByTime(50);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith([["folha-efetivos", "competencia", "unidade"], ["analytics", "summary"]]);
    batch.add([["folha-contratados"]]);
    vi.advanceTimersByTime(250);
    expect(flush).toHaveBeenCalledTimes(2);
  });
  it("cancels pending reloads when leaving the context", () => {
    vi.useFakeTimers();
    const flush = vi.fn();
    const batch = createInvalidationBatch(flush);
    batch.add([["folha-efetivos"]]);
    batch.dispose();
    vi.runAllTimers();
    expect(flush).not.toHaveBeenCalled();
  });
});