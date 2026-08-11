import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function restoreMasterPermissions() {
  console.log("Restaurando permissões MASTER...");

  // 1. Localizar o ID do perfil MASTER
  const { data: perfis } = await supabaseAdmin
    .from('perfis')
    .select('id, codigo')
    .eq('codigo', 'MASTER');

  const masterPerfilId = perfis?.[0]?.id;
  if (!masterPerfilId) {
    console.log("Perfil MASTER não encontrado.");
    return;
  }

  // 2. Localizar o usuário artemiosouza99@gmail.com
  const { data: usuarios } = await supabaseAdmin
    .from('usuarios')
    .select('id')
    .eq('email', 'artemiosouza99@gmail.com');

  const artemioId = usuarios?.[0]?.id;
  if (!artemioId) {
    console.log("Usuário Artemio não encontrado.");
    return;
  }

  // 3. Garantir que ele seja MASTER e tenha as flags de acesso global
  const { error: updateError } = await supabaseAdmin
    .from('usuarios')
    .update({ 
      perfil_id: masterPerfilId,
      acesso_todas_unidades: true,
      acesso_todas_secretarias: true,
      status: 'ativo'
    })
    .eq('id', artemioId);

  if (updateError) {
    console.error("Erro ao atualizar usuário:", updateError);
  } else {
    console.log("Usuário Artemio restaurado como MASTER com acesso global.");
  }

  // 4. Resetar manutenção forçada via sistema_config (tentando sem ID fixo)
  const { error: configError } = await supabaseAdmin
    .from('sistema_config')
    .update({ 
      modo_manutencao_ativo: false,
      aviso_manutencao_id: null
    })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all rows

  if (configError) {
    console.error("Erro ao resetar config:", configError);
  } else {
    console.log("Modo manutenção desativado globalmente.");
  }
}

restoreMasterPermissions();
