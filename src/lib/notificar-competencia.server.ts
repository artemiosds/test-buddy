import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logger } from "./logger";
import { notificarUsuarios } from "./notificar.server";

type Resultado = {
  usuarios: number;
  notificacoes: number;
  notificacoes_ja_existentes: number;
  notificacoes_falhas: number;
  emails: number;
  emails_ja_enviados: number;
  emails_falhos: number;
  aviso_id: string | null;
  aviso_reutilizado: boolean;
  erro: string | null;
};

const resultadoVazio = (erro: string | null = null): Resultado => ({
  usuarios: 0,
  notificacoes: 0,
  notificacoes_ja_existentes: 0,
  notificacoes_falhas: 0,
  emails: 0,
  emails_ja_enviados: 0,
  emails_falhos: 0,
  aviso_id: null,
  aviso_reutilizado: false,
  erro,
});

/**
 * Notifica usuários ativos vinculados às unidades da secretaria sobre a abertura
 * da competência: sino, mural e e-mail. A chave estável usa o ID da competência,
 * não apenas mês/ano, para evitar colisões entre secretarias.
 */
export async function notificarNovaCompetencia(
  competenciaId: string,
  criadoPor?: string,
): Promise<Resultado> {
  const { data: comp, error: compError } = await supabaseAdmin
    .from("competencias")
    .select("id, ano, mes, prazo_envio, prazo_analise, secretaria_id, secretarias(nome)")
    .eq("id", competenciaId)
    .maybeSingle();

  if (compError || !comp) {
    logger.error("competencia.notificar.competencia_erro", {
      competenciaId,
      error: compError?.message ?? "Competência não encontrada",
    });
    return resultadoVazio(compError?.message ?? "Competência não encontrada.");
  }

  const competenciaStr = String(comp.mes).padStart(2, "0") + "/" + comp.ano;
  const secretariaNome = (comp.secretarias as { nome?: string } | null)?.nome ?? "Secretaria";
  const fmt = (d: string | null) =>
    d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "não definido";

  // 1. Unidades ativas da secretaria.
  const { data: unidades, error: unidadesError } = await supabaseAdmin
    .from("unidades")
    .select("id")
    .eq("secretaria_id", comp.secretaria_id)
    .eq("status", "ativa");

  if (unidadesError) {
    logger.error("competencia.notificar.unidades_erro", {
      competenciaId,
      error: unidadesError.message,
    });
    return resultadoVazio(unidadesError.message);
  }

  const unidadeIds = (unidades ?? []).map((u) => u.id as string);
  const alvos = new Map<string, { id: string; email: string | null; nome: string }>();

  // 2. Usuários ativos vinculados às unidades.
  if (unidadeIds.length > 0) {
    const { data: vinculos, error: vinculosError } = await supabaseAdmin
      .from("usuario_unidades")
      .select("usuario_id")
      .in("unidade_id", unidadeIds)
      .is("data_fim", null);

    if (vinculosError) {
      logger.error("competencia.notificar.vinculos_erro", {
        competenciaId,
        error: vinculosError.message,
      });
      return resultadoVazio(vinculosError.message);
    }

    const ids = [...new Set((vinculos ?? []).map((v) => v.usuario_id as string))];
    if (ids.length > 0) {
      const { data: usuarios, error: usuariosError } = await supabaseAdmin
        .from("usuarios")
        .select("id, email, nome_completo")
        .in("id", ids)
        .eq("status", "ativo")
        .is("deleted_at", null);

      if (usuariosError) {
        logger.error("competencia.notificar.usuarios_erro", {
          competenciaId,
          error: usuariosError.message,
        });
        return resultadoVazio(usuariosError.message);
      }

      for (const usuario of usuarios ?? []) {
        alvos.set(usuario.id as string, {
          id: usuario.id as string,
          email: (usuario.email as string) ?? null,
          nome: (usuario.nome_completo as string) ?? "",
        });
      }
    }
  }

  // 3. Usuários da secretaria com acesso amplo, mesmo sem vínculo individual.
  const { data: amplos, error: amplosError } = await supabaseAdmin
    .from("usuarios")
    .select("id, email, nome_completo")
    .eq("secretaria_id", comp.secretaria_id)
    .eq("acesso_todas_unidades", true)
    .eq("status", "ativo")
    .is("deleted_at", null);

  if (amplosError) {
    logger.error("competencia.notificar.acesso_amplo_erro", {
      competenciaId,
      error: amplosError.message,
    });
    return resultadoVazio(amplosError.message);
  }

  for (const usuario of amplos ?? []) {
    alvos.set(usuario.id as string, {
      id: usuario.id as string,
      email: (usuario.email as string) ?? null,
      nome: (usuario.nome_completo as string) ?? "",
    });
  }

  const destinatarios = [...alvos.values()];
  if (destinatarios.length === 0) {
    logger.warn("competencia.notificar.sem_destinatarios", { competenciaId });
    return resultadoVazio("Nenhum usuário ativo está vinculado às unidades desta secretaria.");
  }

  const eventoId = "competencia_aberta:" + competenciaId;
  const titulo = "Nova competência aberta: " + competenciaStr + " — " + secretariaNome;
  const mensagem =
    "A competência " + competenciaStr + " foi aberta para " + secretariaNome + ". " +
    "Prazo de envio das folhas: " + fmt(comp.prazo_envio as string | null) + ". " +
    "Prazo de análise: " + fmt(comp.prazo_analise as string | null) + ".";

  // 4. Compatibilidade com avisos in-app anteriores: marca o evento em notificações
  // antigas da mesma competência antes de passar pelo controlador idempotente central.
  const { data: antigas, error: antigasError } = await supabaseAdmin
    .from("notificacoes")
    .select("id, metadata")
    .eq("entidade_tipo", "competencia")
    .eq("entidade_id", competenciaId)
    .eq("titulo", "Nova competência aberta: " + competenciaStr);

  if (antigasError) {
    logger.error("competencia.notificar.historico_erro", {
      competenciaId,
      error: antigasError.message,
    });
    return resultadoVazio(antigasError.message);
  }

  for (const antiga of antigas ?? []) {
    const metadata =
      antiga.metadata && typeof antiga.metadata === "object"
        ? (antiga.metadata as Record<string, unknown>)
        : {};
    if (metadata.evento_id === eventoId) continue;

    const { error } = await supabaseAdmin
      .from("notificacoes")
      .update({ metadata: { ...metadata, evento_id: eventoId } } as never)
      .eq("id", antiga.id);

    if (error) {
      logger.error("competencia.notificar.historico_migracao_erro", {
        competenciaId,
        notificacaoId: antiga.id,
        error: error.message,
      });
      return resultadoVazio(error.message);
    }
  }

  // 5. Sino e e-mail passam pelo mesmo controlador, mas têm idempotência própria
  // por canal/destinatário; falha SMTP não faz o sino ser enviado novamente.
  const entrega = await notificarUsuarios({
    destinatarios: destinatarios.map((u) => u.id),
    titulo,
    mensagem,
    tipo: "sistema",
    prioridade: "alta",
    canal: "interno",
    link: "/frequencias",
    entidade_tipo: "competencia",
    entidade_id: competenciaId,
    eventoId,
    criadoPor,
    email: true,
    emailAssunto:
      "[Aviso] Nova Competência Aberta: " + competenciaStr + " — " + secretariaNome,
    emailCtaLabel: "Acessar Sistema",
    emailDetalhes: [
      { label: "Competência", value: competenciaStr },
      { label: "Secretaria", value: secretariaNome },
      { label: "Prazo de Envio", value: fmt(comp.prazo_envio as string | null) },
      { label: "Prazo de Análise", value: fmt(comp.prazo_analise as string | null) },
    ],
  });

  if (entrega.erro || entrega.emails_falhos > 0 || entrega.notificacoes_falhas > 0) {
    logger.error("competencia.notificar.entrega_com_falha", {
      competenciaId,
      error: entrega.erro,
      emails_falhos: entrega.emails_falhos,
      notificacoes_falhas: entrega.notificacoes_falhas,
    });
  }

  let erro = entrega.erro;

  // 6. Aviso no mural. O título inclui a secretaria para não reutilizar aviso
  // de outra secretaria que abriu uma competência no mesmo mês/ano.
  let avisoId: string | null = null;
  let avisoReutilizado = false;
  const dataFimAviso = (comp.prazo_envio as string | null) ?? null;

  const { data: avisoExistente, error: avisoBuscaError } = await supabaseAdmin
    .from("avisos_mural")
    .select("id")
    .eq("titulo", titulo)
    .eq("ativo", true)
    .order("criado_em", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (avisoBuscaError) {
    erro = erro ?? avisoBuscaError.message;
    logger.error("competencia.notificar.mural_busca_erro", {
      competenciaId,
      error: avisoBuscaError.message,
    });
  } else if (avisoExistente?.id) {
    avisoId = avisoExistente.id as string;
    avisoReutilizado = true;
    const { error } = await supabaseAdmin
      .from("avisos_mural")
      .update({ mensagem, data_fim: dataFimAviso } as never)
      .eq("id", avisoId);
    if (error) {
      erro = erro ?? error.message;
      logger.error("competencia.notificar.mural_update_erro", {
        competenciaId,
        error: error.message,
      });
    }
  } else {
    const { data: aviso, error } = await supabaseAdmin
      .from("avisos_mural")
      .insert({
        titulo,
        mensagem,
        tipo: "informativo",
        prioridade: "alta",
        fixado: true,
        destinatarios:
          unidadeIds.length > 0 ? { tipo: "unidades", valores: unidadeIds } : { tipo: "todos" },
        data_inicio: new Date().toISOString().split("T")[0],
        data_fim: dataFimAviso,
        ativo: true,
        criado_por: criadoPor ?? null,
      } as never)
      .select("id")
      .maybeSingle();

    if (error) {
      erro = erro ?? error.message;
      logger.error("competencia.notificar.mural_erro", {
        competenciaId,
        error: error.message,
      });
    } else {
      avisoId = (aviso?.id as string) ?? null;
    }
  }

  return {
    usuarios: entrega.usuarios,
    notificacoes: entrega.notificacoes,
    notificacoes_ja_existentes: entrega.ja_existentes,
    notificacoes_falhas: entrega.notificacoes_falhas,
    emails: entrega.emails,
    emails_ja_enviados: entrega.emails_ja_existentes,
    emails_falhos: entrega.emails_falhos,
    aviso_id: avisoId,
    aviso_reutilizado: avisoReutilizado,
    erro,
  };
}
