import { describe, expect, it } from "vitest";
import { exigeLembreteCorrecao, eventoLembreteCorrecao, type FolhaCorrecao } from "./cobranca-correcao";

const agora = new Date("2026-11-08T18:00:00Z");
const exemplo: FolhaCorrecao = {
  id: "folha-123", status: "devolvida", tipo: "efetivos",
  updated_at: "2026-11-07T17:00:00Z",
  unidade_id: "unidade-a", competencia_id: "competencia-a",
  competencia_status: "em_processamento", secretaria_id: "secretaria-a",
};

describe("lembretes de devoluções pendentes", () => {
  it("cobra folha devolvida há mais de 24 horas", () => {
    expect(exigeLembreteCorrecao(exemplo, agora)).toBe(true);
  });
  it("não cobra folha alterada há menos de 24 horas", () => {
    expect(exigeLembreteCorrecao({
      ...exemplo, updated_at: "2026-11-08T10:00:00Z",
    }, agora)).toBe(false);
  });
  it("não cobra folha corrigida, enviada ou aprovada", () => {
    for (const status of ["rascunho", "enviada", "em_analise", "aprovada", "arquivada"]) {
      expect(exigeLembreteCorrecao({ ...exemplo, status }, agora)).toBe(false);
    }
  });
  it("cobra rejeições e pendências não resolvidas", () => {
    for (const status of ["rejeitada", "com_pendencias"]) {
      expect(exigeLembreteCorrecao({ ...exemplo, status }, agora)).toBe(true);
    }
  });
  it("não cobra competência cancelada ou arquivada", () => {
    for (const competencia_status of ["cancelada", "arquivada"]) {
      expect(exigeLembreteCorrecao({ ...exemplo, competencia_status }, agora)).toBe(false);
    }
  });
  it("não cobra registros sem vínculo ou sem data confiável", () => {
    expect(exigeLembreteCorrecao({ ...exemplo, unidade_id: "" }, agora)).toBe(false);
    expect(exigeLembreteCorrecao({ ...exemplo, updated_at: null }, agora)).toBe(false);
    expect(exigeLembreteCorrecao({ ...exemplo, updated_at: "invalid" }, agora)).toBe(false);
  });
  it("mantém a mesma chave no mesmo dia e altera no dia seguinte", () => {
    const cedo = new Date("2026-11-08T12:00:00Z");
    const tarde = new Date("2026-11-08T22:00:00Z");
    const amanha = new Date("2026-11-09T22:00:00Z");
    expect(eventoLembreteCorrecao(exemplo, cedo)).toBe(eventoLembreteCorrecao(exemplo, tarde));
    expect(eventoLembreteCorrecao(exemplo, amanha)).not.toBe(eventoLembreteCorrecao(exemplo, tarde));
  });
  it("não compartilha chave entre folhas e estados diferentes", () => {
    expect(eventoLembreteCorrecao(exemplo, agora))
      .not.toBe(eventoLembreteCorrecao({ ...exemplo, id: "folha-456" }, agora));
    expect(eventoLembreteCorrecao(exemplo, agora))
      .not.toBe(eventoLembreteCorrecao({ ...exemplo, status: "rejeitada" }, agora));
  });
});
