// =============================================================================
// MOTOR DE LAYOUTS — camada de servidor (configuração em banco, nunca em código).
// Reutilizável por qualquer módulo: Piso, BPA, CNES, Produção, Escalas, etc.
// Segurança: requireSupabaseAuth + ensurePermission (nenhuma permissão nova).
// =============================================================================

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensurePermission } from "./authz.server";
import type { LayoutCampo, LayoutVersaoResolvida } from "./layout-engine";

const PERM_CONFIG = "configuracao.editar";

const campoSchema = z.object({
  campo_interno: z.string().trim().min(1).max(80),
  label: z.string().trim().max(120).nullable().optional(),
  coluna_padrao: z.string().trim().max(160).nullable().optional(),
  aliases: z.array(z.string().trim().max(160)).max(50).default([]),
  obrigatorio: z.boolean().default(false),
  ignorado: z.boolean().default(false),
  tipo_dado: z.string().trim().max(30).default("texto"),
  ordem: z.number().int().min(0).default(0),
});

type CampoInput = z.infer<typeof campoSchema>;

function mapCampos(rows: any[]): LayoutCampo[] {
  return (rows ?? []).map((c) => ({
    campo_interno: c.campo_interno,
    label: c.label ?? null,
    coluna_padrao: c.coluna_padrao ?? null,
    aliases: c.aliases ?? [],
    obrigatorio: !!c.obrigatorio,
    ignorado: !!c.ignorado,
    tipo_dado: c.tipo_dado ?? "texto",
    ordem: c.ordem ?? 0,
  }));
}

// -----------------------------------------------------------------------------
// Consulta
// -----------------------------------------------------------------------------

export const listLayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { modulo?: string | null; incluirInativos?: boolean } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    let q = supabase
      .from("import_layouts")
      .select("id, codigo, nome, descricao, tipo, modulo, ativo, versao_atual, created_at, updated_at")
      .order("nome");
    if (data.modulo) q = q.eq("modulo", data.modulo);
    if (!data.incluirInativos) q = q.eq("ativo", true);
    const { data: layouts, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (layouts ?? []).map((l: any) => l.id);
    if (ids.length === 0) return { layouts: [] as any[] };

    const { data: versoes, error: e2 } = await supabase
      .from("import_layout_versoes")
      .select("id, layout_id, versao, situacao, created_at")
      .in("layout_id", ids);
    if (e2) throw new Error(e2.message);

    const versaoIds = (versoes ?? []).map((v: any) => v.id);
    const { data: campos, error: e3 } = versaoIds.length
      ? await supabase.from("import_layout_campos").select("versao_id").in("versao_id", versaoIds)
      : { data: [], error: null };
    if (e3) throw new Error(e3.message);

    const porVersao = new Map<string, number>();
    for (const c of campos ?? [])
      porVersao.set(c.versao_id, (porVersao.get(c.versao_id) ?? 0) + 1);

    return {
      layouts: (layouts ?? []).map((l: any) => {
        const vs = (versoes ?? []).filter((v: any) => v.layout_id === l.id);
        const atual = vs.sort((a: any, b: any) => b.versao - a.versao)[0] ?? null;
        return {
          ...l,
          versoes: vs.length,
          versao_atual_id: atual?.id ?? null,
          qtd_campos: atual ? (porVersao.get(atual.id) ?? 0) : 0,
        };
      }),
    };
  });

