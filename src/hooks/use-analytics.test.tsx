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
  tipo: "contratados",
  total_profissionais: 10,
  total_dias_trabalhados: 100,
  total_faltas: 2,
  total_horas_extras: 40,
  competencia_unidade: {
    competencia_id: "c1",
    unidade_id: "u1",
    unidades: { id: "u1", nome: "Unidade A", sigla: "UA" },
    competencia: { id: "c1", ano: 2024, mes: 1, status: "ativa" }
  },
};
const FREQ_ROW_B = {
  id: "f2",
  status: "enviada",
  tipo: "contratados",
  total_profissionais: 5,
  total_dias_trabalhados: 50,
  total_faltas: 1,
  total_horas_extras: 12,
  competencia_unidade: {
    competencia_id: "c1",
    unidade_id: "u2",
    unidades: { id: "u2", nome: "Unidade B", sigla: "UB" },
    competencia: { id: "c1", ano: 2024, mes: 1, status: "ativa" }
  },
};

function permsHandler() {
  return http.post(`${BASE}/rpc/get_my_permissions`, () => HttpResponse.json([]));
}

function userContextHandler() {
  return http.post(`${BASE}/rpc/get_my_user_context`, () =>
    HttpResponse.json({ id: "user-1", is_master: true, perfil: "MASTER", unidades: [] }),
  );
}

function unidadesLookupHandler() {
  return http.get(`${BASE}/unidades`, () => HttpResponse.json([]));
}

function competenciaAtivaHandler() {
  return http.get(`${BASE}/competencias`, () => HttpResponse.json([]));
}

function baseAnalyticsFixture() {
  return [permsHandler(), userContextHandler(), unidadesLookupHandler(), competenciaAtivaHandler(), ...baseCountHandlers({})];
}

describe("useAnalytics", () => {
  it("mapeia frequencias em contagens/agregações e counts em KPIs", async () => {
    server.use(
      permsHandler(),
      userContextHandler(),
      unidadesLookupHandler(),
      competenciaAtivaHandler(),
      ...baseCountHandlers({
        profissionais: 42,
        unidades: 7,
        setores: 3,
        cargos: 9,
        funcoes: 4,
        frequencia_pendencias: 5,
        pendencias: 5,
      }),
      ...analyticsQueriesOk(),
      http.get(`${BASE}/frequencias`, () => HttpResponse.json([FREQ_ROW_A, FREQ_ROW_B])),
      http.get(`${BASE}/frequencias_contratados`, () =>
        HttpResponse.json([
          { id: "l1", unidade_id: "u1", competencia_id: "c1", profissional_id: "p1", updated_at: "2024-01-02", dias_trabalhados: "20", dias_falta: "2", he_50: "30", he_100: "10", plantoes: null, sobreaviso: null, atestado: null, profissional: { nome_completo: "Ana", matricula: "1", setor: null } },
          { id: "l2", unidade_id: "u1", competencia_id: "c1", profissional_id: "p2", updated_at: "2024-01-02", dias_trabalhados: "22", dias_falta: "1", he_50: "12,5", he_100: null, plantoes: null, sobreaviso: null, atestado: null, profissional: { nome_completo: "Bia", matricula: "2", setor: null } },
        ]),
      ),
    );

    const { result } = renderHookWithQuery(() => useAnalytics({ competenciaId: "c1" }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.totalProfessionals.isSuccess).toBe(true));

    expect(result.current.totalProfessionals.data).toBe(42);
    expect(result.current.totalUnidades.data).toBe(7);
    expect(result.current.pendencias.data).toBe(5);

    expect(result.current.totals.folhasAprovadas).toBe(1);
    expect(result.current.totals.folhasPendentes).toBe(1);
    // Somente lançamentos aprovados (linhas), não resumos persistidos
    expect(result.current.totals.horasExtras).toBe(52.5);
    expect(result.current.totals.faltas).toBe(3);
    expect(result.current.oficial?.contratados.he50).toBe(42.5);
    expect(result.current.oficial?.contratados.he100).toBe(10);
    expect(result.current.oficial?.contratados.profissionais).toBe(2);
    expect(result.current.ranking).toHaveLength(2);
    expect(result.current.ranking[0].unidade_id).toBe("u1");
  });

  it("resposta vazia => agregações zeradas, sem crash", async () => {
    server.use(
      ...baseAnalyticsFixture(),
      ...analyticsQueriesEmpty(),
      http.get(`${BASE}/frequencias`, () => HttpResponse.json([])),
    );

    const { result } = renderHookWithQuery(() => useAnalytics({ competenciaId: "c1" }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.totals.folhasAprovadas).toBe(0);
    expect(result.current.totals.horasExtras).toBe(0);
    expect(result.current.ranking).toEqual([]);
  });
});

describe("useAnalytics · consultas novas (11B)", () => {
  it("OK: statusBreakdown/vinculo/distribuicao*/equipe/alertas retornam dados", async () => {
    server.use(
      ...baseAnalyticsFixture(),
      ...analyticsQueriesOk(),
      http.get(`${BASE}/frequencias`, () => HttpResponse.json([])),
    );

    const { result } = renderHookWithQuery(() =>
      useAnalytics({ competenciaId: "c1", cargoId: "c1" }),
    );

    await waitFor(() => expect(result.current.statusBreakdown.isSuccess).toBe(true), { timeout: 3000 });
    await waitFor(() => expect(result.current.vinculoBreakdown.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.distribuicaoUnidade.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.distribuicaoCargo.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.distribuicaoSetor.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.equipeProfissionais.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.alertas.isSuccess).toBe(true));

    await waitFor(() => {
        expect(result.current.statusBreakdown.data).toEqual({
          ativo: 2,
          ferias: 1,
          licenca: 0,
          afastado: 1,
          desligado: 0,
        });
    });

    await waitFor(() => {
        expect(result.current.vinculoBreakdown.data).toEqual({
          efetivos: 2,
          temporarios: 1,
          outros: 1,
        });
    });

    expect(result.current.distribuicaoUnidade.data?.[0]?.total).toBe(2);
    expect(result.current.distribuicaoCargo.data?.[0]?.total).toBe(2);
    expect(result.current.distribuicaoSetor.data?.unidades?.length).toBeGreaterThan(0);
    expect(result.current.equipeProfissionais.data?.length).toBe(3);
    
    const al = result.current.alertas.data!;
    expect(al.setoresVazios).toBe(0);
  });
});
