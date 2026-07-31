import { describe, expect, it } from "vitest";
import { dependenciasDaFormula, deslocarLinhas, letraColuna } from "./planilha-espelho";

describe("deslocarLinhas", () => {
  it("ajusta a linha mantendo as colunas", () => {
    expect(deslocarLinhas("F2+G2+H2+I2", 48)).toBe("F50+G50+H50+I50");
  });
  it("preserva percentual e função", () => {
    expect(deslocarLinhas("J2*5%", 1)).toBe("J3*5%");
    expect(deslocarLinhas("SUM(H2,M2,N2,O2)", 3)).toBe("SUM(H5,M5,N5,O5)");
  });
  it("respeita linha absoluta", () => {
    expect(deslocarLinhas("$B$1*C2", 4)).toBe("$B$1*C6");
  });
  it("não toca em texto literal", () => {
    expect(deslocarLinhas('IF(A2="X2","A1",B2)', 1)).toBe('IF(A3="X2","A1",B3)');
  });
});

describe("árvore de dependências", () => {
  it("lista as colunas de origem", () => {
    expect(dependenciasDaFormula("F2+G2+H2+I2").sort()).toEqual(["F", "G", "H", "I"]);
    expect(dependenciasDaFormula("SUM(H2,M2)").sort()).toEqual(["H", "M"]);
  });
});

describe("letraColuna", () => {
  it("converte índices", () => {
    expect(letraColuna(1)).toBe("A");
    expect(letraColuna(27)).toBe("AA");
  });
});