/** Versões ativas resolvidas (layout + campos) — insumo do motor de detecção. */
export const listVersoesAtivas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { modulo?: string | null } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    let q = supabase
      .from("import_layouts")
      .select("id, codigo, nome, tipo, modulo, ativo")
      .eq("ativo", true);
    if (data.modulo) q = q.eq("modulo", data.modulo);
    const { data: layouts, error } = await q;
    if (error) throw new Error(error.message);
    const ids = (layouts ?? []).map((l: any) => l.id);
    if (ids.length === 0) return { versoes: [] as LayoutVersaoResolvida[] };

    const { data: versoes, error: e2 } = await supabase
      .from("import_layout_versoes")
      .select("id, layout_id, versao, situacao, arquivo_hints, header_hints, config")
      .in("layout_id", ids)
      .eq("situacao", "ativa")
      .order("versao", { ascending: false });
    if (e2) throw new Error(e2.message);

    // mantém apenas a maior versão ativa de cada layout
    const maisRecente = new Map<string, any>();
    for (const v of versoes ?? []) if (!maisRecente.has(v.layout_id)) maisRecente.set(v.layout_id, v);
    const vIds = Array.from(maisRecente.values()).map((v) => v.id);
    if (vIds.length === 0) return { versoes: [] as LayoutVersaoResolvida[] };

    const { data: campos, error: e3 } = await supabase
      .from("import_layout_campos")
      .select("*")
      .in("versao_id", vIds)
      .order("ordem");
    if (e3) throw new Error(e3.message);

    const out: LayoutVersaoResolvida[] = [];
    for (const l of layouts ?? []) {
      const v = maisRecente.get(l.id);
      if (!v) continue;
      out.push({
        layout_id: l.id,
        layout_codigo: l.codigo,
        layout_nome: l.nome,
        modulo: l.modulo,
        tipo: l.tipo,
        ativo: l.ativo,
        versao_id: v.id,
        versao: v.versao,
        situacao: v.situacao,
        arquivo_hints: v.arquivo_hints ?? [],
        header_hints: v.header_hints ?? [],
        config: v.config ?? {},
        campos: mapCampos((campos ?? []).filter((c: any) => c.versao_id === v.id)),
      });
    }
    return { versoes: out };
  });

export const getLayout = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { layout_id: string; versao_id?: string | null }) =>
    z.object({ layout_id: z.string().uuid(), versao_id: z.string().uuid().nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const { data: layout, error } = await supabase
      .from("import_layouts")
      .select("*")
      .eq("id", data.layout_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!layout) throw new Error("Layout não encontrado.");

    const { data: versoes, error: e2 } = await supabase
      .from("import_layout_versoes")
      .select("*")
      .eq("layout_id", layout.id)
      .order("versao", { ascending: false });
    if (e2) throw new Error(e2.message);

    const alvo = data.versao_id
      ? (versoes ?? []).find((v: any) => v.id === data.versao_id)
      : (versoes ?? [])[0];
    const { data: campos, error: e3 } = alvo
      ? await supabase.from("import_layout_campos").select("*").eq("versao_id", alvo.id).order("ordem")
      : { data: [], error: null };
    if (e3) throw new Error(e3.message);

    return { layout, versoes: versoes ?? [], versao: alvo ?? null, campos: mapCampos(campos ?? []) };
  });

// -----------------------------------------------------------------------------
// Escrita — sempre versionada (nunca sobrescreve versão existente)
// -----------------------------------------------------------------------------

async function inserirCampos(supabase: any, versao_id: string, campos: CampoInput[]) {
  if (campos.length === 0) return;
  const rows = campos.map((c, i) => ({
    versao_id,
    campo_interno: c.campo_interno,
    label: c.label ?? null,
    coluna_padrao: c.coluna_padrao ?? null,
    aliases: c.aliases ?? [],
    obrigatorio: c.obrigatorio,
    ignorado: c.ignorado,
    tipo_dado: c.tipo_dado,
    ordem: c.ordem ?? i,
  }));
  const { error } = await supabase.from("import_layout_campos").insert(rows);
  if (error) throw new Error(error.message);
}

