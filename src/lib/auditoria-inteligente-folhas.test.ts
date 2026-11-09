import { describe, expect, it } from "vitest";
import { auditarPreEnvioFolha, auditarResumoAprovacoes } from "./auditoria-inteligente-folhas";

describe("auditoria de pré-envio informativa", () => {
  it("não apresenta advertências quando não há dados suspeitos", () =>
    expect(auditarPreEnvioFolha({})).toEqual([]));
  it("não transforma dias zerados em bloqueio", () => {
    const achados = auditarPreEnvioFolha({ profissionaisSemDias: [
      { id: "p1", nome: "Profissional A" }, { id: "p2", nome: "Profissional B" },
    ] });
    expect(achados[0].quantidade).toBe(2);
    expect(achados[0].severidade).toBe("aviso");
  });
  it("preserva setores já enviados ao sinalizar envio parcial", () => {
    const r = auditarPreEnvioFolha({ setoresEnvio: [
      { id: "a", nome: "A", status: "enviada", jaEnviado: true },
      { id: "b", nome: "B", status: "rascunho", jaEnviado: false },
    ] });
    expect(r.some(a => a.codigo === "ENVIO_SETORIAL_PARCIAL" && a.quantidade === 1)).toBe(true);
  });
  it("identifica setor devolvido sem tentar alterar o status", () => {
    const input = [{ id: "a", nome: "A", status: "devolvida", jaEnviado: false }];
    expect(auditarPreEnvioFolha({ setoresEnvio: input }).some(a =>
      a.codigo === "SETOR_CORRECAO_PENDENTE")).toBe(true);
    expect(input[0].status).toBe("devolvida");
  });
});
describe("resumo de conferência de aprovações", () => {
  it("identifica folha sem profissionais como aviso, sem afetar aprovação", () => {
    const r = auditarResumoAprovacoes([{
      id: "a", competencia_unidade_id: "u", tipo: "efetivos",
      setor_id: null, status: "enviada", total_profissionais: 0,
    }]);
    expect(r).toEqual({ avaliadas: 1, aguardando: 1, correcao: 0, semProfissionais: 1, duplicadas: 0 });
  });
  it("não conta status rascunho como aguardando aprovação", () => {
    const r = auditarResumoAprovacoes([{
      id: "a", competencia_unidade_id: "u", tipo: "contratados",
      setor_id: "s", status: "rascunho", total_profissionais: 12,
    }]);
    expect(r.aguardando).toBe(0);
  });
  it("detecta id duplicado sem tratar geral/setor como a mesma folha", () => {
    const base = { id: "a", competencia_unidade_id: "u", tipo: "efetivos", setor_id: null, status: "enviada", total_profissionais: 10 };
    const r = auditarResumoAprovacoes([base, base, { ...base, id: "b", setor_id: "s" }]);
    expect(r.duplicadas).toBe(1);
  });
});
