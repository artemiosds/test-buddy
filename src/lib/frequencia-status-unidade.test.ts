import { describe, expect, it } from "vitest";
import { resolverStatusUnidadeContratados } from "./frequencia-status-unidade";

const resolver = (statusGeral: string, statusSetores: string[], visaoGeral = true) =>
  resolverStatusUnidadeContratados({
    statusGeral,
    statusSetores,
    visaoGeral,
    setoresCarregados: true,
  });

describe("resolverStatusUnidadeContratados", () => {
  it("mantém aprovada a Geral quando todos os setores ainda estão enviados", () => {
    expect(resolver("aprovada", Array(5).fill("enviada"))).toBe("aprovada");
  });

  it("não rebaixa uma Geral aprovada por setores vazios ou parcialmente aprovados", () => {
    expect(resolver("aprovada", ["rascunho", "aprovada", "devolvida"])).toBe("aprovada");
  });

  it("preserva etapas oficiais, inclusive a reabertura em análise", () => {
    for (const status of ["enviada", "em_analise", "devolvida", "rejeitada", "com_pendencias", "arquivada"]) {
      expect(resolver(status, ["enviada", "enviada"])).toBe(status);
    }
  });

  it("não promove a Geral a aprovada só porque todos os setores foram aprovados", () => {
    expect(resolver("rascunho", ["aprovada", "aprovada"])).toBe("enviada");
  });

  it("sinaliza envio parcial enquanto a Geral permanece em rascunho", () => {
    expect(resolver("rascunho", ["enviada", "rascunho"])).toBe("parcialmente_enviada");
    expect(resolver("rascunho", ["rascunho", "devolvida"])).toBe("rascunho");
    expect(resolver("rascunho", ["enviada", "em_analise"])).toBe("enviada");
  });

  it("não aplica consolidação fora da visão Geral nem antes de carregar setores", () => {
    expect(resolver("rascunho", ["enviada"], false)).toBe("rascunho");
    expect(resolverStatusUnidadeContratados({
      statusGeral: "rascunho",
      statusSetores: ["enviada"],
      visaoGeral: true,
      setoresCarregados: false,
    })).toBe("rascunho");
    expect(resolver("rascunho", [])).toBe("rascunho");
  });
});
