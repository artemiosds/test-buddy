import { describe, expect, it } from "vitest";
import {
  buildRanking,
  countByStatus,
  STATUS_APROVADAS,
  STATUS_ENVIADAS,
  STATUS_PENDENTES,
  sumField,
  type FrequenciaRow,
} from "./analytics-aggregations";

const row = (
  overrides: Partial<FrequenciaRow> & {
    unidade_id?: string;
    unidade_nome?: string;
    unidade_sigla?: string | null;
  } = {},
): FrequenciaRow => {
  const unidadeId = overrides.unidade_id ?? "u1";
  const base: FrequenciaRow = {
    id: crypto.randomUUID(),
    status: "enviada",
    total_profissionais: 10,
    total_faltas: 0,
    total_horas_extras: 0,
    competencia_unidades: {
      competencia_id: "c1",
      unidade_id: unidadeId,
      unidades: {
        id: unidadeId,
        nome: overrides.unidade_nome ?? "Unidade 1",
        sigla: overrides.unidade_sigla ?? "U1",
      },
    },
  };
  const { unidade_id: _u, unidade_nome: _n, unidade_sigla: _s, ...rest } = overrides;
  return { ...base, ...rest };
};

describe("countByStatus", () => {
  const rows = [
    row({ status: "enviada" }),
    row({ status: "em_analise" }),
    row({ status: "com_pendencias" }),
    row({ status: "rascunho" }),
    row({ status: "aprovada" }),
    row({ status: "aprovada" }),
  ];

  it("conta status enviadas (enviada + em_analise + com_pendencias)", () => {
    expect(countByStatus(rows, STATUS_ENVIADAS)).toBe(3);
  });
  it("conta rascunho como pendente", () => {
    expect(countByStatus(rows, STATUS_PENDENTES)).toBe(1);
  });
  it("conta aprovadas", () => {
    expect(countByStatus(rows, STATUS_APROVADAS)).toBe(2);
  });
  it("retorna 0 para lista vazia", () => {
    expect(countByStatus([], STATUS_ENVIADAS)).toBe(0);
  });
});

describe("sumField", () => {
  it("soma horas extras tratando null como 0", () => {
    const rows = [
      row({ total_horas_extras: 10 }),
      row({ total_horas_extras: null }),
      row({ total_horas_extras: 25 }),
    ];
    expect(sumField(rows, "total_horas_extras")).toBe(35);
  });
  it("soma faltas", () => {
    const rows = [row({ total_faltas: 2 }), row({ total_faltas: 3 })];
    expect(sumField(rows, "total_faltas")).toBe(5);
  });
  it("retorna 0 para lista vazia", () => {
    expect(sumField([], "total_faltas")).toBe(0);
  });
});

describe("buildRanking", () => {
  it("agrega múltiplas folhas da mesma unidade e conta aprovadas", () => {
    const rows = [
      row({
        unidade_id: "u1",
        unidade_nome: "UBS Centro",
        status: "aprovada",
        total_profissionais: 10,
        total_horas_extras: 50,
        total_faltas: 1,
      }),
      row({
        unidade_id: "u1",
        unidade_nome: "UBS Centro",
        status: "enviada",
        total_profissionais: 5,
        total_horas_extras: 20,
        total_faltas: 2,
      }),
    ];
    const r = buildRanking(rows);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      unidade_id: "u1",
      total_profissionais: 15,
      total_horas_extras: 70,
      total_faltas: 3,
      total_folhas: 2,
      aprovadas: 1,
    });
  });

  it("ordena por total_horas_extras desc", () => {
    const rows = [
      row({ unidade_id: "a", unidade_nome: "A", total_horas_extras: 30 }),
      row({ unidade_id: "b", unidade_nome: "B", total_horas_extras: 300 }),
      row({ unidade_id: "c", unidade_nome: "C", total_horas_extras: 150 }),
    ];
    const r = buildRanking(rows);
    expect(r.map((x) => x.unidade_id)).toEqual(["b", "c", "a"]);
  });

  it("retorna array vazio quando não há linhas", () => {
    expect(buildRanking([])).toEqual([]);
  });

  it("trata numéricos nulos como 0", () => {
    const rows = [
      row({
        unidade_id: "u1",
        total_profissionais: null,
        total_horas_extras: null,
        total_faltas: null,
      }),
    ];
    const [r] = buildRanking(rows);
    expect(r.total_profissionais).toBe(0);
    expect(r.total_horas_extras).toBe(0);
    expect(r.total_faltas).toBe(0);
    expect(r.total_folhas).toBe(1);
    expect(r.aprovadas).toBe(0);
  });
});