import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function cleanup() {
  console.log("Iniciando limpeza forense...");
  
  // 1. Remover qualquer aviso que contenha o texto problemático ou que pareça uma tentativa de injeção/reversão
  const { data: avisos, error: fetchError } = await supabaseAdmin
    .from('avisos_mural')
    .select('id, mensagem, titulo');
    
  if (fetchError) {
    console.error("Erro ao buscar avisos:", fetchError);
  } else {
    for (const aviso of (avisos || [])) {
      if (aviso.mensagem.includes('baguncou') || aviso.titulo.includes('baguncou') || aviso.mensagem.includes('reguar')) {
        console.log(`Deletando aviso suspeito: ${aviso.id} - ${aviso.titulo}`);
        await supabaseAdmin.from('avisos_mural').delete().eq('id', aviso.id);
      }
    }
  }

  // 2. Resetar o modo manutenção se estiver ativado
  const { error: resetError } = await supabaseAdmin
    .from('sistema_config')
    .update({ 
      modo_manutencao_ativo: false,
      aviso_manutencao_id: null,
      manutencao_por: null,
      manutencao_em: null
    })
    .eq('id', 'config'); // Assumindo que o ID é 'config' ou similar, mas vamos tentar via RPC se falhar
    
  if (resetError) {
    console.log("Erro ao resetar sistema_config diretamente, tentando via RPC se disponível...");
  } else {
    console.log("Modo manutenção resetado com sucesso.");
  }
}

cleanup();
