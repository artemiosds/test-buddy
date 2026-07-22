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

function applyPreset<Q extends { is: Function; or: Function; eq: Function; in: Function }>(
  query: Q,
  preset?: ProfViewFilters["preset"],
): Q {
  if (!preset || preset === "todos") return query;
  switch (preset) {
    case "sem_unidade":
      return query.is("unidade_id", null) as Q;
    case "sem_setor":
      return query.is("setor_id", null) as Q;
    case "sem_cargo":
      return query.is("cargo_id", null) as Q;
    case "sem_funcao":
      return query.is("funcao_id", null) as Q;
    case "sem_matricula":
      return query.or("matricula.is.null,matricula.eq.") as Q;
    case "sem_cpf":
      return query.or("cpf.is.null,cpf.eq.") as Q;
    case "sem_telefone":
      return query.or("telefone.is.null,telefone.eq.") as Q;
    case "sem_email":
      return query.or("email.is.null,email.eq.") as Q;
    case "sem_nascimento":
      return query.is("data_nascimento", null) as Q;
    case "sem_carga_horaria":
      return query.or("carga_horaria_semanal.is.null,carga_horaria_semanal.eq.0") as Q;
    case "ativos":
      return query.eq("status", "ativo") as Q;
    case "afastados":
      return query.eq("status", "afastado") as Q;
    case "ferias":
      return query.eq("status", "ferias") as Q;
    case "licenciados":
      return query.eq("status", "licenciado") as Q;
    case "inativos":
      return query.in("status", ["inativo", "desligado"]) as Q;
  }
  return query;
}

export async function listProfissionais(filters: ProfViewFilters, page = 1, pageSize = 25) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const base = supabase
    .from("profissionais")
    .select(PROF_SELECT, { count: "exact" })
    .is("deleted_at", null);
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
    ids.unidades.length
      ? supabase.from("unidades").select("id, nome").in("id", ids.unidades)
      : Promise.resolve({ data: [] as { id: string; nome: string }[], error: null }),
    ids.setores.length
      ? supabase.from("setores").select("id, nome").in("id", ids.setores)
      : Promise.resolve({ data: [] as { id: string; nome: string }[], error: null }),
    ids.cargos.length
      ? supabase.from("cargos").select("id, nome").in("id", ids.cargos)
      : Promise.resolve({ data: [] as { id: string; nome: string }[], error: null }),
    ids.funcoes.length
      ? supabase.from("funcoes").select("id, nome").in("id", ids.funcoes)
      : Promise.resolve({ data: [] as { id: string; nome: string }[], error: null }),
    ids.vinculos.length
      ? supabase.from("vinculos").select("id, nome").in("id", ids.vinculos)
      : Promise.resolve({ data: [] as { id: string; nome: string }[], error: null }),
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
    unidade_nome: r.unidade_id ? (mU[r.unidade_id] ?? null) : null,
    setor_nome: r.setor_id ? (mS[r.setor_id] ?? null) : null,
    cargo_nome: r.cargo_id ? (mC[r.cargo_id] ?? null) : null,
    funcao_nome: r.funcao_id ? (mF[r.funcao_id] ?? null) : null,
    vinculo_nome: r.vinculo_id ? (mV[r.vinculo_id] ?? null) : null,
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
  const [
    profRes,
    uCount,
    sCount,
    cCount,
    fCount,
    cargosAll,
    funcoesAll,
    unidadesAll,
    setoresAll,
    vinculosAll,
  ] = await Promise.all([
    supabase
      .from("profissionais")
      .select(
        "id, sexo, data_nascimento, status, unidade_id, setor_id, cargo_id, funcao_id, vinculo_id",
      )
      .is("deleted_at", null),
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
    id: string;
    sexo: string | null;
    data_nascimento: string | null;
    status: string | null;
    unidade_id: string | null;
    setor_id: string | null;
    cargo_id: string | null;
    funcao_id: string | null;
    vinculo_id: string | null;
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
    porVinculo: group(profs, (p) => (p.vinculo_id ? (mV[p.vinculo_id] ?? "—") : "Sem vínculo")),
    porStatus: group(profs, (p) => p.status ?? "—").map((r) => ({ status: r.nome, qtd: r.qtd })),
    porSexo: group(profs, (p) => p.sexo ?? "—").map((r) => ({ sexo: r.nome, qtd: r.qtd })),
    porFaixaEtaria: group(profs, (p) => faixaEtaria(calcAge(p.data_nascimento))).map((r) => ({
      faixa: r.nome,
      qtd: r.qtd,
    })),
    porUnidade: group(profs, (p) =>
      p.unidade_id ? (mU[p.unidade_id] ?? "—") : "Sem unidade",
    ).slice(0, 20),
    porCargo: group(profs, (p) => (p.cargo_id ? (mC[p.cargo_id] ?? "—") : "Sem cargo")).slice(
      0,
      20,
    ),
    porFuncao: group(profs, (p) => (p.funcao_id ? (mF[p.funcao_id] ?? "—") : "Sem função")).slice(
      0,
      20,
    ),
    porSetor: group(profs, (p) => (p.setor_id ? (mS[p.setor_id] ?? "—") : "Sem setor")).slice(
      0,
      20,
    ),
  };
}

