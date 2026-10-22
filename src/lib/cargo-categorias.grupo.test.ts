import { describe, it, expect } from "vitest";
import { cargoNoGrupo } from "./cargo-categorias";

describe("grupos assistenciais", () => {
  it("médicos incluem clínico geral e excluem enfermeiro", () => {
    expect(cargoNoGrupo("MEDICO CLINICO GERAL", "medicos")).toBe(true);
    expect(cargoNoGrupo("CLINICO GERAL/ PLANTONISTA", "medicos")).toBe(true);
    expect(cargoNoGrupo("ENFERMEIRO(A)", "medicos")).toBe(false);
  });
  it("enfermagem inclui enfermeiro, técnico e auxiliar", () => {
    expect(cargoNoGrupo("ENFERMEIRO(A)", "enfermagem")).toBe(true);
    expect(cargoNoGrupo("TEC. EM ENFERMAGEM", "enfermagem")).toBe(true);
    expect(cargoNoGrupo("AUX. DE ENFERMAGEM", "enfermagem")).toBe(true);
    expect(cargoNoGrupo("ODONTÓLOGO(A)", "enfermagem")).toBe(false);
  });
  it("assistência une os dois e exclui outros", () => {
    expect(cargoNoGrupo("MEDICO PEDIATRA", "assistencia")).toBe(true);
    expect(cargoNoGrupo("ENFERMEIRO(A)", "assistencia")).toBe(true);
    expect(cargoNoGrupo("MOTORISTA", "assistencia")).toBe(false);
  });
});
