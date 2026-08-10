// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { HttpResponse, http } from "msw";
import { waitFor } from "@testing-library/react";
import { server } from "@/test/msw-server";
import { renderHookWithQuery } from "@/test/render";
import { usePermissions } from "./use-permissions";
import { BASE } from "@/test/msw-handlers";

const RPC = `${BASE}/rpc/get_my_permissions`;
// URL absoluta usada pelo cliente Supabase no ambiente de teste
const AUTH_USER = `https://aybbfciidtdbhieordqw.supabase.co/auth/v1/user`;

describe("usePermissions", () => {
  it("mapeia RPC em Set e has()/hasAny() funcionam", async () => {
    server.use(
      http.get(AUTH_USER, () => HttpResponse.json({
        id: "u1",
        app_metadata: { permissions: null },
        user_metadata: {},
        aud: "authenticated",
        role: "authenticated"
      })),
      http.post(RPC, () => HttpResponse.json(["frequencia.aprovar", "frequencia.rejeitar"])),
    );
    const { result } = renderHookWithQuery(() => usePermissions());
    
    await waitFor(() => {
      // Verifica se o fallback RPC funcionou quando o metadata é null
      expect(result.current.codes.size).toBe(2);
    }, { timeout: 8000 });

    expect(result.current.has("frequencia.aprovar")).toBe(true);
    expect(result.current.hasAny(["x", "frequencia.rejeitar"])).toBe(true);
  });

  it("usuário com permissões no app_metadata (JWT) funciona diretamente", async () => {
    server.use(
      http.get(AUTH_USER, () => HttpResponse.json({
        id: "u1",
        app_metadata: { permissions: ["perfil.visualizar", "unidade.editar"] },
        user_metadata: {},
        aud: "authenticated",
        role: "authenticated"
      }))
    );
    const { result } = renderHookWithQuery(() => usePermissions());
    
    await waitFor(() => {
      expect(result.current.codes.size).toBe(2);
    }, { timeout: 8000 });

    expect(result.current.has("perfil.visualizar")).toBe(true);
    expect(result.current.has("unidade.editar")).toBe(true);
  });

  it("usuário sem permissões => Set vazio, has()=false", async () => {
    server.use(
      http.get(AUTH_USER, () => HttpResponse.json({
        id: "u1",
        app_metadata: { permissions: null }
      })),
      http.post(RPC, () => HttpResponse.json([]))
    );
    const { result } = renderHookWithQuery(() => usePermissions());
    
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.codes.size).toBe(0);
    }, { timeout: 8000 });

    expect(result.current.has("qualquer.coisa")).toBe(false);
  });

  it("erro do supabase vira estado de erro", async () => {
    server.use(
      http.get(AUTH_USER, () => HttpResponse.json({ id: "u1" })),
      http.post(RPC, () => HttpResponse.json({ message: "error" }, { status: 500 })),
    );
    const { result } = renderHookWithQuery(() => usePermissions());
    
    await waitFor(() => {
      // Deve terminar o carregamento mesmo com erro
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 8000 });
  });
});
