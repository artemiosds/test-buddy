/**
 * Elegibilidade do Piso Nacional da Enfermagem.
 *
 * A elegibilidade considera CARGO **e** FUNÇÃO: se qualquer um dos dois for de
 * enfermagem (Enfermeiro(a), Técnico(a) de Enfermagem, Auxiliar de Enfermagem),
 * o profissional entra no módulo. O cargo tem precedência na categoria; quando
 * o cargo não é de enfermagem, usa-se a função.
 */

import { normalizarCategoriaPiso, type CategoriaPiso } from "./piso-categorias";

export type ItemElegivel = { nome: string; categoria: CategoriaPiso };
export type CatalogoElegivel = {
  cargos: Map<string, ItemElegivel>;
  funcoes: Map<string, ItemElegivel>;
};

async function catalogo(supabase: any, tabela: "cargos" | "funcoes") {
  const { data, error } = await supabase
    .from(tabela)
    .select("id, nome")
    .is("deleted_at", null)
    .limit(5000);
  if (error) throw new Error(error.message);
  const map = new Map<string, ItemElegivel>();
  for (const c of data ?? []) {
    const cat = normalizarCategoriaPiso(c.nome);
    if (cat) map.set(c.id, { nome: c.nome, categoria: cat });
  }
  return map;
}

/** Carrega os cargos e funções considerados elegíveis. */
export async function carregarCatalogoElegivel(supabase: any): Promise<CatalogoElegivel> {
  const [cargos, funcoes] = await Promise.all([
    catalogo(supabase, "cargos"),
    catalogo(supabase, "funcoes"),
  ]);
  return { cargos, funcoes };
}

/** Aplica o filtro "cargo elegível OU função elegível" na query de profissionais. */
export function aplicarFiltroElegivel(q: any, cat: CatalogoElegivel) {
  const cargoIds = Array.from(cat.cargos.keys());
  const funcaoIds = Array.from(cat.funcoes.keys());
  const partes: string[] = [];
  if (cargoIds.length) partes.push(`cargo_id.in.(${cargoIds.join(",")})`);
  if (funcaoIds.length) partes.push(`funcao_id.in.(${funcaoIds.join(",")})`);
  if (partes.length === 0) return null;
  return q.or(partes.join(","));
}

/** Resolve o cargo/função elegível de um profissional (cargo tem precedência). */
export function resolverElegivel(
  p: { cargo_id?: string | null; funcao_id?: string | null },
  cat: CatalogoElegivel,
): ItemElegivel | undefined {
  return (
    (p.cargo_id ? cat.cargos.get(p.cargo_id) : undefined) ??
    (p.funcao_id ? cat.funcoes.get(p.funcao_id) : undefined)
  );
}

export const SELECT_PROFISSIONAL_ELEGIVEL =
  "id, nome_completo, cpf, matricula, carga_horaria_semanal, situacao_funcional, status, cargo_id, funcao_id, unidade_id, setor_id, vinculo_id";
