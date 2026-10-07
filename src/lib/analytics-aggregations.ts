import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { parseNumeroPtBr } from "@/lib/numero-ptbr";

// Tipo extraído do hook de permissões para evitar circular deps se necessário
export type UserContext = {
  id: string;
  is_master: boolean;
  unidades: string[];
  [key: string]: any;
};

export type FrequenciaRow = {
  id: string;
  status: Database["public"]["Enums"]["status_frequencia"];
  tipo: Database["public"]["Enums"]["tipo_frequencia"];
  total_profissionais: number;
  total_dias_trabalhados: number;
  total_faltas: number;
  total_horas_extras: number;
  competencia_unidade?: {
    unidade_id: string;
    competencia_id: string;
    unidades?: { id: string; nome: string; sigla: string | null } | null;
    competencia?: { id: string; ano: number; mes: number; status: string } | null;
  } | null;
};

export const STATUS_APROVADAS = ["aprovada", "aprovadas", "arquivada"];
export const STATUS_ENVIADAS = ["enviada", "em_analise"];
export const STATUS_PENDENTES = ["enviada", "em_analise", "com_pendencias", "devolvida"];

export type RankingRow = {
  unidade_id: string;
  unidade_nome: string;
  unidade_sigla: string | null;
  total_profissionais: number;
  total_faltas: number;
  total_horas_extras: number;
  aprovadas: number;
  total_folhas: number;
};

export function countByStatus(rows: FrequenciaRow[], statusList: string[]) {
  return rows.filter((r) => statusList.includes(r.status)).length;
}

export function sumField(rows: FrequenciaRow[], field: keyof FrequenciaRow) {
  return rows.reduce((acc, curr) => acc + (Number(curr[field]) || 0), 0);
}

export function buildRanking(rows: FrequenciaRow[]): RankingRow[] {
  const map = new Map<string, RankingRow>();
  for (const r of rows) {
    const uid = r.competencia_unidade?.unidade_id;
    if (!uid) continue;
    const existing = map.get(uid);
    if (existing) {
      existing.total_profissionais += r.total_profissionais;
      existing.total_faltas += r.total_faltas;
      existing.total_horas_extras += r.total_horas_extras;
      existing.total_folhas += 1;
      if (STATUS_APROVADAS.includes(r.status)) existing.aprovadas += 1;
    } else {
      map.set(uid, {
        unidade_id: uid,
        unidade_nome: r.competencia_unidade?.unidades?.nome || "Desconhecida",
        unidade_sigla: r.competencia_unidade?.unidades?.sigla || null,
        total_profissionais: r.total_profissionais,
        total_faltas: r.total_faltas,
        total_horas_extras: r.total_horas_extras,
        aprovadas: STATUS_APROVADAS.includes(r.status) ? 1 : 0,
        total_folhas: 1,
      });
    }
  }
  return Array.from(map.values());
}

export type AggregationParams = {
  competenciaId?: string | null;
  unidadeId?: string | null;
  tipo?: string | null;
};

/** Totais de um recorte (somente lançamentos aprovados). */
export type TotaisTipo = {
  profissionais: number;
  diasTrabalhados: number;
  faltas: number;
  faltasJustificadas: number;
  faltasInjustificadas: number;
  he50: number;
  he100: number;
  heTotal: number;
  plantoes: number;
  sobreaviso: number;
  atestado: number;
  adn: number;
  incentivo: number;
  ferias: number;
  feriasTerco: number;
  feriasIntegral: number;
  licencas: number;
  licencaPremio: number;
  afastamentos: number;
  salSubH: number;
  aulasSuplementares: number;
};

/** Linha oficial (aprovada, deduplicada por profissional/unidade). */
export type LinhaOficial = {
  tipo: "efetivos" | "contratados";
  unidade_id: string;
  unidade_nome: string;
  unidade_sigla: string | null;
  setor_nome: string | null;
  profissional_id: string;
  profissional_nome: string;
  matricula: string | null;
  diasTrabalhados: number;
  faltas: number;
  faltasJustificadas: number;
  faltasInjustificadas: number;
  he50: number;
  he100: number;
  heTotal: number;
  plantoes: number;
  sobreaviso: number;
  atestado: number;
  adn: number;
  incentivo: number;
  ferias: number;
  feriasTerco: number;
  feriasIntegral: number;
  licencas: number;
  licencaPremio: number;
  afastamentos: number;
  salSubH: number;
  aulasSuplementares: number;
};

