import { describe, it, expect } from "vitest";
import { normalizarCategoriaPiso, ehCargoElegivel } from "./piso-categorias";

describe("normalizarCategoriaPiso", () => {
  it("normaliza enfermeiros", () => {
    for (const c of ["Enfermeira", "Enfermeiro", "ENFERMEIRO(A)", "Enfermeiro(a)", "ENFERMEIRO"]) {
      expect(normalizarCategoriaPiso(c)).toBe("ENFERMEIRO");
    }
  });

  it("normaliza técnicos", () => {
    for (const c of [
      "TEC. EM ENFERMAGEM",
      "Técnico de Enfermagem",
      "Técnica de Enfermagem",
      "TECNICO EM ENFERMAGEM",
    ]) {
      expect(normalizarCategoriaPiso(c)).toBe("TECNICO_ENFERMAGEM");
    }
  });

  it("normaliza auxiliares", () => {
    for (const c of ["Auxiliar de Enfermagem", "AUX. DE ENFERMAGEM", "auxiliar enfermagem"]) {
      expect(normalizarCategoriaPiso(c)).toBe("AUXILIAR_ENFERMAGEM");
    }
  });

  it("aceita abreviações", () => {
    expect(normalizarCategoriaPiso("Enf.")).toBe("ENFERMEIRO");
    expect(normalizarCategoriaPiso("ENF")).toBe("ENFERMEIRO");
    expect(normalizarCategoriaPiso("TEC ENF")).toBe("TECNICO_ENFERMAGEM");
    expect(normalizarCategoriaPiso("TEC.ENFERMAGEM")).toBe("TECNICO_ENFERMAGEM");
    expect(normalizarCategoriaPiso("TEC. EM ENFERMAGEM")).toBe("TECNICO_ENFERMAGEM");
    expect(normalizarCategoriaPiso("AUX. ENF")).toBe("AUXILIAR_ENFERMAGEM");
    expect(normalizarCategoriaPiso("AUX ENFERMAGEM")).toBe("AUXILIAR_ENFERMAGEM");
  });

  it("rejeita cargos fora da enfermagem", () => {
    for (const c of [
      "Médico",
      "Agente de Saúde",
      "",
      null,
      undefined,
      "Motorista",
      "Fonoaudiólogo",
      "Fono",
      "Biomédica",
      "Assistente Administrativo",
      "Assistente Social",
      "Cozinheira",
      "AUX.SERV. GERAIS",
      "TEC. LABORATÓRIO",
      "Farmacêutico",
      "Odontólogo",
      "Psicólogo",
      "Nutricionista",
      "Fisioterapeuta",
    ]) {
      expect(normalizarCategoriaPiso(c)).toBeNull();
      expect(ehCargoElegivel(c)).toBe(false);
    }
  });
});

