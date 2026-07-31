// =============================================================================
// MODELOS DE PLANILHA — server functions.
//
// Guarda o arquivo .xlsx de referência (ex.: "UBS") para que os downloads das
// Importações saiam com a MESMA estrutura, colunas e fórmulas do modelo, em vez
// do gerador fixo antigo. Arquivo fino: só declarações de createServerFn.
// =============================================================================

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensurePermission } from "./authz.server";

const LIMITE_BASE64 = 8_000_000; // ~6 MB de arquivo

export const listarModelosPlanilha = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        modulo: z.string().trim().max(40).default("piso"),
        vinculo: z.string().trim().max(40).nullable().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    let q = supabase
      .from("planilha_modelos")
      .select(
        "id,nome,descricao,modulo,vinculo,unidade_id,nome_arquivo,aba,linha_cabecalho,colunas,colunas_estruturais,bytes,padrao,ativo,created_at",
      )
      .eq("ativo", true)
      .eq("modulo", data.modulo)
      .order("padrao", { ascending: false })
      .order("nome");
    if (data.vinculo) q = q.or(`vinculo.is.null,vinculo.eq.${data.vinculo}`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { modelos: rows ?? [] };
  });

export const obterModeloPlanilha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const { data: row, error } = await supabase
      .from("planilha_modelos")
      .select("id,nome,nome_arquivo,aba,linha_cabecalho,colunas,arquivo_base64")
      .eq("id", data.id)
      .eq("ativo", true)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const salvarModeloPlanilha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        nome: z.string().trim().min(2).max(120),
        descricao: z.string().trim().max(500).nullable().optional(),
        modulo: z.string().trim().max(40).default("piso"),
        vinculo: z.string().trim().max(40).nullable().optional(),
        unidade_id: z.string().uuid().nullable().optional(),
        nome_arquivo: z.string().trim().max(200).default(""),
        aba: z.string().trim().max(120).default(""),
        linha_cabecalho: z.number().int().min(1).max(200).default(1),
        colunas: z.array(z.string().max(200)).max(200).default([]),
        colunas_estruturais: z.array(z.string().max(200)).max(200).default([]),
        arquivo_base64: z.string().min(100).max(LIMITE_BASE64),
        padrao: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ensurePermission(supabase, context.userId, "configuracao.editar");

    if (data.padrao) {
      let q = supabase
        .from("planilha_modelos")
        .update({ padrao: false })
        .eq("modulo", data.modulo)
        .eq("padrao", true);
      q = data.vinculo ? q.eq("vinculo", data.vinculo) : q.is("vinculo", null);
      q = data.unidade_id ? q.eq("unidade_id", data.unidade_id) : q.is("unidade_id", null);
      const { error: eUp } = await q;
      if (eUp) throw new Error(eUp.message);
    }

    const { data: row, error } = await supabase
      .from("planilha_modelos")
      .insert({
        nome: data.nome,
        descricao: data.descricao ?? null,
        modulo: data.modulo,
        vinculo: data.vinculo ?? null,
        unidade_id: data.unidade_id ?? null,
        nome_arquivo: data.nome_arquivo,
        aba: data.aba,
        linha_cabecalho: data.linha_cabecalho,
        colunas: data.colunas,
        colunas_estruturais: data.colunas_estruturais,
        arquivo_base64: data.arquivo_base64,
        bytes: Math.round((data.arquivo_base64.length * 3) / 4),
        padrao: data.padrao,
        criado_por: context.userId,
      })
      .select("id,nome")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const definirModeloPadrao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ensurePermission(supabase, context.userId, "configuracao.editar");

    const { data: alvo, error: e0 } = await supabase
      .from("planilha_modelos")
      .select("id,modulo,vinculo,unidade_id")
      .eq("id", data.id)
      .single();
    if (e0) throw new Error(e0.message);

    let q = supabase
      .from("planilha_modelos")
      .update({ padrao: false })
      .eq("modulo", alvo.modulo)
      .eq("padrao", true);
    q = alvo.vinculo ? q.eq("vinculo", alvo.vinculo) : q.is("vinculo", null);
    q = alvo.unidade_id ? q.eq("unidade_id", alvo.unidade_id) : q.is("unidade_id", null);
    const { error: e1 } = await q;
    if (e1) throw new Error(e1.message);

    const { error: e2 } = await supabase
      .from("planilha_modelos")
      .update({ padrao: true })
      .eq("id", data.id);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

export const excluirModeloPlanilha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ensurePermission(supabase, context.userId, "configuracao.editar");
    const { error } = await supabase
      .from("planilha_modelos")
      .update({ ativo: false, padrao: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
