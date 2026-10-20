import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { paramsDoSnapshot } from "@/hooks/use-folha-financeira";
import { calcularFolha, parseFinanceiro } from "@/lib/folha-financeira";

const entrada = { tipo: "contratados" as const, cargo_id: "c1", salario_proprio: null, carga_cargo: 40, vinculo_nome: null,
  diasTrabalhados: 30, faltasInjustificadas: 0, faltasJustificadas: 0, atestado: 0, he50: 0, he100: 0, adn: 0, plantoes: 0, sobreaviso: 0, incentivo: 0 };

describe("regras históricas da aprovação", () => {
  it("usa o salário do cargo gravado na aprovação, não o atual", () => {
    const antigo = paramsDoSnapshot({ financeiro: { cargos: { c1: { salario_base: 1518 } } }, nivelPorCargo: {} });
    const atual = parseFinanceiro({ cargos: { c1: { salario_base: 1621 } } });
    expect(calcularFolha(entrada, antigo).salarioBase).toBe(1518);
    expect(calcularFolha(entrada, atual).salarioBase).toBe(1621);
  });
  it("preserva o nível de escolaridade do cargo da época", () => {
    const p = paramsDoSnapshot({ financeiro: {}, nivelPorCargo: { c1: "superior" } });
    expect(p.nivelPorCargo?.c1).toBe("superior");
  });
});
