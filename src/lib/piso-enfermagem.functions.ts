import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensurePermission } from "./authz.server";

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type PisoRow = { [k: string]: JsonValue };

const MODELO = z.enum(["Efetivos", "Contratados", "Ministério", "Personalizado"]);
const TIPO_ARQ = z.enum(["PDF", "Excel", "CSV"]);

// --------------------- Match profissionais ---------------------

const MatchInput = z.object({
  cpfs: z.array(z.string()).default([]),
  matriculas: z.array(z.string()).default([]),
  nomes: z.array(z.string()).default([]),
});

export const matchProfissionaisImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MatchInput.parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.importar");
    const { supabase } = context;
    const cpfs = Array.from(new Set(data.cpfs.filter(Boolean)));
    const mats = Array.from(new Set(data.matriculas.filter(Boolean)));
    const nomes = Array.from(new Set(data.nomes.filter(Boolean))).slice(0, 5000);

    const byCpf: Record<string, string> = {};
    const byMatricula: Record<string, string> = {};
    // Amostra de candidatos para fuzzy: retorna todos os profissionais com nome
    // (limite defensivo). O cliente calcula similaridade localmente.
    let candidatos: { id: string; nome: string }[] = [];

    if (cpfs.length > 0) {
      const { data: rows, error } = await supabase
        .from("profissionais")
        .select("id, cpf")
        .in("cpf", cpfs);
      if (error) throw new Error(error.message);
      for (const r of rows ?? []) {
        if (r.cpf) byCpf[r.cpf] = r.id;
      }
    }
    if (mats.length > 0) {
      const { data: rows, error } = await supabase
        .from("profissionais")
        .select("id, matricula")
        .in("matricula", mats);
      if (error) throw new Error(error.message);
      for (const r of rows ?? []) {
        if (r.matricula) byMatricula[r.matricula] = r.id;
      }
    }
    if (nomes.length > 0) {
      const { data: rows, error } = await supabase
        .from("profissionais")
        .select("id, nome_completo")
        .not("nome_completo", "is", null)
        .limit(10000);
      if (error) throw new Error(error.message);
      candidatos = (rows ?? []).map((r) => ({ id: r.id, nome: r.nome_completo as string }));
    }
    return { byCpf, byMatricula, candidatos };
  });

// --------------------- Desfazer importação ---------------------

export const desfazerImportacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.importar");
    const { supabase } = context;
    const { error: delErr } = await supabase
      .from("piso_enfermagem")
      .delete()
      .eq("historico_id", data.id);
    if (delErr) throw new Error(delErr.message);
    const { error: updErr } = await supabase
      .from("historico_importacoes")
      .update({ status: "Desfeito" })
      .eq("id", data.id);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });

// --------------------- Commit da importação ---------------------

const LinhaSchema = z.object({
  cpf: z.string().nullable().optional(),
  nome: z.string().nullable().optional(),
  matricula: z.string().nullable().optional(),
  cargo: z.string().nullable().optional(),
  unidade: z.string().nullable().optional(),
  setor: z.string().nullable().optional(),
  vinculo: z.string().nullable().optional(),
  competencia: z.string().nullable().optional(),
  salario_base: z.number().nullable().optional(),
  piso_complementacao: z.number().nullable().optional(),
  insalubridade: z.number().nullable().optional(),
  gratificacao: z.number().nullable().optional(),
  hora_extra_50: z.number().nullable().optional(),
  hora_extra_100: z.number().nullable().optional(),
  adicional_noturno: z.number().nullable().optional(),
  auxilio_financeiro: z.number().nullable().optional(),
  ferias_1_3: z.number().nullable().optional(),
  ferias: z.number().nullable().optional(),
  inss: z.number().nullable().optional(),
  irrf: z.number().nullable().optional(),
  valor_liquido: z.number().nullable().optional(),
  valor_final: z.number().nullable().optional(),
  profissional_id: z.string().uuid().nullable().optional(),
  status_match: z.enum(["cpf", "matricula", "nome", "nao_localizado"]),
});

const CommitInput = z.object({
  modelo: MODELO,
  nome_arquivo: z.string().min(1),
  tipo_arquivo: TIPO_ARQ,
  competencia: z.string().nullable().optional(),
  mapeamento: z.record(z.string(), z.string().nullable()).default({}),
  linhas: z.array(LinhaSchema).max(20000),
});

