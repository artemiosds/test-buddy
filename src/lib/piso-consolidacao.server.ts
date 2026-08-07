// -----------------------------------------------------------------------------
// Motor de Consolidação do Piso Nacional da Enfermagem.
//
// Regra central: 1 profissional × 1 competência = 1 registro consolidado.
// Cadastro de Profissionais é a fonte oficial dos dados cadastrais; a
// importação (Folha/FOPAG e Piso) alimenta apenas os campos financeiros.
// A consolidação é SEMPRE incremental: nunca recalcula toda a base quando
// apenas alguns profissionais foram afetados.
// -----------------------------------------------------------------------------
import { type CategoriaPiso } from "./piso-categorias";
import {
  aplicarFiltroElegivel,
  carregarCatalogoElegivel,
  resolverElegivel,
  SELECT_PROFISSIONAL_ELEGIVEL,
} from "./piso-elegiveis.server";

import { calcularPiso } from "./piso-calculo";
import { carregarReferencias, refDe } from "./piso-referencia.server";
import type { StatusConsolidacao, Inconsistencia } from "./piso-consolidacao";

export type { StatusConsolidacao, Inconsistencia } from "./piso-consolidacao";

const digitos = (v: unknown) => String(v ?? "").replace(/\D+/g, "");
const LOTE = 500;

