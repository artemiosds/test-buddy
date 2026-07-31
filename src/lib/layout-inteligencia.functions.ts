// =============================================================================
// CATÁLOGO INTELIGENTE DE LAYOUTS — camada de servidor.
//
// Aditivo ao motor: aprendizado por confirmação, histórico e score de
// sinônimos, sugestão por IA, estatísticas, classificação da biblioteca e
// exportação/importação de layouts em JSON.
//
// Não altera o motor de importação nem a detecção automática.
// =============================================================================

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensurePermission } from "./authz.server";
import { normalizarTexto } from "./layout-engine";
import { CLASSIFICACOES, PACOTE_VERSAO, pesoSugeridoAlias } from "./layout-inteligencia";
import { CATALOGO_CAMPOS } from "./layout-campos-catalogo";

const PERM_CONFIG = "configuracao.editar";

/** Confirmações independentes necessárias para promover um sinônimo. */
export const LIMIAR_CONFIRMACOES = 3;

function normAlias(s: string): string {
  return normalizarTexto(s).replace(/\s+/g, " ").trim();
}

// -----------------------------------------------------------------------------
// 1) Aprendizado por confirmação
// -----------------------------------------------------------------------------

export const registrarConfirmacaoAlias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        modulo: z.string().trim().max(40).default("geral"),
        campo_interno: z.string().trim().min(1).max(80),
        alias: z.string().trim().min(1).max(160),
        origem: z.enum(["manual", "ia"]).default("manual"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const alias_norm = normAlias(data.alias);
    if (!alias_norm) throw new Error("Cabeçalho inválido.");

    // já é sinônimo oficial do catálogo do módulo?
    const { data: jaOficial } = await supabase
      .from("import_campo_aliases")
      .select("id")
      .eq("modulo", data.modulo)
      .eq("campo_interno", data.campo_interno)
      .eq("ativo", true)
      .limit(200);
    // (comparação por normalização é feita no cliente do banco abaixo)

    const { data: existente, error } = await supabase
      .from("import_alias_sugestoes")
      .select("id, confirmacoes, usuarios, status")
      .eq("modulo", data.modulo)
      .eq("campo_interno", data.campo_interno)
      .eq("alias_norm", alias_norm)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!existente) {
      const { error: e2 } = await supabase.from("import_alias_sugestoes").insert({
        modulo: data.modulo,
        campo_interno: data.campo_interno,
        alias: data.alias.trim(),
        alias_norm,
        confirmacoes: 1,
        usuarios: [context.userId],
        origem: data.origem,
        criado_por: context.userId,
      });
      if (e2) throw new Error(e2.message);
      return {
        confirmacoes: 1,
        limiar: LIMIAR_CONFIRMACOES,
        promover: false,
        jaOficial: (jaOficial ?? []).length > 0 ? false : false,
      };
    }

    const usuarios: string[] = existente.usuarios ?? [];
    const novoUsuario = !usuarios.includes(context.userId);
    const confirmacoes = existente.confirmacoes + (novoUsuario ? 1 : 0);

    if (novoUsuario) {
      const { error: e3 } = await supabase
        .from("import_alias_sugestoes")
        .update({ confirmacoes, usuarios: [...usuarios, context.userId] })
        .eq("id", existente.id);
      if (e3) throw new Error(e3.message);
    }

    return {
      confirmacoes,
      limiar: LIMIAR_CONFIRMACOES,
      promover: confirmacoes >= LIMIAR_CONFIRMACOES && existente.status === "pendente",
      jaOficial: false,
    };
  });

/** Lista as sugestões pendentes/promovidas (painel administrativo). */
export const listSugestoesAlias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { modulo?: string | null } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    let q = supabase
      .from("import_alias_sugestoes")
      .select("*")
      .order("confirmacoes", { ascending: false })
      .limit(400);
    if (data.modulo) q = q.eq("modulo", data.modulo);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { sugestoes: rows ?? [] };
  });

