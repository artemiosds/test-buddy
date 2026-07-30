// Handlers MSW reutilizáveis para as consultas novas do useAnalytics
// (Sublote 11B). Modo: `ok` (dados realistas), `empty` (vazio) e `error` (500).
//
// Notas:
// - Distinguimos as consultas GET em /profissionais pelo parâmetro `select`,
//   já que o hook faz múltiplas leituras da mesma tabela com projeções
//   diferentes (statusBreakdown, vinculoBreakdown, distribuicao*, alertas,
//   equipeProfissionais, quadroLotacao).
// - HEAD counts de alertas são cobertos por `analyticsHeadCounts`.
import { HttpResponse, http, type HttpHandler } from "msw";

export const BASE = "http://supabase.test/rest/v1";

export function countResponse(total: number) {
  return new HttpResponse(null, {
    status: 200,
    headers: { "content-range": `0-0/${total}` },
  });
}

export function analyticsHeadCounts(counts: {
  profissionais?: number;
  unidades?: number;
  setores?: number;
  cargos?: number;
  funcoes?: number;
  frequencia_pendencias?: number;
}): HttpHandler[] {
  return (
    ["profissionais", "unidades", "setores", "cargos", "funcoes", "frequencia_pendencias"] as const
  ).map((table) => http.head(`${BASE}/${table}`, () => countResponse(counts[table] ?? 0)));
}

// -----------------------------------------------------------------------------
// OK
// -----------------------------------------------------------------------------
function profissionaisOkBySelect(select: string) {
  if (select.startsWith("status,unidade_id,setor_id")) {
    // quadroLotacao
    return [
      {
        status: "ativo",
        unidade_id: "u1",
        setor_id: "s1",
        cargo_id: "c1",
        funcao_id: "f1",
        unidade: { nome: "Unidade A", sigla: "UA" },
        setor: { nome: "Setor 1" },
        cargo: { nome: "Enfermeiro" },
        funcao: { nome: "Assistencial" },
      },
      {
        status: "ferias",
        unidade_id: "u1",
        setor_id: "s1",
        cargo_id: "c1",
        funcao_id: "f1",
        unidade: { nome: "Unidade A", sigla: "UA" },
        setor: { nome: "Setor 1" },
        cargo: { nome: "Enfermeiro" },
        funcao: { nome: "Assistencial" },
      },
      {
        status: "ativo",
        unidade_id: "u2",
        setor_id: "s2",
        cargo_id: "c2",
        funcao_id: "f2",
        unidade: { nome: "Unidade B", sigla: "UB" },
        setor: { nome: "Setor 2" },
        cargo: { nome: "Médico" },
        funcao: { nome: "Gestão" },
      },
    ];
  }
  if (select === "status") {
    // statusBreakdown
    return [{ status: "ativo" }, { status: "ativo" }, { status: "ferias" }, { status: "afastado" }];
  }
  if (select.startsWith("vinculo:")) {
    // vinculoBreakdown
    return [
      { vinculo: { natureza: "efetivo" } },
      { vinculo: { natureza: "efetivo" } },
      { vinculo: { natureza: "temporario" } },
      { vinculo: null },
    ];
  }
  if (select.startsWith("unidade_id,unidades")) {
    // distribuicaoUnidade
    return [
      { unidade_id: "u1", unidades: { nome: "Unidade A", sigla: "UA" } },
      { unidade_id: "u1", unidades: { nome: "Unidade A", sigla: "UA" } },
      { unidade_id: "u2", unidades: { nome: "Unidade B", sigla: "UB" } },
    ];
  }
  if (select.startsWith("cargo_id,cargos")) {
    return [
      { cargo_id: "c1", cargos: { nome: "Enfermeiro" } },
      { cargo_id: "c1", cargos: { nome: "Enfermeiro" } },
      { cargo_id: "c2", cargos: { nome: "Médico" } },
    ];
  }
  if (select.startsWith("setor_id,setores")) {
    return [
      { setor_id: "s1", setores: { nome: "Setor 1" } },
      { setor_id: "s2", setores: { nome: "Setor 2" } },
      { setor_id: "s2", setores: { nome: "Setor 2" } },
    ];
  }
  if (select.startsWith("funcao_id,funcoes")) {
    return [
      { funcao_id: "f1", funcoes: { nome: "Assistencial" } },
      { funcao_id: "f2", funcoes: { nome: "Gestão" } },
    ];
  }
  if (select === "setor_id") {
    // alertas -> profissionais(setor_id) para calcular setores vazios
    return [{ setor_id: "s1" }, { setor_id: "s2" }];
  }
  if (select.startsWith("id,nome_completo") || select.startsWith("id, nome_completo")) {
    // equipeProfissionais
    return [
      {
        id: "p1",
        nome_completo: "Ana Silva",
        matricula: "0001",
        status: "ativo",
        unidade: { nome: "Unidade A", sigla: "UA" },
        setor: { nome: "Setor 1" },
        cargo: { nome: "Enfermeiro" },
        funcao: { nome: "Assistencial" },
      },
      {
        id: "p2",
        nome_completo: "Bruno Souza",
        matricula: "0002",
        status: "ativo",
        unidade: { nome: "Unidade A", sigla: "UA" },
        setor: { nome: "Setor 1" },
        cargo: { nome: "Enfermeiro" },
        funcao: { nome: "Assistencial" },
      },
      {
        id: "p3",
        nome_completo: "Carla Dias",
        matricula: "0003",
        status: "ferias",
        unidade: { nome: "Unidade A", sigla: "UA" },
        setor: { nome: "Setor 1" },
        cargo: { nome: "Enfermeiro" },
        funcao: { nome: "Assistencial" },
      },
    ];
  }
  return [];
}

export function analyticsQueriesOk(): HttpHandler[] {
  return [
    http.get(`${BASE}/profissionais`, ({ request }) => {
      const select = new URL(request.url).searchParams.get("select") ?? "";
      return HttpResponse.json(profissionaisOkBySelect(select));
    }),
    http.get(`${BASE}/setores`, () =>
      HttpResponse.json([
        { id: "s1", gestor_id: "g1", responsavel_nome: null },
        { id: "s2", gestor_id: null, responsavel_nome: "João" },
        { id: "s3", gestor_id: null, responsavel_nome: null },
      ]),
    ),
  ];
}

// -----------------------------------------------------------------------------
// EMPTY
// -----------------------------------------------------------------------------
export function analyticsQueriesEmpty(): HttpHandler[] {
  return [
    http.get(`${BASE}/profissionais`, () => HttpResponse.json([])),
    http.get(`${BASE}/setores`, () => HttpResponse.json([])),
  ];
}

// -----------------------------------------------------------------------------
// ERROR (500) — hook deve entrar em isError sem quebrar.
// -----------------------------------------------------------------------------
export function analyticsQueriesError(): HttpHandler[] {
  return [
    http.get(`${BASE}/profissionais`, () =>
      HttpResponse.json({ message: "boom", code: "500" }, { status: 500 }),
    ),
    http.get(`${BASE}/setores`, () =>
      HttpResponse.json({ message: "boom", code: "500" }, { status: 500 }),
    ),
  ];
}