// Campos que o usuário pode desmarcar na tela de importação.
const CAMPOS_ATUALIZAVEIS = [
  "cargo",
  "unidade",
  "setor",
  "vinculo",
  "salario_base",
  "piso_complementacao",
  "insalubridade",
  "gratificacao",
  "hora_extra_50",
  "hora_extra_100",
  "adicional_noturno",
  "auxilio_financeiro",
  "ferias_1_3",
  "ferias",
  "inss",
  "irrf",
] as const;
type CampoAtualizavel = (typeof CAMPOS_ATUALIZAVEIS)[number];
const CamposAtualizarSchema = z
  .array(z.enum(CAMPOS_ATUALIZAVEIS))
  .default([...CAMPOS_ATUALIZAVEIS]);

function filtraCampos<T extends Record<string, unknown>>(row: T, camposPermitidos: Set<string>): T {
  const out = { ...row } as Record<string, unknown>;
  for (const k of CAMPOS_ATUALIZAVEIS) {
    if (!camposPermitidos.has(k)) out[k] = null;
  }
  return out as T;
}

export const commitImportPiso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    CommitInput.extend({ camposAtualizar: CamposAtualizarSchema.optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.importar");
    const { supabase, userId } = context;
    const camposSet = new Set<string>(data.camposAtualizar ?? [...CAMPOS_ATUALIZAVEIS]);

    let importados = 0,
      divergentes = 0,
      naoLocalizados = 0;
    for (const l of data.linhas) {
      if (l.status_match === "nao_localizado") naoLocalizados++;
      else if (!l.cpf && !l.matricula) divergentes++;
      else importados++;
    }

    const { data: hist, error: histErr } = await supabase
      .from("historico_importacoes")
      .insert({
        modelo: data.modelo,
        nome_arquivo: data.nome_arquivo,
        tipo_arquivo: data.tipo_arquivo,
        competencia: data.competencia ?? null,
        mapeamento: data.mapeamento,
        total_registros: data.linhas.length,
        registros_importados: importados,
        registros_divergentes: divergentes,
        registros_nao_encontrados: naoLocalizados,
        importado_por: userId,
        status: naoLocalizados > 0 || divergentes > 0 ? "Com erros" : "Concluído",
      })
      .select("id")
      .single();
    if (histErr || !hist) throw new Error(histErr?.message ?? "Falha ao criar histórico");

    if (data.linhas.length > 0) {
      const rows = data.linhas.map((l) =>
        filtraCampos(
          {
            historico_id: hist.id,
            profissional_id: l.profissional_id ?? null,
            cpf: l.cpf ?? null,
            nome: l.nome ?? null,
            matricula: l.matricula ?? null,
            cargo: l.cargo ?? null,
            unidade: l.unidade ?? null,
            setor: l.setor ?? null,
            vinculo: l.vinculo ?? null,
            salario_base: l.salario_base ?? null,
            piso_complementacao: l.piso_complementacao ?? null,
            insalubridade: l.insalubridade ?? null,
            gratificacao: l.gratificacao ?? null,
            hora_extra_50: l.hora_extra_50 ?? null,
            hora_extra_100: l.hora_extra_100 ?? null,
            adicional_noturno: l.adicional_noturno ?? null,
            auxilio_financeiro: l.auxilio_financeiro ?? null,
            ferias_1_3: l.ferias_1_3 ?? null,
            ferias: l.ferias ?? null,
            inss: l.inss ?? null,
            irrf: l.irrf ?? null,
            valor_liquido: l.valor_liquido ?? null,
            valor_final: l.valor_final ?? null,
            competencia: l.competencia ?? data.competencia ?? null,
            origem_arquivo: data.nome_arquivo,
            importado_por: userId,
            status_match: l.status_match,
          },
          camposSet,
        ),
      );

      // Batches de 500 para evitar payload muito grande
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await supabase.from("piso_enfermagem").insert(chunk);
        if (error) throw new Error(error.message);
      }
    }

    return {
      historico_id: hist.id,
      stats: { total: data.linhas.length, importados, divergentes, naoLocalizados },
    };
  });

// --------------------- Commit em chunks (com barra de progresso) ---------------------

const StartInput = z.object({
  modelo: MODELO,
  nome_arquivo: z.string().min(1),
  tipo_arquivo: TIPO_ARQ,
  competencia: z.string().nullable().optional(),
  mapeamento: z.record(z.string(), z.string().nullable()).default({}),
  total: z.number().int().nonnegative(),
});

