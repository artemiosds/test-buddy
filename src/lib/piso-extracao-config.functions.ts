/**
 * Configuração do Motor de Extração de PDF (módulo Piso da Enfermagem).
 *
 * A chave de API da IA nunca é devolvida ao navegador: o cliente recebe apenas
 * um indicador de "configurada" e os últimos 4 caracteres.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensurePermission } from "./authz.server";

export const MOTORES = ["automatico", "texto", "ocr_local", "ia_visao"] as const;
export type MotorExtracao = (typeof MOTORES)[number];

export const FORNECEDORES = ["gemini", "lovable"] as const;
export type FornecedorIA = (typeof FORNECEDORES)[number];

export type ExtracaoConfigPublica = {
  motor: MotorExtracao;
  ia_fornecedor: FornecedorIA;
  ia_modelo: string;
  ia_habilitada: boolean;
  ocr_idioma: string;
  /** true quando existe chave salva (Gemini) ou quando o fornecedor é o gateway. */
  ia_configurada: boolean;
  chave_mascarada: string | null;
};

const PADRAO: ExtracaoConfigPublica = {
  motor: "automatico",
  ia_fornecedor: "gemini",
  ia_modelo: "gemini-3.6-flash",
  ia_habilitada: false,
  ocr_idioma: "por",
  ia_configurada: false,
  chave_mascarada: null,
};

type Linha = {
  motor: string;
  ia_fornecedor: string;
  ia_modelo: string;
  ia_api_key: string | null;
  ia_habilitada: boolean;
  ocr_idioma: string;
  tem_chave?: boolean;
  chave_final4?: string | null;
};

/** Leitura via RPC SECURITY DEFINER (não expõe a chave de API ao cliente). */
export async function lerConfigExtracao(supabase: {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
}): Promise<Linha> {
  const { data, error } = await supabase.rpc("piso_extracao_config_ler");
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Record<string, unknown>;
  if (!row.existe) {
    return {
      motor: PADRAO.motor,
      ia_fornecedor: PADRAO.ia_fornecedor,
      ia_modelo:
        process.env.PISO_FOPAG_MODELO_IA ?? process.env.LOVABLE_AI_MODEL ?? PADRAO.ia_modelo,
      ia_api_key: null,
      ia_habilitada: false,
      ocr_idioma: PADRAO.ocr_idioma,
    };
  }
  return {
    motor: String(row.motor ?? PADRAO.motor),
    ia_fornecedor: String(row.ia_fornecedor ?? PADRAO.ia_fornecedor),
    ia_modelo: String(row.ia_modelo ?? PADRAO.ia_modelo),
    ia_api_key: null,
    ia_habilitada: Boolean(row.ia_habilitada),
    ocr_idioma: String(row.ocr_idioma ?? PADRAO.ocr_idioma),
    tem_chave: Boolean(row.tem_chave),
    chave_final4: (row.chave_final4 as string | null) ?? null,
  };
}

/** Recupera a chave da IA (server-only, exige permissão de importação/config). */
export async function lerChaveIA(supabase: {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
}): Promise<string | null> {
  const { data, error } = await supabase.rpc("piso_extracao_ia_key");
  if (error) throw new Error(error.message);
  const key = typeof data === "string" ? data.trim() : "";
  return key || null;
}

function publica(row: Linha): ExtracaoConfigPublica {
  const final4 = row.chave_final4 ?? (row.ia_api_key ? row.ia_api_key.slice(-4) : null);
  const temChave =
    row.ia_fornecedor === "lovable"
      ? Boolean(process.env.LOVABLE_API_KEY)
      : Boolean(row.tem_chave ?? row.ia_api_key);
  return {
    motor: row.motor as MotorExtracao,
    ia_fornecedor: row.ia_fornecedor as FornecedorIA,
    ia_modelo: row.ia_modelo,
    ia_habilitada: row.ia_habilitada,
    ocr_idioma: row.ocr_idioma,
    ia_configurada: row.ia_habilitada && temChave,
    chave_mascarada: final4 ? `••••••••${final4}` : null,
  };
}

export const getExtracaoConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.visualizar");
    const cfg = publica(await lerConfigExtracao(context.supabase as never));

    // A IA de Visão também está disponível quando houver provedor ativo no
    // Gerenciador de Provedores de IA (arquitetura multi-provedor).
    if (!cfg.ia_configurada) {
      const { data } = await (
        context.supabase as unknown as {
          rpc: (fn: string) => Promise<{ data: unknown; error: unknown }>;
        }
      ).rpc("piso_ia_provedores_listar");
      const lista = ((data ?? {}) as { provedores?: { ativo?: boolean }[] }).provedores ?? [];
      if (lista.some((p) => p.ativo)) return { ...cfg, ia_configurada: true };
    }
    return cfg;
  });

export const salvarExtracaoConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        motor: z.enum(MOTORES),
        ia_fornecedor: z.enum(FORNECEDORES),
        ia_modelo: z.string().trim().min(1).max(120),
        ia_habilitada: z.boolean(),
        ocr_idioma: z.string().trim().min(2).max(20).default("por"),
        /** Enviar apenas quando o administrador digitar uma nova chave. */
        ia_api_key: z.string().trim().max(400).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "configuracao.editar");
    const { error } = await context.supabase.rpc(
      "piso_extracao_config_salvar" as never,
      {
        _motor: data.motor,
        _ia_fornecedor: data.ia_fornecedor,
        _ia_modelo: data.ia_modelo,
        _ia_habilitada: data.ia_habilitada,
        _ocr_idioma: data.ocr_idioma,
        _ia_api_key: data.ia_api_key ?? null,
        _atualizar_chave: data.ia_api_key !== undefined,
      } as never,
    );
    if (error) throw new Error(error.message);
    return publica(await lerConfigExtracao(context.supabase as never));
  });

/** Testa a conexão com o provedor de IA sem enviar documentos. */
export const testarConexaoIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ia_fornecedor: z.enum(FORNECEDORES),
        ia_modelo: z.string().trim().min(1),
        /** Chave digitada agora; se ausente usa a já salva. */
        ia_api_key: z.string().trim().max(400).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "configuracao.editar");
    const inicio = Date.now();

    if (data.ia_fornecedor === "lovable") {
      const key = process.env.LOVABLE_API_KEY;
      if (!key) return { ok: false, mensagem: "LOVABLE_API_KEY não configurada no ambiente." };
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
        body: JSON.stringify({
          model: data.ia_modelo,
          reasoning_effort: "none",
          messages: [{ role: "user", content: "ping" }],
        }),
      });
      const txt = resp.ok ? "" : (await resp.text()).slice(0, 200);
      return {
        ok: resp.ok,
        mensagem: resp.ok
          ? `Conexão bem-sucedida (${Date.now() - inicio} ms).`
          : `Falha [${resp.status}]: ${txt}`,
      };
    }

    let key = (data.ia_api_key || "").trim();
    if (!key) {
      key = (await lerChaveIA(context.supabase as never)) ?? "";
    }
    if (!key) return { ok: false, mensagem: "Informe a API Key do Gemini." };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      data.ia_modelo,
    )}:generateContent`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "ping" }] }] }),
    });
    if (resp.ok) return { ok: true, mensagem: `Conexão bem-sucedida (${Date.now() - inicio} ms).` };
    const detalhe = (await resp.text()).slice(0, 250);
    return { ok: false, mensagem: `Falha [${resp.status}]: ${detalhe}` };
  });