// ==================== ONDA 2 ====================
// Relatórios gerenciais de Unidades, Setores, Cargos e Funções.
// Todas as queries são client-side (RLS). Contagens de profissionais
// são feitas em memória a partir de um SELECT enxuto de profissionais.

type ProfMini = {
  id: string;
  unidade_id: string | null;
  setor_id: string | null;
  cargo_id: string | null;
  funcao_id: string | null;
  status: string | null;
};

async function loadProfissionaisMini(): Promise<ProfMini[]> {
  const { data, error } = await supabase
    .from("profissionais")
    .select("id, unidade_id, setor_id, cargo_id, funcao_id, status")
    .is("deleted_at", null);
  if (error) throw error;
  return (data ?? []) as ProfMini[];
}

function countBy<T, K extends string>(rows: T[], keyFn: (r: T) => K | null | undefined) {
  const m = new Map<K, number>();
  for (const r of rows) {
    const k = keyFn(r);
    if (k == null) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

// -------- Unidades --------

export type UnidadeRow = {
  id: string;
  nome: string;
  sigla: string | null;
  tipo_unidade: string | null;
  status: string;
  cnes: string | null;
  cnpj: string | null;
  telefone: string | null;
  email_institucional: string | null;
  responsavel_nome: string | null;
  distrito: string | null;
  municipio: string | null;
  qtd_profissionais: number;
  qtd_ativos: number;
};

export type UnidadePreset =
  | "todas"
  | "ativas"
  | "inativas"
  | "sem_diretor"
  | "sem_telefone"
  | "sem_cnes"
  | "sem_cnpj"
  | "sem_email"
  | "sem_tipo";

export async function listUnidadesGerencial(
  preset: UnidadePreset = "todas",
  tipo?: string | null,
): Promise<UnidadeRow[]> {
  const { data, error } = await supabase
    .from("unidades")
    .select(
      "id, nome, sigla, tipo_unidade, status, cnes, cnpj, telefone, email_institucional, responsavel_nome, distrito, municipio",
    )
    .is("deleted_at", null)
    .order("nome");
  if (error) throw error;
  const profs = await loadProfissionaisMini();
  const totalMap = countBy(profs, (p) => p.unidade_id);
  const ativoMap = countBy(
    profs.filter((p) => p.status === "ativo"),
    (p) => p.unidade_id,
  );

  let rows = (data ?? []).map(
    (u): UnidadeRow => ({
      ...u,
      qtd_profissionais: totalMap.get(u.id) ?? 0,
      qtd_ativos: ativoMap.get(u.id) ?? 0,
    }),
  );
  if (tipo) rows = rows.filter((r) => (r.tipo_unidade ?? "").toLowerCase() === tipo.toLowerCase());
  switch (preset) {
    case "ativas":
      rows = rows.filter((r) => r.status === "ativa");
      break;
    case "inativas":
      rows = rows.filter((r) => r.status !== "ativa");
      break;
    case "sem_diretor":
      rows = rows.filter((r) => !r.responsavel_nome);
      break;
    case "sem_telefone":
      rows = rows.filter((r) => !r.telefone);
      break;
    case "sem_cnes":
      rows = rows.filter((r) => !r.cnes);
      break;
    case "sem_cnpj":
      rows = rows.filter((r) => !r.cnpj);
      break;
    case "sem_email":
      rows = rows.filter((r) => !r.email_institucional);
      break;
    case "sem_tipo":
      rows = rows.filter((r) => !r.tipo_unidade);
      break;
  }
  return rows;
}

export async function listTiposUnidade(): Promise<string[]> {
  const { data, error } = await supabase
    .from("unidades")
    .select("tipo_unidade")
    .is("deleted_at", null);
  if (error) throw error;
  const set = new Set<string>();
  for (const r of data ?? []) if (r.tipo_unidade) set.add(r.tipo_unidade);
  return Array.from(set).sort();
}

// -------- Setores --------

export type SetorRow = {
  id: string;
  nome: string;
  sigla: string | null;
  unidade_id: string;
  unidade_nome: string | null;
  status: string;
  responsavel_nome: string | null;
  qtd_profissionais: number;
};

export type SetorPreset = "todos" | "sem_coordenador" | "sem_profissionais" | "um_servidor";

export async function listSetoresGerencial(
  preset: SetorPreset = "todos",
  unidadeId?: string | null,
): Promise<SetorRow[]> {
  let q = supabase
    .from("setores")
    .select("id, nome, sigla, unidade_id, status, responsavel_nome")
    .is("deleted_at", null)
    .order("nome");
  if (unidadeId) q = q.eq("unidade_id", unidadeId);
  const { data, error } = await q;
  if (error) throw error;

  const setores = data ?? [];
  const unidadeIds = Array.from(new Set(setores.map((s) => s.unidade_id)));
  const [uRes, profs] = await Promise.all([
    unidadeIds.length
      ? supabase.from("unidades").select("id, nome").in("id", unidadeIds)
      : Promise.resolve({ data: [] as { id: string; nome: string }[], error: null as never }),
    loadProfissionaisMini(),
  ]);
  const mU = (uRes.data ?? []).reduce<Record<string, string>>(
    (a, r) => ((a[r.id] = r.nome), a),
    {},
  );
  const countMap = countBy(profs, (p) => p.setor_id);

  let rows: SetorRow[] = setores.map((s) => ({
    ...s,
    unidade_nome: mU[s.unidade_id] ?? null,
    qtd_profissionais: countMap.get(s.id) ?? 0,
  }));
  switch (preset) {
    case "sem_coordenador":
      rows = rows.filter((r) => !r.responsavel_nome);
      break;
    case "sem_profissionais":
      rows = rows.filter((r) => r.qtd_profissionais === 0);
      break;
    case "um_servidor":
      rows = rows.filter((r) => r.qtd_profissionais === 1);
      break;
  }
  return rows;
}

// -------- Cargos --------

export type CargoRow = {
  id: string;
  nome: string;
  codigo: string | null;
  cbo: string | null;
  nivel: string | null;
  status: string;
  qtd_profissionais: number;
};

export type CargoPreset = "todos" | "sem_profissionais" | "com_profissionais";

export async function listCargosGerencial(preset: CargoPreset = "todos"): Promise<CargoRow[]> {
  const { data, error } = await supabase
    .from("cargos")
    .select("id, nome, codigo, cbo, nivel, status")
    .is("deleted_at", null)
    .order("nome");
  if (error) throw error;
  const profs = await loadProfissionaisMini();
  const countMap = countBy(profs, (p) => p.cargo_id);
  let rows: CargoRow[] = (data ?? []).map((c) => ({
    ...c,
    nivel: (c.nivel as string | null) ?? null,
    qtd_profissionais: countMap.get(c.id) ?? 0,
  }));
  if (preset === "sem_profissionais") rows = rows.filter((r) => r.qtd_profissionais === 0);
  if (preset === "com_profissionais") rows = rows.filter((r) => r.qtd_profissionais > 0);
  return rows;
}

// -------- Funções --------

export type FuncaoRow = {
  id: string;
  nome: string;
  codigo: string | null;
  gratificacao_percentual: number | null;
  status: string;
  qtd_profissionais: number;
};

export type FuncaoPreset = "todas" | "sem_profissionais" | "com_profissionais";

export async function listFuncoesGerencial(preset: FuncaoPreset = "todas"): Promise<FuncaoRow[]> {
  const { data, error } = await supabase
    .from("funcoes")
    .select("id, nome, codigo, gratificacao_percentual, status")
    .is("deleted_at", null)
    .order("nome");
  if (error) throw error;
  const profs = await loadProfissionaisMini();
  const countMap = countBy(profs, (p) => p.funcao_id);
  let rows: FuncaoRow[] = (data ?? []).map((f) => ({
    ...f,
    qtd_profissionais: countMap.get(f.id) ?? 0,
  }));
  if (preset === "sem_profissionais") rows = rows.filter((r) => r.qtd_profissionais === 0);
  if (preset === "com_profissionais") rows = rows.filter((r) => r.qtd_profissionais > 0);
  return rows;
}

// ==================== ONDA 3 ====================

// -------- Estrutura Organizacional --------

export type OrgProf = {
  id: string;
  nome_completo: string;
  cargo_nome: string | null;
  funcao_nome: string | null;
  status: string | null;
};

export type OrgSetor = {
  id: string;
  nome: string;
  coordenador: string | null;
  profissionais: OrgProf[];
};

export type OrgUnidade = {
  id: string;
  nome: string;
  sigla: string | null;
  diretor: string | null;
  setores: OrgSetor[];
  sem_setor: OrgProf[];
};

export async function getOrganograma(unidadeId?: string | null): Promise<OrgUnidade[]> {
  const [uRes, sRes, pRes, cRes, fRes] = await Promise.all([
    unidadeId
      ? supabase
          .from("unidades")
          .select("id, nome, sigla, responsavel_nome")
          .eq("id", unidadeId)
          .is("deleted_at", null)
      : supabase
          .from("unidades")
          .select("id, nome, sigla, responsavel_nome")
          .is("deleted_at", null)
          .order("nome"),
    supabase
      .from("setores")
      .select("id, nome, unidade_id, responsavel_nome")
      .is("deleted_at", null)
      .order("nome"),
    supabase
      .from("profissionais")
      .select("id, nome_completo, unidade_id, setor_id, cargo_id, funcao_id, status")
      .is("deleted_at", null)
      .order("nome_completo"),
    supabase.from("cargos").select("id, nome").is("deleted_at", null),
    supabase.from("funcoes").select("id, nome").is("deleted_at", null),
  ]);
  if (uRes.error) throw uRes.error;
  if (sRes.error) throw sRes.error;
  if (pRes.error) throw pRes.error;

  const mCargo = (cRes.data ?? []).reduce<Record<string, string>>(
    (a, r) => ((a[r.id] = r.nome), a),
    {},
  );
  const mFunc = (fRes.data ?? []).reduce<Record<string, string>>(
    (a, r) => ((a[r.id] = r.nome), a),
    {},
  );

  const setoresByUnidade = new Map<string, OrgSetor[]>();
  for (const s of sRes.data ?? []) {
    if (!setoresByUnidade.has(s.unidade_id)) setoresByUnidade.set(s.unidade_id, []);
    setoresByUnidade.get(s.unidade_id)!.push({
      id: s.id,
      nome: s.nome,
      coordenador: s.responsavel_nome,
      profissionais: [],
    });
  }

  const setorIndex = new Map<string, OrgSetor>();
  for (const arr of setoresByUnidade.values()) for (const s of arr) setorIndex.set(s.id, s);

  const semSetorByUnidade = new Map<string, OrgProf[]>();
  for (const p of pRes.data ?? []) {
    const prof: OrgProf = {
      id: p.id,
      nome_completo: p.nome_completo,
      cargo_nome: p.cargo_id ? (mCargo[p.cargo_id] ?? null) : null,
      funcao_nome: p.funcao_id ? (mFunc[p.funcao_id] ?? null) : null,
      status: p.status,
    };
    if (p.setor_id && setorIndex.has(p.setor_id)) {
      setorIndex.get(p.setor_id)!.profissionais.push(prof);
    } else if (p.unidade_id) {
      if (!semSetorByUnidade.has(p.unidade_id)) semSetorByUnidade.set(p.unidade_id, []);
      semSetorByUnidade.get(p.unidade_id)!.push(prof);
    }
  }

  return (uRes.data ?? []).map((u) => ({
    id: u.id,
    nome: u.nome,
    sigla: u.sigla,
    diretor: u.responsavel_nome,
    setores: setoresByUnidade.get(u.id) ?? [],
    sem_setor: semSetorByUnidade.get(u.id) ?? [],
  }));
}

// -------- Piso Gerencial (competências, comparativo, divergências, log) --------

export async function listPisoCompetencias(): Promise<string[]> {
  const { data, error } = await supabase
    .from("piso_enfermagem")
    .select("competencia")
    .not("competencia", "is", null);
  if (error) throw error;
  const set = new Set<string>();
  for (const r of data ?? []) if (r.competencia) set.add(r.competencia);
  return Array.from(set).sort().reverse();
}

export type PisoResumo = {
  competencia: string;
  totalRegistros: number;
  totalMatch: number;
  totalDivergentes: number;
  totalNaoEncontrados: number;
  somaFinal: number;
  somaLiquido: number;
  somaPisoComplementacao: number;
};

export async function getPisoResumo(competencia: string): Promise<PisoResumo> {
  const { data, error } = await supabase
    .from("piso_enfermagem")
    .select("status_match, valor_final, valor_liquido, piso_complementacao")
    .eq("competencia", competencia);
  if (error) throw error;
  const rows = data ?? [];
  const somaFinal = rows.reduce((a, r) => a + Number(r.valor_final ?? 0), 0);
  const somaLiquido = rows.reduce((a, r) => a + Number(r.valor_liquido ?? 0), 0);
  const somaPiso = rows.reduce((a, r) => a + Number(r.piso_complementacao ?? 0), 0);
  return {
    competencia,
    totalRegistros: rows.length,
    totalMatch: rows.filter((r) => r.status_match === "ok" || r.status_match === "matched").length,
    totalDivergentes: rows.filter(
      (r) => r.status_match === "divergente" || r.status_match === "divergent",
    ).length,
    totalNaoEncontrados: rows.filter(
      (r) => r.status_match === "nao_encontrado" || r.status_match === "not_found",
    ).length,
    somaFinal,
    somaLiquido,
    somaPisoComplementacao: somaPiso,
  };
}

export type PisoComparRow = {
  cpf: string;
  nome: string | null;
  unidade: string | null;
  cargo: string | null;
  valorA: number;
  valorB: number;
  diff: number;
  diffPct: number | null;
};

export async function comparePisoCompetencias(
  compA: string,
  compB: string,
): Promise<PisoComparRow[]> {
  const [aRes, bRes] = await Promise.all([
    supabase
      .from("piso_enfermagem")
      .select("cpf, nome, unidade, cargo, valor_final")
      .eq("competencia", compA),
    supabase
      .from("piso_enfermagem")
      .select("cpf, nome, unidade, cargo, valor_final")
      .eq("competencia", compB),
  ]);
  if (aRes.error) throw aRes.error;
  if (bRes.error) throw bRes.error;

  type Rec = {
    cpf: string;
    nome: string | null;
    unidade: string | null;
    cargo: string | null;
    valor: number;
  };
  const norm = (rows: typeof aRes.data): Rec[] =>
    (rows ?? [])
      .filter((r) => r.cpf)
      .map((r) => ({
        cpf: r.cpf as string,
        nome: r.nome,
        unidade: r.unidade,
        cargo: r.cargo,
        valor: Number(r.valor_final ?? 0),
      }));
  const A = norm(aRes.data);
  const B = norm(bRes.data);
  const mA = new Map(A.map((r) => [r.cpf, r] as const));
  const mB = new Map(B.map((r) => [r.cpf, r] as const));
  const cpfs = new Set<string>([...mA.keys(), ...mB.keys()]);

  const out: PisoComparRow[] = [];
  for (const cpf of cpfs) {
    const a = mA.get(cpf);
    const b = mB.get(cpf);
    const valorA = a?.valor ?? 0;
    const valorB = b?.valor ?? 0;
    const diff = valorB - valorA;
    out.push({
      cpf,
      nome: b?.nome ?? a?.nome ?? null,
      unidade: b?.unidade ?? a?.unidade ?? null,
      cargo: b?.cargo ?? a?.cargo ?? null,
      valorA,
      valorB,
      diff,
      diffPct: valorA > 0 ? (diff / valorA) * 100 : null,
    });
  }
  return out.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
}

export type PisoDivergencia = {
  id: string;
  cpf: string | null;
  nome: string | null;
  matricula: string | null;
  unidade: string | null;
  cargo: string | null;
  status_match: string;
  valor_final: number | null;
};

export async function listPisoDivergencias(
  competencia: string,
  tipo: "divergentes" | "nao_encontrados" | "todos" = "todos",
): Promise<PisoDivergencia[]> {
  let q = supabase
    .from("piso_enfermagem")
    .select("id, cpf, nome, matricula, unidade, cargo, status_match, valor_final")
    .eq("competencia", competencia);
  if (tipo === "divergentes") q = q.in("status_match", ["divergente", "divergent"]);
  else if (tipo === "nao_encontrados") q = q.in("status_match", ["nao_encontrado", "not_found"]);
  else q = q.not("status_match", "in", "(ok,matched)");
  const { data, error } = await q.order("nome");
  if (error) throw error;
  return (data ?? []) as PisoDivergencia[];
}

export type PisoHistoricoRow = {
  id: string;
  nome_arquivo: string;
  competencia: string | null;
  data_importacao: string;
  importado_por: string | null;
  status: string;
  total_registros: number;
  registros_importados: number;
  registros_divergentes: number;
  registros_nao_encontrados: number;
  modelo: string;
};

export async function listPisoHistorico(limit = 50): Promise<PisoHistoricoRow[]> {
  const { data, error } = await supabase
    .from("historico_importacoes")
    .select(
      "id, nome_arquivo, competencia, data_importacao, importado_por, status, total_registros, registros_importados, registros_divergentes, registros_nao_encontrados, modelo",
    )
    .eq("tipo_arquivo", "piso_enfermagem")
    .order("data_importacao", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PisoHistoricoRow[];
}
