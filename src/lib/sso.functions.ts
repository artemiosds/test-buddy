import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SignJWT } from "jose";

/**
 * Interface para representar o contexto do usuário retornado pela RPC
 */
interface UserContextRow {
  id: string;
  nome_completo: string | null;
  email: string | null;
  perfil_nome: string | null;
  secretaria_id: string | null;
  unidade_principal_id: string | null;
}

/**
 * Função Servidora para gerar um JWT SSO genérico para sistemas externos.
 * O segredo de assinatura é derivado de uma variável de ambiente.
 */
export const gerarTokenSSO = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        sistemaId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const user = (context as any).user;
    if (!user) {
      throw new Error("Não autorizado");
    }

    // 1. Buscar detalhes do sistema
    const { data: sistema, error: sErr } = await supabaseAdmin
      .from("sistemas_externos")
      .select("*")
      .eq("id", data.sistemaId)
      .eq("ativo", true)
      .single();

    if (sErr || !sistema) {
      throw new Error("Sistema não encontrado ou inativo");
    }

    // 2. Buscar contexto do usuário via RPC (mais performático e centralizado)
    const { data: userContext, error: cErr } = await supabaseAdmin.rpc("get_my_user_context");
    
    if (cErr || !userContext) {
      throw new Error("Falha ao obter contexto do usuário");
    }

    const profile = (Array.isArray(userContext) ? userContext[0] : userContext) as any;

    // 3. Buscar permissões
    const { data: permsData } = await supabaseAdmin.rpc("get_my_permissions");
    const permissoes = (permsData as unknown as string[]) || [];

    // 4. Buscar nomes de secretaria e unidade se existirem IDs
    let secretariaNome = "";
    let unidadeNome = "";

    if (profile.secretaria_id) {
      const { data: sec } = await supabaseAdmin
        .from("secretarias")
        .select("nome")
        .eq("id", profile.secretaria_id)
        .single();
      secretariaNome = sec?.nome || "";
    }

    if (profile.unidade_principal_id) {
      const { data: uni } = await supabaseAdmin
        .from("unidades")
        .select("nome")
        .eq("id", profile.unidade_principal_id)
        .single();
      unidadeNome = uni?.nome || "";
    }

    // 5. Preparar Payload
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (sistema.token_exp_segundos || 60);

    const payload = {
      user_id: user.id,
      nome: profile.nome_completo,
      email: user.email,
      perfil: profile.perfil_nome,
      secretaria: secretariaNome,
      unidade: unidadeNome,
      permissoes: permissoes,
      iss: sistema.issuer || "HSM-GESTAO",
      aud: sistema.audience || sistema.url_base,
      iat: now,
      exp: exp,
      jti: crypto.randomUUID(),
    };

    // 6. Assinar JWT
    const secret = new TextEncoder().encode(
      process.env.SSO_JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "fallback-secret-hsm",
    );

    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .sign(secret);

    return {
      token,
      urlRedirect: `${sistema.url_base}${sistema.endpoint_sso}?token=${token}`,
    };
  });
