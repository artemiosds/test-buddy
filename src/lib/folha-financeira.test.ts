import { describe, expect, it } from "vitest";
import { calcularFolha, DEFAULT_FINANCEIRO, validarFinanceiro, type EntradaCalculo, type ParametrosFinanceiros } from "./folha-financeira";

const P: ParametrosFinanceiros = {
  ...DEFAULT_FINANCEIRO,
  divisor_modo: "fixo",
  divisor_fixo: 200,
  valor_plantao: 100,
  valor_sobreaviso: 50,
  cargos: { c1: { salario_base: 3000 } },
  niveis: { superior: { salario_base: 2000 } },
  tributos: { inss: { regime: "nenhum" }, rpps: { regime: "nenhum" }, irrf: { regime: "nenhum" }, iss: { regime: "nenhum", somente_autonomo: true } },
};
const E: EntradaCalculo = {
  tipo: "efetivos", cargo_id: "c1", salario_proprio: null, carga_cargo: 40, diasTrabalhados: 30,
  faltasInjustificadas: 0, faltasJustificadas: 0, atestado: 0, he50: 0, he100: 0, adn: 0, plantoes: 0, sobreaviso: 0, incentivo: 0,
};
const calc = (x: Partial<EntradaCalculo>) => calcularFolha({ ...E, ...x }, P);

describe("folha financeira", () => {
  it("herda salário do cargo", () => expect(calc({}).salarioBase).toBe(3000));
  it("salário individual prevalece", () => expect(calc({ salario_proprio: 4000 }).origemBase).toBe("profissional"));
  it("sem cargo usa piso do nível", () => expect(calc({ cargo_id: null, nivel_cargo: "superior" }).salarioBase).toBe(2000));
  it("falta injustificada desconta salário ÷ 30 × qtd", () => expect(calc({ faltasInjustificadas: 2 }).descontoFaltas).toBe(200));
  it("falta justificada e atestado não descontam", () => expect(calc({ faltasJustificadas: 3, atestado: 2 }).descontoFaltas).toBe(0));
  it("HE 50% = qtd × hora × 1,5", () => expect(calc({ he50: 10 }).vHe50).toBe(225));
  it("HE 100% = qtd × hora × 2", () => expect(calc({ he100: 10 }).vHe100).toBe(300));
  it("ADN = horas × (hora + 20%)", () => expect(calc({ adn: 10 }).vAdn).toBe(180));
  it("planilha: 20 h × R$ 34,48 = 689,60 e 120 h × R$ 20,69", () => {
    const r = calcularFolha({ ...E, cargo_id: null, salario_proprio: 2585.99, carga_cargo: 30, he100: 20, adn: 120 }, { ...P, divisor_modo: "fixo", divisor_fixo: 150 });
    expect(r.unit.he100).toBe(34.48);
    expect(r.vHe100).toBe(689.6);
    expect(r.unit.adn).toBe(20.69);
  });
  it("plantões e sobreavisos = qtd × valor", () => {
    const r = calc({ plantoes: 3, sobreaviso: 2 });
    expect(r.vPlantoes).toBe(300);
    expect(r.vSobreaviso).toBe(100);
  });
  it("incentivo soma direto ao bruto", () => expect(calc({ incentivo: 150 }).bruto).toBe(3150));
  it("validação rejeita divisor fixo vazio", () => expect(validarFinanceiro({ ...P, divisor_fixo: 0 })).not.toBeNull());
  it("validação aceita parâmetros corretos", () => expect(validarFinanceiro(P)).toBeNull());
});

describe("gratificação por cargo", () => {
  const P2: ParametrosFinanceiros = { ...P, niveis: { superior: { gratificacao_pct: 80 } }, cargos: { d: { salario_base: 2544.02, gratificacao_pct: 100 }, k: { salario_base: 2544.02, gratificacao_pct: 0 }, e: { salario_base: 2585.99 } } };
  const g = (cargo_id: string) => calcularFolha({ ...E, cargo_id, nivel_cargo: "superior" }, P2).vGratificacao;
  it("diretor com 100% recebe gratificação igual ao base", () => expect(g("d")).toBeCloseTo(2544.02, 2));
  it("coordenador com 0% não recebe gratificação do nível", () => expect(g("k")).toBe(0));
  it("cargo sem gratificação própria herda 80% do nível", () => expect(g("e")).toBeCloseTo(2068.79, 2));
});