export type CoberturaUnidade = {
  unidade_id: string;
  unidade_nome: string;
  unidade_sigla: string | null;
  totalFolhas: number;
  aprovadas: number;
  enviadas: number;
  devolvidas: number;
  rascunho: number;
  completa: boolean;
};

export type ConsolidacaoOficial = {
  consolidado: TotaisTipo;
  efetivos: TotaisTipo;
  contratados: TotaisTipo;
  linhas: LinhaOficial[];
  cobertura: {
    totalFolhas: number;
    aprovadas: number;
    enviadas: number;
    devolvidas: number;
    rascunho: number;
    unidades: number;
    unidadesCompletas: number;
    porUnidade: CoberturaUnidade[];
  };
  duplicidadesIgnoradas: number;
};

export type AggregatedSummary = {
  totalFolhas: number;
  /** Profissionais distintos com lançamento aprovado. */
  totalProfissionais: number;
  totalDiasTrabalhados: number;
  totalFaltas: number;
  /** HE 50% + HE 100% (horas, sem multiplicador) — somente aprovadas. */
  totalHorasExtras: number;
  totalAprovadas: number;
  /** Folhas enviadas/em análise/com pendências/devolvidas (fora rascunho). */
  totalPendentes: number;
  totalRascunho: number;
  linhas: FrequenciaRow[];
  oficial: ConsolidacaoOficial;
};

const n = (v: unknown) => parseNumeroPtBr(v);

function zeroTotais(): TotaisTipo {
  return {
    profissionais: 0, diasTrabalhados: 0, faltas: 0, faltasJustificadas: 0,
    faltasInjustificadas: 0, he50: 0, he100: 0, heTotal: 0, plantoes: 0, sobreaviso: 0, atestado: 0,
    adn: 0, incentivo: 0, ferias: 0, feriasTerco: 0, feriasIntegral: 0, licencas: 0, licencaPremio: 0,
    afastamentos: 0, salSubH: 0, aulasSuplementares: 0,
  };
}

export function somarTotais(linhas: LinhaOficial[]): TotaisTipo {
  const t = zeroTotais();
  const profs = new Set<string>();
  for (const l of linhas) {
    profs.add(`${l.tipo}:${l.profissional_id}`);
    t.diasTrabalhados += l.diasTrabalhados;
    t.faltas += l.faltas;
    t.faltasJustificadas += l.faltasJustificadas;
    t.faltasInjustificadas += l.faltasInjustificadas;
    t.he50 += l.he50;
    t.he100 += l.he100;
    t.heTotal += l.heTotal;
    t.plantoes += l.plantoes;
    t.sobreaviso += l.sobreaviso;
    t.atestado += l.atestado;
    for (const k of EXTRA_KEYS) t[k] += l[k];
  }
  t.profissionais = profs.size;
  return t;
}

export const EXTRA_KEYS = [
  "adn", "incentivo", "ferias", "feriasTerco", "feriasIntegral", "licencas", "licencaPremio",
  "afastamentos", "salSubH", "aulasSuplementares",
] as const;

const STATUS_LINHA_OFICIAL = ["aprovada", "arquivada"];

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await build(from, from + size - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < arr.length; i += size) r.push(arr.slice(i, i + size));
  return r;
}

/**
 * Camada única de agregação oficial de frequências (somente leitura).
 * Regra: totais oficiais consideram SOMENTE lançamentos aprovados,
 * calculados a partir das linhas (não dos resumos persistidos), com
 * deduplicação por profissional + unidade (folha geral × setorial).
 */
