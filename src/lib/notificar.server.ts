import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail, generateEmailTemplate } from "./email.server";
import { logger } from "./logger";

/**
 * PONTO ÚNICO DE NOTIFICAÇÃO DO SISTEMA
 * -----------------------------------------------------------------------------
 * Toda rotina que precisa avisar alguém (pendências, competências, folhas,
 * prazos, documentos, anexos) deve usar `notificarUsuarios`. Ela:
 *  - valida canal/tipo/prioridade contra os valores aceitos pelo banco
 *    (o motivo histórico de avisos perdidos: canais "in_app"/"sistema" inválidos);
 *  - grava a notificação interna (sino/lista) de forma idempotente;
 *  - dispara o e-mail quando solicitado;
 *  - registra TUDO em `logs_notificacoes`, para que a tela "Notificações (Logs)"
 *    e a tela "Notificações" contem a mesma história — inclusive as falhas.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

export const CANAIS_VALIDOS = ["interno", "email", "sms", "push"] as const;
export const TIPOS_VALIDOS = [
  "info",
  "sucesso",
  "alerta",
  "erro",
  "pendencia",
  "aprovacao",
  "sistema",
] as const;
export const PRIORIDADES_VALIDAS = ["baixa", "normal", "alta", "urgente"] as const;

export type NotifTipo = (typeof TIPOS_VALIDOS)[number];
export type NotifPrioridade = (typeof PRIORIDADES_VALIDAS)[number];
export type NotifCanal = (typeof CANAIS_VALIDOS)[number];

export type NotificarInput = {
  destinatarios: Array<string | null | undefined>;
  titulo: string;
  mensagem: string;
  tipo?: string | null;
  prioridade?: string | null;
  canal?: string | null;
  link?: string | null;
  entidade_tipo?: string | null;
  entidade_id?: string | null;
  metadata?: Record<string, unknown>;
  /** Idempotência por evento de domínio: não duplica aviso do mesmo evento. */
  eventoId?: string | null;
  criadoPor?: string | null;
  /** Envia e-mail além do aviso interno. */
  email?: boolean;
  emailAssunto?: string | null;
  emailCtaLabel?: string | null;
  emailDetalhes?: Array<{ label: string; value: string }>;
  /** Cliente Supabase service-role alternativo (ex.: worker de eventos). */
  client?: Supa;
};

export type NotificarResultado = {
  usuarios: number;
  notificacoes: number;
  ja_existentes: number;
  notificacoes_falhas: number;
  emails: number;
  emails_ja_existentes: number;
  emails_falhos: number;
  erro: string | null;
};

export function normalizarTipo(v: string | null | undefined): NotifTipo {
  return (TIPOS_VALIDOS as readonly string[]).includes(v ?? "") ? (v as NotifTipo) : "info";
}

export function normalizarPrioridade(v: string | null | undefined): NotifPrioridade {
  return (PRIORIDADES_VALIDAS as readonly string[]).includes(v ?? "")
    ? (v as NotifPrioridade)
    : "normal";
}

/** Canais inválidos ("in_app", "sistema", etc.) caem para "interno". */
export function normalizarCanal(v: string | null | undefined): NotifCanal {
  return (CANAIS_VALIDOS as readonly string[]).includes(v ?? "") ? (v as NotifCanal) : "interno";
}

/** Registra o resultado do aviso interno no mesmo log visto em "Notificações (Logs)". */
async function registrarLog(
  supa: Supa,
  entrada: { destinatario: string; assunto: string; status: "enviado" | "erro"; detalhe?: string },
) {
  try {
    await supa.from("logs_notificacoes").insert({
      destinatario: entrada.destinatario.slice(0, 300),
      assunto: entrada.assunto.slice(0, 300),
      status: entrada.status,
      detalhe_erro: entrada.detalhe?.slice(0, 500) ?? null,
    } as never);
  } catch (err) {
    logger.error("notificar.log_erro", { error: err instanceof Error ? err.message : String(err) });
  }
}

function baseUrl() {
  return process.env.VITE_APP_URL || process.env.SITE_URL || "https://hsmgestao.lovable.app";
}


