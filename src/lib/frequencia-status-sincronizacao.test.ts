import { describe, expect, it } from "vitest";
import { statusSincronizadoContratados } from "./frequencia-status-sincronizacao";

describe("proteção da reabertura de Contratados", () => {
  it("não rebaixa em_analise por autosave com linhas em rascunho", () => {
    expect(statusSincronizadoContratados("em_analise", ["rascunho", "aprovada"], "FOLHA_SALVA"))
      .toBe("em_analise");
  });
  it("não aprova automaticamente folha reaberta mesmo com linhas aprovadas", () => {
    expect(statusSincronizadoContratados("em_analise", ["aprovada", "aprovada"], "FOLHA_SALVA"))
      .toBe("em_analise");
  });
  it("permite aprovação explícita apenas com todas as linhas aprovadas", () => {
    expect(statusSincronizadoContratados("em_analise", ["aprovada", "aprovada"], "FOLHA_APROVADA"))
      .toBe("aprovada");
    expect(statusSincronizadoContratados("em_analise", ["aprovada", "rascunho"], "FOLHA_APROVADA"))
      .toBe("em_analise");
  });
  it("preserva status antigo quando nenhuma linha foi registrada", () => {
    expect(statusSincronizadoContratados("em_analise", [], "FOLHA_SALVA")).toBe("em_analise");
    expect(statusSincronizadoContratados("rascunho", [], "FOLHA_SALVA")).toBe("rascunho");
  });
  it("mantém o comportamento das folhas normais", () => {
    expect(statusSincronizadoContratados("rascunho", ["enviada", "rascunho"], "FOLHA_SALVA"))
      .toBe("rascunho");
    expect(statusSincronizadoContratados("rascunho", ["enviada", "enviada"], "FOLHA_ENVIADA"))
      .toBe("enviada");
    expect(statusSincronizadoContratados("enviada", ["aprovada", "aprovada"], "FOLHA_APROVADA"))
      .toBe("aprovada");
  });
});