export const startImportPiso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StartInput.parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.importar");
    const { data: hist, error } = await context.supabase
      .from("historico_importacoes")
      .insert({
        modelo: data.modelo,
        nome_arquivo: data.nome_arquivo,
        tipo_arquivo: data.tipo_arquivo,
        competencia: data.competencia ?? null,
        mapeamento: data.mapeamento,
        total_registros: data.total,
        registros_importados: 0,
        registros_divergentes: 0,
        registros_nao_encontrados: 0,
        importado_por: context.userId,
        status: "Em andamento",
      })
      .select("id")
      .single();
    if (error || !hist) throw new Error(error?.message ?? "Falha ao iniciar importação");
    return { historico_id: hist.id };
  });

const AppendInput = z.object({
  historico_id: z.string().uuid(),
  nome_arquivo: z.string().min(1),
  competencia: z.string().nullable().optional(),
  linhas: z.array(LinhaSchema).max(500),
  camposAtualizar: CamposAtualizarSchema.optional(),
});

export const appendPisoLinhas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AppendInput.parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.importar");
    if (data.linhas.length === 0) return { inserted: 0 };
    const camposSet = new Set<string>(data.camposAtualizar ?? [...CAMPOS_ATUALIZAVEIS]);
    const rows = data.linhas.map((l) =>
      filtraCampos(
        {
          historico_id: data.historico_id,
          profissional_id: l.profissional_id ?? null,
          cpf: l.cpf ?? null,
          nome: l.nome ?? null,
          matricula: l.matricula ?? null,
          cargo: l.cargo ?? null,
          unidade: l.unidade ?? null,
          setor: l.setor ?? null,
          vinculo: l.vinculo ?? null,
          salario_base: l.salario_base ?? null,
          piso_complementacao: l.piso_complementacao ?? null,
          insalubridade: l.insalubridade ?? null,
          gratificacao: l.gratificacao ?? null,
          hora_extra_50: l.hora_extra_50 ?? null,
          hora_extra_100: l.hora_extra_100 ?? null,
          adicional_noturno: l.adicional_noturno ?? null,
          auxilio_financeiro: l.auxilio_financeiro ?? null,
          ferias_1_3: l.ferias_1_3 ?? null,
          ferias: l.ferias ?? null,
          inss: l.inss ?? null,
          irrf: l.irrf ?? null,
          valor_liquido: l.valor_liquido ?? null,
          valor_final: l.valor_final ?? null,
          competencia: l.competencia ?? data.competencia ?? null,
          origem_arquivo: data.nome_arquivo,
          importado_por: context.userId,
          status_match: l.status_match,
        },
        camposSet,
      ),
    );
    const { error } = await context.supabase.from("piso_enfermagem").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

const FinalizeInput = z.object({
  historico_id: z.string().uuid(),
  importados: z.number().int().nonnegative(),
  divergentes: z.number().int().nonnegative(),
  naoLocalizados: z.number().int().nonnegative(),
  cancelado: z.boolean().default(false),
});

