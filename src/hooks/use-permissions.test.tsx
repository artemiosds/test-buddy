// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { HttpResponse, http } from "msw";
import { waitFor } from "@testing-library/react";
import { server } from "@/test/msw-server";
import { renderHookWithQuery } from "@/test/render";
import { usePermissions } from "./use-permissions";

const RPC = "http://supabase.test/rest/v1/rpc/get_my_permissions";

describe("usePermissions", () => {
  it("mapeia RPC em Set e has()/hasAny() funcionam", async () => {
    server.use(
      http.post(RPC, () =>
        HttpResponse.json(["frequencia.aprovar", "frequencia.rejeitar"]),
      ),
    );
    const { result } = renderHookWithQuery(() => usePermissions());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.codes.size).toBe(2);
    expect(result.current.has("frequencia.aprovar")).toBe(true);
    expect(result.current.has("competencia.criar")).toBe(false);
    expect(result.current.hasAny(["x", "frequencia.rejeitar"])).toBe(true);
    expect(result.current.hasAny(["x", "y"])).toBe(false);
  });

  it("usuário sem permissões => Set vazio, has()=false", async () => {
    server.use(http.post(RPC, () => HttpResponse.json([])));
    const { result } = renderHookWithQuery(() => usePermissions());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.codes.size).toBe(0);
    expect(result.current.has("qualquer.coisa")).toBe(false);
  });

  it("resposta null (sem sessão) => Set vazio sem crash", async () => {
    server.use(http.post(RPC, () => HttpResponse.json(null)));
    const { result } = renderHookWithQuery(() => usePermissions());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.codes.size).toBe(0);
  });

  it("erro do supabase vira estado de erro (sem exception não tratada)", async () => {
    server.use(
      http.post(RPC, () =>
        HttpResponse.json({ message: "boom", code: "500" }, { status: 500 }),
      ),
    );
    const { result } = renderHookWithQuery(() => usePermissions());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.codes.size).toBe(0);
    expect(result.current.has("x")).toBe(false);
  });
});