// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { HttpResponse, http } from "msw";
import { waitFor } from "@testing-library/react";
import { server } from "@/test/msw-server";
import { renderHookWithQuery } from "@/test/render";
import {
  BASE,
  analyticsHeadCounts,
  analyticsQueriesOk,
  analyticsQueriesEmpty,
  analyticsQueriesError,
} from "@/test/msw-handlers";
import { useAnalytics } from "./use-analytics";

const baseCountHandlers = analyticsHeadCounts;

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

// Combos padrão usados por todos os cenários abaixo — silenciam os requests
// paralelos (statusBreakdown/vinculo/distribuicao*/alertas/quadroLotacao)
// que disparam automaticamente sem depender de filtro.
function baseAnalyticsFixture() {
  return [
    permsHandler(),
    competenciaAtivaHandler(),
    ...baseCountHandlers({}),
  ];
}

describe("useAnalytics", () => {
  it("mapeia frequencias em contagens/agregações e counts em KPIs", async () => {
    server.use(
      permsHandler(),
      competenciaAtivaHandler(),
      ...baseCountHandlers({
        profissionais: 42,
        unidades: 7,
        setores: 3,
        cargos: 9,
        funcoes: 4,
        frequencia_pendencias: 5,
      }),
      ...analyticsQueriesOk(),
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
      ...baseAnalyticsFixture(),
      ...analyticsQueriesEmpty(),
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
      ...baseAnalyticsFixture(),
      ...analyticsQueriesEmpty(),
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

// ---------------------------------------------------------------------------
// Sublote 11B: cobertura das consultas novas (equipeProfissionais,
// quadroLotacao, distribuicaoFuncao, statusBreakdown, vinculoBreakdown,
// alertas). Cada bloco valida OK / vazio / erro.
// ---------------------------------------------------------------------------
describe("useAnalytics · consultas novas (11B)", () => {
  it("OK: statusBreakdown/vinculo/distribuicao*/equipe/quadro/alertas retornam dados", async () => {
    server.use(
      ...baseAnalyticsFixture(),
      ...analyticsQueriesOk(),
      http.get(`${BASE}/frequencias`, () => HttpResponse.json([])),
    );

    const { result } = renderHookWithQuery(() =>
      useAnalytics({ competenciaId: "c1", cargoId: "c1" }),
    );

    await waitFor(() => expect(result.current.statusBreakdown.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.vinculoBreakdown.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.distribuicaoUnidade.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.distribuicaoCargo.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.distribuicaoSetor.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.distribuicaoFuncao.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.equipeProfissionais.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.quadroLotacao.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.alertas.isSuccess).toBe(true));

    expect(result.current.statusBreakdown.data).toEqual({ ativo: 2, ferias: 1, afastado: 1 });
    expect(result.current.vinculoBreakdown.data).toEqual({ efetivos: 2, temporarios: 1, outros: 1 });
    expect(result.current.distribuicaoUnidade.data?.[0]?.total).toBe(2);
    expect(result.current.distribuicaoCargo.data?.[0]?.total).toBe(2);
    expect(result.current.distribuicaoSetor.data?.[0]?.total).toBe(2);
    expect(result.current.distribuicaoFuncao.data?.length).toBe(2);
    expect(result.current.equipeProfissionais.data?.length).toBe(3);
    expect(result.current.quadroLotacao.data?.length).toBe(2);
    const al = result.current.alertas.data!;
    // setores retornou 3, com 2 ocupados (s1,s2) => 1 vazio; 1 setor sem gestor+resp
    expect(al.setoresVazios).toBe(1);
    expect(typeof al.setoresSemResponsavel).toBe("number");
  });

  it("VAZIO: consultas novas retornam estruturas zeradas sem crash", async () => {
    server.use(
      ...baseAnalyticsFixture(),
      ...analyticsQueriesEmpty(),
      http.get(`${BASE}/frequencias`, () => HttpResponse.json([])),
    );

    const { result } = renderHookWithQuery(() =>
      useAnalytics({ competenciaId: "c1", cargoId: "c1" }),
    );

    await waitFor(() => expect(result.current.statusBreakdown.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.equipeProfissionais.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.quadroLotacao.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.alertas.isSuccess).toBe(true));

    expect(result.current.statusBreakdown.data).toEqual({});
    expect(result.current.vinculoBreakdown.data).toEqual({ efetivos: 0, temporarios: 0, outros: 0 });
    expect(result.current.distribuicaoUnidade.data).toEqual([]);
    expect(result.current.distribuicaoCargo.data).toEqual([]);
    expect(result.current.distribuicaoSetor.data).toEqual([]);
    expect(result.current.distribuicaoFuncao.data).toEqual([]);
    expect(result.current.equipeProfissionais.data).toEqual([]);
    expect(result.current.quadroLotacao.data).toEqual([]);
    expect(result.current.alertas.data?.setoresVazios).toBe(0);
  });

  it("ERRO 500: consultas novas entram em isError sem derrubar o hook", async () => {
    server.use(
      ...baseAnalyticsFixture(),
      ...analyticsQueriesError(),
      http.get(`${BASE}/frequencias`, () => HttpResponse.json([])),
    );

    const { result } = renderHookWithQuery(() =>
      useAnalytics({ competenciaId: "c1", cargoId: "c1" }),
    );

    await waitFor(() => expect(result.current.statusBreakdown.isError).toBe(true));
    await waitFor(() => expect(result.current.vinculoBreakdown.isError).toBe(true));
    await waitFor(() => expect(result.current.distribuicaoUnidade.isError).toBe(true));
    await waitFor(() => expect(result.current.distribuicaoCargo.isError).toBe(true));
    await waitFor(() => expect(result.current.distribuicaoSetor.isError).toBe(true));
    await waitFor(() => expect(result.current.distribuicaoFuncao.isError).toBe(true));
    await waitFor(() => expect(result.current.equipeProfissionais.isError).toBe(true));
    await waitFor(() => expect(result.current.quadroLotacao.isError).toBe(true));
    await waitFor(() => expect(result.current.alertas.isError).toBe(true));

    // Hook continua exportando agregações padrão sem exceção.
    expect(result.current.ranking).toEqual([]);
    expect(result.current.frequenciasAprovadas).toBe(0);
  });
});