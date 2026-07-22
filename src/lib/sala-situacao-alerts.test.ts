import { describe, expect, it } from "vitest";
import {
  ALERT_RULES,
  buildAlertas,
  filterHeCritico,
  pendenciaEstaCritica,
  type PendenciaInput,
} from "./sala-situacao-alerts";
import type { RankingRow } from "./analytics-aggregations";

const NOW = new Date("2026-07-17T12:00:00Z").getTime();
const DAY = 24 * 3600 * 1000;

const rank = (over: Partial<RankingRow> = {}): RankingRow => ({
  unidade_id: over.unidade_id ?? "u1",
  unidade_nome: over.unidade_nome ?? "UBS Centro",
  unidade_sigla: over.unidade_sigla ?? "UBS-C",
  total_profissionais: over.total_profissionais ?? 0,
  total_faltas: over.total_faltas ?? 0,
  total_horas_extras: over.total_horas_extras ?? 0,
  aprovadas: over.aprovadas ?? 0,
  total_folhas: over.total_folhas ?? 0,
});

const pend = (over: Partial<PendenciaInput> = {}): PendenciaInput => ({
  ...{
    id: "p1",
    titulo: "Pendência X" as string | null,
    status: "aberta",
    created_at: new Date(NOW - 10 * DAY).toISOString(),
  },
  ...over,
});

describe("ALERT_RULES", () => {
  it("mantém limiares operacionais documentados", () => {
    expect(ALERT_RULES.pendenciaDiasCritico).toBe(7);
    expect(ALERT_RULES.heCriticoUnidade).toBe(200);
  });
});

describe("pendenciaEstaCritica", () => {
  it("é crítica quando ultrapassa o limiar", () => {
    expect(pendenciaEstaCritica(new Date(NOW - 10 * DAY), NOW)).toBe(true);
  });
  it("não é crítica dentro do limiar (exatamente 7 dias)", () => {
    expect(pendenciaEstaCritica(new Date(NOW - 7 * DAY), NOW)).toBe(false);
  });
  it("aceita ISO string", () => {
    expect(pendenciaEstaCritica(new Date(NOW - 30 * DAY).toISOString(), NOW)).toBe(true);
  });
});

describe("filterHeCritico", () => {
  it("retém somente unidades acima do limiar padrão (>200h)", () => {
    const ranking = [
      rank({ unidade_id: "a", total_horas_extras: 100 }),
      rank({ unidade_id: "b", total_horas_extras: 200 }),
      rank({ unidade_id: "c", total_horas_extras: 201 }),
      rank({ unidade_id: "d", total_horas_extras: 999 }),
    ];
    expect(filterHeCritico(ranking).map((r) => r.unidade_id)).toEqual(["c", "d"]);
  });
  it("respeita limite customizado", () => {
    const ranking = [
      rank({ unidade_id: "a", total_horas_extras: 50 }),
      rank({ unidade_id: "b", total_horas_extras: 51 }),
    ];
    expect(filterHeCritico(ranking, 50).map((r) => r.unidade_id)).toEqual(["b"]);
  });
});

describe("buildAlertas", () => {
  it("agrega os três tipos na ordem: pendência → he → rascunho", () => {
    const alertas = buildAlertas({
      pendencias: [pend({ id: "p1", created_at: new Date(NOW - 10 * DAY).toISOString() })],
      ranking: [rank({ unidade_id: "u1", total_horas_extras: 300 })],
      frequenciasPendentes: 4,
      now: NOW,
    });
    expect(alertas.map((a) => a.tipo)).toEqual(["pendencia", "he", "rascunho"]);
    expect(alertas[0].id).toBe("pend-p1");
    expect(alertas[1].id).toBe("he-u1");
    expect(alertas[2].id).toBe("rascunho-global");
  });

  it("omite alerta de rascunho quando frequenciasPendentes = 0", () => {
    const alertas = buildAlertas({
      pendencias: [],
      ranking: [],
      frequenciasPendentes: 0,
      now: NOW,
    });
    expect(alertas).toEqual([]);
  });

  it("não alerta unidades com HE dentro do limiar", () => {
    const alertas = buildAlertas({
      pendencias: [],
      ranking: [
        rank({ unidade_id: "u1", total_horas_extras: 150 }),
        rank({ unidade_id: "u2", total_horas_extras: 200 }),
      ],
      frequenciasPendentes: 0,
      now: NOW,
    });
    expect(alertas).toEqual([]);
  });

  it("usa fallback de título quando pendência não tem título", () => {
    const [a] = buildAlertas({
      pendencias: [pend({ titulo: null })],
      ranking: [],
      frequenciasPendentes: 0,
      now: NOW,
    });
    expect(a.titulo).toBe("Pendência sem título");
  });

  it("calcula dias em aberto corretamente", () => {
    const [a] = buildAlertas({
      pendencias: [pend({ created_at: new Date(NOW - 12 * DAY).toISOString() })],
      ranking: [],
      frequenciasPendentes: 0,
      now: NOW,
    });
    expect(a.detalhe).toContain("12 dias");
    expect(a.detalhe).toContain("status aberta");
  });

  it("aceita limiteHe customizado", () => {
    const alertas = buildAlertas({
      pendencias: [],
      ranking: [rank({ unidade_id: "u1", total_horas_extras: 60 })],
      frequenciasPendentes: 0,
      now: NOW,
      limiteHe: 50,
    });
    expect(alertas).toHaveLength(1);
    expect(alertas[0].tipo).toBe("he");
  });
});
