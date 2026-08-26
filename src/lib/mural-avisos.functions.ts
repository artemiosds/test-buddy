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
          const { enviarEmailsAviso } = await import("@/lib/mural-avisos.server");
          const res = await enviarEmailsAviso(avisoInserido.id);
          if (res.enviados > 0) {
            await supabaseAdmin
              .from('avisos_mural')
              .update({ email_enviado_em: new Date().toISOString() })
              .eq('id', avisoInserido.id);
          }
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

    const { enviarEmailsAviso } = await import("@/lib/mural-avisos.server");
    const res = await enviarEmailsAviso(data.avisoId);

    if (res.enviados === 0) {
      throw new Error(
        res.motivo ??
          "Nenhum e-mail pôde ser enviado. Verifique as configurações de SMTP em Configurações do Sistema.",
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from('avisos_mural')
      .update({ email_enviado_em: new Date().toISOString() })
      .eq('id', data.avisoId);

    return {
      success: true,
      enviados: res.enviados,
      falhas: res.falhas,
      destinatarios: res.destinatarios,
      motivo: res.motivo,
    };

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

const editarAvisoSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
  subtitulo: z.string().optional().nullable(),
  mensagem: z.string().min(5, "Mensagem deve ter no mínimo 5 caracteres"),
  tipo: z.enum(['informativo', 'urgente', 'manutencao']),
  prioridade: z.enum(['baixa', 'normal', 'alta', 'critica']),
  data_fim: z.string().optional().nullable(),
  fixado: z.boolean().default(false),
  ativo: z.boolean().default(true),
  ativa_modo_manutencao: z.boolean().optional(),
});

export const editarAviso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => editarAvisoSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from('usuarios')
      .select('id, perfil:perfis(codigo)')
      .eq('id', userId)
      .maybeSingle();

    const role = (profile?.perfil as { codigo: string } | null)?.codigo ?? null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: atual, error: erroBusca } = await supabaseAdmin
      .from('avisos_mural')
      .select('id, criado_por, tipo, ativa_modo_manutencao')
      .eq('id', data.id)
      .maybeSingle();

    if (erroBusca) throw erroBusca;
    if (!atual) throw new Error("Aviso não encontrado");

    const isGestao = role === 'MASTER' || role === 'GESTOR';
    const isAutor = atual.criado_por === userId;
    if (!isGestao && !isAutor) {
      throw new Error("Não autorizado");
    }

    const ativaManutencao =
      data.ativa_modo_manutencao ?? (atual.ativa_modo_manutencao ?? false);

    const { data: atualizado, error } = await supabaseAdmin
      .from('avisos_mural')
      .update({
        titulo: data.titulo,
        subtitulo: data.subtitulo ?? null,
        mensagem: data.mensagem,
        tipo: data.tipo,
        prioridade: data.prioridade,
        data_fim: data.data_fim ? data.data_fim : null,
        fixado: data.fixado,
        ativo: data.ativo,
        ativa_modo_manutencao: data.tipo === 'manutencao' ? ativaManutencao : false,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', data.id)
      .select('*')
      .single();

    if (error) throw error;

    // Mantém o modo manutenção coerente com o estado final do aviso.
    const { lerConfigManutencao, aplicarModoManutencao } = await import("@/lib/manutencao.server");
    const cfg = await lerConfigManutencao();
    const deveBloquear = data.tipo === 'manutencao' && data.ativo && ativaManutencao;

    if (deveBloquear && cfg?.aviso_manutencao_id !== data.id) {
      await aplicarModoManutencao(data.id, userId);
    } else if (!deveBloquear && cfg?.aviso_manutencao_id === data.id) {
      await aplicarModoManutencao(null, userId);
    }

    return atualizado;
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