export const criarLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        codigo: z.string().trim().min(2).max(60),
        nome: z.string().trim().min(2).max(120),
        descricao: z.string().trim().max(500).nullable().optional(),
        tipo: z.string().trim().max(40).default("planilha"),
        modulo: z.string().trim().max(40).default("geral"),
        arquivo_hints: z.array(z.string().trim().max(60)).max(20).default([]),
        header_hints: z.array(z.string().trim().max(60)).max(40).default([]),
        notas: z.string().trim().max(500).nullable().optional(),
        campos: z.array(campoSchema).max(200).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ensurePermission(supabase, context.userId, PERM_CONFIG);

    const { data: layout, error } = await supabase
      .from("import_layouts")
      .insert({
        codigo: data.codigo,
        nome: data.nome,
        descricao: data.descricao ?? null,
        tipo: data.tipo,
        modulo: data.modulo,
        versao_atual: 1,
        criado_por: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { data: versao, error: e2 } = await supabase
      .from("import_layout_versoes")
      .insert({
        layout_id: layout.id,
        versao: 1,
        situacao: "ativa",
        notas: data.notas ?? null,
        arquivo_hints: data.arquivo_hints,
        header_hints: data.header_hints,
        criado_por: context.userId,
      })
      .select("id")
      .single();
    if (e2) throw new Error(e2.message);

    await inserirCampos(supabase, versao.id, data.campos);
    return { layout_id: layout.id, versao_id: versao.id, versao: 1 };
  });

/** Salvar alterações = criar SEMPRE uma nova versão (imutabilidade histórica). */
export const criarNovaVersao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        layout_id: z.string().uuid(),
        arquivo_hints: z.array(z.string().trim().max(60)).max(20).default([]),
        header_hints: z.array(z.string().trim().max(60)).max(40).default([]),
        notas: z.string().trim().max(500).nullable().optional(),
        campos: z.array(campoSchema).max(200).default([]),
        nome: z.string().trim().min(2).max(120).optional(),
        descricao: z.string().trim().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ensurePermission(supabase, context.userId, PERM_CONFIG);

    const { data: ult, error } = await supabase
      .from("import_layout_versoes")
      .select("versao")
      .eq("layout_id", data.layout_id)
      .order("versao", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const proxima = ((ult ?? [])[0]?.versao ?? 0) + 1;

    // versões anteriores viram histórico (importações antigas continuam ligadas a elas)
    const { error: eArq } = await supabase
      .from("import_layout_versoes")
      .update({ situacao: "historica" })
      .eq("layout_id", data.layout_id)
      .eq("situacao", "ativa");
    if (eArq) throw new Error(eArq.message);

    const { data: versao, error: e2 } = await supabase
      .from("import_layout_versoes")
      .insert({
        layout_id: data.layout_id,
        versao: proxima,
        situacao: "ativa",
        notas: data.notas ?? null,
        arquivo_hints: data.arquivo_hints,
        header_hints: data.header_hints,
        criado_por: context.userId,
      })
      .select("id")
      .single();
    if (e2) throw new Error(e2.message);

    await inserirCampos(supabase, versao.id, data.campos);

    const patch: Record<string, unknown> = { versao_atual: proxima };
    if (data.nome) patch.nome = data.nome;
    if (data.descricao !== undefined) patch.descricao = data.descricao;
    const { error: e3 } = await supabase.from("import_layouts").update(patch).eq("id", data.layout_id);
    if (e3) throw new Error(e3.message);

    return { versao_id: versao.id, versao: proxima };
  });