type ProfBase = {
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

async function nomesPor(supabase: any, tabela: string, ids: string[]) {
  const m = new Map<string, string>();
  if (ids.length === 0) return m;
  const { data } = await supabase.from(tabela).select("id, nome").in("id", ids);
  for (const r of data ?? []) m.set(r.id, r.nome);
  return m;
}

/** Carrega profissionais elegíveis (opcionalmente restrito a um conjunto de ids). */
async function carregarProfissionais(supabase: any, ids?: string[] | null) {
  const cargos = await carregarCatalogoElegivel(supabase);
  
  // No modo multitenant (preparação para 100 municípios), o limite deve ser por query
  // de forma que profissionais elegíveis nunca sejam truncados se houver muitos registros.
  let base = supabase
    .from("profissionais")
    .select(SELECT_PROFISSIONAL_ELEGIVEL)
    .is("deleted_at", null)
    .eq("status", "ativo");
    
  let q = aplicarFiltroElegivel(base, cargos);
  if (!q) return { profissionais: [] as ProfBase[], cargos, lookups: null };
  
  if (ids && ids.length > 0) {
    q = q.in("id", ids);
  } else {
    // Escalonamento: Se não houver IDs específicos, limitamos para evitar estouro de memória
    // mas aumentamos o limite para 50.000 profissionais (meta da Fase 8).
    q = q.limit(50000);
  }
  
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const profissionais = (data ?? []) as ProfBase[];


  const uniq = (k: keyof ProfBase) =>
    Array.from(new Set(profissionais.map((p) => p[k]).filter(Boolean) as string[]));
  const [unidades, setores, vinculos] = await Promise.all([
    nomesPor(supabase, "unidades", uniq("unidade_id")),
    nomesPor(supabase, "setores", uniq("setor_id")),
    nomesPor(supabase, "vinculos", uniq("vinculo_id")),
  ]);
  return { profissionais, cargos, lookups: { unidades, setores, vinculos } };
}

function definirStatus(row: any, memoria: ReturnType<typeof calcularPiso>, inc: Inconsistencia[]) {
  const fatal = inc.some((i) =>
    ["cpf_ausente", "cargo_incompativel", "profissional_nao_localizado"].includes(i.tipo),
  );
  if (fatal) return "erro" as StatusConsolidacao;
  if (!row) return "sem_importacao" as StatusConsolidacao;
  if (memoria.divergencia) return "divergente" as StatusConsolidacao;
  const temFolha = !!row.origem_fopag;
  const temPiso = !!row.origem_piso;
  if (temFolha && temPiso) return "consolidado" as StatusConsolidacao;
  if (temFolha || temPiso) return "parcial" as StatusConsolidacao;
  return "pendente" as StatusConsolidacao;
}

export type ResultadoConsolidacao = {
  competencia: string;
  processados: number;
  consolidados: number;
  parciais: number;
  pendentes: number;
  divergentes: number;
  semImportacao: number;
  erros: number;
};

/**
 * Consolida uma competência (ou apenas os profissionais informados).
 * Sempre incremental: `profissionalIds` restringe o escopo do reprocessamento.
 */
export async function consolidarCompetencia(
  supabase: any,
  params: { competencia: string; profissionalIds?: string[] | null; userId: string },
): Promise<ResultadoConsolidacao> {
  const { competencia, userId } = params;
  const escopo = params.profissionalIds?.length ? params.profissionalIds : null;

  const { profissionais, cargos, lookups } = await carregarProfissionais(supabase, escopo);

  // Registros financeiros já importados nesta competência.
  let qEx = supabase
    .from("piso_competencia_profissional")
    .select("*")
    .eq("competencia", competencia)
    .limit(50000); // Sincronizado com o limite de profissionais elegíveis
  if (escopo) qEx = qEx.in("profissional_id", escopo);
  const { data: existentes, error: errEx } = await qEx;
  if (errEx) throw new Error(errEx.message);
  const mapEx = new Map<string, any>((existentes ?? []).map((r: any) => [r.profissional_id, r]));

  const referencias = await carregarReferencias(supabase, competencia);
  const compId = (referencias as any)?.[0]?.competencia_id || "";





  const agora = new Date().toISOString();
  const rows: any[] = [];
  const resumo: ResultadoConsolidacao = {
    competencia,
    processados: 0,
    consolidados: 0,
    parciais: 0,
    pendentes: 0,
    divergentes: 0,
    semImportacao: 0,
    erros: 0,
  };

  const idsElegiveis = new Set(profissionais.map((p) => p.id));

  for (const p of profissionais) {
    const cargo = resolverElegivel(p, cargos);
    const fq = null;
    const ex = mapEx.get(p.id);
    const inc: Inconsistencia[] = [];


    if (!digitos(p.cpf)) inc.push({ tipo: "cpf_ausente", detalhe: "Profissional sem CPF no cadastro." });
    if (!cargo)
      inc.push({ tipo: "cargo_incompativel", detalhe: "Cargo fora das categorias do Piso." });
    if (!p.carga_horaria_semanal)
      inc.push({ tipo: "carga_horaria_ausente", detalhe: "Carga horária semanal não informada." });
    if (ex && ex.salario_base == null)
      inc.push({ tipo: "importacao_parcial", detalhe: "Folha importada sem salário base." });
    if (ex && ex.origem_piso && !ex.origem_fopag)
      inc.push({ tipo: "importacao_parcial", detalhe: "Somente a planilha do Piso foi importada." });
    if (ex && ex.origem_fopag && !ex.origem_piso)
      inc.push({ tipo: "importacao_parcial", detalhe: "Somente a Folha (FOPAG) foi importada." });

    const salarioBase = ex?.salario_base != null ? Number(ex.salario_base) : null;
    const insalubridade = ex?.insalubridade != null ? Number(ex.insalubridade) : null;
    const auxilioPiso = ex?.auxilio_financeiro != null ? Number(ex.auxilio_financeiro) : null;


    const memoria = calcularPiso({
      categoria: cargo?.categoria ?? null,
      cargaHoraria: p.carga_horaria_semanal,
      salarioBase,
      insalubridade,
      auxilioImportado: auxilioPiso,
      ...refDe(referencias, cargo?.categoria ?? null),
    });
    if (memoria.divergencia)
      inc.push({
        tipo: "valores_divergentes",
        detalhe: `Diferença de R$ ${memoria.diferenca.toFixed(2)} entre calculado e importado.`,
      });

    const status = definirStatus(ex, memoria, inc);
    resumo.processados += 1;
    if (status === "consolidado") resumo.consolidados += 1;
    else if (status === "parcial") resumo.parciais += 1;
    else if (status === "pendente") resumo.pendentes += 1;
    else if (status === "divergente") resumo.divergentes += 1;
    else if (status === "sem_importacao") resumo.semImportacao += 1;
    else resumo.erros += 1;

    rows.push({
      ...(ex ?? {}),
      salario_base: salarioBase,
      insalubridade: insalubridade,
      auxilio_financeiro: auxilioPiso,
      gratificacoes: ex?.gratificacoes ?? null,
      gratificacao_incentivo: ex?.gratificacao_incentivo ?? null,
      hora_extra_50: ex?.hora_extra_50 ?? null,
      hora_extra_100: ex?.hora_extra_100 ?? null,
      plantoes_extras: ex?.plantoes_extras ?? null,
      adicional_noturno: ex?.adicional_noturno ?? null,
      origem_frequencia: false,

      profissional_id: p.id,
      competencia,
      // Cadastro é sempre a fonte oficial — sobrescreve o que veio da planilha.
      nome: p.nome_completo,
      cpf: p.cpf,
      matricula: p.matricula,
      cargo_id: p.cargo_id,
      cargo_nome: cargo?.nome ?? null,
      categoria: cargo?.categoria ?? ex?.categoria ?? null,
      unidade_id: p.unidade_id,
      unidade_nome: p.unidade_id ? (lookups?.unidades.get(p.unidade_id) ?? null) : null,
      setor_id: p.setor_id,
      setor_nome: p.setor_id ? (lookups?.setores.get(p.setor_id) ?? null) : null,
      vinculo_id: p.vinculo_id,
      vinculo_nome: p.vinculo_id ? (lookups?.vinculos.get(p.vinculo_id) ?? null) : null,
      situacao_funcional: p.situacao_funcional,
      carga_horaria_semanal: p.carga_horaria_semanal,
      // Memória financeira derivada
      valor_referencia: memoria.valorReferencia,
      complementacao: memoria.complementacao,
      total_remuneracao: memoria.totalRemuneracao,
      divergencia: memoria.divergencia,
      divergencia_valor: memoria.divergencia ? memoria.diferenca : null,
      // Controle
      status_consolidacao: status,
      status_importacao: ex ? (ex.status_importacao ?? "importado") : "pendente",
      inconsistencias: inc,
      consolidado_em: agora,
      updated_by: userId,
      created_by: ex?.created_by ?? userId,
    });
  }

  // Registros consolidados órfãos (profissional saiu do escopo elegível).
  for (const [profId, ex] of mapEx) {
    if (idsElegiveis.has(profId)) continue;
    resumo.processados += 1;
    resumo.erros += 1;
    rows.push({
      ...ex,
      status_consolidacao: "erro",
      inconsistencias: [
        {
          tipo: "profissional_nao_localizado",
          detalhe: "Profissional inativo, excluído ou fora das categorias do Piso.",
        },
      ],
      consolidado_em: agora,
      updated_by: userId,
    });
  }

  const MAX_BATCH_RETRIES = 2;
  for (let i = 0; i < rows.length; i += LOTE) {
    const batch = rows.slice(i, i + LOTE);
    let success = false;
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_BATCH_RETRIES; attempt++) {
      // Hardening: Garantir que os campos numéricos sejam Number e nunca NaN
      const cleanBatch = batch.map(row => ({
        ...row,
        salario_base: Math.max(0, Number(row.salario_base || 0)),
        insalubridade: Math.max(0, Number(row.insalubridade || 0)),
        auxilio_financeiro: Math.max(0, Number(row.auxilio_financeiro || 0)),
        valor_referencia: Math.max(0, Number(row.valor_referencia || 0)),
        complementacao: Math.max(0, Number(row.complementacao || 0)),
        total_remuneracao: Math.max(0, Number(row.total_remuneracao || 0)),
      }));

      const { error } = await supabase
        .from("piso_competencia_profissional")
        .upsert(cleanBatch, { onConflict: "profissional_id,competencia" });

      if (!error) {
        success = true;
        break;
      }
      lastError = error;
      if (attempt < MAX_BATCH_RETRIES) {
        await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
      }
    }

    if (!success && lastError) {
      throw new Error(`Falha na persistência do lote ${i / LOTE + 1}: ${lastError.message}`);
    }
  }

  return resumo;
}

/** Reprocessa um profissional em todas as competências onde ele possui registro. */
export async function reprocessarProfissional(
  supabase: any,
  params: { profissionalId: string; userId: string; competencia?: string | null },
) {
  let competencias: string[] = [];
  if (params.competencia) competencias = [params.competencia];
  else {
    const { data } = await supabase
      .from("piso_competencia_profissional")
      .select("competencia")
      .eq("profissional_id", params.profissionalId)
      .limit(500);
    competencias = Array.from(new Set((data ?? []).map((r: any) => r.competencia as string)));
  }
  const resultados: ResultadoConsolidacao[] = [];
  for (const c of competencias) {
    resultados.push(
      await consolidarCompetencia(supabase, {
        competencia: c,
        profissionalIds: [params.profissionalId],
        userId: params.userId,
      }),
    );
  }
  return resultados;
}