export async function getAggregatedFrequencies(params: AggregationParams): Promise<AggregatedSummary> {
  const { data: userData, error: userError } = await supabase.rpc("get_my_user_context");
  if (userError) throw userError;
  const userCtx = (userData as unknown) as UserContext;
  const isMaster = !!userCtx?.is_master;

  let q = supabase
    .from("frequencias")
    .select(`
      id, status, tipo, setor_id,
      total_profissionais, total_dias_trabalhados, total_faltas, total_horas_extras,
      setor:setores(nome),
      competencia_unidade:competencia_unidades!inner(
        unidade_id, competencia_id,
        unidades(id, nome, sigla),
        competencia:competencias(id, ano, mes, status)
      )
    `)
    .is("deleted_at", null);

  if (params.competenciaId && params.competenciaId !== "all") {
    q = q.eq("competencia_unidade.competencia_id", params.competenciaId);
  }
  if (params.unidadeId && params.unidadeId !== "all") {
    q = q.eq("competencia_unidade.unidade_id", params.unidadeId);
  } else if (!isMaster && userCtx?.unidades && Array.isArray(userCtx.unidades)) {
    q = q.in("competencia_unidade.unidade_id", userCtx.unidades as string[]);
  }
  if (params.tipo && params.tipo !== "all") {
    q = q.eq("tipo", params.tipo as any);
  }

  const { data: rawFolhas, error } = await q.limit(5000);
  if (error) throw error;
  const folhas = (rawFolhas ?? []) as unknown as (FrequenciaRow & {
    setor_id: string | null;
    setor?: { nome: string } | null;
  })[];

  const unidadeInfo = new Map<string, { nome: string; sigla: string | null }>();
  for (const f of folhas) {
    const u = f.competencia_unidade?.unidades;
    if (u) unidadeInfo.set(u.id, { nome: u.nome, sigla: u.sigla });
  }

  // ---------- Efetivos: linhas das folhas aprovadas ----------
  const folhasEfAprov = folhas.filter((f) => f.tipo === "efetivos" && STATUS_APROVADAS.includes(f.status));
  const folhaById = new Map(folhas.map((f) => [f.id, f]));
  type RawEf = {
    id: string; frequencia_id: string; profissional_id: string; updated_at: string;
    dias_trabalhados: string | null; faltas_justificadas: string | null; faltas_injustificadas: string | null;
    he_50: string | null; he_100: string | null; plantoes_extras: string | null; sobreaviso: string | null; atestado: string | null;
    adicional_noturno: string | null; incentivo: string | null; ferias: string | null; ferias_terco: string | null;
    ferias_integral: string | null; licencas: string | null; licenca_premio: string | null; afastamentos: string | null;
    sal_sub_h: string | null; aulas_suplementares: string | null;
    profissional: { nome_completo: string; matricula: string | null; setor: { nome: string } | null } | null;
  };
  const efRaw: RawEf[] = [];
  for (const ids of chunk(folhasEfAprov.map((f) => f.id), 150)) {
    const rows = await fetchAll<RawEf>((from, to) =>
      supabase
        .from("frequencia_profissional")
        .select("id, frequencia_id, profissional_id, updated_at, dias_trabalhados, faltas_justificadas, faltas_injustificadas, he_50, he_100, plantoes_extras, sobreaviso, atestado, adicional_noturno, incentivo, ferias, ferias_terco, ferias_integral, licencas, licenca_premio, afastamentos, sal_sub_h, aulas_suplementares, profissional:profissionais(nome_completo, matricula, setor:setores!profissionais_setor_id_fkey(nome))")
        .in("frequencia_id", ids)
        .is("deleted_at", null)
        .order("id")
        .range(from, to) as any,
    );
    efRaw.push(...rows);
  }

  // ---------- Contratados: linhas aprovadas por unidade/competência ----------
  const pares = new Map<string, { competencia_id: string; unidade_id: string }>();
  for (const f of folhas) {
    if (f.tipo !== "contratados" || !f.competencia_unidade) continue;
    const k = `${f.competencia_unidade.competencia_id}|${f.competencia_unidade.unidade_id}`;
    pares.set(k, { competencia_id: f.competencia_unidade.competencia_id, unidade_id: f.competencia_unidade.unidade_id });
  }
  type RawCt = {
    id: string; unidade_id: string; competencia_id: string; profissional_id: string; updated_at: string;
    dias_trabalhados: string | null; dias_falta: string | null; he_50: string | null; he_100: string | null;
    plantoes: string | null; sobreaviso: string | null; atestado: string | null;
    adn: string | null; incentivo: string | null;
    profissional: { nome_completo: string; matricula: string | null; setor: { nome: string } | null } | null;
  };
  const ctRaw: RawCt[] = [];
  const porComp = new Map<string, string[]>();
  for (const p of pares.values()) {
    const arr = porComp.get(p.competencia_id) ?? [];
    arr.push(p.unidade_id);
    porComp.set(p.competencia_id, arr);
  }
  for (const [compId, unids] of porComp) {
    for (const us of chunk(unids, 100)) {
      const rows = await fetchAll<RawCt>((from, to) =>
        supabase
          .from("frequencias_contratados")
          .select("id, unidade_id, competencia_id, profissional_id, updated_at, dias_trabalhados, dias_falta, he_50, he_100, plantoes, sobreaviso, atestado, adn, incentivo, profissional:profissionais(nome_completo, matricula, setor:setores!profissionais_setor_id_fkey(nome))")
          .eq("competencia_id", compId)
          .in("unidade_id", us)
          .in("status", STATUS_LINHA_OFICIAL as any)
          .is("deleted_at", null)
          .order("id")
          .range(from, to) as any,
      );
      ctRaw.push(...rows);
    }
  }

  // ---------- Normalização + deduplicação ----------
  let duplicidades = 0;
  const dedupe = new Map<string, { updated_at: string; linha: LinhaOficial }>();
  const put = (key: string, updated_at: string, linha: LinhaOficial) => {
    const ex = dedupe.get(key);
    if (ex) {
      duplicidades++;
      if (ex.updated_at >= updated_at) return;
    }
    dedupe.set(key, { updated_at, linha });
  };

  for (const r of efRaw) {
    const f = folhaById.get(r.frequencia_id);
    const uid = f?.competencia_unidade?.unidade_id ?? "";
    const comp = f?.competencia_unidade?.competencia_id ?? "";
    const u = unidadeInfo.get(uid);
    const fj = n(r.faltas_justificadas), fi = n(r.faltas_injustificadas);
    const h50 = n(r.he_50), h100 = n(r.he_100);
    put(`ef|${comp}|${uid}|${r.profissional_id}`, r.updated_at, {
      tipo: "efetivos", unidade_id: uid, unidade_nome: u?.nome ?? "—", unidade_sigla: u?.sigla ?? null,
      setor_nome: f?.setor?.nome ?? r.profissional?.setor?.nome ?? null,
      profissional_id: r.profissional_id, profissional_nome: r.profissional?.nome_completo ?? "—",
      matricula: r.profissional?.matricula ?? null,
      diasTrabalhados: n(r.dias_trabalhados), faltas: fj + fi, faltasJustificadas: fj, faltasInjustificadas: fi,
      he50: h50, he100: h100, heTotal: h50 + h100,
      plantoes: n(r.plantoes_extras), sobreaviso: n(r.sobreaviso), atestado: n(r.atestado),
      adn: n(r.adicional_noturno), incentivo: n(r.incentivo), ferias: n(r.ferias), feriasTerco: n(r.ferias_terco),
      feriasIntegral: n(r.ferias_integral), licencas: n(r.licencas), licencaPremio: n(r.licenca_premio),
      afastamentos: n(r.afastamentos), salSubH: n(r.sal_sub_h), aulasSuplementares: n(r.aulas_suplementares),
    });
  }
  for (const r of ctRaw) {
    const u = unidadeInfo.get(r.unidade_id);
    const h50 = n(r.he_50), h100 = n(r.he_100), fa = n(r.dias_falta);
    put(`ct|${r.competencia_id}|${r.unidade_id}|${r.profissional_id}`, r.updated_at, {
      tipo: "contratados", unidade_id: r.unidade_id, unidade_nome: u?.nome ?? "—", unidade_sigla: u?.sigla ?? null,
      setor_nome: r.profissional?.setor?.nome ?? null,
      profissional_id: r.profissional_id, profissional_nome: r.profissional?.nome_completo ?? "—",
      matricula: r.profissional?.matricula ?? null,
      diasTrabalhados: n(r.dias_trabalhados), faltas: fa, faltasJustificadas: 0, faltasInjustificadas: fa,
      he50: h50, he100: h100, heTotal: h50 + h100,
      plantoes: n(r.plantoes), sobreaviso: n(r.sobreaviso), atestado: n(r.atestado),
      adn: n(r.adn), incentivo: n(r.incentivo), ferias: 0, feriasTerco: 0, feriasIntegral: 0, licencas: 0,
      licencaPremio: 0, afastamentos: 0, salSubH: 0, aulasSuplementares: 0,
    });
  }

  const linhasOficiais = Array.from(dedupe.values()).map((v) => v.linha)
    .sort((a, b) => a.unidade_nome.localeCompare(b.unidade_nome) || a.profissional_nome.localeCompare(b.profissional_nome));

  const efetivos = somarTotais(linhasOficiais.filter((l) => l.tipo === "efetivos"));
  const contratados = somarTotais(linhasOficiais.filter((l) => l.tipo === "contratados"));
  const consolidado = somarTotais(linhasOficiais);
  // Profissional distinto no consolidado (mesmo profissional em Efetivos e Contratados conta 1x).
  consolidado.profissionais = new Set(linhasOficiais.map((l) => l.profissional_id)).size;

  // ---------- Cobertura ----------
  const cobMap = new Map<string, CoberturaUnidade>();
  let enviadas = 0, devolvidas = 0, rascunho = 0, aprovadas = 0;
  for (const f of folhas) {
    const uid = f.competencia_unidade?.unidade_id;
    if (!uid) continue;
    const u = unidadeInfo.get(uid);
    const c = cobMap.get(uid) ?? {
      unidade_id: uid, unidade_nome: u?.nome ?? "—", unidade_sigla: u?.sigla ?? null,
      totalFolhas: 0, aprovadas: 0, enviadas: 0, devolvidas: 0, rascunho: 0, completa: false,
    };
    c.totalFolhas++;
    if (STATUS_APROVADAS.includes(f.status)) { c.aprovadas++; aprovadas++; }
    else if (STATUS_ENVIADAS.includes(f.status) || f.status === "com_pendencias") { c.enviadas++; enviadas++; }
    else if (f.status === "devolvida" || f.status === "rejeitada") { c.devolvidas++; devolvidas++; }
    else { c.rascunho++; rascunho++; }
    cobMap.set(uid, c);
  }
  const porUnidade = Array.from(cobMap.values()).map((c) => ({ ...c, completa: c.aprovadas === c.totalFolhas }))
    .sort((a, b) => a.unidade_nome.localeCompare(b.unidade_nome));

  // Folhas com totais vindos das linhas oficiais quando aprovadas
  const linhasFolha: FrequenciaRow[] = folhas.map((f) => {
    if (f.tipo !== "efetivos" || !STATUS_APROVADAS.includes(f.status)) return f;
    const ls = efRaw.filter((r) => r.frequencia_id === f.id);
    return {
      ...f,
      total_profissionais: new Set(ls.map((r) => r.profissional_id)).size,
      total_dias_trabalhados: ls.reduce((a, r) => a + n(r.dias_trabalhados), 0),
      total_faltas: ls.reduce((a, r) => a + n(r.faltas_justificadas) + n(r.faltas_injustificadas), 0),
      total_horas_extras: ls.reduce((a, r) => a + n(r.he_50) + n(r.he_100), 0),
    };
  });

  return {
    totalFolhas: folhas.length,
    totalProfissionais: consolidado.profissionais,
    totalDiasTrabalhados: consolidado.diasTrabalhados,
    totalFaltas: consolidado.faltas,
    totalHorasExtras: consolidado.heTotal,
    totalAprovadas: aprovadas,
    totalPendentes: enviadas + devolvidas,
    totalRascunho: rascunho,
    linhas: linhasFolha,
    oficial: {
      consolidado, efetivos, contratados, linhas: linhasOficiais,
      cobertura: {
        totalFolhas: folhas.length, aprovadas, enviadas, devolvidas, rascunho,
        unidades: porUnidade.length, unidadesCompletas: porUnidade.filter((c) => c.completa).length,
        porUnidade,
      },
      duplicidadesIgnoradas: duplicidades,
    },
  };
}

/** Ranking oficial por unidade, a partir das linhas aprovadas. */
export function buildRankingOficial(o: ConsolidacaoOficial | undefined): RankingRow[] {
  if (!o) return [];
  const map = new Map<string, RankingRow & { _profs: Set<string> }>();
  for (const c of o.cobertura.porUnidade) {
    map.set(c.unidade_id, {
      unidade_id: c.unidade_id, unidade_nome: c.unidade_nome, unidade_sigla: c.unidade_sigla,
      total_profissionais: 0, total_faltas: 0, total_horas_extras: 0,
      aprovadas: c.aprovadas, total_folhas: c.totalFolhas, _profs: new Set(),
    });
  }
  for (const l of o.linhas) {
    const r = map.get(l.unidade_id);
    if (!r) continue;
    r._profs.add(l.profissional_id);
    r.total_faltas += l.faltas;
    r.total_horas_extras += l.heTotal;
  }
  return Array.from(map.values())
    .map(({ _profs, ...r }) => ({ ...r, total_profissionais: _profs.size }))
    .sort((a, b) => b.total_profissionais - a.total_profissionais);
}
