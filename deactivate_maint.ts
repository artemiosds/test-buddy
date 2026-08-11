import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function deactivateMaintenance() {
  console.log("Tentando desativar manutenção via RPC...");
  const { error } = await supabaseAdmin.rpc('desativar_modo_manutencao_admin');
  
  if (error) {
    console.log("RPC falhou ou não existe. Tentando update genérico...");
    const { error: err2 } = await supabaseAdmin
      .from('sistema_config')
      .update({ modo_manutencao_ativo: false })
      .filter('id', 'not.is', null);
      
    if (err2) console.error("Erro final:", err2);
    else console.log("Update genérico concluído.");
  } else {
    console.log("Desativado via RPC.");
  }
}

deactivateMaintenance();