export const resolverSugestaoAlias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["aceita", "rejeitada", "pendente"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ensurePermission(supabase, context.userId, PERM_CONFIG);
    const { error } = await supabase
      .from("import_alias_sugestoes")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -----------------------------------------------------------------------------
// 3) Histórico e manutenção dos sinônimos
// -----------------------------------------------------------------------------

export const listHistoricoAliases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { modulo?: string | null } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    let q = supabase
      .from("import_campo_aliases")
      .select("*")
      .order("campo_interno")
      .limit(1000);
    if (data.modulo) q = q.eq("modulo", data.modulo);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = Array.from(
      new Set((rows ?? []).map((r: any) => r.criado_por).filter(Boolean)),
    ) as string[];
    const nomes = new Map<string, string>();
    if (ids.length) {
      const { data: us } = await supabase
        .from("usuarios")
        .select("id, nome_completo")
        .in("id", ids);
      for (const u of us ?? []) nomes.set(u.id, u.nome_completo);
    }

    return {
      aliases: (rows ?? []).map((r: any) => ({
        ...r,
        peso: r.peso ?? pesoSugeridoAlias(r.campo_interno, r.alias),
        criado_por_nome: r.criado_por ? (nomes.get(r.criado_por) ?? "—") : "Sistema",
      })),
    };
  });

export const atualizarAliasCatalogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        peso: z.number().int().min(0).max(100).optional(),
        ativo: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ensurePermission(supabase, context.userId, PERM_CONFIG);
    const patch: Record<string, unknown> = {};
    if (data.peso !== undefined) patch.peso = data.peso;
    if (data.ativo !== undefined) patch.ativo = data.ativo;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase.from("import_campo_aliases").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Contabiliza a utilização real dos sinônimos após uma importação. */
export const registrarUsoAliases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        modulo: z.string().trim().max(40).default("geral"),
        pares: z
          .array(z.object({ campo_interno: z.string().max(80), alias: z.string().max(160) }))
          .max(200)
          .default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    if (data.pares.length === 0) return { ok: true, atualizados: 0 };

    const { data: rows, error } = await supabase
      .from("import_campo_aliases")
      .select("id, campo_interno, alias, usos")
      .eq("modulo", data.modulo)
      .in(
        "campo_interno",
        Array.from(new Set(data.pares.map((p) => p.campo_interno))),
      );
    if (error) throw new Error(error.message);

    let atualizados = 0;
    for (const p of data.pares) {
      const alvo = (rows ?? []).find(
        (r: any) => r.campo_interno === p.campo_interno && normAlias(r.alias) === normAlias(p.alias),
      );
      if (!alvo) continue;
      await supabase
        .from("import_campo_aliases")
        .update({ usos: (alvo.usos ?? 0) + 1, ultimo_uso: new Date().toISOString() })
        .eq("id", alvo.id);
      atualizados += 1;
    }
    return { ok: true, atualizados };
  });

// -----------------------------------------------------------------------------
// 4) Sugestão de campo por IA (apenas sugere; quem confirma é o usuário)
// -----------------------------------------------------------------------------

