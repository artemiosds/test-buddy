// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { HttpResponse, http } from "msw";
import { waitFor } from "@testing-library/react";
import { server } from "@/test/msw-server";
import { renderHookWithQuery } from "@/test/render";
import { useAnalytics } from "./use-analytics";

const BASE = "http://supabase.test/rest/v1";

// HEAD count: supabase-js lê o total de `content-range: */N`.
function countResponse(total: number) {
  return new HttpResponse(null, {
    status: 200,
    headers: { "content-range": `0-0/${total}` },
  });
}

function baseCountHandlers(counts: Record<string, number>) {
  return Object.entries(counts).map(([table, n]) =>
    http.head(`${BASE}/${table}`, () => countResponse(n)),
  );
}

const FREQ_ROW_A = {
  id: "f1",
  status: "aprovada",
  total_profissionais: 10,
  total_faltas: 2,
  total_horas_extras: 40,
  competencia_unidades: {
    competencia_id: "c1",
    unidade_id: "u1",
    unidades: { id: "u1", nome: "Unidade A", sigla: "UA" },
  },
};
const FREQ_ROW_B = {
  id: "f2",
  status: "enviada",
  total_profissionais: 5,
  total_faltas: 1,
  total_horas_extras: 12,
  competencia_unidades: {
    competencia_id: "c1",
    unidade_id: "u2",
    unidades: { id: "u2", nome: "Unidade B", sigla: "UB" },
  },
};

function permsHandler() {
  return http.post(`${BASE}/rpc/get_my_permissions`, () => HttpResponse.json([]));
}

// useAnalytics chama useCompetenciaAtiva internamente; devolvemos vazio para
// silenciar o request e forçar o uso do competenciaId passado no filtro.
function competenciaAtivaHandler() {
  return http.get(`${BASE}/competencias`, () => HttpResponse.json([]));
}

describe("useAnalytics", () => {
  it("mapeia frequencias em contagens/agregações e counts em KPIs", async () => {
    server.use(
      permsHandler(),
      ...baseCountHandlers({
        profissionais: 42,
        unidades: 7,
        setores: 3,
        cargos: 9,
        funcoes: 4,
        frequencia_pendencias: 5,
      }),
      http.get(`${BASE}/frequencias`, () =>
        HttpResponse.json([FREQ_ROW_A, FREQ_ROW_B]),
      ),
    );

    const { result } = renderHookWithQuery(() =>
      useAnalytics({ competenciaId: "c1" }),
    );

    await waitFor(() => expect(result.current.frequencias.isSuccess).toBe(true));
    await waitFor(() =>
      expect(result.current.totalProfessionals.isSuccess).toBe(true),
    );

    expect(result.current.totalProfessionals.data).toBe(42);
    expect(result.current.totalUnidades.data).toBe(7);
    expect(result.current.pendencias.data).toBe(5);

    expect(result.current.frequenciasAprovadas).toBe(1);
    expect(result.current.frequenciasEnviadas).toBe(1);
    expect(result.current.frequenciasPendentes).toBe(0);
    expect(result.current.totalHorasExtras).toBe(52);
    expect(result.current.totalFaltas).toBe(3);
    expect(result.current.ranking).toHaveLength(2);
    expect(result.current.ranking[0].unidade_id).toBe("u1"); // maior HE primeiro
  });

  it("resposta vazia => agregações zeradas, sem crash", async () => {
    server.use(
      permsHandler(),
      ...baseCountHandlers({
        profissionais: 0,
        unidades: 0,
        setores: 0,
        cargos: 0,
        funcoes: 0,
        frequencia_pendencias: 0,
      }),
      http.get(`${BASE}/frequencias`, () => HttpResponse.json([])),
    );

    const { result } = renderHookWithQuery(() =>
      useAnalytics({ competenciaId: "c1" }),
    );
    await waitFor(() => expect(result.current.frequencias.isSuccess).toBe(true));

    expect(result.current.frequenciasAprovadas).toBe(0);
    expect(result.current.totalHorasExtras).toBe(0);
    expect(result.current.ranking).toEqual([]);
  });

  it("erro em frequencias => isError sem exception no hook", async () => {
    server.use(
      permsHandler(),
      ...baseCountHandlers({
        profissionais: 0,
        unidades: 0,
        setores: 0,
        cargos: 0,
        funcoes: 0,
        frequencia_pendencias: 0,
      }),
      http.get(`${BASE}/frequencias`, () =>
        HttpResponse.json({ message: "boom", code: "500" }, { status: 500 }),
      ),
    );

    const { result } = renderHookWithQuery(() =>
      useAnalytics({ competenciaId: "c1" }),
    );
    await waitFor(() => expect(result.current.frequencias.isError).toBe(true));
    // Agregações defaultam com array vazio quando data é undefined.
    expect(result.current.frequenciasAprovadas).toBe(0);
    expect(result.current.ranking).toEqual([]);
  });
});