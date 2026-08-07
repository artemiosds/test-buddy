/**
 * Fluxo OFICIAL e ÚNICO de manipulação do Modo Manutenção.
 * Nenhum outro módulo deve escrever em `sistema_config` diretamente.
 */

type ConfigRow = {
  id: number;
  modo_manutencao_ativo: boolean | null;
  aviso_manutencao_id: string | null;
};

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Lê a linha de configuração global sem depender de um id fixo. */
export async function lerConfigManutencao(): Promise<ConfigRow | null> {
  const supabaseAdmin = await getAdmin();
  const { data, error } = await supabaseAdmin
    .from("sistema_config")
    .select("id, modo_manutencao_ativo, aviso_manutencao_id")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as ConfigRow | null) ?? null;
}

/**
 * Ativa ou desativa o modo manutenção. Fonte de verdade única.
 * @param avisoId aviso que justifica o bloqueio (null = desativar)
 */
export async function aplicarModoManutencao(
  avisoId: string | null,
  userId: string | null,
): Promise<{ ativo: boolean; avisoId: string | null }> {
  const supabaseAdmin = await getAdmin();
  const config = await lerConfigManutencao();

  const ativo = !!avisoId;
  const payload = {
    modo_manutencao_ativo: ativo,
    aviso_manutencao_id: avisoId,
    ativado_por: ativo ? userId : null,
    ativado_em: ativo ? new Date().toISOString() : null,
  };

  if (config) {
    const { error } = await supabaseAdmin
      .from("sistema_config")
      .update(payload)
      .eq("id", config.id);
    if (error) throw new Error(`Erro ao aplicar modo manutenção: ${error.message}`);
  } else {
    const { error } = await supabaseAdmin.from("sistema_config").insert(payload as never);
    if (error) throw new Error(`Erro ao criar configuração global: ${error.message}`);
  }

  // Mantém a flag do aviso coerente com o estado global.
  if (!ativo && config?.aviso_manutencao_id) {
    await supabaseAdmin
      .from("avisos_mural")
      .update({ ativa_modo_manutencao: false })
      .eq("id", config.aviso_manutencao_id);
  }
  if (ativo && avisoId) {
    await supabaseAdmin
      .from("avisos_mural")
      .update({ ativa_modo_manutencao: true })
      .eq("id", avisoId);
  }

  return { ativo, avisoId };
}

/** Estado consumido pelo cliente. */
export async function obterEstadoManutencao() {
  const supabaseAdmin = await getAdmin();
  const config = await lerConfigManutencao();

  if (!config?.modo_manutencao_ativo || !config.aviso_manutencao_id) {
    return { modo_manutencao_ativo: false, aviso: null };
  }

  const { data: aviso } = await supabaseAdmin
    .from("avisos_mural")
    .select("titulo, mensagem, criado_em, previsao_termino")
    .eq("id", config.aviso_manutencao_id)
    .maybeSingle();

  return { modo_manutencao_ativo: true, aviso: aviso ?? null };
}