export const finalizeImportPiso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FinalizeInput.parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.importar");
    if (data.cancelado) {
      // Cancelamento: remove linhas parciais + marca desfeito
      await context.supabase.from("piso_enfermagem").delete().eq("historico_id", data.historico_id);
      const { error } = await context.supabase
        .from("historico_importacoes")
        .update({ status: "Cancelado" })
        .eq("id", data.historico_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const status = data.naoLocalizados > 0 || data.divergentes > 0 ? "Com erros" : "Concluído";
    const { error } = await context.supabase
      .from("historico_importacoes")
      .update({
        registros_importados: data.importados,
        registros_divergentes: data.divergentes,
        registros_nao_encontrados: data.naoLocalizados,
        status,
      })
      .eq("id", data.historico_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --------------------- Distribuições (dashboard) ---------------------

export const getPisoDistribuicao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ competencia: z.string().nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.visualizar");
    if (!data.competencia) {
      return { porUnidade: [], porCargo: [], naoLocalizados: [] };
    }
    const { data: rows, error } = await context.supabase
      .from("piso_enfermagem")
      .select("unidade, cargo, nome, cpf, matricula, piso_complementacao, status_match")
      .eq("competencia", data.competencia)
      .limit(20000);
    if (error) throw new Error(error.message);
    const uMap = new Map<string, { total: number; valor: number }>();
    const cMap = new Map<string, { total: number; valor: number }>();
    const naoLocalizados: { nome: string | null; cpf: string | null; matricula: string | null }[] =
      [];
    for (const r of rows ?? []) {
      const uKey = r.unidade ?? "—";
      const cKey = r.cargo ?? "—";
      const val = r.piso_complementacao ?? 0;
      const u = uMap.get(uKey) ?? { total: 0, valor: 0 };
      u.total += 1;
      u.valor += val;
      uMap.set(uKey, u);
      const c = cMap.get(cKey) ?? { total: 0, valor: 0 };
      c.total += 1;
      c.valor += val;
      cMap.set(cKey, c);
      if (r.status_match === "nao_localizado") {
        naoLocalizados.push({
          nome: r.nome ?? null,
          cpf: r.cpf ?? null,
          matricula: r.matricula ?? null,
        });
      }
    }
    const porUnidade = Array.from(uMap.entries())
      .map(([k, v]) => ({ label: k, total: v.total, valor: v.valor }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
    const porCargo = Array.from(cMap.entries())
      .map(([k, v]) => ({ label: k, total: v.total, valor: v.valor }))
      .sort((a, b) => b.total - a.total);
    return { porUnidade, porCargo, naoLocalizados: naoLocalizados.slice(0, 50) };
  });

// --------------------- Listagens ---------------------

export const listHistoricoImportacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ page: z.number().default(1), pageSize: z.number().default(25) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.visualizar");
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const {
      data: rows,
      count,
      error,
    } = await context.supabase
      .from("historico_importacoes")
      .select("*", { count: "exact" })
      .order("data_importacao", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], count: count ?? 0 };
  });

export const getHistoricoImportacao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.visualizar");
    const { data: hist, error } = await context.supabase
      .from("historico_importacoes")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!hist) return { historico: null as PisoRow | null, linhas: [] as PisoRow[] };
    const { data: linhas, error: lerr } = await context.supabase
      .from("piso_enfermagem")
      .select("*")
      .eq("historico_id", data.id)
      .order("nome", { ascending: true });
    if (lerr) throw new Error(lerr.message);
    return {
      historico: hist as unknown as PisoRow,
      linhas: (linhas ?? []) as unknown as PisoRow[],
    };
  });

// --------------------- Mapeamentos salvos ---------------------

export const saveMapeamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        nome: z.string().min(1).max(120),
        modelo: MODELO,
        mapeamento: z.record(z.string(), z.string().nullable()),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.importar");
    const { error } = await context.supabase.from("piso_mapeamentos_salvos").upsert(
      {
        nome: data.nome,
        modelo: data.modelo,
        mapeamento: data.mapeamento,
        criado_por: context.userId,
      },
      { onConflict: "modelo,nome" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMapeamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ modelo: MODELO }).parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.visualizar");
    const { data: rows, error } = await context.supabase
      .from("piso_mapeamentos_salvos")
      .select("id, nome, modelo, mapeamento, updated_at")
      .eq("modelo", data.modelo)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

// --------------------- Dashboard: métricas comparativas ---------------------

type PisoLinhaLite = {
  nome: string | null;
  competencia: string | null;
  piso_complementacao: number | null;
};

export const getDashboardPiso = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.visualizar");
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("piso_enfermagem")
      .select("nome, competencia, piso_complementacao")
      .not("competencia", "is", null)
      .order("competencia", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);

    const linhas = (rows ?? []) as PisoLinhaLite[];
    const porCompetencia = new Map<string, PisoLinhaLite[]>();
    for (const l of linhas) {
      const key = l.competencia ?? "";
      if (!key) continue;
      const arr = porCompetencia.get(key) ?? [];
      arr.push(l);
      porCompetencia.set(key, arr);
    }
    const competencias = Array.from(porCompetencia.keys());
    const atual = competencias[0] ?? null;
    const anterior = competencias[1] ?? null;

    const somaPiso = (arr: PisoLinhaLite[]) =>
      arr.reduce((acc, r) => acc + (r.piso_complementacao ?? 0), 0);

    const totalAtual = atual ? somaPiso(porCompetencia.get(atual) ?? []) : 0;
    const totalAnterior = anterior ? somaPiso(porCompetencia.get(anterior) ?? []) : 0;
    const registrosAtual = atual ? (porCompetencia.get(atual)?.length ?? 0) : 0;
    const registrosAnterior = anterior ? (porCompetencia.get(anterior)?.length ?? 0) : 0;

    // Top 5 profissionais com maior complementação na competência atual
    const top5 = atual
      ? Array.from(
          (porCompetencia.get(atual) ?? []).reduce((map, r) => {
            const nome = r.nome ?? "—";
            map.set(nome, (map.get(nome) ?? 0) + (r.piso_complementacao ?? 0));
            return map;
          }, new Map<string, number>()),
        )
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([nome, valor]) => ({ nome, valor }))
      : [];

    return {
      competenciaAtual: atual,
      competenciaAnterior: anterior,
      totalAtual,
      totalAnterior,
      registrosAtual,
      registrosAnterior,
      top5,
    };
  });