export const sugerirCamposIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        headers: z.array(z.string().trim().max(160)).min(1).max(60),
        modulo: z.string().trim().max(40).default("geral"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { sugestoes: [] as { header: string; campo: string; confianca: number }[], erro: "IA não configurada." };

    const catalogo = CATALOGO_CAMPOS.map((c) => `${c.key} = ${c.label} (${c.grupo})`).join("\n");
    const prompt = [
      "Você mapeia cabeçalhos de planilhas de folha de pagamento para campos internos de um sistema.",
      "Responda APENAS com JSON no formato {\"sugestoes\":[{\"header\":\"...\",\"campo\":\"chave_do_catalogo\",\"confianca\":0-100}]}.",
      "Use somente chaves existentes no catálogo. Se não houver correspondência clara, omita o cabeçalho.",
      "",
      "CATÁLOGO:",
      catalogo,
      "",
      "CABEÇALHOS:",
      data.headers.join(" | "),
    ].join("\n");

    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
        body: JSON.stringify({
          model: "openai/gpt-5.6-luna",
          reasoning_effort: "none",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (resp.status === 429) return { sugestoes: [], erro: "Limite de uso da IA atingido. Tente novamente em instantes." };
      if (resp.status === 402) return { sugestoes: [], erro: "Créditos de IA esgotados." };
      if (!resp.ok) return { sugestoes: [], erro: `Falha na IA [${resp.status}].` };

      const json = (await resp.json()) as any;
      const texto: string = json?.choices?.[0]?.message?.content ?? "";
      const bruto = texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1);
      const parsed = JSON.parse(bruto || "{}");
      const validos = new Set(CATALOGO_CAMPOS.map((c) => c.key));
      const sugestoes = (Array.isArray(parsed?.sugestoes) ? parsed.sugestoes : [])
        .filter((s: any) => typeof s?.header === "string" && validos.has(s?.campo))
        .slice(0, 60)
        .map((s: any) => ({
          header: String(s.header),
          campo: String(s.campo),
          confianca: Math.max(0, Math.min(100, Number(s.confianca) || 0)),
        }));
      return { sugestoes, erro: null as string | null };
    } catch (e) {
      return { sugestoes: [], erro: e instanceof Error ? e.message : "Falha ao consultar a IA." };
    }
  });

// -----------------------------------------------------------------------------
// 5) Estatísticas do motor
// -----------------------------------------------------------------------------

export const estatisticasLayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { modulo?: string | null } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const filtroModulo = data.modulo ?? null;

    let qL = supabase.from("import_layouts").select("id, codigo, nome, modulo, ativo, classificacao");
    if (filtroModulo) qL = qL.eq("modulo", filtroModulo);
    const { data: layouts, error } = await qL;
    if (error) throw new Error(error.message);
    const ids = (layouts ?? []).map((l: any) => l.id);

    const { data: versoes } = ids.length
      ? await supabase.from("import_layout_versoes").select("id, layout_id").in("layout_id", ids)
      : { data: [] as any[] };
    const vIds = (versoes ?? []).map((v: any) => v.id);

    const { data: campos } = vIds.length
      ? await supabase
          .from("import_layout_campos")
          .select("versao_id, campo_interno, aliases, obrigatorio, condicional")
          .in("versao_id", vIds)
      : { data: [] as any[] };

    let qA = supabase.from("import_campo_aliases").select("campo_interno, origem, ativo, usos");
    if (filtroModulo) qA = qA.eq("modulo", filtroModulo);
    const { data: aliases } = await qA;

    let qU = supabase
      .from("import_layout_uso")
      .select("layout_id, layout_codigo, created_at, detalhes, nome_arquivo, competencia, total_linhas")
      .order("created_at", { ascending: false })
      .limit(500);
    if (filtroModulo) qU = qU.eq("modulo", filtroModulo);
    const { data: usos } = await qU;

    let qS = supabase.from("import_alias_sugestoes").select("campo_interno, confirmacoes, status");
    if (filtroModulo) qS = qS.eq("modulo", filtroModulo);
    const { data: sugestoes } = await qS;

    const pct = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const recs = (usos ?? [])
      .map((u: any) => pct(u.detalhes?.reconhecimento_pct))
      .filter((n: number | null): n is number => n !== null);
    const manuais = (usos ?? [])
      .map((u: any) => pct(u.detalhes?.mapeamento_manual_pct))
      .filter((n: number | null): n is number => n !== null);

    const porLayout = new Map<string, { codigo: string; usos: number }>();
    for (const u of usos ?? []) {
      const k = u.layout_codigo ?? u.layout_id ?? "—";
      porLayout.set(k, { codigo: k, usos: (porLayout.get(k)?.usos ?? 0) + 1 });
    }

    const dificeis = new Map<string, number>();
    for (const s of sugestoes ?? [])
      dificeis.set(s.campo_interno, (dificeis.get(s.campo_interno) ?? 0) + (s.confirmacoes ?? 1));

    const totalAliasesCampos = (campos ?? []).reduce(
      (acc: number, c: any) => acc + (c.aliases?.length ?? 0),
      0,
    );

    return {
      layouts: (layouts ?? []).length,
      layouts_ativos: (layouts ?? []).filter((l: any) => l.ativo).length,
      por_classificacao: (layouts ?? []).reduce((acc: Record<string, number>, l: any) => {
        const k = l.classificacao ?? "experimental";
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {}),
      versoes: (versoes ?? []).length,
      campos: (campos ?? []).length,
      campos_condicionais: (campos ?? []).filter((c: any) => c.condicional).length,
      aliases_layout: totalAliasesCampos,
      aliases_catalogo: (aliases ?? []).length,
      aliases_aprendidos: (aliases ?? []).filter((a: any) => a.origem !== "catalogo").length,
      aliases_inativos: (aliases ?? []).filter((a: any) => a.ativo === false).length,
      sugestoes_pendentes: (sugestoes ?? []).filter((s: any) => s.status === "pendente").length,
      importacoes: (usos ?? []).length,
      taxa_reconhecimento:
        recs.length > 0 ? Math.round(recs.reduce((a: number, b: number) => a + b, 0) / recs.length) : null,
      taxa_manual:
        manuais.length > 0
          ? Math.round(manuais.reduce((a: number, b: number) => a + b, 0) / manuais.length)
          : null,
      mais_utilizados: Array.from(porLayout.values())
        .sort((a, b) => b.usos - a.usos)
        .slice(0, 10),
      ultimos_usos: (usos ?? []).slice(0, 10).map((u: any) => ({
        layout: u.layout_codigo ?? "—",
        arquivo: u.nome_arquivo ?? "—",
        competencia: u.competencia ?? "—",
        linhas: u.total_linhas ?? 0,
        data: u.created_at,
      })),
      campos_dificeis: Array.from(dificeis.entries())
        .map(([campo, qtd]) => ({ campo, qtd }))
        .sort((a, b) => b.qtd - a.qtd)
        .slice(0, 10),
    };
  });

