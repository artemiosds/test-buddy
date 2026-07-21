import { describe, it, expect } from "vitest";
import {
  derivarSituacao,
  derivarAlertas,
  derivarElegibilidadePiso,
  contarSituacoes,
} from "./situacao-funcional";

const base = {
  id: "1",
  cpf: "12345678909",
  cargo: "Enfermeiro",
  funcao: "Assistencial",
  setor: "UTI",
  banco: "001",
  agencia: "1234",
  conta_corrente: "56789-0",
  situacao_funcional: "ativo",
};

describe("situacao-funcional", () => {
  it("deriva situação a partir de campos existentes", () => {
    expect(derivarSituacao({ id: "1", situacao_funcional: "ferias" })).toBe("ferias");
    expect(derivarSituacao({ id: "1", status: "licenca" })).toBe("licenca");
    expect(derivarSituacao({ id: "1" })).toBe("ativo");
  });

  it("aponta alertas cadastrais", () => {
    const alertas = derivarAlertas({ id: "1", cpf: null, cargo: null });
    expect(alertas).toContain("sem_cpf");
    expect(alertas).toContain("sem_cargo");
  });

  it("elegibilidade ao piso: enfermeiro sem pendências = elegível", () => {
    expect(derivarElegibilidadePiso(base)).toBe("elegivel");
  });

  it("elegibilidade: cargo fora de enfermagem = não elegível", () => {
    expect(derivarElegibilidadePiso({ ...base, cargo: "Motorista" })).toBe("nao_elegivel");
  });

  it("elegibilidade: enfermeiro em férias = revisar", () => {
    expect(derivarElegibilidadePiso({ ...base, situacao_funcional: "ferias" })).toBe("revisar");
  });

  it("contarSituacoes soma corretamente", () => {
    const r = contarSituacoes([
      base,
      { ...base, id: "2", situacao_funcional: "ferias" },
      { ...base, id: "3", situacao_funcional: "desligado" },
    ]);
    expect(r.total).toBe(3);
    expect(r.ativos).toBe(1);
    expect(r.ferias).toBe(1);
    expect(r.desligados).toBe(1);
  });
});