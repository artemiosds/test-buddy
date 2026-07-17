import { describe, it, expect } from "vitest";
import {
  resolveWorkforceFilters,
  mergeWorkforceFilters,
  workforceFiltersSchema,
} from "./workforce-filters";

describe("workforce-filters", () => {
  it("competência vazia resolve para a ativa", () => {
    const r = resolveWorkforceFilters({ competencia: "" }, "comp-ativa");
    expect(r.competenciaId).toBe("comp-ativa");
  });

  it("competência preenchida sobrepõe a ativa", () => {
    const r = resolveWorkforceFilters({ competencia: "comp-x" }, "comp-ativa");
    expect(r.competenciaId).toBe("comp-x");
  });

  it("unidade e status vazios viram null (nunca sentinelas)", () => {
    const r = resolveWorkforceFilters({ unidade: "", status: "" }, null);
    expect(r.unidadeId).toBeNull();
    expect(r.status).toBeNull();
  });

  it("unidade e status preenchidos passam adiante", () => {
    const r = resolveWorkforceFilters(
      { unidade: "u-1", status: "ativo" },
      null,
    );
    expect(r.unidadeId).toBe("u-1");
    expect(r.status).toBe("ativo");
  });

  it("input indefinido é tratado como todos-vazios", () => {
    const r = resolveWorkforceFilters(undefined, "comp-ativa");
    expect(r).toEqual({ competenciaId: "comp-ativa", unidadeId: null, status: null });
  });

  it("merge preserva os demais filtros ao atualizar um só", () => {
    const next = mergeWorkforceFilters(
      { competencia: "c1", unidade: "u1", status: "ativo" },
      { status: "afastado" },
    );
    expect(next).toEqual({ competencia: "c1", unidade: "u1", status: "afastado" });
  });

  it("merge aceita string vazia para 'limpar' um filtro específico", () => {
    const next = mergeWorkforceFilters(
      { competencia: "c1", unidade: "u1", status: "ativo" },
      { unidade: "" },
    );
    expect(next.unidade).toBe("");
    expect(next.competencia).toBe("c1");
  });

  it("schema aplica default '' para chaves ausentes", () => {
    const parsed = workforceFiltersSchema.parse({});
    expect(parsed).toEqual({ competencia: "", unidade: "", status: "" });
  });

  it("schema faz fallback para '' em tipo inválido (não quebra URL)", () => {
    const parsed = workforceFiltersSchema.parse({ unidade: 123 as unknown as string });
    expect(parsed.unidade).toBe("");
  });
});