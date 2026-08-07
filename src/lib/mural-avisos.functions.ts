import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const anexoSchema = z.object({
  nome: z.string(),
  path: z.string(),
  mime: z.string(),
  size: z.number(),
  bucket: z.string().default('mural_anexos'),
});

const avisoSchema = z.object({
  titulo: z.string().min(3),
  subtitulo: z.string().optional().nullable(),
  mensagem: z.string().min(5),
  tipo: z.enum(['informativo', 'urgente', 'manutencao']).default('informativo'),
  prioridade: z.enum(['baixa', 'normal', 'alta', 'critica']).default('normal'),
  fixado: z.boolean().default(false),
  destinatarios: z.object({
    tipo: z.enum(['todos', 'perfis', 'unidades']),
    valores: z.array(z.string()).optional()
  }).default({ tipo: 'todos' }),
  confirmacao_obrigatoria: z.boolean().default(false),
  data_inicio: z.string().default(() => new Date().toISOString().split('T')[0]),
  data_fim: z.string().optional().nullable(),
  notificar_email: z.boolean().default(false),
  ativa_modo_manutencao: z.boolean().default(false),
  previsao_termino: z.string().optional().nullable(),
  anexos: z.array(anexoSchema).optional().default([]),
  status: z.enum(['rascunho', 'publicado']).default('publicado'),
});

export const criarAviso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => avisoSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    try {
      const { data: profile } = await supabase
        .from('usuarios')
        .select('id, perfil:perfis(codigo)')
        .eq('id', userId)
        .maybeSingle();

      const role = (profile?.perfil as { codigo: string } | null)?.codigo ?? null;

      if (role !== 'MASTER' && role !== 'GESTOR') {
        throw new Error("Apenas MASTER ou GESTOR podem criar avisos.");
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: avisoInserido, error } = await supabaseAdmin
        .from('avisos_mural')
        .insert({
          titulo: data.titulo,
          subtitulo: data.subtitulo,
          mensagem: data.mensagem,
          tipo: data.tipo,
          prioridade: data.prioridade,
          fixado: data.fixado,
          destinatarios: data.destinatarios,
          confirmacao_obrigatoria: data.confirmacao_obrigatoria,
          data_inicio: data.data_inicio,
          data_fim: data.data_fim,
          notificar_email: !!data.notificar_email,
          criado_por: userId,
          ativo: data.status === 'publicado',
          ativa_modo_manutencao: !!data.ativa_modo_manutencao,
          previsao_termino: data.previsao_termino
        })
        .select('id')
        .single();

      if (error) throw error;

      if (data.anexos && data.anexos.length > 0 && avisoInserido) {
        const anexosToInsert = data.anexos.map(a => ({
          ...a,
          aviso_id: avisoInserido.id
        }));
        const { error: anexoError } = await supabaseAdmin
          .from('avisos_mural_anexos')
          .insert(anexosToInsert);
        
        if (anexoError) {
          console.error("Erro ao inserir anexos:", anexoError);
        }
      }

      // Fluxo ÚNICO de manutenção: delega para o helper oficial.
      if (data.tipo === 'manutencao' && avisoInserido) {
        const { aplicarModoManutencao } = await import("@/lib/manutencao.server");
        await aplicarModoManutencao(
          data.ativa_modo_manutencao ? avisoInserido.id : null,
          userId,
        );
      }


      if (data.notificar_email && avisoInserido) {
        try {
          await supabase.functions.invoke('notificar-aviso-mural', {
            body: { aviso_id: avisoInserido.id }
          });
          await supabaseAdmin
            .from('avisos_mural')
            .update({ email_enviado_em: new Date().toISOString() })
            .eq('id', avisoInserido.id);
        } catch (invokeError) {
          console.error("Erro ao disparar notificação por e-mail:", invokeError);
        }
      }

      return { success: true };
    } catch (err) {
      console.error("[criarAviso] Erro:", err);
      throw err instanceof Error ? err : new Error("Erro interno ao criar aviso");
    }
  });

