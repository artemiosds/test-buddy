import { describe, it, expect } from "vitest";
import {
  detectarModelo,
  detectarCompetencia,
  competenciaAtual,
  headerConfidence,
  computeQuality,
  fingerprint,
  isCpfValido,
} from "./piso-heuristics";

describe("piso-heuristics", () => {
  it("detecta modelo pelo nome do arquivo", () => {
    expect(detectarModelo("Folha Efetivos Janeiro.xlsx")).toBe("Efetivos");
    expect(detectarModelo("fopag_01_2026.xls")).toBe("Efetivos");
    expect(detectarModelo("Contratados-Fev-2026.csv")).toBe("Contratados");
    expect(detectarModelo("MS_janeiro.xlsx")).toBe("Ministério");
    expect(detectarModelo("aleatorio.xlsx")).toBeNull();
  });

  it("detecta competência em vários formatos", () => {
    expect(detectarCompetencia("Folha_01_2026.xlsx")).toBe("Janeiro 2026");
    expect(detectarCompetencia("efetivos-2026-03.csv")).toBe("Março 2026");
    expect(detectarCompetencia("Folha janeiro 2026.xlsx")).toBe("Janeiro 2026");
    expect(detectarCompetencia("arquivo.xlsx")).toBeNull();
  });

  it("competência atual segue mês/ano", () => {
    const d = new Date(2026, 6, 1);
    expect(competenciaAtual(d)).toBe("Julho 2026");
  });

  it("headerConfidence: alta para alias exato, média para inclusão", () => {
    expect(headerConfidence("CPF").tone).toBe("high");
    expect(headerConfidence("Vencimento base do servidor").tone).toBe("medium");
    expect(headerConfidence("XYZ desconhecido").tone).toBe("none");
  });

  it("computeQuality calcula percentuais e overall", () => {
    const rows = [
      { CPF: "123.456.789-00", NOME: "A", MAT: "1" },
      { CPF: "111", NOME: "B", MAT: "" },
      { CPF: "987.654.321-00", NOME: "", MAT: "3" },
    ];
    const q = computeQuality(rows, { CPF: "cpf", NOME: "nome", MAT: "matricula" });
    expect(q.total).toBe(3);
    expect(q.cpfValidos).toBe(2);
    expect(q.nomePreenchido).toBe(2);
    expect(q.matriculaPreenchida).toBe(2);
  });

  it("isCpfValido aceita 11 dígitos", () => {
    expect(isCpfValido("123.456.789-00")).toBe(true);
    expect(isCpfValido("123")).toBe(false);
  });

  it("fingerprint independe da ordem", () => {
    expect(fingerprint(["A", "B", "C"])).toBe(fingerprint(["C", "A", "B"]));
  });
});
