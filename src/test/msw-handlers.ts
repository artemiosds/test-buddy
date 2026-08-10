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

export const BASE = "https://aybbfciidtdbhieordqw.supabase.co/rest/v1";

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
  if (select === "status,situacao_funcional") {
    // statusBreakdown (situação detalhada consolidada em grupos)
    return [
      { status: "ativo", situacao_funcional: null },
      { status: "ativo", situacao_funcional: null },
      { status: "ferias", situacao_funcional: "ferias" },
      { status: "afastamento_inss", situacao_funcional: "afastamento_inss" },
    ];
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
      
      // New distribuicaoSetor query
      if (select.includes("unidade_id") && select.includes("setor_id") && select.includes("cpf")) {
        return HttpResponse.json([
          { id: "p1", nome_completo: "P1", cpf: "123", unidade_id: "u1", setor_id: "s1", unidades: { nome: "Unidade A" }, setores: { nome: "Setor 1", status: "ativa" } },
          { id: "p2", nome_completo: "P2", cpf: "456", unidade_id: "u1", setor_id: "s1", unidades: { nome: "Unidade A" }, setores: { nome: "Setor 1", status: "ativa" } },
          { id: "p3", nome_completo: "P3", cpf: "789", unidade_id: "u2", setor_id: null, unidades: { nome: "Unidade B" }, setores: null },
        ]);
      }
      
      return HttpResponse.json(profissionaisOkBySelect(select));
    }),
    http.get(`${BASE}/setores`, ({ request }) => {
      const select = new URL(request.url).searchParams.get("select") ?? "";
      if (select.includes("status")) {
        return HttpResponse.json([
          { id: "s1", nome: "Setor 1", status: "ativa" },
          { id: "s2", nome: "Setor 2", status: "ativa" },
          { id: "s3", nome: "Setor 3", status: "inativa" },
        ]);
      }
      return HttpResponse.json([
        { id: "s1", gestor_id: "g1", responsavel_nome: null },
        { id: "s2", gestor_id: null, responsavel_nome: "João" },
        { id: "s3", gestor_id: null, responsavel_nome: null },
      ]);
    }),
    http.get(`${BASE}/v_integridade_profissionais`, () => HttpResponse.json([
      { total: 4, incompleto: 1, faltantes: { cargo: 1, setor: 1 } }
    ])),
    http.post(`${BASE}/rpc/get_dashboard_summary`, () => HttpResponse.json({
      status_breakdown: { ativo: 2, ferias: 1, licenca: 0, afastado: 1, desligado: 0 },
      vinculo_breakdown: { efetivos: 2, temporarios: 1, outros: 1 },
      top_unidades: [{ id: "u1", nome: "Unidade A", sigla: "UA", total: 2 }],
      top_cargos: [{ id: "c1", nome: "Enfermeiro", total: 2 }],
      rh_kpis: { enviadas: 1, pendentes: 0, aprovadas: 1, total_horas_extras: 52, total_faltas: 3 }
    })),
    http.post(`${BASE}/rpc/get_ranking_rh`, () => HttpResponse.json([
      { unidade_id: "u1", unidade_nome: "Unidade A", total_horas_extras: 40 },
      { unidade_id: "u2", unidade_nome: "Unidade B", total_horas_extras: 12 },
    ])),
    http.post(`${BASE}/rpc/get_quadro_lotacao`, () => HttpResponse.json([
      { unidade_id: "u1", unidade_nome: "Unidade A", total: 2 },
      { unidade_id: "u2", unidade_nome: "Unidade B", total: 1 },
    ])),
    http.get(`${BASE}/competencias`, () => HttpResponse.json([])),
  ];
}

// -----------------------------------------------------------------------------
// EMPTY
// -----------------------------------------------------------------------------
export function analyticsQueriesEmpty(): HttpHandler[] {
  return [
    http.get(`${BASE}/profissionais`, () => HttpResponse.json([])),
    http.get(`${BASE}/setores`, () => HttpResponse.json([])),
    http.get(`${BASE}/v_integridade_profissionais`, () => HttpResponse.json([])),
    http.post(`${BASE}/rpc/get_dashboard_summary`, () => HttpResponse.json(null)),
    http.post(`${BASE}/rpc/get_ranking_rh`, () => HttpResponse.json([])),
    http.post(`${BASE}/rpc/get_quadro_lotacao`, () => HttpResponse.json([])),
    http.get(`${BASE}/competencias`, () => HttpResponse.json([])),
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
    http.get(`${BASE}/v_integridade_profissionais`, () =>
      HttpResponse.json({ message: "boom", code: "500" }, { status: 500 }),
    ),
    http.post(`${BASE}/rpc/get_dashboard_summary`, () =>
      HttpResponse.json({ message: "boom", code: "500" }, { status: 500 }),
    ),
    http.post(`${BASE}/rpc/get_ranking_rh`, () =>
      HttpResponse.json({ message: "boom", code: "500" }, { status: 500 }),
    ),
    http.post(`${BASE}/rpc/get_quadro_lotacao`, () =>
      HttpResponse.json({ message: "boom", code: "500" }, { status: 500 }),
    ),
  ];
}
