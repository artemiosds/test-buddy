// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAutosaveFolha } from "./use-autosave-folha";
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("serial autosave regression", () => {
  it("debounces edits and confirms only after persistence", async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => true);
    const { result } = renderHook(() => useAutosaveFolha({ enabled: true, run }));
    act(() => { result.current.schedule(); vi.advanceTimersByTime(800); result.current.schedule(); });
    expect(run).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(900); });
    expect(run).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("saved");
  });
  it("keeps concurrent edits queued and never runs two writes at once", async () => {
    let complete: ((ok: boolean) => void) | undefined;
    const run = vi.fn().mockImplementationOnce(() => new Promise<boolean>((resolve) => { complete = resolve; })).mockResolvedValue(true);
    const { result } = renderHook(() => useAutosaveFolha({ enabled: true, run }));
    let saving: Promise<boolean> | undefined;
    act(() => { saving = result.current.saveNow(); });
    act(() => { result.current.schedule(); });
    expect(run).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("saving");
    await act(async () => { complete?.(true); await saving; });
    expect(run).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("saved");
  });
  it("keeps failed writes pending and supports retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const run = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { result } = renderHook(() => useAutosaveFolha({ enabled: true, run }));
    await act(async () => { expect(await result.current.saveNow()).toBe(false); });
    expect(result.current.status).toBe("error");
    expect(result.current.hasPending()).toBe(true);
    await act(async () => { expect(await result.current.retry()).toBe(true); });
    expect(result.current.status).toBe("saved");
    expect(result.current.hasPending()).toBe(false);
    vi.restoreAllMocks();
  });
  it("does not save disabled sheets or invent work on flush", async () => {
    const run = vi.fn(async () => true);
    const { result, rerender } = renderHook(({ enabled }) => useAutosaveFolha({ enabled, run }), { initialProps: { enabled: false } });
    await act(async () => { result.current.schedule(); await result.current.saveNow(); });
    rerender({ enabled: true });
    await act(async () => { await result.current.flush(); });
    expect(run).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });
});