export const reenviarEmailAviso = createServerFn({ method: "POST" })
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

    if (role !== 'MASTER' && role !== 'GESTOR') {
      throw new Error("Não autorizado");
    }

    const { error: invokeError } = await supabase.functions.invoke('notificar-aviso-mural', {
      body: { aviso_id: data.avisoId }
    });

    if (invokeError) throw invokeError;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from('avisos_mural')
      .update({ email_enviado_em: new Date().toISOString() })
      .eq('id', data.avisoId);

    return { success: true };
  });

export const listarAvisosAtivos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from('usuarios')
      .select('id, perfil:perfis(codigo)')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) return [];
    const role = (profile.perfil as { codigo: string } | null)?.codigo ?? null;

    const { data: vinculos } = await supabase
      .from('usuario_unidades')
      .select('unidade_id')
      .eq('usuario_id', userId);
    const unidadeIds = (vinculos ?? []).map((v) => v.unidade_id);

    const today = new Date().toISOString().split('T')[0];
    const { data: avisos, error } = await supabase
      .from('avisos_mural')
      .select(`
        *,
        anexos:avisos_mural_anexos(*),
        leituras:avisos_mural_leituras(confirmado, usuario_id)
      `)
      .eq('ativo', true)
      .lte('data_inicio', today)
      .or(`data_fim.is.null,data_fim.gte.${today}`)
      .order('fixado', { ascending: false })
      .order('criado_em', { ascending: false });

    if (error) throw error;

    return (avisos || []).filter((aviso: any) => {
      const dest = aviso.destinatarios as any;
      if (!dest || dest.tipo === 'todos') return true;
      if (dest.tipo === 'perfis' && role && dest.valores?.includes(role)) return true;
      if (dest.tipo === 'unidades') return unidadeIds.some((id) => dest.valores?.includes(id));
      return false;
    });
  });

export const listarAvisosArquivados = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from('usuarios')
      .select('id, perfil:perfis(codigo)')
      .eq('id', userId)
      .maybeSingle();

    const role = (profile?.perfil as { codigo: string } | null)?.codigo ?? null;
    if (role !== 'MASTER' && role !== 'GESTOR') {
      throw new Error("Acesso negado");
    }

    const today = new Date().toISOString().split('T')[0];
    const { data: avisos, error } = await supabase
      .from('avisos_mural')
      .select(`
        *,
        anexos:avisos_mural_anexos(*),
        criador:usuarios!avisos_mural_criado_por_fkey(nome)
      `)
      .or(`ativo.eq.false,data_fim.lt.${today}`)
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return avisos || [];
  });

export const reativarAviso = createServerFn({ method: "POST" })
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
    if (role !== 'MASTER' && role !== 'GESTOR') {
      throw new Error("Não autorizado");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from('avisos_mural')
      .update({ 
        ativo: true,
        data_fim: null // Limpa expiração ao reativar para evitar loop de arquivo
      })
      .eq('id', data.avisoId);

    if (error) throw error;
    return { success: true };
  });


export const marcarComoLido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ avisoId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from('avisos_mural_leituras')
      .upsert({
        aviso_id: data.avisoId,
        usuario_id: userId,
        lido_em: new Date().toISOString()
      }, { onConflict: 'aviso_id,usuario_id' });

    if (error) throw error;
    return { success: true };
  });

export const confirmarCiencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ avisoId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from('avisos_mural_leituras')
      .upsert({
        aviso_id: data.avisoId,
        usuario_id: userId,
        confirmado: true,
        lido_em: new Date().toISOString()
      }, { onConflict: 'aviso_id,usuario_id' });

    if (error) throw error;
    return { success: true };
  });

export const desativarAviso = createServerFn({ method: "POST" })
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

    if (role !== 'MASTER' && role !== 'GESTOR') {
      throw new Error("Não autorizado");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from('avisos_mural')
      .update({ ativo: false })
      .eq('id', data.avisoId);

    if (error) throw error;

    // Se este aviso estava bloqueando o sistema, libera pelo fluxo oficial.
    const { lerConfigManutencao, aplicarModoManutencao } = await import("@/lib/manutencao.server");
    const cfg = await lerConfigManutencao();

    if (cfg?.aviso_manutencao_id === data.avisoId) {
      await aplicarModoManutencao(null, userId);
    }


    return { success: true };
  });

