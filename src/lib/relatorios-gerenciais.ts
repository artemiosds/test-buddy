/**
 * Relatórios Gerenciais — queries client-side (só SELECT) sobre cadastros
 * atuais. Nenhum destes relatórios depende de competência. Todas as leituras
 * passam pelo cliente publishable (RLS aplica-se ao usuário logado).
 */
import { supabase } from "@/integrations/supabase/client";

export type ProfViewFilters = {
  q?: string | null;
  secretariaId?: string | null;
  unidadeId?: string | null;
  setorId?: string | null;
  cargoId?: string | null;
  funcaoId?: string | null;
  vinculoId?: string | null;
  status?: string | null;
  situacao?: string | null;
  /** Modo pré-configurado que aplica filtros específicos (sem unidade, etc.) */
  preset?:
    | "todos"
    | "sem_unidade"
    | "sem_setor"
    | "sem_cargo"
    | "sem_funcao"
    | "sem_matricula"
    | "sem_cpf"
    | "sem_telefone"
    | "sem_email"
    | "sem_nascimento"
    | "sem_carga_horaria"
    | "ativos"
    | "afastados"
    | "ferias"
    | "licenciados"
    | "inativos";
};

export type ProfRow = {
  id: string;
  nome_completo: string;
  cpf: string | null;
  matricula: string | null;
  telefone: string | null;
  email: string | null;
  data_nascimento: string | null;
  carga_horaria_semanal: number | null;
  status: string | null;
  situacao_funcional: string | null;
  unidade_id: string | null;
  setor_id: string | null;
  cargo_id: string | null;
  funcao_id: string | null;
  vinculo_id: string | null;
  unidade_nome?: string | null;
  setor_nome?: string | null;
  cargo_nome?: string | null;
  funcao_nome?: string | null;
  vinculo_nome?: string | null;
};

const PROF_SELECT =
  "id, nome_completo, cpf, matricula, telefone, email, data_nascimento, carga_horaria_semanal, status, situacao_funcional, secretaria_id, unidade_id, setor_id, cargo_id, funcao_id, vinculo_id";

function applyPreset<Q extends { is: Function; or: Function; eq: Function; in: Function }>(query: Q, preset?: ProfViewFilters["preset"]): Q {
  if (!preset || preset === "todos") return query;
  switch (preset) {
    case "sem_unidade": return query.is("unidade_id", null) as Q;
    case "sem_setor": return query.is("setor_id", null) as Q;
    case "sem_cargo": return query.is("cargo_id", null) as Q;
    case "sem_funcao": return query.is("funcao_id", null) as Q;
    case "sem_matricula": return query.or("matricula.is.null,matricula.eq.") as Q;
    case "sem_cpf": return query.or("cpf.is.null,cpf.eq.") as Q;
    case "sem_telefone": return query.or("telefone.is.null,telefone.eq.") as Q;
    case "sem_email": return query.or("email.is.null,email.eq.") as Q;
    case "sem_nascimento": return query.is("data_nascimento", null) as Q;
    case "sem_carga_horaria": return query.or("carga_horaria_semanal.is.null,carga_horaria_semanal.eq.0") as Q;
    case "ativos": return query.eq("status", "ativo") as Q;
    case "afastados": return query.eq("status", "afastado") as Q;
    case "ferias": return query.eq("status", "ferias") as Q;
    case "licenciados": return query.eq("status", "licenciado") as Q;
    case "inativos": return query.in("status", ["inativo", "desligado"]) as Q;
  }
  return query;
}

export async function listProfissionais(filters: ProfViewFilters, page = 1, pageSize = 25) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const base = supabase.from("profissionais").select(PROF_SELECT, { count: "exact" }).is("deleted_at", null);
  let query = applyPreset(base, filters.preset);

  if (filters.q) {
    const like = `%${filters.q.trim()}%`;
    query = query.or(`nome_completo.ilike.${like},cpf.ilike.${like},matricula.ilike.${like}`);
  }
  if (filters.secretariaId) query = query.eq("secretaria_id", filters.secretariaId);
  if (filters.unidadeId) query = query.eq("unidade_id", filters.unidadeId);
  if (filters.setorId) query = query.eq("setor_id", filters.setorId);
  if (filters.cargoId) query = query.eq("cargo_id", filters.cargoId);
  if (filters.funcaoId) query = query.eq("funcao_id", filters.funcaoId);
  if (filters.vinculoId) query = query.eq("vinculo_id", filters.vinculoId);
  if (filters.status) query = query.eq("status", filters.status as never);
  if (filters.situacao) query = query.eq("situacao_funcional", filters.situacao as never);

  const { data, count, error } = await query.order("nome_completo").range(from, to);
  if (error) throw error;

  const rows = (data ?? []) as ProfRow[];
  const ids = {
    unidades: Array.from(new Set(rows.map((r) => r.unidade_id).filter(Boolean))) as string[],
    setores: Array.from(new Set(rows.map((r) => r.setor_id).filter(Boolean))) as string[],
    cargos: Array.from(new Set(rows.map((r) => r.cargo_id).filter(Boolean))) as string[],
    funcoes: Array.from(new Set(rows.map((r) => r.funcao_id).filter(Boolean))) as string[],
    vinculos: Array.from(new Set(rows.map((r) => r.vinculo_id).filter(Boolean))) as string[],
  };

  const [u, s, c, f, v] = await Promise.all([
    ids.unidades.length ? supabase.from("unidades").select("id, nome").in("id", ids.unidades) : Promise.resolve({ data: [] as { id: string; nome: string }[], error: null }),
    ids.setores.length ? supabase.from("setores").select("id, nome").in("id", ids.setores) : Promise.resolve({ data: [] as { id: string; nome: string }[], error: null }),
    ids.cargos.length ? supabase.from("cargos").select("id, nome").in("id", ids.cargos) : Promise.resolve({ data: [] as { id: string; nome: string }[], error: null }),
    ids.funcoes.length ? supabase.from("funcoes").select("id, nome").in("id", ids.funcoes) : Promise.resolve({ data: [] as { id: string; nome: string }[], error: null }),
    ids.vinculos.length ? supabase.from("vinculos").select("id, nome").in("id", ids.vinculos) : Promise.resolve({ data: [] as { id: string; nome: string }[], error: null }),
  ]);

  const map = (arr: { id: string; nome: string }[] | null) =>
    (arr ?? []).reduce<Record<string, string>>((acc, r) => ((acc[r.id] = r.nome), acc), {});
  const mU = map(u.data);
  const mS = map(s.data);
  const mC = map(c.data);
  const mF = map(f.data);
  const mV = map(v.data);

  const enriched = rows.map((r) => ({
    ...r,
    unidade_nome: r.unidade_id ? mU[r.unidade_id] ?? null : null,
    setor_nome: r.setor_id ? mS[r.setor_id] ?? null : null,
    cargo_nome: r.cargo_id ? mC[r.cargo_id] ?? null : null,
    funcao_nome: r.funcao_id ? mF[r.funcao_id] ?? null : null,
    vinculo_nome: r.vinculo_id ? mV[r.vinculo_id] ?? null : null,
  }));

  return { rows: enriched, count: count ?? 0 };
}