// -----------------------------------------------------------------------------
// 9) Classificação da biblioteca
// -----------------------------------------------------------------------------

export const definirClassificacaoLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ layout_id: z.string().uuid(), classificacao: z.enum(CLASSIFICACOES) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ensurePermission(supabase, context.userId, PERM_CONFIG);
    const { error } = await supabase
      .from("import_layouts")
      .update({ classificacao: data.classificacao })
      .eq("id", data.layout_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -----------------------------------------------------------------------------
// 10) Biblioteca compartilhada — exportar / importar
// -----------------------------------------------------------------------------

export const exportarLayout = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { layout_id: string; versao_id?: string | null }) =>
    z
      .object({ layout_id: z.string().uuid(), versao_id: z.string().uuid().nullable().optional() })
      .parse(d),
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

    const { data: versoes } = await supabase
      .from("import_layout_versoes")
      .select("*")
      .eq("layout_id", layout.id)
      .order("versao", { ascending: false });
    const alvo = data.versao_id
      ? (versoes ?? []).find((v: any) => v.id === data.versao_id)
      : (versoes ?? [])[0];
    if (!alvo) throw new Error("Este layout ainda não possui versões.");

    const { data: campos } = await supabase
      .from("import_layout_campos")
      .select("*")
      .eq("versao_id", alvo.id)
      .order("ordem");

    return {
      pacote: "layout-importacao" as const,
      versao_pacote: PACOTE_VERSAO,
      exportado_em: new Date().toISOString(),
      layout: {
        codigo: layout.codigo,
        nome: layout.nome,
        descricao: layout.descricao ?? null,
        tipo: layout.tipo,
        modulo: layout.modulo,
        classificacao: layout.classificacao ?? "experimental",
      },
      versao: {
        versao: alvo.versao,
        notas: alvo.notas ?? null,
        arquivo_hints: alvo.arquivo_hints ?? [],
        header_hints: alvo.header_hints ?? [],
        regras: alvo.regras ?? {},
        config: alvo.config ?? {},
      },
      campos: (campos ?? []).map((c: any) => ({
        campo_interno: c.campo_interno,
        label: c.label ?? null,
        coluna_padrao: c.coluna_padrao ?? null,
        aliases: c.aliases ?? [],
        obrigatorio: !!c.obrigatorio,
        condicional: !!c.condicional,
        ignorado: !!c.ignorado,
        tipo_dado: c.tipo_dado ?? "texto",
        pesos: c.pesos ?? {},
        ordem: c.ordem ?? 0,
      })),
    };
  });

