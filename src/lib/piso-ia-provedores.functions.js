/**
 * Gerenciador Universal de Provedores de IA — Server Functions.
 *
 * A chave de API nunca é devolvida ao navegador (apenas `tem_chave` e os 4
 * últimos caracteres). Toda persistência passa por RPCs SECURITY DEFINER.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensurePermission } from "./authz.server";
import { definicao, } from "./ai-providers/catalog";
/** Cadeia ordenada por prioridade (server-only: inclui chaves). */
export async function lerCadeiaProvedores(supabase) {
    const { data, error } = await supabase.rpc("piso_ia_cadeia");
    if (error)
        throw new Error(error.message);
    const j = (data ?? {});
    return {
        modo: j.modo === "manual" ? "manual" : "automatico",
        provedores: Array.isArray(j.provedores) ? j.provedores : [],
    };
}
export const listarProvedoresIA = createServerFn({ method: "GET" })
    .middleware([requireSupabaseAuth])
    .handler(async ({ context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.visualizar");
    const { data, error } = await context.supabase.rpc("piso_ia_provedores_listar");
    if (error)
        throw new Error(error.message);
    const j = (data ?? {});
    return {
        provedores: (j.provedores ?? []).sort((a, b) => a.prioridade - b.prioridade),
        config: j.config ?? { modo: "automatico", provedor_id: null },
        /** Sinaliza se há pelo menos um provedor pronto para uso. */
        disponivel: (j.provedores ?? []).some((p) => p.ativo),
    };
});
const ProvedorInput = z.object({
    id: z.string().uuid().nullable().optional(),
    tipo: z.string().min(2).max(40),
    nome: z.string().trim().min(1).max(80),
    modelo: z.string().trim().max(160).default(""),
    base_url: z.string().trim().max(400).nullable().optional(),
    timeout_ms: z.number().int().min(5000).max(600000).default(120000),
    tentativas: z.number().int().min(1).max(6).default(3),
    prioridade: z.number().int().min(1).max(999).default(100),
    ativo: z.boolean().default(true),
    extra: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
    /** Enviar somente quando o administrador digitar uma nova chave. */
    api_key: z.string().trim().max(600).nullable().optional(),
});
export const salvarProvedorIA = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((d) => ProvedorInput.parse(d))
    .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "configuracao.editar");
    const { data: id, error } = await context.supabase.rpc("piso_ia_provedor_salvar", {
        _id: data.id ?? null,
        _tipo: data.tipo,
        _nome: data.nome,
        _modelo: data.modelo,
        _base_url: data.base_url ?? definicao(data.tipo).baseUrlPadrao,
        _timeout_ms: data.timeout_ms,
        _tentativas: data.tentativas,
        _prioridade: data.prioridade,
        _ativo: data.ativo,
        _extra: data.extra,
        _api_key: data.api_key ?? null,
        _atualizar_chave: data.api_key !== undefined && data.api_key !== null,
    });
    if (error)
        throw new Error(error.message);
    return { id: id };
});
export const excluirProvedorIA = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
    .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "configuracao.editar");
    const { error } = await context.supabase.rpc("piso_ia_provedor_excluir", {
        _id: data.id,
    });
    if (error)
        throw new Error(error.message);
    return { ok: true };
});
export const ordenarProvedoresIA = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).max(50) }).parse(d))
    .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "configuracao.editar");
    const { error } = await context.supabase.rpc("piso_ia_provedores_ordenar", {
        _ids: data.ids,
    });
    if (error)
        throw new Error(error.message);
    return { ok: true };
});
export const salvarModoIA = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((d) => z
    .object({
    modo: z.enum(["automatico", "manual"]),
    provedor_id: z.string().uuid().nullable().optional(),
})
    .parse(d))
    .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "configuracao.editar");
    const { error } = await context.supabase.rpc("piso_ia_config_salvar", {
        _modo: data.modo,
        _provedor_id: data.provedor_id ?? null,
    });
    if (error)
        throw new Error(error.message);
    return { ok: true };
});
/** Testa a conexão de um provedor (salvo ou ainda em edição). */
export const testarProvedorIA = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((d) => z
    .object({
    id: z.string().uuid().nullable().optional(),
    tipo: z.string().min(2).max(40),
    nome: z.string().trim().min(1).max(80),
    modelo: z.string().trim().max(160),
    base_url: z.string().trim().max(400).nullable().optional(),
    timeout_ms: z.number().int().min(5000).max(600000).default(60000),
    tentativas: z.number().int().min(1).max(6).default(1),
    api_key: z.string().trim().max(600).nullable().optional(),
})
    .parse(d))
    .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "configuracao.editar");
    const { criarProvider } = await import("./ai-providers/runtime.server");
    let chave = (data.api_key || "").trim();
    if (!chave && data.id) {
        const { data: k } = await context.supabase.rpc("piso_ia_provedor_key", {
            _id: data.id,
        });
        chave = typeof k === "string" ? k.trim() : "";
    }
    const provider = criarProvider({
        id: data.id ?? "novo",
        tipo: data.tipo,
        nome: data.nome,
        modelo: data.modelo,
        base_url: data.base_url ?? null,
        api_key: chave || null,
        timeout_ms: data.timeout_ms,
        tentativas: 1,
        prioridade: 1,
        extra: {},
    });
    const r = await provider.testar();
    if (data.id) {
        await context.supabase
            .rpc("piso_ia_provedor_metrica", {
            _id: data.id,
            _ok: r.ok,
            _ms: r.ms,
            _status: r.status,
            _erro: r.ok ? null : r.mensagem,
            _confianca: null,
            _pdfs: 0,
        })
            .catch(() => undefined);
    }
    return r;
});
