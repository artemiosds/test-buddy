import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SignJWT, jwtVerify } from "jose";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Zod schema para validação de entrada de sistema
 * Mapeado para os campos reais existentes no banco e preparando para expansão
 */
const sistemaSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  descricao: z.string().optional(),
  url_base: z.string().url("URL Base inválida"),
  icone: z.string().default("Globe"),
  cor: z.string().default("#3b82f6"),
  ordem: z.number().default(0),
  status: z.string().default("Ativo"),
  tipo_autenticacao: z.string().default("JWT SSO"),
  endpoint_sso: z.string().optional(),
  endpoint_logout: z.string().optional(),
  endpoint_refresh: z.string().optional(),
  audience: z.string().optional(),
  issuer: z.string().optional(),
  token_exp_segundos: z.number().default(60),
  clock_skew_segundos: z.number().default(0),
  nonce: z.string().optional(),
  jti_enabled: z.boolean().default(true),
  ativo: z.boolean().default(true),
});

export const listarSistemas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const user = { id: context.userId, ...context.claims };
    const correlationId = crypto.randomUUID();
    
    if (!user) {
      throw new Response("Server Function não autenticada.", { status: 401 });
    }

    const { data: userContext, error: rpcError } = await supabaseAdmin.rpc("get_my_user_context");
    const profile = Array.isArray(userContext) ? userContext[0] : userContext;
    
    const perfilNormalizado = (profile?.perfil_nome ?? profile?.perfil_codigo ?? '').toLowerCase().trim();
    const isMaster = profile?.is_master === true || [
      'master', 'admin', 'administrador', 'administrator', 'gestor', 'gestao', 'gestão', 
      'administrador master', 'adm master'
    ].includes(perfilNormalizado);
    const isGestor = perfilNormalizado === 'gestor' || perfilNormalizado === 'gestao' || perfilNormalizado === 'gestão' || profile?.perfil_nome === "GESTOR";

    if (!isMaster && !isGestor) {
      throw new Response("Role insuficiente para listar sistemas.", { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("sistemas_externos")
      .select("*")
      .order("ordem", { ascending: true });

    if (error) {
      console.error(`[Admin][${correlationId}] Erro ao listar:`, error);
      throw new Response(`Erro ao listar sistemas: ${error.message}`, { status: 500 });
    }
    
    return data;
  });

export const criarSistema = createServerFn({ method: "POST" })
  .inputValidator((data) => sistemaSchema.parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const user = { id: context.userId, ...context.claims };
    const correlationId = crypto.randomUUID();

    if (!user) {
      throw new Response("Server Function não autenticada.", { status: 401 });
    }

    const { data: userContext } = await supabaseAdmin.rpc("get_my_user_context");
    const profile = Array.isArray(userContext) ? userContext[0] : userContext;
    
    const perfilNormalizado = (profile?.perfil_nome ?? profile?.perfil_codigo ?? '').toLowerCase().trim();
    const isMaster = profile?.is_master === true || [
      'master', 'admin', 'administrador', 'administrator', 'gestor', 'gestao', 'gestão',
      'administrador master', 'adm master'
    ].includes(perfilNormalizado);

    if (!isMaster) {
      throw new Response("Role insuficiente. Apenas usuários MASTER podem criar sistemas.", { status: 403 });
    }

    const { data: novo, error } = await supabaseAdmin
      .from("sistemas_externos")
      .insert({
        nome: data.nome,
        descricao: data.descricao,
        url_base: data.url_base,
        icone: data.icone,
        cor: data.cor,
        ordem: data.ordem,
        tipo_autenticacao: data.tipo_autenticacao,
        endpoint_sso: data.endpoint_sso,
        endpoint_logout: data.endpoint_logout,
        endpoint_refresh: data.endpoint_refresh,
        audience: data.audience,
        issuer: data.issuer,
        token_exp_segundos: data.token_exp_segundos,
        clock_skew_segundos: data.clock_skew_segundos,
        nonce: data.nonce,
        jti_enabled: data.jti_enabled,
        ativo: data.ativo,
        status: data.status,
      })
      .select()
      .single();

    if (error) {
      console.error(`[Admin][${correlationId}] Erro ao inserir:`, error);
      if (error.code === "42501") {
        throw new Response("Policy RLS bloqueou INSERT na tabela sistemas_externos.", { status: 403 });
      }
      throw new Response(`Erro ao salvar sistema: ${error.message}`, { status: 500 });
    }

    await supabaseAdmin.from("audit_log").insert({
      tabela: "sistemas_externos",
      operacao: "insert",
      usuario_id: user.id,
      registro_id: novo.id,
      valor_novo: novo,
      contexto: { correlationId, role: profile?.perfil_nome }
    });

    return novo;
  });