const pacoteSchema = z.object({
  pacote: z.literal("layout-importacao"),
  versao_pacote: z.number().int().min(1).max(PACOTE_VERSAO),
  layout: z.object({
    codigo: z.string().trim().min(2).max(60),
    nome: z.string().trim().min(2).max(120),
    descricao: z.string().trim().max(500).nullable().optional(),
    tipo: z.string().trim().max(40).default("planilha"),
    modulo: z.string().trim().max(40).default("geral"),
    classificacao: z.enum(CLASSIFICACOES).default("experimental"),
  }),
  versao: z.object({
    versao: z.number().int().min(1).optional(),
    notas: z.string().trim().max(500).nullable().optional(),
    arquivo_hints: z.array(z.string().trim().max(60)).max(20).default([]),
    header_hints: z.array(z.string().trim().max(60)).max(40).default([]),
    regras: z.record(z.string(), z.unknown()).default({}),
    config: z.record(z.string(), z.unknown()).default({}),
  }),
  campos: z
    .array(
      z.object({
        campo_interno: z.string().trim().min(1).max(80),
        label: z.string().trim().max(120).nullable().optional(),
        coluna_padrao: z.string().trim().max(160).nullable().optional(),
        aliases: z.array(z.string().trim().max(160)).max(80).default([]),
        obrigatorio: z.boolean().default(false),
        condicional: z.boolean().default(false),
        ignorado: z.boolean().default(false),
        tipo_dado: z.string().trim().max(30).default("texto"),
        pesos: z.record(z.string(), z.number()).default({}),
        ordem: z.number().int().min(0).default(0),
      }),
    )
    .max(300)
    .default([]),
});

/** Importa um pacote JSON como NOVO layout (nunca sobrescreve o histórico). */
export const importarLayoutPacote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        pacote: pacoteSchema,
        codigo: z.string().trim().min(2).max(60).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ensurePermission(supabase, context.userId, PERM_CONFIG);
    const p = data.pacote;

    let codigo = (data.codigo ?? p.layout.codigo).trim();
    const { data: existe } = await supabase
      .from("import_layouts")
      .select("id")
      .eq("codigo", codigo)
      .maybeSingle();
    if (existe) codigo = `${codigo}-imp-${Date.now().toString().slice(-5)}`;

    const { data: layout, error } = await supabase
      .from("import_layouts")
      .insert({
        codigo,
        nome: p.layout.nome,
        descricao: p.layout.descricao ?? null,
        tipo: p.layout.tipo,
        modulo: p.layout.modulo,
        classificacao: p.layout.classificacao,
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
        notas: p.versao.notas ?? `Importado de pacote (v${p.versao.versao ?? 1}).`,
        arquivo_hints: p.versao.arquivo_hints,
        header_hints: p.versao.header_hints,
        regras: p.versao.regras,
        config: p.versao.config,
        criado_por: context.userId,
      })
      .select("id")
      .single();
    if (e2) throw new Error(e2.message);

    if (p.campos.length) {
      const { error: e3 } = await supabase.from("import_layout_campos").insert(
        p.campos.map((c, i) => ({
          versao_id: versao.id,
          campo_interno: c.campo_interno,
          label: c.label ?? null,
          coluna_padrao: c.coluna_padrao ?? null,
          aliases: c.aliases,
          obrigatorio: c.obrigatorio,
          condicional: c.condicional,
          ignorado: c.ignorado,
          tipo_dado: c.tipo_dado,
          pesos: c.pesos,
          ordem: c.ordem ?? i,
        })),
      );
      if (e3) throw new Error(e3.message);
    }

    return { layout_id: layout.id, codigo };
  });