// -------- Indicadores gerais --------

export type IndicadoresResumo = {
  totalProfissionais: number;
  totalUnidades: number;
  totalSetores: number;
  totalCargos: number;
  totalFuncoes: number;
  porVinculo: { nome: string; qtd: number }[];
  porStatus: { status: string; qtd: number }[];
  porSexo: { sexo: string; qtd: number }[];
  porFaixaEtaria: { faixa: string; qtd: number }[];
  porUnidade: { nome: string; qtd: number }[];
  porCargo: { nome: string; qtd: number }[];
  porFuncao: { nome: string; qtd: number }[];
  porSetor: { nome: string; qtd: number }[];
};

function group<T>(rows: T[], keyFn: (r: T) => string | null | undefined) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = keyFn(r) ?? "—";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Array.from(m.entries())
    .map(([nome, qtd]) => ({ nome, qtd }))
    .sort((a, b) => b.qtd - a.qtd);
}

function calcAge(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

function faixaEtaria(age: number | null): string {
  if (age == null) return "—";
  if (age < 25) return "< 25";
  if (age < 35) return "25–34";
  if (age < 45) return "35–44";
  if (age < 55) return "45–54";
  if (age < 65) return "55–64";
  return "65+";
}

export async function getIndicadoresResumo(): Promise<IndicadoresResumo> {
  const [profRes, uCount, sCount, cCount, fCount, cargosAll, funcoesAll, unidadesAll, setoresAll, vinculosAll] = await Promise.all([
    supabase.from("profissionais").select("id, sexo, data_nascimento, status, unidade_id, setor_id, cargo_id, funcao_id, vinculo_id").is("deleted_at", null),
    supabase.from("unidades").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("setores").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("cargos").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("funcoes").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("cargos").select("id, nome").is("deleted_at", null),
    supabase.from("funcoes").select("id, nome").is("deleted_at", null),
    supabase.from("unidades").select("id, nome").is("deleted_at", null),
    supabase.from("setores").select("id, nome").is("deleted_at", null),
    supabase.from("vinculos").select("id, nome").is("deleted_at", null),
  ]);
  if (profRes.error) throw profRes.error;
  const profs = (profRes.data ?? []) as {
    id: string; sexo: string | null; data_nascimento: string | null; status: string | null;
    unidade_id: string | null; setor_id: string | null; cargo_id: string | null;
    funcao_id: string | null; vinculo_id: string | null;
  }[];

  const map = (arr: { id: string; nome: string }[] | null) =>
    (arr ?? []).reduce<Record<string, string>>((acc, r) => ((acc[r.id] = r.nome), acc), {});
  const mU = map(unidadesAll.data);
  const mS = map(setoresAll.data);
  const mC = map(cargosAll.data);
  const mF = map(funcoesAll.data);
  const mV = map(vinculosAll.data);

  return {
    totalProfissionais: profs.length,
    totalUnidades: uCount.count ?? 0,
    totalSetores: sCount.count ?? 0,
    totalCargos: cCount.count ?? 0,
    totalFuncoes: fCount.count ?? 0,
    porVinculo: group(profs, (p) => (p.vinculo_id ? mV[p.vinculo_id] ?? "—" : "Sem vínculo")),
    porStatus: group(profs, (p) => p.status ?? "—").map((r) => ({ status: r.nome, qtd: r.qtd })),
    porSexo: group(profs, (p) => p.sexo ?? "—").map((r) => ({ sexo: r.nome, qtd: r.qtd })),
    porFaixaEtaria: group(profs, (p) => faixaEtaria(calcAge(p.data_nascimento))).map((r) => ({ faixa: r.nome, qtd: r.qtd })),
    porUnidade: group(profs, (p) => (p.unidade_id ? mU[p.unidade_id] ?? "—" : "Sem unidade")).slice(0, 20),
    porCargo: group(profs, (p) => (p.cargo_id ? mC[p.cargo_id] ?? "—" : "Sem cargo")).slice(0, 20),
    porFuncao: group(profs, (p) => (p.funcao_id ? mF[p.funcao_id] ?? "—" : "Sem função")).slice(0, 20),
    porSetor: group(profs, (p) => (p.setor_id ? mS[p.setor_id] ?? "—" : "Sem setor")).slice(0, 20),
  };
}