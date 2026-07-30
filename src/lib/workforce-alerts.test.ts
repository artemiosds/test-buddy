import { describe, it, expect } from "vitest";
import { classifySemaforo } from "./intelligence";
import { buildWorkforceAlertItems } from "./workforce-alerts";

describe("Status da Força de Trabalho — classifySemaforo", () => {
  const base = {
    totalProfessionals: 100,
    afastados: 0,
    pendencias: 0,
    semLotacao: 0,
    unidadesSemGestor: 0,
    horasExtras: 0,
    frequenciasPendentes: 0,
  };

  it("🟢 Regular quando não há gatilhos ativos", () => {
    const r = classifySemaforo(base);
    expect(r.nivel).toBe("ok");
    expect(r.motivos).toHaveLength(0);
  });

  it("🔴 Crítico quando há pendências abertas", () => {
    const r = classifySemaforo({ ...base, pendencias: 3 });
    expect(r.nivel).toBe("critico");
    expect(r.motivos.join(" ")).toMatch(/pendência/i);
  });

  it("🔴 Crítico quando há unidades sem gestor", () => {
    const r = classifySemaforo({ ...base, unidadesSemGestor: 1 });
    expect(r.nivel).toBe("critico");
    expect(r.motivos.join(" ")).toMatch(/sem gestor/i);
  });

  it("🟡 Atenção quando há profissionais sem lotação", () => {
    const r = classifySemaforo({ ...base, semLotacao: 5 });
    expect(r.nivel).toBe("atencao");
    expect(r.motivos.join(" ")).toMatch(/sem lotação/i);
  });

  it("🟡 Atenção quando há frequências pendentes no período ativo", () => {
    const r = classifySemaforo({ ...base, frequenciasPendentes: 2 });
    expect(r.nivel).toBe("atencao");
    expect(r.motivos.join(" ")).toMatch(/frequência/i);
  });

  it("crítico prevalece sobre atenção quando ambos ocorrem", () => {
    const r = classifySemaforo({
      ...base,
      pendencias: 1,
      semLotacao: 10,
      frequenciasPendentes: 4,
    });
    expect(r.nivel).toBe("critico");
    expect(r.contagemAlertas).toBeGreaterThanOrEqual(3);
  });
});

describe("Alertas de Força de Trabalho — buildWorkforceAlertItems", () => {
  const alertasFull = {
    semUnidade: 1,
    semSetor: 2,
    semCargo: 3,
    semFuncao: 4,
    unidadesSemGestor: 5,
    setoresVazios: 6,
  };

  it("gera 7 alertas cobrindo todos os gatilhos exigidos", () => {
    const items = buildWorkforceAlertItems({ alertas: alertasFull, pendenciasVencidas: 7 });
    expect(items).toHaveLength(7);
    const ids = items.map((i) => i.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "prof-sem-unidade",
        "prof-sem-setor",
        "prof-sem-cargo",
        "prof-sem-funcao",
        "uni-sem-gestor",
        "set-vazios",
        "pend-vencidas",
      ]),
    );
  });

  it("cada alerta aponta para uma rota de detalhes existente (nunca ação de escrita)", () => {
    const items = buildWorkforceAlertItems({ alertas: alertasFull, pendenciasVencidas: 7 });
    for (const it of items) {
      expect(it.to.startsWith("/")).toBe(true);
      // Nenhum alerta deve apontar para rotas de escrita/edição.
      expect(it.to).not.toMatch(/\/(edit|novo|criar|excluir)/i);
    }
  });

  it("preserva a contagem exata vinda de useAnalytics.alertas", () => {
    const items = buildWorkforceAlertItems({ alertas: alertasFull, pendenciasVencidas: 9 });
    const byId = Object.fromEntries(items.map((i) => [i.id, i.count]));
    expect(byId["prof-sem-unidade"]).toBe(1);
    expect(byId["prof-sem-setor"]).toBe(2);
    expect(byId["prof-sem-cargo"]).toBe(3);
    expect(byId["prof-sem-funcao"]).toBe(4);
    expect(byId["uni-sem-gestor"]).toBe(5);
    expect(byId["set-vazios"]).toBe(6);
    expect(byId["pend-vencidas"]).toBe(9);
  });

  it("aceita alertas nulos e devolve zeros sem quebrar", () => {
    const items = buildWorkforceAlertItems({ alertas: null, pendenciasVencidas: 0 });
    expect(items.every((i) => i.count === 0)).toBe(true);
  });
});
