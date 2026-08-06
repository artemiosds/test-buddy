import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const ativarModoManutencao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ avisoId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from('usuarios')
      .select('id, perfil:perfis(codigo)')
      .eq('id', userId)
      .maybeSingle();

    const role = (profile?.perfil as { codigo: string } | null)?.codigo ?? null;
    if (role !== 'MASTER') {
      throw new Error("Apenas usuários MASTER podem ativar o modo manutenção");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: aviso, error: avisoError } = await supabaseAdmin
      .from('avisos_mural')
      .select('id, tipo')
      .eq('id', data.avisoId)
      .maybeSingle();

    if (avisoError || !aviso) throw new Error("Aviso não encontrado");
    if (aviso.tipo !== 'manutencao') throw new Error("Apenas avisos do tipo 'manutencao' podem ativar o modo");

    const { error: configError } = await supabaseAdmin
      .from('sistema_config')
      .update({
        modo_manutencao_ativo: true,
        aviso_manutencao_id: data.avisoId,
        ativado_por: userId,
        ativado_em: new Date().toISOString(),
      })
      .eq('id', 1);

    if (configError) throw new Error(`Erro ao ativar modo manutenção: ${configError.message}`);

    return { success: true };
  });

export const desativarModoManutencao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from('usuarios')
      .select('id, perfil:perfis(codigo)')
      .eq('id', userId)
      .maybeSingle();

    const role = (profile?.perfil as { codigo: string } | null)?.codigo ?? null;
    if (role !== 'MASTER') {
      throw new Error("Apenas usuários MASTER podem desativar o modo manutenção");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: config } = await supabaseAdmin
      .from('sistema_config')
      .select('aviso_manutencao_id')
      .eq('id', 1)
      .maybeSingle();

    const { error: configError } = await supabaseAdmin
      .from('sistema_config')
      .update({
        modo_manutencao_ativo: false,
        aviso_manutencao_id: null,
        ativado_por: null,
        ativado_em: null,
      })
      .eq('id', 1);

    if (configError) throw new Error(`Erro ao desativar modo manutenção: ${configError.message}`);

    if (config?.aviso_manutencao_id) {
      await supabaseAdmin
        .from('avisos_mural')
        .update({ ativa_modo_manutencao: false })
        .eq('id', config.aviso_manutencao_id);
    }

    return { success: true };
  });

export const verificarEstadoManutencao = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data, error } = await supabaseAdmin
        .from('sistema_config')
        .select('modo_manutencao_ativo, aviso_manutencao_id')
        .eq('id', 1)
        .maybeSingle();

      if (error || !data) return { modo_manutencao_ativo: false, aviso: null };

      let aviso = null;
      if (data.modo_manutencao_ativo && data.aviso_manutencao_id) {
        const { data: avisoData } = await supabaseAdmin
          .from('avisos_mural')
          .select('titulo, mensagem, criado_em, previsao_termino')
          .eq('id', data.aviso_manutencao_id)
          .maybeSingle();
        aviso = avisoData;
      }

      return {
        modo_manutencao_ativo: data.modo_manutencao_ativo || false,
        aviso,
      };
    } catch (error) {
      console.error('Erro crítico na verificação:', error);
      return { modo_manutencao_ativo: false, aviso: null };
    }
  });
