import { describe, expect, it } from "vitest";
import { calcularFolha, parseFinanceiro, validarFinanceiro, type EntradaCalculo } from "./folha-financeira";

const e: EntradaCalculo = { tipo: "contratados", cargo_id: "enfermeiro", nivel_cargo: "superior", salario_proprio: 2585.99, carga_cargo: 30, diasTrabalhados: 30, faltasInjustificadas: 0, faltasJustificadas: 0, atestado: 0, he50: 20, he100: 20, adn: 120, plantoes: 0, sobreaviso: 0, incentivo: 0 };
const raw = { modo_horas: "unitario", valor_he50: 15, valor_he100: 20, valor_adn: 10, niveis: { superior: { valor_he50: "25,54", valor_he100: "34,48", valor_adn: "20,69" } } };

describe("tarifas livres por hora", () => {
  it("20 horas a R$25,54 pagam R$510,80", () => expect(calcularFolha(e, parseFinanceiro(raw)).vHe50).toBe(510.8));
  it("20 horas a R$34,48 pagam R$689,60", () => expect(calcularFolha(e, parseFinanceiro(raw)).vHe100).toBe(689.6));
  it("120 horas a R$20,69 pagam R$2482,80", () => expect(calcularFolha(e, parseFinanceiro(raw)).vAdn).toBe(2482.8));
  it("aceita outros valores sem depender de salário ou divisor", () => {
    const p = parseFinanceiro({ ...raw, niveis: { superior: { valor_he50: 15 } }, divisor_modo: "fixo", divisor_fixo: 200 });
    expect(calcularFolha({ ...e, salario_proprio: 10000 }, p).vHe50).toBe(300);
  });
  it("nível vazio herda a tarifa geral", () => expect(calcularFolha({ ...e, nivel_cargo: "medio" }, parseFinanceiro(raw)).vHe100).toBe(400));
  it("zero explícito não herda a tarifa geral", () => {
    const p = parseFinanceiro({ ...raw, niveis: { superior: { valor_he50: 0 } } });
    expect(calcularFolha(e, p).vHe50).toBe(0);
  });
  it("sem tarifas novas não aplica fórmula antiga", () => expect(calcularFolha(e, parseFinanceiro({ modo_horas: "unitario" })).vAdn).toBe(0));
  it("rejeita tarifa negativa no nível", () => expect(validarFinanceiro(parseFinanceiro({ ...raw, niveis: { superior: { valor_he50: -1 } } }))).not.toBeNull());
  it("rejeita tarifa geral não finita", () => {
    const p = parseFinanceiro(raw);
    expect(validarFinanceiro({ ...p, valor_he100: Infinity })).not.toBeNull();
  });
  it("salvar e reler mantém tarifas e zero explícito", () => {
    const p = parseFinanceiro({ ...raw, niveis: { superior: { valor_adn: 0 } } });
    expect(calcularFolha(e, parseFinanceiro(JSON.parse(JSON.stringify(p)))).vAdn).toBe(0);
  });
  it("snapshot antigo conserva a tarifa anterior", () => {
    const p = parseFinanceiro({ divisor_modo: "fixo", divisor_fixo: 150, he100_fator: 2 });
    expect(calcularFolha(e, p).vHe100).toBe(689.6);
    expect(calcularFolha(e, parseFinanceiro({ ...raw, niveis: {} })).vHe100).toBe(400);
  });
});