async function claimEntrega(
  supa: Supa,
  eventoId: string,
  canal: "in_app" | "email",
  destinatario: string,
): Promise<"reservada" | "duplicada" | "em_andamento" | "indisponivel" | "erro"> {
  const { data, error } = await supa.rpc("claim_notificacao_evento_entrega", {
    p_evento_id: eventoId,
    p_canal: canal,
    p_destinatario: destinatario,
    p_payload: null,
    p_lease_segundos: 900,
  });

  if (error) {
    const detalhe = (error.code ?? "") + " " + (error.message ?? "");
    if (/PGRST202|PGRST205|42P01|42883|does not exist|schema cache/i.test(detalhe)) {
      return "indisponivel";
    }
    logger.error("notificar.ledger_reserva_erro", { eventoId, canal, error: error.message });
    return "erro";
  }

  if (data === true) return "reservada";

  // A RPC retorna false tanto para eventos já enviados quanto para reservas
  // ainda em processamento. Diferencia os estados para não fechar competência
  // enquanto outro worker ainda tenta entregar o aviso interno.
  const { data: atual, error: consultaError } = await supa
    .from("notificacao_evento_entregas")
    .select("status")
    .eq("evento_id", eventoId)
    .eq("canal", canal)
    .eq("destinatario", destinatario)
    .maybeSingle();

  if (consultaError) {
    logger.error("notificar.ledger_status_erro", {
      eventoId,
      canal,
      destinatario,
      error: consultaError.message,
    });
    return "erro";
  }

  if (atual?.status === "enviado") return "duplicada";
  if (atual?.status === "processando") return "em_andamento";
  return "erro";
}

async function atualizarEntrega(
  supa: Supa,
  eventoId: string,
  canal: "in_app" | "email",
  destinatario: string,
  status: "enviado" | "falhou",
  detalhe?: string,
) {
  const agora = new Date().toISOString();
  const { error } = await supa
    .from("notificacao_evento_entregas")
    .update({
      status,
      erro: status === "falhou" ? (detalhe ?? "Falha não especificada").slice(0, 1000) : null,
      atualizado_em: agora,
      entregue_em: status === "enviado" ? agora : null,
    })
    .eq("evento_id", eventoId)
    .eq("canal", canal)
    .eq("destinatario", destinatario);

  if (error) {
    logger.error("notificar.ledger_update_erro", {
      eventoId,
      canal,
      destinatario,
      error: error.message,
    });
  }
}