// --------------------- Listagem completa (por competência) ---------------------

const ListInput = z.object({
  competencia: z.string().nullable().optional(),
  vinculo: z.string().nullable().optional(),
  cargo: z.string().nullable().optional(),
  busca: z.string().nullable().optional(),
  page: z.number().default(1),
  pageSize: z.number().default(20),
});

export const listPisoLinhas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.visualizar");
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    let q = context.supabase
      .from("piso_enfermagem")
      .select(
        "id, nome, cpf, matricula, cargo, vinculo, competencia, salario_base, piso_complementacao, valor_final, valor_liquido",
        { count: "exact" },
      )
      .order("nome", { ascending: true });
    if (data.competencia) q = q.eq("competencia", data.competencia);
    if (data.vinculo) q = q.eq("vinculo", data.vinculo);
    if (data.cargo) q = q.ilike("cargo", `%${data.cargo}%`);
    if (data.busca && data.busca.trim()) {
      const s = data.busca.trim().replace(/[%,()]/g, "");
      q = q.or(`nome.ilike.%${s}%,cpf.ilike.%${s}%`);
    }
    const { data: rows, count, error } = await q.range(from, to);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], count: count ?? 0 };
  });

export const listPisoCompetencias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.visualizar");
    const { data, error } = await context.supabase
      .from("piso_enfermagem")
      .select("competencia")
      .not("competencia", "is", null)
      .limit(10000);
    if (error) throw new Error(error.message);
    const set = new Set<string>();
    for (const r of data ?? []) if (r.competencia) set.add(r.competencia);
    return { competencias: Array.from(set).sort().reverse() };
  });

export const getPisoCompetenciaResumo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ competencia: z.string().nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.visualizar");
    const { supabase } = context;

    // Descobre atual + anterior a partir da lista de competências
    let atual = data.competencia ?? null;
    let anterior: string | null = null;
    const { data: allComp, error: cErr } = await supabase
      .from("piso_enfermagem")
      .select("competencia")
      .not("competencia", "is", null)
      .limit(10000);
    if (cErr) throw new Error(cErr.message);
    const uniq = Array.from(new Set((allComp ?? []).map((r) => r.competencia as string)))
      .sort()
      .reverse();
    if (!atual) atual = uniq[0] ?? null;
    if (atual) {
      const idx = uniq.indexOf(atual);
      anterior = idx >= 0 ? (uniq[idx + 1] ?? null) : null;
    }

    async function resumoFor(comp: string | null) {
      if (!comp) {
        return {
          total: 0,
          valorFinal: 0,
          complementacao: 0,
          beneficiados: 0,
          top5: [] as { nome: string; valor: number }[],
        };
      }
      const { data: rows, error } = await supabase
        .from("piso_enfermagem")
        .select("nome, valor_final, piso_complementacao")
        .eq("competencia", comp)
        .limit(20000);
      if (error) throw new Error(error.message);
      const list = rows ?? [];
      let valorFinal = 0,
        complementacao = 0,
        beneficiados = 0;
      const porNome = new Map<string, number>();
      for (const r of list) {
        valorFinal += r.valor_final ?? 0;
        const comp = r.piso_complementacao ?? 0;
        complementacao += comp;
        if (comp > 0) beneficiados++;
        const nome = r.nome ?? "—";
        porNome.set(nome, (porNome.get(nome) ?? 0) + comp);
      }
      const top5 = Array.from(porNome.entries())
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([nome, valor]) => ({ nome, valor }));
      return { total: list.length, valorFinal, complementacao, beneficiados, top5 };
    }

    const atualR = await resumoFor(atual);
    const anteriorR = await resumoFor(anterior);

    return {
      competenciaAtual: atual,
      competenciaAnterior: anterior,
      todasCompetencias: uniq,
      atual: atualR,
      anterior: anteriorR,
    };
  });