export const editarSistema = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    id: z.string().uuid(),
    updates: sistemaSchema.partial()
  }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const user = { id: context.userId, ...context.claims };
    const correlationId = crypto.randomUUID();

    if (!user) {
      throw new Response("Server Function não autenticada.", { status: 401 });
    }

    const { data: userContext } = await supabaseAdmin.rpc("get_my_user_context");
    const profile = Array.isArray(userContext) ? userContext[0] : userContext;
    
    const perfilNormalizado = (profile?.perfil_nome ?? profile?.perfil_codigo ?? '').toLowerCase().trim();
    const isMaster = profile?.is_master === true || [
      'master', 'admin', 'administrador', 'administrator', 'gestor', 'gestao', 'gestão',
      'administrador master', 'adm master'
    ].includes(perfilNormalizado);

    if (!isMaster) {
      throw new Response("Role insuficiente. Apenas usuários MASTER podem editar sistemas.", { status: 403 });
    }

    const { data: anterior } = await supabaseAdmin
      .from("sistemas_externos")
      .select("*")
      .eq("id", data.id)
      .single();

    const { data: atualizado, error } = await supabaseAdmin
      .from("sistemas_externos")
      .update({
        ...data.updates,
        // Garantir que campos numéricos sejam passados corretamente
        token_exp_segundos: data.updates.token_exp_segundos,
        clock_skew_segundos: data.updates.clock_skew_segundos,
      } as any)
      .eq("id", data.id)
      .select()
      .single();

    if (error) {
      console.error(`[Admin][${correlationId}] Erro ao atualizar:`, error);
      if (error.code === "42501") {
        throw new Response("Policy RLS bloqueou UPDATE na tabela sistemas_externos.", { status: 403 });
      }
      throw new Response(`Erro ao atualizar sistema: ${error.message}`, { status: 500 });
    }

    await supabaseAdmin.from("audit_log").insert({
      tabela: "sistemas_externos",
      operacao: "update",
      usuario_id: user.id,
      registro_id: data.id,
      valor_anterior: anterior,
      valor_novo: atualizado,
      contexto: { correlationId, role: profile?.perfil_nome }
    });

    return atualizado;
  });

export const removerSistema = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const user = { id: context.userId, ...context.claims };
    const correlationId = crypto.randomUUID();

    if (!user) {
      throw new Response("Server Function não autenticada.", { status: 401 });
    }

    const { data: userContext } = await supabaseAdmin.rpc("get_my_user_context");
    const profile = Array.isArray(userContext) ? userContext[0] : userContext;
    
    const perfilNormalizado = (profile?.perfil_nome ?? profile?.perfil_codigo ?? '').toLowerCase().trim();
    const isMaster = profile?.is_master === true || [
      'master', 'admin', 'administrador', 'administrator', 'gestor', 'gestao', 'gestão',
      'administrador master', 'adm master'
    ].includes(perfilNormalizado);

    if (!isMaster) {
      throw new Response("Role insuficiente. Apenas usuários MASTER podem remover sistemas.", { status: 403 });
    }

    const { data: anterior } = await supabaseAdmin
      .from("sistemas_externos")
      .select("*")
      .eq("id", data.id)
      .single();

    const { error } = await supabaseAdmin
      .from("sistemas_externos")
      .delete()
      .eq("id", data.id);

    if (error) {
      console.error(`[Admin][${correlationId}] Erro ao deletar:`, error);
      if (error.code === "42501") {
        throw new Response("Policy RLS bloqueou DELETE na tabela sistemas_externos.", { status: 403 });
      }
      throw new Response(`Erro ao deletar sistema: ${error.message}`, { status: 500 });
    }

    await supabaseAdmin.from("audit_log").insert({
      tabela: "sistemas_externos",
      operacao: "delete",
      usuario_id: user.id,
      registro_id: data.id,
      valor_anterior: anterior,
      contexto: { correlationId, role: profile?.perfil_nome }
    });

    return { success: true };
  });

export const duplicarSistema = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const user = { id: context.userId, ...context.claims };
    const correlationId = crypto.randomUUID();

    if (!user) {
      throw new Response("Server Function não autenticada.", { status: 401 });
    }

    const { data: userContext } = await supabaseAdmin.rpc("get_my_user_context");
    const profile = Array.isArray(userContext) ? userContext[0] : userContext;
    
    const perfilNormalizado = (profile?.perfil_nome ?? profile?.perfil_codigo ?? '').toLowerCase().trim();
    const isMaster = profile?.is_master === true || [
      'master', 'admin', 'administrador', 'administrator', 'gestor', 'gestao', 'gestão',
      'administrador master', 'adm master'
    ].includes(perfilNormalizado);

    if (!isMaster) {
      throw new Response("Role insuficiente. Apenas usuários MASTER podem duplicar sistemas.", { status: 403 });
    }

    const { data: original, error: fetchError } = await supabaseAdmin
      .from("sistemas_externos")
      .select("*")
      .eq("id", data.id)
      .single();

    if (fetchError || !original) {
      throw new Response("Sistema original não encontrado para duplicação.", { status: 404 });
    }

    const { id, created_at, updated_at, ...copyData } = original;
    copyData.nome = `${original.nome} (Cópia)`;

    const { data: novo, error: createError } = await supabaseAdmin
      .from("sistemas_externos")
      .insert(copyData as any)
      .select()
      .single();

    if (createError) {
      console.error(`[Admin][${correlationId}] Erro ao duplicar:`, createError);
      throw new Response(`Erro ao duplicar sistema: ${createError.message}`, { status: 500 });
    }

    return novo;
  });