export const duplicarLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        layout_id: z.string().uuid(),
        codigo: z.string().trim().min(2).max(60),
        nome: z.string().trim().min(2).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ensurePermission(supabase, context.userId, PERM_CONFIG);

    const { data: origem, error } = await supabase
      .from("import_layouts")
      .select("descricao, tipo, modulo")
      .eq("id", data.layout_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!origem) throw new Error("Layout de origem não encontrado.");

    const { data: v, error: e2 } = await supabase
      .from("import_layout_versoes")
      .select("id, arquivo_hints, header_hints")
      .eq("layout_id", data.layout_id)
      .order("versao", { ascending: false })
      .limit(1);
    if (e2) throw new Error(e2.message);
    const origemVersao = (v ?? [])[0];

    const { data: campos, error: e3} = origemVersao
      ? await supabase.from("import_layout_campos").select("*").eq("versao_id", origemVersao.id).order("ordem")
      : { data: [], error: null };
    if (e3) throw new Error(e3.message);

    const { data: novo, error: e4 } = await supabase
      .from("import_layouts")
      .insert({
        codigo: data.codigo,
        nome: data.nome,
        descricao: origem.descricao,
        tipo: origem.tipo,
        modulo: origem.modulo,
        criado_por: context.userId,
      })
      .select("id")
      .single();
    if (e4) throw new Error(e4.message);

    const { data: novaVersao, error: e5 } = await supabase
      .from("import_layout_versoes")
      .insert({
        layout_id: novo.id,
        versao: 1,
        situacao: "ativa",
        arquivo_hints: origemVersao?.arquivo_hints ?? [],
        header_hints: origemVersao?.header_hints ?? [],
        criado_por: context.userId,
      })
      .select("id")
      .single();
    if (e5) throw new Error(e5.message);

    await inserirCampos(supabase, novaVersao.id, mapCampos(campos ?? []) as CampoInput[]);
    return { layout_id: novo.id };
  });

export const alterarSituacaoLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ layout_id: z.string().uuid(), ativo: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ensurePermission(supabase, context.userId, PERM_CONFIG);
    const { error } = await supabase
      .from("import_layouts")
      .update({ ativo: data.ativo })
      .eq("id", data.layout_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -----------------------------------------------------------------------------
// Catálogo global de sinônimos
// -----------------------------------------------------------------------------

export const listAliasesCatalogo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { modulo?: string | null } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    let q = supabase.from("import_campo_aliases").select("*").order("campo_interno");
    if (data.modulo) q = q.eq("modulo", data.modulo);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { aliases: rows ?? [] };
  });

export const salvarAliasCatalogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        modulo: z.string().trim().max(40).default("geral"),
        campo_interno: z.string().trim().min(1).max(80),
        alias: z.string().trim().min(1).max(160),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ensurePermission(supabase, context.userId, PERM_CONFIG);
    const { error } = await supabase
      .from("import_campo_aliases")
      .upsert({ ...data, criado_por: context.userId }, { onConflict: "modulo,campo_interno,alias" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removerAliasCatalogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ensurePermission(supabase, context.userId, PERM_CONFIG);
    const { error } = await supabase.from("import_campo_aliases").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -----------------------------------------------------------------------------
// Auditoria de utilização do motor
// -----------------------------------------------------------------------------

export const registrarUsoLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        layout_id: z.string().uuid().nullable().optional(),
        versao_id: z.string().uuid().nullable().optional(),
        layout_codigo: z.string().trim().max(60).nullable().optional(),
        versao: z.number().int().nullable().optional(),
        modulo: z.string().trim().max(40).default("geral"),
        historico_id: z.string().uuid().nullable().optional(),
        nome_arquivo: z.string().trim().max(255).nullable().optional(),
        competencia: z.string().trim().max(40).nullable().optional(),
        total_linhas: z.number().int().min(0).default(0),
        duracao_ms: z.number().int().min(0).nullable().optional(),
        detalhes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const { error } = await supabase.from("import_layout_uso").insert({
      layout_id: data.layout_id ?? null,
      versao_id: data.versao_id ?? null,
      layout_codigo: data.layout_codigo ?? null,
      versao: data.versao ?? null,
      modulo: data.modulo,
      historico_id: data.historico_id ?? null,
      usuario_id: context.userId,
      nome_arquivo: data.nome_arquivo ?? null,
      competencia: data.competencia ?? null,
      total_linhas: data.total_linhas,
      duracao_ms: data.duracao_ms ?? null,
      detalhes: data.detalhes,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listUsoLayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { layout_id?: string | null; limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    let q = supabase
      .from("import_layout_uso")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 100, 500));
    if (data.layout_id) q = q.eq("layout_id", data.layout_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { usos: rows ?? [] };
  });
