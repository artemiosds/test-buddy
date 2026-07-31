import { describe, expect, it } from "vitest";
import { calcularUbs } from "./calculators/ubsCalculator";
import { detectarTemplate, cpfFormatado, numero } from "./index";

describe("template UBS", () => {
  it("aplica a matemática do modelo", () => {
    const r = calcularUbs({
      nome: "  maria  silva ",
      cpf: "123.456.789-09",
      cargo: "enfermeira",
      salario_base: "4.654,80",
      insalubridade: 517.2,
      hora_extra_50: 100,
      adicional_noturno: 0,
      gratificacao: 200,
      vale_transporte: 50,
      auxilio_financeiro: 30,
    });
    expect(r.total_proventos).toBe(5272);
    expect(r.total_descontos).toBe(263.6);
    expect(r.valor_liquido).toBe(5008.4);
    expect(r.valor_final).toBe(380);
    expect(r.nome).toBe("MARIA SILVA");
    expect(r.cpf).toBe("12345678909");
  });

  it("detecta pelo nome do arquivo e cabeçalhos", () => {
    const det = detectarTemplate("SAUDE - UBS'S.xlsx", [
      "NOME",
      "C.P.F.",
      "LOTAÇÃO",
      "CARGO",
      "BASE",
    ]);
    expect(det?.template.id).toBe("UBS_SAUDE");
  });

  it("não detecta arquivo alheio", () => {
    expect(detectarTemplate("educacao.xlsx", ["ALGO", "OUTRO"])).toBeNull();
  });

  it("formata cpf e converte números pt-BR", () => {
    expect(cpfFormatado("12345678909")).toBe("123.456.789-09");
    expect(numero("1.234,56")).toBe(1234.56);
    expect(numero("R$ 517,20")).toBe(517.2);
  });
});
