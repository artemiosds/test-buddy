import {
  aplicarFiltroElegivel,
  carregarCatalogoElegivel,
  resolverElegivel,
  SELECT_PROFISSIONAL_ELEGIVEL,
} from "./piso-elegiveis.server";
import { type CategoriaPiso } from "./piso-categorias";
import { calcularPiso } from "./piso-calculo";
import { carregarReferencias, refDe } from "./piso-referencia.server";
import { STATUS_EXCLUIDOS } from "./piso-match";

export const somenteDigitos = (v: string | null | undefined) => (v ?? "").replace(/\D+/g, "");

export type ProfBase = {
  id: string;
  nome_completo: string;
  cpf: string | null;
  matricula: string | null;
  carga_horaria_semanal: number | null;
  situacao_funcional: string | null;
  status: string;
  cargo_id: string | null;
  funcao_id: string | null;
  unidade_id: string | null;
  setor_id: string | null;
  vinculo_id: string | null;
};

export async function carregarElegiveis(supabase: any) {
  const cargos = await carregarCatalogoElegivel(supabase);
  const base = supabase
    .from("profissionais")
    .select(SELECT_PROFISSIONAL_ELEGIVEL)
    .is("deleted_at", null)
    .not("status", "in", `(${STATUS_EXCLUIDOS.join(",")})`)
    .limit(50000);
  const q = aplicarFiltroElegivel(base, cargos);
  if (!q)
    return {
      profissionais: [] as ProfBase[],
      cargos,
      unidades: new Map<string, string>(),
      setores: new Map<string, string>(),
      vinculos: new Map<string, string>(),
    };

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const profissionais = (data ?? []) as ProfBase[];

  const unidadeIds = Array.from(
    new Set(profissionais.map((p) => p.unidade_id).filter(Boolean) as string[]),
  );
  const unidades = new Map<string, string>();
  if (unidadeIds.length > 0) {
    const { data: us } = await supabase.from("unidades").select("id, nome").in("id", unidadeIds);
    for (const u of us ?? []) unidades.set(u.id, u.nome);
  }

  const setorIds = Array.from(
    new Set(profissionais.map((p) => p.setor_id).filter(Boolean) as string[]),
  );
  const setores = new Map<string, string>();
  if (setorIds.length > 0) {
    const { data: ss } = await supabase.from("setores").select("id, nome").in("id", setorIds);
    for (const s of ss ?? []) setores.set(s.id, s.nome);
  }

  const vinculoIds = Array.from(
    new Set(profissionais.map((p) => p.vinculo_id).filter(Boolean) as string[]),
  );
  const vinculos = new Map<string, string>();
  if (vinculoIds.length > 0) {
    const { data: vs } = await supabase.from("vinculos").select("id, nome").in("id", vinculoIds);
    for (const v of vs ?? []) vinculos.set(v.id, v.nome);
  }
  return { profissionais, cargos, unidades, setores, vinculos };
}

export type LinhaElegivel = {
  id: string;
  profissional_id: string;
  nome: string;
  cpf: string | null;
  matricula: string | null;
  cargo: string | null;
  cargo_id: string | null;
  categoria: CategoriaPiso;
  unidade: string | null;
  unidade_id: string | null;
  setor: string | null;
  setor_id: string | null;
  vinculo: string | null;
  vinculo_id: string | null;
  carga_horaria: number | null;
  situacao_funcional: string | null;
  salario_base: number | null;
  insalubridade: number | null;
  auxilio_financeiro: number | null;
  valor_referencia: number;
  referencia_configurada: boolean;
  complementacao: number;
  total_remuneracao: number;
  divergencia: boolean;
  diferenca: number;
  status_importacao: "importado" | "pendente";
  competencia: string | null;
  atualizado_em: string | null;
};

export async function montarLinhas(supabase: any, competencia: string | null) {
  const { profissionais, cargos, unidades, setores, vinculos } = await carregarElegiveis(supabase);

  const consolidados = new Map<string, any>();
  if (competencia && profissionais.length > 0) {
    const { data, error } = await supabase
      .from("piso_competencia_profissional")
      .select("*")
      .eq("competencia", competencia)
      .limit(50000);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) consolidados.set(r.profissional_id, r);
  }

  const referencias = await carregarReferencias(supabase, competencia);

  const linhas: LinhaElegivel[] = profissionais.map((p) => {
    const cargo = resolverElegivel(p, cargos);
    const c = consolidados.get(p.id);
    const memoria = calcularPiso({
      categoria: cargo?.categoria ?? null,
      cargaHoraria: p.carga_horaria_semanal,
      salarioBase: c?.salario_base ?? null,
      insalubridade: c?.insalubridade ?? null,
      auxilioImportado: c?.auxilio_financeiro ?? null,
      ...refDe(referencias, cargo?.categoria ?? null),
    });
    return {
      id: p.id,
      profissional_id: p.id,
      nome: p.nome_completo,
      cpf: p.cpf ?? null,
      matricula: p.matricula ?? null,
      cargo: cargo?.nome ?? null,
      cargo_id: p.cargo_id,
      categoria: (cargo?.categoria ?? "ENFERMEIRO") as CategoriaPiso,
      unidade: p.unidade_id ? (unidades.get(p.unidade_id) ?? null) : null,
      unidade_id: p.unidade_id,
      setor: p.setor_id ? (setores.get(p.setor_id) ?? null) : null,
      setor_id: p.setor_id,
      vinculo: p.vinculo_id ? (vinculos.get(p.vinculo_id) ?? null) : null,
      vinculo_id: p.vinculo_id,
      carga_horaria: p.carga_horaria_semanal,
      situacao_funcional: p.situacao_funcional,
      salario_base: c?.salario_base ?? null,
      insalubridade: c?.insalubridade ?? null,
      auxilio_financeiro: c?.auxilio_financeiro ?? null,
      valor_referencia: memoria.valorReferencia,
      referencia_configurada: memoria.referenciaConfigurada,
      complementacao: memoria.complementacao,
      total_remuneracao: memoria.totalRemuneracao,
      divergencia: memoria.divergencia,
      diferenca: memoria.diferenca,
      status_importacao: c ? "importado" : "pendente",
      competencia: c?.competencia ?? (competencia || null),
      atualizado_em: c?.updated_at ?? c?.created_at ?? null,
    };
  });

  linhas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return linhas;
}

export function pend(
  tipo: string,
  l: { cpf?: string | null; nome?: string | null },
  data: { competencia: string; historico_id: string; origem_arquivo: string },
  detalhe: string,
) {
  return {
    tipo,
    competencia: data.competencia,
    cpf: l.cpf ?? null,
    nome: l.nome ?? null,
    historico_id: data.historico_id,
    origem_arquivo: data.origem_arquivo,
    detalhe,
  };
}
