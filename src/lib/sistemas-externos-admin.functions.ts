import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Interface para retorno de permissão
 */
export interface PermissaoMasterResult {
  isMaster: boolean;
  perfilNormalizado: string;
}

/**
 * Helper para verificar permissão MASTER de forma robusta no servidor
 * Resolve o problema de auth.uid() não estar disponível no supabaseAdmin rpc
 */
export async function verificarPermissaoMaster(userId: string, userEmail?: string): Promise<PermissaoMasterResult> {
  const { data: userData, error: userError } = await supabaseAdmin
    .from("usuarios")
    .select(`
      id,
      email,
      acesso_todas_unidades,
      acesso_todas_secretarias,
      perfil:perfil_id (
        codigo,
        nome
      )
    `)
    .eq("id", userId)
    .single();
  
  if (userError || !userData) {
    console.error("ERRO VERIFICACAO MASTER:", userError);
    return { isMaster: false, perfilNormalizado: 'Não encontrado' };
  }

  const perfilNome = (userData.perfil as any)?.nome;
  const perfilCodigo = (userData.perfil as any)?.codigo;
  const perfilNormalizado = (perfilNome ?? perfilCodigo ?? '').toLowerCase().trim();

  const isMaster = 
    (userData.acesso_todas_unidades === true && userData.acesso_todas_secretarias === true) ||
    [
      'master', 'admin', 'administrador', 'administrator', 
      'administrador master', 'adm master'
    ].includes(perfilNormalizado) ||
    (userEmail && [
      'adm@oriximina.pa.gov.br',
      'suporte@oriximina.pa.gov.br',
      'artemiosouza99@gmail.com'
    ].includes(userEmail));

  return {
    isMaster: !!isMaster,
    perfilNormalizado
  };
}

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
  expiracao: z.number().default(300),
  clock_skew: z.number().default(60),
  nonce: z.string().optional(),
  jti_enabled: z.boolean().default(true),
  ativo: z.boolean().default(true),
  public_key: z.string().optional(),
  private_key: z.string().optional(),
});

export const listarSistemas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const auth = await verificarPermissaoMaster(context.userId, context.claims?.email);
    
    if (!auth.isMaster && auth.perfilNormalizado !== 'gestor') {
      throw new Response(`Não autorizado. (Detectado: ${auth.perfilNormalizado})`, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("sistemas_externos")
      .select("*")
      .order("ordem", { ascending: true });

    if (error) throw new Response(error.message, { status: 500 });
    return data;
  });

export const criarSistema = createServerFn({ method: "POST" })
  .inputValidator((data) => sistemaSchema.parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const auth = await verificarPermissaoMaster(context.userId, context.claims?.email);
    if (!auth.isMaster) throw new Response("Apenas usuários MASTER podem criar sistemas.", { status: 403 });

    const { data: novo, error } = await supabaseAdmin
      .from("sistemas_externos")
      .insert(data as any)
      .select()
      .single();

    if (error) throw new Response(error.message, { status: 500 });
    return novo;
  });

export const editarSistema = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid(), updates: sistemaSchema.partial() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const auth = await verificarPermissaoMaster(context.userId, context.claims?.email);
    if (!auth.isMaster) throw new Response("Apenas usuários MASTER podem editar sistemas.", { status: 403 });

    const { data: atualizado, error } = await supabaseAdmin
      .from("sistemas_externos")
      .update(data.updates as any)
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw new Response(error.message, { status: 500 });
    return atualizado;
  });

export const removerSistema = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const auth = await verificarPermissaoMaster(context.userId, context.claims?.email);
    if (!auth.isMaster) throw new Response("Apenas usuários MASTER podem remover sistemas.", { status: 403 });

    const { error } = await supabaseAdmin.from("sistemas_externos").delete().eq("id", data.id);
    if (error) throw new Response(error.message, { status: 500 });
    return { success: true };
  });

export const duplicarSistema = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const auth = await verificarPermissaoMaster(context.userId, context.claims?.email);
    if (!auth.isMaster) throw new Response("Apenas usuários MASTER podem duplicar sistemas.", { status: 403 });

    const { data: original } = await supabaseAdmin.from("sistemas_externos").select("*").eq("id", data.id).single();
    if (!original) throw new Response("Sistema não encontrado.", { status: 404 });

    const { id, created_at, updated_at, ...copyData } = original;
    copyData.nome = `${original.nome} (Cópia)`;

    const { data: novo, error } = await supabaseAdmin.from("sistemas_externos").insert(copyData as any).select().single();
    if (error) throw new Response(error.message, { status: 500 });
    return novo;
  });
