import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SignJWT, jwtVerify } from "jose";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { verificarPermissaoMaster } from "./sistemas-externos-admin.functions";

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

      // 2. Verificar permissão MASTER ou GESTOR de forma robusta
      const auth = await verificarPermissaoMaster(context.userId, context.claims?.email);
      
      const role = auth.perfilNormalizado;
      const isMaster = auth.isMaster;
      const isGestor = role === 'gestor' || role === 'gestao' || role === 'gestão';

      const hasPermission = isMaster || isGestor;
      
      diagnostico.passos.push({ 
        nome: "Permissão de Acesso", 
        status: hasPermission,
        mensagem: hasPermission ? `Perfil ${role.toUpperCase()} autorizado` : `Perfil ${role || 'desconhecido'} não possui permissão para diagnóstico` 
      });

      if (!hasPermission) {
        await logAudit("permission", false, `Usuário sem permissão para executar diagnóstico. (Detectado: ${role || 'Nenhum'})`, { role, isMaster });
        throw new Error(`Usuário sem permissão para executar diagnóstico. (Detectado: ${role || 'Nenhum'})`);
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

      // 6. Variável de Ambiente SSO_JWT_SECRET (Global Fallback)
      const globalSecret = process.env.SSO_JWT_SECRET;
      let checkSecret = sistema.private_key || globalSecret;
      
      // Normalização idêntica à do gerador de token
      if (checkSecret && !checkSecret.includes("-----BEGIN")) {
        checkSecret = checkSecret.trim().replace(/\s/g, '');
      }

      diagnostico.passos.push({ 
        nome: "Segredo de Assinatura (Secret)", 
        status: !!checkSecret,
        mensagem: sistema.private_key 
          ? "Utilizando chave específica do sistema (Recomendado)" 
          : (globalSecret ? "Utilizando fallback global (SSO_JWT_SECRET)" : "ERRO: Nenhuma chave configurada")
      });
      
      if (!checkSecret) {
        await logAudit("env_var", false, "Nenhum segredo (private_key ou SSO_JWT_SECRET) encontrado.");
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
      let testSecret = sistema.private_key || process.env.SSO_JWT_SECRET;
      if (testSecret && !testSecret.includes("-----BEGIN")) {
        testSecret = testSecret.trim().replace(/\s/g, '');
      }

      if (testSecret) {
        try {
          const key = new TextEncoder().encode(testSecret);
          const signJwt = new SignJWT({ test: true, diag: correlationId })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuer(sistema.issuer)
            .setAudience(sistema.audience);
          
          if (sistema.expiracao) {
            signJwt.setExpirationTime(Math.floor(Date.now() / 1000) + sistema.expiracao);
          } else {
            signJwt.setExpirationTime("1m");
          }

          const token = await signJwt.sign(key);
          
          await jwtVerify(token, key, {
            issuer: sistema.issuer,
            audience: sistema.audience,
          });

          diagnostico.passos.push({ 
            nome: "Geração e Assinatura JWT", 
            status: true,
            mensagem: `Token assinado via HS256 e validado localmente (${sistema.private_key ? 'Chave do Sistema' : 'Chave Global'})`
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
          let targetUrl = sistema.endpoint_sso || sistema.url_base || "";
          if (targetUrl && !targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = `https://${targetUrl}`;
          }

          const response = await fetch(targetUrl, { method: "HEAD" }).catch((e) => {
            // Se for erro de DNS ou conexão recusada
            return { 
              status: 530, 
              statusText: "Connection Failed",
              error: e.message 
            } as any;
          });

          const status = response ? response.status : 530;
          const isOk = response ? response.status < 500 : false;
          
          let mensagem = response
            ? `Endpoint respondeu HTTP ${status}`
            : "O servidor do sistema de destino (Plantão Inteligente) está inacessível ou a URL configurada está incorreta/offline.";

          if (status === 530) {
            mensagem = "O servidor do sistema de destino (Plantão Inteligente) está inacessível ou a URL configurada está incorreta/offline.";
          }

          diagnostico.passos.push({
            nome: "Conectividade de Endpoint",
            status: isOk,
            aviso: !isOk, // Marca como aviso em caso de falha, para não bloquear o fluxo
            mensagem: mensagem,
          });

          if (response && (response.status === 401 || response.status === 403 || response.status >= 500)) {
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
    if (!context.userId) {
      return { error: "Sessão expirada ou usuário não autenticado. Faça login novamente." };
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
      
      await supabaseAdmin.from("audit_log").insert({
        tabela: "sistemas_externos",
        operacao: "custom",
        usuario_id: user.id,
        contexto: { 
          success: false,
          error: "Sistema não encontrado ou inativo", 
          correlationId, 
          sistemaId: data.sistemaId,
          step: "lookup_system"
        }
      });

      throw new Error("Sistema não encontrado ou inativo");
    }


    // 2. Validar Configurações Obrigatórias e definir Secret
    // O segredo deve vir preferencialmente do cadastro do sistema (private_key se for chave simétrica)
    // Se não houver no sistema, usamos a variável global SSO_JWT_SECRET como fallback.
    const ssoSecret = sistema.private_key || process.env.SSO_JWT_SECRET;
    
    // Verificação de segurança e normalização robusta
    // Se for uma chave RSA/PEM, não aplicamos trim() agressivo que possa quebrar o formato,
    // mas se for uma string simples (HS256), removemos espaços e quebras de linha acidentais.
    let normalizedSecret = ssoSecret || "";
    
    // Se não começar com o cabeçalho PEM, é provavelmente uma chave simétrica (HS256)
    if (normalizedSecret && !normalizedSecret.includes("-----BEGIN")) {
      normalizedSecret = normalizedSecret.trim().replace(/\s/g, '');
    }

    if (!normalizedSecret) {
      console.error(`[SSO][${correlationId}] ERRO: Nem private_key no sistema nem SSO_JWT_SECRET configurada.`);
      throw new Error("Configuração de segurança ausente: Defina a 'Chave Privada/Secret' no cadastro do sistema.");
    }

    // Issuer e Audience são obrigatórios para a assinatura do token
    if (!sistema.issuer || !sistema.audience) {
      console.error(`[SSO][${correlationId}] Configuração incompleta para o sistema ${sistema.nome}:`, { issuer: sistema.issuer, audience: sistema.audience });
      throw new Error(`Configuração incompleta: Preencha os campos 'Issuer' e 'Audience' na aba 'Segurança/SSO' para o sistema ${sistema.nome}.`);
    }

    // 3. Buscar contexto do usuário via RPC (que retorna um JSONB direto)
    // 3. Buscar contexto do usuário via RPC
    const { data: userContext, error: cErr } = await supabaseAdmin.rpc("get_my_user_context");
    
    // Fallback manual se a RPC falhar ou retornar nulo, para não bloquear o acesso
    let profile = userContext as any;
    
    if (cErr || !profile) {
      console.warn(`[SSO][${correlationId}] RPC get_my_user_context retornou erro ou vazio. Usando fallback de metadados.`, cErr);
      profile = {
        id: user.id,
        email: user.email,
        nome_completo: user.user_metadata?.full_name || user.user_metadata?.name || 'Usuário',
        perfil_nome: user.user_metadata?.role || 'profissional',
        secretaria_id: user.user_metadata?.secretaria_id || null,
        unidade_principal_id: user.user_metadata?.unidade_principal_id || null
      };
    }

    

    // 4. Buscar permissões
    const { data: permsData } = await supabaseAdmin.rpc("get_my_permissions");
    const permissoes = (permsData as unknown as string[]) || [];

    // 5. Buscar nomes de secretaria e unidade
    let secretariaNome = "";
    let unidadeNome = "";

    const secretariaId = profile?.secretaria_id || user?.user_metadata?.secretaria_id || null;
    const unidadePrincipalId = profile?.unidade_principal_id || user?.user_metadata?.unidade_principal_id || null;

    if (secretariaId) {
      const { data: sec } = await supabaseAdmin
        .from("secretarias")
        .select("nome")
        .eq("id", secretariaId)
        .single();
      secretariaNome = sec?.nome || "";
    }

    if (unidadePrincipalId) {
      const { data: uni } = await supabaseAdmin
        .from("unidades")
        .select("nome")
        .eq("id", unidadePrincipalId)
        .single();
      unidadeNome = uni?.nome || "";
    }

    // 6. Preparar Payload
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (sistema.expiracao || 300);

    const payload: any = {
      sub: user?.id,
      email: user?.email,
      cpf: (context as any).claims?.cpf || profile?.cpf || null,
      matricula: (context as any).claims?.matricula || profile?.matricula || null,
      nome: profile?.nome_completo || user?.user_metadata?.full_name || 'Usuário',
      name: profile?.nome_completo || user?.user_metadata?.full_name || 'Usuário',
      secretaria_id: profile?.secretaria_id || null,
      role: profile?.perfil_nome || profile?.role || 'profissional',
      iss: sistema.issuer || "https://gestao-saude-sms-oriximina.vercel.app",
      aud: sistema.audience || "plantao-inteligente",
      iat: now,
      exp: exp,
      correlation_id: correlationId,
      user_id: user.id,
      perfil: profile?.perfil_nome,
      secretaria: secretariaNome,
      unidade: unidadeNome,
      permissoes: permissoes,
    };

    // Acessar via colchetes para evitar erro de tipagem antes do build regenerar tipos do Supabase
    if ((sistema as any).clock_skew) {
      payload.nbf = now - (sistema as any).clock_skew;
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
    let token = "";
    try {
      // O normalizedSecret já foi tratado no início do handler
      console.log(`[SSO][${correlationId}] Assinando com HS256. Secret size: ${normalizedSecret.length}`);
      
      const secretKey = new TextEncoder().encode(normalizedSecret);
      const alg = "HS256"; 



      const jwtSigner = new SignJWT(payload)
        .setProtectedHeader({ alg })
        .setIssuer(payload.iss)
        .setAudience(payload.aud)
        .setIssuedAt(now)
        .setExpirationTime(exp);

      if (payload.jti) {
        jwtSigner.setJti(payload.jti);
      }

      token = await jwtSigner.sign(secretKey);
      console.log(`[SSO][${correlationId}] Token gerado: ${token}`);
    } catch (e: any) {
      await supabaseAdmin.from("audit_log").insert({
        tabela: "sistemas_externos",
        operacao: "custom",
        usuario_id: user.id,
        contexto: { 
          success: false,
          error: `Falha na assinatura do token: ${e.message}`, 
          correlationId, 
          sistemaId: data.sistemaId,
          sistemaNome: sistema.nome,
          step: "sign_jwt"
        }
      });
      throw e;
    }

    await supabaseAdmin.from("audit_log").insert({
      tabela: "sistemas_externos",
      operacao: "insert",
      usuario_id: user.id,
      ip: (context as any).ip || null,
      user_agent: (context as any).userAgent || null,
      contexto: { 
        success: true, 
        correlationId, 
        sistemaId: data.sistemaId,
        sistemaNome: sistema.nome,
        step: "generate_token"
      }
    });

    return {
      token,
      urlRedirect: sistema.endpoint_sso || sistema.url_base,
    };
  });

export const getSSOMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // 1. Total sistemas conectados
    const { count: totalSistemas } = await supabaseAdmin
      .from("sistemas_externos")
      .select("*", { count: "exact", head: true })
      .eq("ativo", true);

    // 2. Autenticações SSO nas últimas 24h (Sucesso)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { count: ssoSucessos } = await supabaseAdmin
      .from("audit_log")
      .select("*", { count: "exact", head: true })
      .eq("tabela", "sistemas_externos")
      .contains("contexto", { success: true })
      .gte("ocorrido_em", yesterday);

    // 3. Falhas nas últimas 24h
    const { count: ssoFalhas } = await supabaseAdmin
      .from("audit_log")
      .select("*", { count: "exact", head: true })
      .eq("tabela", "sistemas_externos")
      .contains("contexto", { success: false })
      .gte("ocorrido_em", yesterday);

    return {
      totalSistemas: totalSistemas || 0,
      ssoSucessos: ssoSucessos || 0,
      ssoFalhas: ssoFalhas || 0,
      statusCentral: "Operacional",
    };
  });

export const getSSOLogs = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({
      sistemaId: z.string().uuid().optional(),
      status: z.enum(["success", "error", "all"]).optional(),
      busca: z.string().optional(),
      limit: z.number().optional().default(50),
    }).parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    let query = supabaseAdmin
      .from("audit_log")
      .select(`*`)
      .eq("tabela", "sistemas_externos")
      .order("ocorrido_em", { ascending: false })
      .limit(data.limit);

    if (data.status === "success") {
      query = query.contains("contexto", { success: true });
    } else if (data.status === "error") {
      query = query.contains("contexto", { success: false });
    }

    if (data.sistemaId) {
      query = query.contains("contexto", { sistemaId: data.sistemaId });
    }

    const { data: logs, error } = await query;

    if (error) throw error;

    // Se houver logs, buscar dados dos usuários para enriquecer
    const userIds = Array.from(new Set(logs.map(l => l.usuario_id).filter(Boolean))) as string[];
    const { data: userData } = userIds.length > 0 
      ? await supabaseAdmin.from("usuarios").select("id, nome_completo, email").in("id", userIds)
      : { data: [] };

    const userMap = new Map(userData?.map(u => [u.id, u]) || []);

    return logs.map(log => {
      const u = log.usuario_id ? userMap.get(log.usuario_id) : null;
      return {
        id: log.id,
        timestamp: log.ocorrido_em,
        usuario: u?.nome_completo || log.usuario_email || "Sistema",
        cpf: "-", // CPF não disponível na tabela usuários, buscar se necessário via profissionais
        sistemaDestino: (log.contexto as any)?.sistemaNome || "SSO",
        ip: log.ip,
        dispositivo: log.user_agent,
        resultado: (log.contexto as any)?.success ? "Sucesso" : "Falha",
        detalhes: log.contexto,
        operacao: log.operacao
      };
    });
  });
