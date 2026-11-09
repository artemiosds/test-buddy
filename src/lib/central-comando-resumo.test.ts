import { describe, expect, it } from "vitest";
import { resumirComando } from "./central-comando-resumo";

const linha = (id: string, unidade_id: string, status: string, setor_id: string | null = null, tipo="contratados") =>
  ({ id, unidade_id, status, setor_id, tipo });

describe("Central de Comando — sem acesso a dados além do escopo recebido", () => {
  it("não considera setores em rascunho quando a folha Geral enviada prevalece", () => {
    const r = resumirComando(["A"], [
      linha("geral", "A", "enviada"), linha("setor", "A", "rascunho", "setor-1"),
    ]);
    expect(r.pendentes).toBe(0);
    expect(r.prontasAprovacao).toBe(1);
  });
  it("não considera unidade concluída com uma das folhas em rascunho", () => {
    const r = resumirComando(["A"], [
      linha("efetivos", "A", "enviada", null, "efetivos"),
      linha("contratados", "A", "rascunho"),
    ]);
    expect(r.pendentes).toBe(1);
  });
  it("mostra unidade sem nenhuma folha como pendente", () => {
    expect(resumirComando(["A"], []).pendentes).toBe(1);
  });
  it("separa correção, aprovação e conclusão", () => {
    const r = resumirComando(["A", "B", "C"], [
      linha("a", "A", "devolvida"),
      linha("b", "B", "em_analise"),
      linha("c", "C", "aprovada"),
    ]);
    expect([r.emCorrecao, r.prontasAprovacao, r.concluidas]).toEqual([1,1,2]);
  });
  it("ignora folhas de unidades fora do escopo", () => {
    const r = resumirComando(["A"], [linha("outro", "B", "devolvida")]);
    expect(r.unidades).toBe(1);
    expect(r.emCorrecao).toBe(0);
  });
});
