// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  handlers: new Map<string, (payload: any) => void>(),
  removeChannel: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  channel: () => {
    const channel = {
      on: (_event: string, config: { table: string }, handler: (payload: any) => void) => {
        mocks.handlers.set(config.table, handler);
        return channel;
      },
      subscribe: () => channel,
    };
    return channel;
  },
  removeChannel: mocks.removeChannel,
} }));
import { useFrequencyRealtime } from "./frequency-realtime";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); mocks.handlers.clear(); });
describe("frequency realtime integration", () => {
  it("coalesces row events and refreshes the current scope plus consolidated reports", () => {
    vi.useFakeTimers();
    renderHook(() => useFrequencyRealtime({ competenciaId: "c1", unidadeId: "u1", frequenciaId: "f1" }));
    act(() => {
      for (let i = 0; i < 20; i++) mocks.handlers.get("frequencia_profissional")?.({ new: { frequencia_id: "f1" }, old: {} });
      vi.advanceTimersByTime(250);
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledTimes(4);
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["folha-efetivos", "c1", "u1"] });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["folha-efetivos-consolidado", "c1"] });
  });
  it("ignores details from another sheet and cancels work on unmount", () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useFrequencyRealtime({ frequenciaId: "f1" }));
    act(() => {
      mocks.handlers.get("frequencias_contratados")?.({ new: { frequencia_id: "f2" }, old: {} });
      vi.advanceTimersByTime(250);
    });
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
    act(() => { mocks.handlers.get("frequencias")?.({ new: { id: "f1", status: "devolvida" }, old: {} }); });
    unmount();
    vi.runAllTimers();
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
    expect(mocks.removeChannel).toHaveBeenCalledTimes(1);
  });
  it("refreshes status summaries and both types when the parent sheet changes", () => {
    vi.useFakeTimers();
    renderHook(() => useFrequencyRealtime({ competenciaId: "c1", unidadeId: "u1" }));
    act(() => {
      mocks.handlers.get("frequencias")?.({ new: { status: "devolvida" }, old: {} });
      vi.advanceTimersByTime(250);
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["frequencia-resumo", "c1", "u1"] });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["folha-contratados", "c1", "u1"] });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["folha-efetivos", "c1", "u1"] });
  });
});