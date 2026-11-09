import { describe, expect, it } from "vitest";
import { escopoDaSincronizacaoLinha } from "./frequencia-escopo-sincronizacao";

describe("escopo físico na sincronização de linhas", () => {
  it("direciona alteração setorial à própria folha, não à Geral", () => {
    expect(escopoDaSincronizacaoLinha({
      tipo: "contratados", competencia_id: "c", unidade_id: "u", setor_id: "s",
    })).toEqual({
      evento: "LINHA_ALTERADA", tipo: "contratados",
      competencia_id: "c", unidade_id: "u", setor_id: "s",
    });
  });
  it("preserva ausência de setor para a folha Geral", () => {
    expect(escopoDaSincronizacaoLinha({
      tipo: "efetivos", competencia_id: "c", unidade_id: "u", setor_id: null,
    }).setor_id).toBeUndefined();
  });
  it("preserva a natureza da folha Efetivos ou Contratados", () => {
    for (const tipo of ["efetivos", "contratados"] as const) {
      const result = escopoDaSincronizacaoLinha({
        tipo, competencia_id: "c", unidade_id: "u", setor_id: "s",
      });
      expect(result.tipo).toBe(tipo);
      expect(result.evento).toBe("LINHA_ALTERADA");
    }
  });
});