export async function notificarUsuarios(input: NotificarInput): Promise<NotificarResultado> {
  const supa: Supa = input.client ?? supabaseAdmin;
  const resultado: NotificarResultado = {
    usuarios: 0,
    notificacoes: 0,
    ja_existentes: 0,
    notificacoes_falhas: 0,
    emails: 0,
    emails_ja_existentes: 0,
    emails_falhos: 0,
    erro: null,
  };

  const ids = Array.from(new Set(input.destinatarios.filter((x): x is string => !!x)));
  if (ids.length === 0) return resultado;
  resultado.usuarios = ids.length;

  const tipo = normalizarTipo(input.tipo);
  const prioridade = normalizarPrioridade(input.prioridade);
  const canal = normalizarCanal(input.canal);
  const assuntoLog = "[Sino] " + input.titulo;

  // 1) Verifica o histórico in-app. A reserva atômica protege chamadas concorrentes.
  let alvosInApp: string[] = [];
  const reservasInApp: string[] = [];

  if (input.eventoId) {
    const { data: existentes, error } = await supa
      .from("notificacoes")
      .select("usuario_id")
      .in("usuario_id", ids)
      .contains("metadata", { evento_id: input.eventoId });

    if (error) {
      resultado.erro = error.message;
      resultado.notificacoes_falhas += ids.length;
      logger.error("notificar.inapp_consulta_erro", { error: error.message, eventoId: input.eventoId });
    } else {
      const jaTem = new Set(
        ((existentes ?? []) as Array<{ usuario_id: string }>).map((r) => r.usuario_id),
      );

      for (const id of ids) {
        if (jaTem.has(id)) {
          resultado.ja_existentes++;
          continue;
        }

        const reserva = await claimEntrega(supa, input.eventoId, "in_app", id);
        if (reserva === "duplicada") {
          resultado.ja_existentes++;
        } else if (
          reserva === "erro" ||
          reserva === "indisponivel" ||
          reserva === "em_andamento"
        ) {
          resultado.notificacoes_falhas++;
          resultado.erro =
            resultado.erro ??
            (reserva === "indisponivel"
              ? "A migration de entregas de notificações precisa ser aplicada no Supabase."
              : reserva === "em_andamento"
                ? "A entrega da notificação ainda está em processamento."
                : "Não foi possível reservar a entrega da notificação.");
        } else {
          alvosInApp.push(id);
          reservasInApp.push(id);
        }
      }
    }
  } else {
    alvosInApp = ids;
  }

  // 2) Grava o sino sem condicionar o envio de e-mail ao resultado deste canal.
  if (alvosInApp.length > 0) {
    const rows = alvosInApp.map((usuario_id) => ({
      usuario_id,
      titulo: input.titulo,
      mensagem: input.mensagem,
      tipo,
      prioridade,
      canal,
      link: input.link ?? null,
      entidade_tipo: input.entidade_tipo ?? null,
      entidade_id: input.entidade_id ?? null,
      created_by: input.criadoPor ?? null,
      metadata: {
        ...(input.metadata ?? {}),
        ...(input.eventoId ? { evento_id: input.eventoId } : {}),
      },
    }));

    const { error, count } = await supa
      .from("notificacoes")
      .insert(rows as never, { count: "exact" });

    if (error) {
      resultado.erro = resultado.erro ?? error.message;
      resultado.notificacoes_falhas += alvosInApp.length;
      logger.error("notificar.inapp_erro", { error: error.message, titulo: input.titulo, tipo, canal });
      await registrarLog(supa, {
        destinatario: "sino: " + alvosInApp.length + " usuário(s)",
        assunto: assuntoLog,
        status: "erro",
        detalhe: error.message,
      });
      if (input.eventoId) {
        for (const id of reservasInApp) {
          await atualizarEntrega(supa, input.eventoId, "in_app", id, "falhou", error.message);
        }
      }
    } else {
      resultado.notificacoes = count ?? alvosInApp.length;
      await registrarLog(supa, {
        destinatario: "sino: " + resultado.notificacoes + " usuário(s)",
        assunto: assuntoLog,
        status: "enviado",
      });
      if (input.eventoId) {
        for (const id of reservasInApp) {
          await atualizarEntrega(supa, input.eventoId, "in_app", id, "enviado");
        }
      }
    }
  }

  // 3) E-mail é calculado a partir dos destinatários originais (não dos pendentes do sino).
  // Assim, um sino já entregue não impede um e-mail que falhou de ser tentado novamente.
  if (input.email) {
    const { data: usuarios, error: usuariosError } = await supa
      .from("usuarios")
      .select("id, email")
      .in("id", ids)
      .eq("status", "ativo")
      .is("deleted_at", null);

    if (usuariosError) {
      resultado.emails_falhos++;
      resultado.erro = resultado.erro ?? usuariosError.message;
      logger.error("notificar.email_destinatarios_erro", { error: usuariosError.message });
    } else {
      const emails = [
        ...new Map(
          ((usuarios ?? []) as Array<{ email: string | null }>)
            .filter((u) => !!u.email && u.email.includes("@"))
            .map((u) => [u.email!.trim().toLowerCase(), u.email!.trim()]),
        ).values(),
      ];

      for (const email of emails) {
        try {
          const html = generateEmailTemplate({
            title: input.titulo,
            message: input.mensagem,
            ctaLabel: input.link ? (input.emailCtaLabel ?? "Abrir no Sistema") : undefined,
            ctaUrl: input.link ? baseUrl() + input.link : undefined,
            details: input.emailDetalhes,
          });
          const envio = await sendEmail({
            to: email,
            subject: input.emailAssunto ?? "[HSM Gestão] " + input.titulo,
            html,
            idempotencyKey: input.eventoId ?? undefined,
          });

          if ("duplicate" in envio && envio.duplicate) {
            resultado.emails_ja_existentes++;
            continue;
          }
          if (envio.success) resultado.emails++;
          else {
            resultado.emails_falhos++;
            const detalhe =
              "error" in envio && envio.error instanceof Error
                ? envio.error.message
                : "Falha SMTP";
            resultado.erro = resultado.erro ?? detalhe;
          }
        } catch (error) {
          resultado.emails_falhos++;
          const detalhe = error instanceof Error ? error.message : String(error);
          resultado.erro = resultado.erro ?? detalhe;
          logger.error("notificar.email_excecao", {
            email,
            titulo: input.titulo,
            error: detalhe,
          });
        }
      }
    }
  }

  return resultado;
}
