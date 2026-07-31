import { describe, expect, it } from "vitest";
import {
  aplicarRegrasFormulas,
  extrairRegrasDeColunas,
  interpretarFormula,
  regrasParaCampos,
} from "./layout-formulas";

describe("interpretarFormula", () => {
  it("soma simples", () => {
    expect(interpretarFormula("=H7+I7+J7+K7")?.termos.length).toBe(4);
  });
  it("percentual", () => {
    const r = interpretarFormula("=L7*5%");
    expect(r?.termos[0].fator).toBeCloseTo(0.05);
  });
  it("subtração", () => {
    const r = interpretarFormula("=L7-M7");
    expect(r?.termos.map((t) => t.fator)).toEqual([1, -1]);
  });
  it("SUM com lista", () => {
    expect(interpretarFormula("=SUM(H2,M2,N2,O2)")?.termos.length).toBe(4);
  });
  it("rejeita não linear", () => {
    expect(interpretarFormula("=H7/I7")).toBeNull();
  });
});

describe("aprendizado ponta a ponta", () => {
  const headers = ["BASE", "INSALUBRIDADE", "H.E.", "AD. NOTURNO", "BRUTO", "ISS", "TOTAL"];
  const celulas = [
    { colunaIndice: 4, formula: "=A7+B7+C7+D7" },
    { colunaIndice: 5, formula: "=E7*5%" },
    { colunaIndice: 6, formula: "=E7-F7" },
  ];

  it("aplica a matemática do modelo", () => {
    const regrasColuna = extrairRegrasDeColunas(celulas, headers);
    expect(regrasColuna).toHaveLength(3);
    const mapa = {
      BASE: "salario_base",
      INSALUBRIDADE: "insalubridade",
      "H.E.": "hora_extra_50",
      "AD. NOTURNO": "adicional_noturno",
      BRUTO: "total_proventos",
      ISS: "total_descontos",
      TOTAL: "valor_liquido",
    };
    const regras = regrasParaCampos(regrasColuna, mapa);
    const [linha] = aplicarRegrasFormulas(
      [
        {
          salario_base: 4654.78,
          insalubridade: 517.2,
          hora_extra_50: 0,
          adicional_noturno: 0,
          total_proventos: null,
          total_descontos: null,
          valor_liquido: null,
        },
      ],
      regras,
    );
    expect(linha.total_proventos).toBeCloseTo(5171.98, 2);
    expect(linha.total_descontos).toBeCloseTo(258.6, 2);
    expect(linha.valor_liquido).toBeCloseTo(4913.38, 2);
  });
});
