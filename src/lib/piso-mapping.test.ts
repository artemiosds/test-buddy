import { describe, it, expect } from "vitest";
import { autoMap, normalize, parseNumeric, suggestDestino, onlyDigits, CPF_REGEX } from "./piso-mapping";

describe("piso-mapping", () => {
  it("normaliza acentos e caixa", () => {
    expect(normalize("Gratificação")).toBe("gratificacao");
    expect(normalize("HORA EXTRA 50%")).toBe("hora extra 50%");
  });

  it("sugere destino por alias exato", () => {
    expect(suggestDestino("CPF")).toBe("cpf");
    expect(suggestDestino("FUNCIONÁRIO")).toBe("nome");
    expect(suggestDestino("Matrícula")).toBe("matricula");
    expect(suggestDestino("VENCIMENTO")).toBe("salario_base");
    expect(suggestDestino("INSS")).toBe("inss");
    expect(suggestDestino("HORA EXTRA 50%")).toBe("hora_extra_50");
  });

  it("retorna null para headers sem alias", () => {
    expect(suggestDestino("CAMPO_ESQUISITO_XYZ")).toBeNull();
  });

  it("autoMap não repete destino já usado", () => {
    const m = autoMap(["CPF", "Nome", "Nome Completo", "Vencimento"]);
    expect(m["CPF"]).toBe("cpf");
    expect(m["Nome"]).toBe("nome");
    expect(m["Nome Completo"]).toBeNull();
    expect(m["Vencimento"]).toBe("salario_base");
  });

  it("parseNumeric entende R$ com vírgula/milhar", () => {
    expect(parseNumeric("R$ 1.234,56")).toBe(1234.56);
    expect(parseNumeric("2500")).toBe(2500);
    expect(parseNumeric("")).toBeNull();
    expect(parseNumeric(null)).toBeNull();
  });

  it("onlyDigits + CPF regex", () => {
    expect(onlyDigits("123.456.789-00")).toBe("12345678900");
    expect(CPF_REGEX.test("123.456.789-00")).toBe(true);
    expect(CPF_REGEX.test("12345678900")).toBe(true);
  });
});