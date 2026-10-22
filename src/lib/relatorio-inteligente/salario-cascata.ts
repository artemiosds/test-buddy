/**
 * Completa salário base/bruto/líquido do relatório "Dados Salariais" com a
 * mesma cascata da Folha Financeira (próprio > cargo > nível), sem frequência.
 * Somente leitura: nunca grava no cadastro. Valores já preenchidos prevalecem.
 */
import { calcularFolha, type ParametrosFinanceiros } from "@/lib/folha-financeira";

type ProfRow = Record<string, unknown> & {
  cargo_id?: string | null;
  carga_cargo?: number | null;
  vinculo?: string;
  tipo_regime?: "efetivos" | "contratados";
};

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

type FolhaVals = { horas_extras: number; he_50?: number; he_100?: number; plantoes?: number; sobreaviso?: number; adicional_noturno: number; gratificacao_incentivo: number; liquido: number };

export function aplicarCascataSalarial<T extends ProfRow>(
  rows: T[],
  p: ParametrosFinanceiros | undefined,
  folha?: Map<string, FolhaVals>,
): T[] {
  if (!p) return rows;
  return rows.map((r0) => {
    const r = aplicarFolha(r0, folha);
    const base = n(r.salario_base || r.valor_piso);
    const bruto = n(r.salario_bruto);
    const liquido = n(r.salario_liquido);
    if (base > 0 && bruto > 0 && liquido > 0) return r;
    const res = calcularFolha(
      {
        tipo: r.tipo_regime ?? (/efetiv/i.test(String(r.vinculo ?? "")) ? "efetivos" : "contratados"),
        cargo_id: r.cargo_id ?? null,
        salario_proprio: base > 0 ? base : null,
        carga_cargo: r.carga_cargo ?? null,
        vinculo_nome: (r.vinculo as string) ?? null,
        diasTrabalhados: 30, faltasInjustificadas: 0, faltasJustificadas: 0, atestado: 0,
        he50: 0, he100: 0, adn: 0, plantoes: 0, sobreaviso: 0, incentivo: 0,
      },
      p,
    );
    if (res.origemBase === "sem_base") return r;
    const out = {
      ...r,
      salario_base: base > 0 ? base : res.salarioBase,
      salario_bruto: bruto > 0 ? bruto : res.bruto,
      salario_liquido: liquido > 0 ? liquido : res.liquido,
      origem_salario: base > 0 ? "Cadastro" : res.origemBase === "cargo" ? "Regra do cargo" : "Piso do nível",
    };
    if (!(n(out.vencimento_liquido) > 0)) (out as Record<string, unknown>).vencimento_liquido = out.salario_liquido;
    return out;
  });
}

/** Valores da Folha Financeira (frequência aprovada) preenchem campos vazios do cadastro. */
function aplicarFolha<T extends ProfRow>(r: T, folha?: Map<string, FolhaVals>): T {
  const f = folha?.get(String(r.id ?? ""));
  if (!f) {
    return n(r.vencimento_liquido) > 0 || !(n(r.salario_liquido) > 0) ? r : { ...r, vencimento_liquido: n(r.salario_liquido) };
  }
  const pick = (cad: unknown, v: number) => (n(cad) > 0 ? n(cad) : v);
  return {
    ...r,
    horas_extras: pick(r.horas_extras, f.horas_extras),
    he_50_valor: n(f.he_50),
    he_100_valor: n(f.he_100),
    plantoes_valor: n(f.plantoes),
    sobreaviso_valor: n(f.sobreaviso),
    adicional_noturno: pick(r.adicional_noturno, f.adicional_noturno),
    gratificacao_incentivo: pick(r.gratificacao_incentivo, f.gratificacao_incentivo),
    vencimento_liquido: pick(r.vencimento_liquido, f.liquido),
  };
}
