import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensurePermission } from "./authz.server";

const MODELO = z.enum(["Efetivos", "Contratados", "Ministério", "Personalizado"]);
const TIPO_ARQ = z.enum(["PDF", "Excel", "CSV"]);

// --------------------- Match profissionais ---------------------

const MatchInput = z.object({
  cpfs: z.array(z.string()).default([]),
  matriculas: z.array(z.string()).default([]),
});

export const matchProfissionaisImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MatchInput.parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.importar");
    const { supabase } = context;
    const cpfs = Array.from(new Set(data.cpfs.filter(Boolean)));
    const mats = Array.from(new Set(data.matriculas.filter(Boolean)));

    const byCpf: Record<string, string> = {};
    const byMatricula: Record<string, string> = {};

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
    return { byCpf, byMatricula };
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

export const commitImportPiso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CommitInput.parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.importar");
    const { supabase, userId } = context;

    let importados = 0, divergentes = 0, naoLocalizados = 0;
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
      const rows = data.linhas.map((l) => ({
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
      }));

      // Batches de 500 para evitar payload muito grande
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await supabase.from("piso_enfermagem").insert(chunk);
        if (error) throw new Error(error.message);
      }
    }

    return { historico_id: hist.id, stats: { total: data.linhas.length, importados, divergentes, naoLocalizados } };
  });

// --------------------- Listagens ---------------------

export const listHistoricoImportacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ page: z.number().default(1), pageSize: z.number().default(25) }).parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.visualizar");
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const { data: rows, count, error } = await context.supabase
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
    if (!hist) return { historico: null, linhas: [] as Record<string, unknown>[] };
    const { data: linhas, error: lerr } = await context.supabase
      .from("piso_enfermagem")
      .select("*")
      .eq("historico_id", data.id)
      .order("nome", { ascending: true });
    if (lerr) throw new Error(lerr.message);
    return { historico: hist, linhas: (linhas ?? []) as Record<string, unknown>[] };
  });

// --------------------- Mapeamentos salvos ---------------------

export const saveMapeamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      nome: z.string().min(1).max(120),
      modelo: MODELO,
      mapeamento: z.record(z.string(), z.string().nullable()),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.importar");
    const { error } = await context.supabase
      .from("piso_mapeamentos_salvos")
      .upsert(
        { nome: data.nome, modelo: data.modelo, mapeamento: data.mapeamento, criado_por: context.userId },
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