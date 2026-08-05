import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gerarParDeChaves } from "./sso-keys";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verificarPermissaoMaster } from "./sistemas-externos-admin.functions";

export const obterNovasChavesSSO = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const auth = await verificarPermissaoMaster(context.userId, context.claims?.email);
    
    if (!auth?.isMaster) {
      console.warn(`[SSO Admin] Acesso negado. Perfil: ${auth?.perfilNormalizado}. Email: ${context.claims?.email}`);
      throw new Error(`Erro ao gerar chaves: Apenas usuários MASTER podem gerar chaves. (Detectado: ${auth?.perfilNormalizado || 'Nenhum'})`);
    }

    const chaves = await gerarParDeChaves();
    
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
