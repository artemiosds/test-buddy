import { describe, expect, it } from "vitest";
import {
  computeDossieResumo,
  deriveLotacoes,
  deriveMovimentacoes,
  formatTempoServico,
  diasDesde,
  type HistoricoEvento,
  type LinhaFrequenciaMin,
} from "./dossie";

function ev(over: Partial<HistoricoEvento>): HistoricoEvento {
  return {
    id: over.id ?? crypto.randomUUID(),
    tipo_evento: over.tipo_evento ?? "outro",
    data_inicio: over.data_inicio ?? "2024-01-01",
    data_fim: over.data_fim ?? null,
    motivo: over.motivo ?? null,
    observacoes: over.observacoes ?? null,
    documento_referencia: over.documento_referencia ?? null,
    unidade_novo_id: over.unidade_novo_id ?? null,
    unidade_anterior_id: over.unidade_anterior_id ?? null,
    setor_novo_id: over.setor_novo_id ?? null,
    setor_anterior_id: over.setor_anterior_id ?? null,
    cargo_novo_id: over.cargo_novo_id ?? null,
    cargo_anterior_id: over.cargo_anterior_id ?? null,
    funcao_novo_id: over.funcao_novo_id ?? null,
    funcao_anterior_id: over.funcao_anterior_id ?? null,
    vinculo_novo_id: over.vinculo_novo_id ?? null,
    vinculo_anterior_id: over.vinculo_anterior_id ?? null,
  };
}

describe("formatTempoServico", () => {
  const ref = new Date("2026-07-17T12:00:00Z");

  it("retorna anos+meses para admissão antiga", () => {
    expect(formatTempoServico("2020-01-15", ref)).toMatch(/^6a 6m$/);
  });

  it("retorna placeholder para nulo/invalido/futuro", () => {
    expect(formatTempoServico(null, ref)).toBe("—");
    expect(formatTempoServico("invalid", ref)).toBe("—");
    expect(formatTempoServico("2030-01-01", ref)).toBe("—");
  });

  it("mostra dias quando menor que um mês", () => {
    expect(formatTempoServico("2026-07-10", ref)).toMatch(/\d+d/);
  });
});

describe("diasDesde", () => {
  const ref = new Date("2026-07-17T12:00:00Z");
  it("calcula diferença em dias", () => {
    expect(diasDesde("2026-07-01", ref)).toBe(16);
  });
  it("retorna null quando ausente", () => {
    expect(diasDesde(null, ref)).toBeNull();
  });
});

describe("deriveLotacoes", () => {
  it("mantém apenas eventos com destino de unidade/setor/cargo/função ou admissão, ordenados desc, com data_fim inferida", () => {
    const h: HistoricoEvento[] = [
      ev({ id: "a", tipo_evento: "admissao", data_inicio: "2020-01-01" }),
      ev({ id: "b", tipo_evento: "transferencia", data_inicio: "2022-05-10", unidade_novo_id: "u1" }),
      ev({ id: "c", tipo_evento: "mudanca_cargo", data_inicio: "2024-02-01", cargo_novo_id: "c1" }),
      ev({ id: "d", tipo_evento: "ferias", data_inicio: "2024-06-01" }),
    ];
    const lot = deriveLotacoes(h);
    expect(lot.map((l) => l.id)).toEqual(["c", "b", "a"]);
    expect(lot[2].data_fim_efetiva).toBe("2022-05-10");
    expect(lot[1].data_fim_efetiva).toBe("2024-02-01");
    expect(lot[0].data_fim_efetiva).toBeNull();
  });
});

describe("deriveMovimentacoes", () => {
  it("filtra somente tipos de movimentação, ordena desc", () => {
    const h: HistoricoEvento[] = [
      ev({ id: "a", tipo_evento: "admissao", data_inicio: "2020-01-01" }),
      ev({ id: "b", tipo_evento: "ferias", data_inicio: "2023-06-01" }),
      ev({ id: "c", tipo_evento: "transferencia", data_inicio: "2022-01-01" }),
    ];
    const m = deriveMovimentacoes(h);
    expect(m.map((x) => x.id)).toEqual(["c", "a"]);
  });
});

describe("computeDossieResumo", () => {
  it("agrega contagens, HE, faltas, % aprovadas e dias desde última movimentação", () => {
    const ref = new Date("2026-07-17T12:00:00Z");
    const h: HistoricoEvento[] = [
      ev({ tipo_evento: "admissao", data_inicio: "2020-01-01", unidade_novo_id: "u1", setor_novo_id: "s1", cargo_novo_id: "c1", funcao_novo_id: "f1" }),
      ev({ tipo_evento: "transferencia", data_inicio: "2024-06-01", unidade_novo_id: "u2", setor_novo_id: "s2" }),
    ];
    const linhas: LinhaFrequenciaMin[] = [
      { status_linha: "aprovada", faltas_injustificadas: 0, faltas_justificadas: 1, he_50: 2, he_100: 0, competencia_key: "2025-01", unidade_id: "u1" },
      { status_linha: "aprovada", faltas_injustificadas: 1, faltas_justificadas: 0, he_50: 0, he_100: 4, competencia_key: "2025-02", unidade_id: "u2" },
      { status_linha: "pendente", faltas_injustificadas: 2, faltas_justificadas: 0, he_50: 0, he_100: 0, competencia_key: "2025-02", unidade_id: "u2" },
    ];
    const r = computeDossieResumo({ historico: h, linhas, pendenciasAbertas: 1, pendenciasResolvidas: 3, ref });
    expect(r.totalCompetencias).toBe(2);
    expect(r.totalFrequencias).toBe(3);
    expect(r.totalHorasExtras).toBe(6);
    expect(r.totalFaltas).toBe(4);
    expect(r.frequenciasAprovadas).toBe(2);
    expect(r.percentualAprovadas).toBe(67);
    expect(r.unidadesDistintas).toBe(2);
    expect(r.setoresDistintos).toBe(2);
    expect(r.cargosDistintos).toBe(1);
    expect(r.funcoesDistintas).toBe(1);
    expect(r.diasDesdeUltimaMovimentacao).toBeGreaterThan(0);
    expect(r.pendenciasAbertas).toBe(1);
  });
});