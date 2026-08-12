import { describe, expect, it } from "vitest";
import { isCpfValido, validarLinhas } from "./piso-validacao";
import type { ResolvedRow } from "./piso-import";

function row(p: Partial<ResolvedRow>): ResolvedRow {
  return {
    cpf: null,
    nome: null,
    matricula: null,
    cargo: null,
    unidade: null,
    setor: null,
    vinculo: null,
    competencia: null,
    salario_base: null,
    dias_trabalhados: null,
    piso_complementacao: null,
    insalubridade: null,
    gratificacao: null,
    grat_funcao_vr: null,
    grat_funcao_pct: null,
    grat_nivel_superior: null,
    incentivos: null,
    hora_extra_50: null,
    hora_extra_100: null,
    adicional_noturno: null,
    auxilio_financeiro: null,
    aux_financeiro: null,
    ferias_1_3: null,
    ferias: null,
    ferias_normais: null,
    inss: null,
    irrf: null,
    iss: null,
    outros_descontos: null,
    valor_liquido: null,
    valor_final: null,
    total_positivos: null,
    total_desconto: null,
    tempo_servico: null,
    plantao: null,
    sobreaviso: null,
    vale_transporte: null,
    total_descontos: null,
    total_proventos: null,
    total_proventos_folha: null,
    total_descontos_folha: null,
    valor_liquido_folha: null,
    adn_informativo: null,
    profissional_id: null,
    status_match: "cpf",
    confidence_extraction: 1,
    confidence_validation: 1,
    validation_status: "READY",
    ...p,
  };
}

describe("isCpfValido", () => {
  it("aceita CPF válido", () => {
    expect(isCpfValido("529.982.247-25")).toBe(true);
  });
  it("rejeita dígito verificador errado e repetidos", () => {
    expect(isCpfValido("529.982.247-26")).toBe(false);
    expect(isCpfValido("111.111.111-11")).toBe(false);
    expect(isCpfValido("")).toBe(false);
  });
});

describe("validarLinhas", () => {
  const opts = { competencia: "Junho 2026", obrigatorios: ["cpf", "nome"] as never };

  it("marca linha válida", () => {
    const r = validarLinhas(
      [row({ cpf: "52998224725", nome: "MARIA", profissional_id: "x" })],
      opts,
    );
    expect(r.resumo.validas).toBe(1);
    expect(r.issues).toHaveLength(0);
  });

  it("detecta CPF ausente, inválido e duplicado", () => {
    const r = validarLinhas(
      [
        row({ nome: "SEM CPF" }),
        row({ cpf: "12345678900", nome: "INVALIDO" }),
        row({ cpf: "52998224725", nome: "A" }),
        row({ cpf: "529.982.247-25", nome: "B" }),
      ],
      opts,
    );
    expect(r.resumo.semCpf).toBe(1);
    expect(r.resumo.cpfInvalido).toBe(1);
    expect(r.resumo.duplicados).toBe(1);
    expect(r.resumo.validas).toBe(1);
  });

  it("detecta profissional não localizado e campo obrigatório", () => {
    const r = validarLinhas(
      [row({ cpf: "52998224725", status_match: "nao_localizado" })],
      opts,
    );
    const tipos = r.issues.map((i) => i.tipo);
    expect(tipos).toContain("profissional_nao_encontrado");
    expect(tipos).toContain("campo_obrigatorio");
    expect(r.linhasValidas).toHaveLength(0);
  });

  it("detecta competência divergente sem bloquear", () => {
    const r = validarLinhas(
      [row({ cpf: "52998224725", nome: "A", competencia: "Maio 2026" })],
      opts,
    );
    expect(r.resumo.competenciaDivergente).toBe(1);
    expect(r.linhasValidas).toHaveLength(1);
  });
});
