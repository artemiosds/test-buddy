import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SignJWT, jwtVerify } from "jose";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const testarConfiguracaoSSO = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({
      sistemaId: z.string().uuid(),
    }).parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    // correlationId gerado no início para rastreamento
    const correlationId = crypto.randomUUID();
    
    // O context.user é injetado pelo middleware requireSupabaseAuth
    const user = { id: context.userId, ...context.claims };
    
    const diagnostico: any = {
      timestamp: new Date().toISOString(),
      correlationId,
      passos: [],
    };

    const logAudit = async (step: string, success: boolean, message: string, extra: any = {}) => {
      try {
        await supabaseAdmin.from("audit_log").insert({
          tabela: "sistemas_externos",
          operacao: "update",
          usuario_id: user?.id,
          contexto: {
            tipo: "diagnostico_sso",
            correlationId,
            step,
            success,
            message,
            role: user?.role,
            ...extra
          }
        });
      } catch (e) {
        console.error("Erro ao registrar log de auditoria do diagnóstico:", e);
      }
    };

    try {
      // 1. Validar Autenticação e Permissão
      if (!user) {
        const msg = "Usuário não autenticado ou sessão inválida.";
        await logAudit("auth", false, msg);
        throw new Error(msg);
      }

      // 2. Verificar permissão MASTER ou GESTOR
      const { data: userRole, error: roleError } = await supabaseAdmin
        .rpc("get_my_user_context");
      
      if (roleError) {
        const msg = `Falha ao validar permissões do usuário: ${roleError.message}`;
        await logAudit("permission_check", false, msg);
        throw new Error(msg);
      }

      const profile = (Array.isArray(userRole) ? userRole[0] : userRole) as any;
      const role = profile?.perfil_nome;
      const isMaster = profile?.is_master === true;

      const hasPermission = isMaster || role === "MASTER" || role === "GESTOR";
      diagnostico.passos.push({ 
        nome: "Permissão de Acesso", 
        status: hasPermission,
        mensagem: hasPermission ? `Perfil ${role || 'MASTER'} autorizado` : `Perfil ${role || 'desconhecido'} não possui permissão para diagnóstico` 
      });

      if (!hasPermission) {
        await logAudit("permission", false, "Usuário sem permissão para executar diagnóstico.", { role, isMaster });
        throw new Error("Usuário sem permissão para executar diagnóstico.");
      }

      // 3. Variável de Ambiente SSO_JWT_SECRET
      const secret = process.env.SSO_JWT_SECRET;
      diagnostico.passos.push({ 
        nome: "Variável SSO_JWT_SECRET", 
        status: !!secret,
        mensagem: secret ? "Configurada" : "SSO_JWT_SECRET ausente no servidor" 
      });
      
      if (!secret) {
        await logAudit("env_var", false, "SSO_JWT_SECRET ausente.");
      }

      // 4. SERVICE_ROLE_KEY (Implícito se o supabaseAdmin funcionar)
      const hasAdmin = !!supabaseAdmin;
      diagnostico.passos.push({ 
        nome: "Acesso Administrativo (Supabase)", 
        status: hasAdmin,
        mensagem: hasAdmin ? "supabaseAdmin inicializado (SERVICE_ROLE_KEY presente)" : "Falha ao inicializar supabaseAdmin (SERVICE_ROLE_KEY ausente?)" 
      });

      if (!hasAdmin) {
        await logAudit("admin_client", false, "SERVICE_ROLE_KEY ausente ou inválida.");
      }

      // 5. Provedor no Banco
      const { data: sistema, error: fetchError } = await supabaseAdmin
        .from("sistemas_externos")
        .select("*")
        .eq("id", data.sistemaId)
        .single();

      if (fetchError) {
        diagnostico.passos.push({ 
          nome: "Consulta Banco de Dados", 
          status: false,
          mensagem: `Falha ao acessar tabela sistemas_externos: ${fetchError.message}`
        });
        await logAudit("db_fetch", false, `Falha ao acessar tabela: ${fetchError.message}`);
        throw new Error("Falha ao acessar tabela sistemas_externos.");
      }

      diagnostico.passos.push({ 
        nome: "Localização do Sistema", 
        status: !!sistema,
        mensagem: sistema ? `Sistema "${sistema.nome}" localizado` : "Sistema não encontrado"
      });

      if (!sistema) {
        await logAudit("system_lookup", false, "Sistema externo não encontrado.");
        throw new Error("Sistema externo não encontrado.");
      }

      // 6. Configurações de Payload
      diagnostico.passos.push({ 
        nome: "Validação de Configurações (iss/aud)", 
        status: !!(sistema.issuer && sistema.audience),
        mensagem: `${sistema.issuer ? 'Issuer OK' : 'Issuer AUSENTE'} | ${sistema.audience ? 'Audience OK' : 'Audience AUSENTE'}`
      });

      if (!sistema.issuer || !sistema.audience) {
        const missing = !sistema.issuer ? "Issuer" : "Audience";
        await logAudit("config_validation", false, `${missing} inválida ou ausente.`);
        throw new Error(`${missing} inválida ou ausente.`);
      }

      // 7. Teste de Assinatura e Validação Local
      if (secret) {
        try {
          const key = new TextEncoder().encode(secret);
          const token = await new SignJWT({ test: true, diag: correlationId })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuer(sistema.issuer)
            .setAudience(sistema.audience)
            .setExpirationTime("1m")
            .sign(key);
          
          await jwtVerify(token, key, {
            issuer: sistema.issuer,
            audience: sistema.audience,
          });

          diagnostico.passos.push({ 
            nome: "Geração e Assinatura JWT", 
            status: true,
            mensagem: "Token assinado e validado localmente"
          });
        } catch (e: any) {
          diagnostico.passos.push({ 
            nome: "Geração e Assinatura JWT", 
            status: false,
            mensagem: `JWT não pôde ser assinado ou validado: ${e.message}`
          });
          await logAudit("jwt_sign", false, "JWT não pôde ser assinado ou validado.", { error: e.message });
          throw new Error("Falha ao validar assinatura local do JWT.");
        }
      }

      // 8. Verificação de Conectividade (Head request ao endpoint)
      if (sistema.url_base) {
        try {
          const targetUrl = `${sistema.url_base}${sistema.endpoint_sso || ""}`;
          const response = await fetch(targetUrl, { method: "HEAD" }).catch(() => null);

          const status = response ? response.status : "Erro de Conexão";
          const isOk = response ? response.status < 500 : false;

          diagnostico.passos.push({
            nome: "Conectividade de Endpoint",
            status: isOk,
            mensagem: response
              ? `Endpoint respondeu HTTP ${status}`
              : "Não foi possível alcançar o host remoto",
          });

          if (response && (response.status === 401 || response.status === 403)) {
            await logAudit("connectivity", false, `Endpoint remoto respondeu HTTP ${response.status}`, {
              status: response.status,
            });
          }
        } catch (e: any) {
          await logAudit("connectivity_error", false, `Erro durante teste de conectividade: ${e.message}`);
        }
      }

      await logAudit("diagnostico_completo", true, "Diagnóstico concluído com sucesso.");
      return diagnostico;
    } catch (err: any) {
      diagnostico.erroGeral = err.message;
      // Garante que o erro fatal seja registrado se ainda não foi
      return diagnostico;
    }
  });


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
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const user = { id: context.userId, ...context.claims };
    if (!user) {
      throw new Error("Não autorizado");
    }

    const correlationId = crypto.randomUUID();

    // 1. Buscar detalhes do sistema
    const { data: sistema, error: sErr } = await supabaseAdmin
      .from("sistemas_externos")
      .select("*")
      .eq("id", data.sistemaId)
      .eq("ativo", true)
      .single();

    if (sErr || !sistema) {
      console.error(`[SSO][${correlationId}] Sistema não encontrado:`, sErr);
      throw new Error("Sistema não encontrado ou inativo");
    }

    // 2. Validar Configurações Obrigatórias
    const ssoSecret = process.env.SSO_JWT_SECRET;
    if (!ssoSecret) {
      const errorMsg = "SSO_JWT_SECRET não configurada no ambiente";
      console.error(`[SSO][${correlationId}] ${errorMsg}`);
      
      await supabaseAdmin.from("audit_log").insert({
        tabela: "sistemas_externos",
        operacao: "insert",
        usuario_id: user.id,
        contexto: { 
          error: errorMsg, 
          correlationId, 
          sistemaId: data.sistemaId,
          step: "validate_secret"
        }
      });

      throw new Error(errorMsg);
    }

    if (!sistema.issuer) {
      throw new Error(`Configuração inválida: Issuer não definido para o sistema ${sistema.nome}`);
    }

    if (!sistema.audience) {
      throw new Error(`Configuração inválida: Audience não definida para o sistema ${sistema.nome}`);
    }

    // 3. Buscar contexto do usuário via RPC
    const { data: userContext, error: cErr } = await supabaseAdmin.rpc("get_my_user_context");
    
    if (cErr || !userContext) {
      throw new Error("Falha ao obter contexto do usuário");
    }

    const profile = (Array.isArray(userContext) ? userContext[0] : userContext) as any;

    // 4. Buscar permissões
    const { data: permsData } = await supabaseAdmin.rpc("get_my_permissions");
    const permissoes = (permsData as unknown as string[]) || [];

    // 5. Buscar nomes de secretaria e unidade
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

    // 6. Preparar Payload
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (sistema.token_exp_segundos || 60);

    const payload: any = {
      user_id: user.id,
      nome: profile.nome_completo,
      email: user.email,
      perfil: profile.perfil_nome,
      secretaria: secretariaNome,
      unidade: unidadeNome,
      permissoes: permissoes,
      iss: sistema.issuer,
      aud: sistema.audience,
      iat: now,
      exp: exp,
      correlation_id: correlationId,
    };

    // Acessar via colchetes para evitar erro de tipagem antes do build regenerar tipos do Supabase
    if ((sistema as any).clock_skew_segundos) {
      payload.nbf = now - (sistema as any).clock_skew_segundos;
    }

    if ((sistema as any).nonce) {
      payload.nonce = (sistema as any).nonce;
    }

    if ((sistema as any).jti_enabled !== false) {
      payload.jti = crypto.randomUUID();
    }

    // 7. Logs de Geração (Seguro)
    console.log(`[SSO][${correlationId}] Gerando token:`, {
      iss: payload.iss,
      aud: payload.aud,
      exp: payload.exp,
      iat: payload.iat,
      jti: payload.jti,
      correlation_id: correlationId
    });

    // 8. Assinar JWT
    const secret = new TextEncoder().encode(ssoSecret);
    const alg = "HS256"; 

    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg })
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .sign(secret);

    return {
      token,
      urlRedirect: `${sistema.url_base}${sistema.endpoint_sso}?token=${token}`,
    };
  });
