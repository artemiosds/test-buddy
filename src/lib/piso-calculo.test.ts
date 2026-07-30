import { describe, it, expect } from "vitest";
import { calcularPiso, valorReferencia } from "./piso-calculo";

// Os valores de referência vêm SEMPRE da Tabela de Referência (parametrizável
// por competência/categoria). Nos testes eles são passados explicitamente.
const REF_ENFERMEIRO = 4750;
const REF_TECNICO = 3325;
const REF_AUXILIAR = 2375;

describe("piso-calculo", () => {
  it("aplica proporcionalidade por carga horária", () => {
    expect(valorReferencia("ENFERMEIRO", 44, REF_ENFERMEIRO)).toBe(4750);
    expect(valorReferencia("ENFERMEIRO", 22, REF_ENFERMEIRO)).toBe(2375);
    expect(valorReferencia("TECNICO_ENFERMAGEM", 44, REF_TECNICO)).toBe(3325);
    expect(valorReferencia(null, 44, REF_ENFERMEIRO)).toBe(0);
  });

  it("retorna zero quando não há valor cadastrado na tabela de referência", () => {
    expect(valorReferencia("ENFERMEIRO", 44)).toBe(0);
    const m = calcularPiso({ categoria: "ENFERMEIRO", cargaHoraria: 44, salarioBase: 1000 });
    expect(m.referenciaConfigurada).toBe(false);
    expect(m.complementacao).toBe(0);
  });

  it("calcula complementação a partir da base considerada", () => {
    const m = calcularPiso({
      categoria: "ENFERMEIRO",
      cargaHoraria: 44,
      salarioBase: 3000,
      insalubridade: 500,
      valorReferenciaBase: REF_ENFERMEIRO,
    });
    expect(m.baseConsiderada).toBe(3500);
    expect(m.complementacao).toBe(1250);
    expect(m.totalRemuneracao).toBe(4750);
    expect(m.divergencia).toBe(false);
    expect(m.referenciaConfigurada).toBe(true);
  });

  it("marca divergência quando o importado difere do calculado", () => {
    const m = calcularPiso({
      categoria: "ENFERMEIRO",
      cargaHoraria: 44,
      salarioBase: 3000,
      insalubridade: 0,
      auxilioImportado: 1500,
      valorReferenciaBase: REF_ENFERMEIRO,
    });
    expect(m.complementacao).toBe(1750);
    expect(m.divergencia).toBe(true);
    expect(m.diferenca).toBe(250);
  });

  it("não gera complementação negativa", () => {
    const m = calcularPiso({
      categoria: "AUXILIAR_ENFERMAGEM",
      salarioBase: 9000,
      valorReferenciaBase: REF_AUXILIAR,
    });
    expect(m.complementacao).toBe(0);
  });
});
