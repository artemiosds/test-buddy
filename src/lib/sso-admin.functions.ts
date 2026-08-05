import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gerarParDeChaves } from "./sso-keys";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const obterNovasChavesSSO = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Recuperar contexto do usuário
    const { data: userContext } = await supabaseAdmin.rpc("get_my_user_context");
    const profile = Array.isArray(userContext) ? userContext[0] : userContext;
    
    // Log temporário para depuração de perfil (como solicitado)
    console.log('Perfil do usuário logado (SSO Admin):', {
      perfil_nome: profile?.perfil_nome,
      perfil_codigo: profile?.perfil_codigo,
      is_master: profile?.is_master,
      raw: profile
    });

    // Verificação flexível de perfil MASTER
    const perfilNormalizado = (
      profile?.perfil_nome ?? 
      profile?.perfil_codigo ?? 
      ''
    ).toLowerCase().trim();

    const isMaster = 
      profile?.is_master === true || 
      [
        'master', 'admin', 'administrador', 
        'administrator', 'gestor', 'gestao', 'gestão',
        'administrador master', 'adm master'
      ].includes(perfilNormalizado);

    if (!isMaster) {
      throw new Error("Apenas usuários MASTER podem gerar chaves.");
    }

    const chaves = await gerarParDeChaves();
    
    // Log de auditoria (sem salvar a chave privada no banco por segurança, apenas o fato que foi gerada)
    await supabaseAdmin.from("audit_log").insert({
      tabela: "configuracoes_sso",
      operacao: "insert",
      usuario_id: context.userId,
      contexto: { 
        acao: "geracao_par_chaves_rsa",
        public_key_preview: chaves.publicKeyPem.substring(0, 100) + "..."
      }
    });

    return chaves;
  });
