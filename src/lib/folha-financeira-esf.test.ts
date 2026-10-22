import { describe, expect, it } from "vitest";
import { calcularFolha, parseFinanceiro, type EntradaCalculo } from "./folha-financeira";

const params = parseFinanceiro({
  modo_horas: "unitario",
  valor_he50: 10,
  niveis: { superior: { valor_he50: 24.54 } },
  cargos: {
    odonto: { salario_base: 2435.69, valor_he100: 30, esf: { salario_base: 5212.6, valor_he50: 40 } },
  },
});
const base: EntradaCalculo = {
  tipo: "efetivos", cargo_id: "odonto", salario_proprio: null, carga_cargo: 20, nivel_cargo: "superior",
  diasTrabalhados: 30, faltasInjustificadas: 0, faltasJustificadas: 0, atestado: 0,
  he50: 10, he100: 10, adn: 0, plantoes: 0, sobreaviso: 0, incentivo: 0,
};

describe("regras por cargo e variação ESF", () => {
  it("profissional comum usa salário do cargo e HE 50% do nível", () => {
    const r = calcularFolha(base, params);
    expect(r.salarioBase).toBe(2435.69);
    expect(r.unit.he50).toBe(24.54);
  });
  it("tarifa própria do cargo prevalece sobre o nível", () => {
    expect(calcularFolha(base, params).vHe100).toBe(300);
  });
  it("profissional ESF usa a variação ESF e herda o restante do cargo", () => {
    const r = calcularFolha({ ...base, esf: true }, params);
    expect(r.salarioBase).toBe(5212.6);
    expect(r.vHe50).toBe(400);
    expect(r.vHe100).toBe(300);
  });
  it("salário próprio do cadastro continua prevalecendo para ESF", () => {
    expect(calcularFolha({ ...base, esf: true, salario_proprio: 6000 }, params).salarioBase).toBe(6000);
  });
});
