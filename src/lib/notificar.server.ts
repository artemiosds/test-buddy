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
  emails: number;
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

export async function notificarUsuarios(input: NotificarInput): Promise<NotificarResultado> {
  const supa: Supa = input.client ?? supabaseAdmin;
  const resultado: NotificarResultado = {
    usuarios: 0,
    notificacoes: 0,
    ja_existentes: 0,
    emails: 0,
    emails_falhos: 0,
    erro: null,
  };

  const ids = Array.from(new Set(input.destinatarios.filter((x): x is string => !!x)));
  if (ids.length === 0) return resultado;
  resultado.usuarios = ids.length;

  const tipo = normalizarTipo(input.tipo);
  const prioridade = normalizarPrioridade(input.prioridade);
  const canal = normalizarCanal(input.canal);
  const assuntoLog = `[Sino] ${input.titulo}`;

  // 1) Idempotência por evento de domínio.
  let alvos = ids;
  if (input.eventoId) {
    const { data: existentes } = await supa
      .from("notificacoes")
      .select("usuario_id")
      .in("usuario_id", ids)
      .contains("metadata", { evento_id: input.eventoId });
    const jaTem = new Set(
      ((existentes ?? []) as Array<{ usuario_id: string }>).map((r) => r.usuario_id),
    );
    alvos = ids.filter((id) => !jaTem.has(id));
    resultado.ja_existentes = ids.length - alvos.length;
  }

  // 2) Aviso interno (sino/lista).
  if (alvos.length > 0) {
    const rows = alvos.map((usuario_id) => ({
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
      resultado.erro = error.message;
      logger.error("notificar.inapp_erro", { error: error.message, titulo: input.titulo, tipo, canal });
      await registrarLog(supa, {
        destinatario: `sino: ${alvos.length} usuário(s)`,
        assunto: assuntoLog,
        status: "erro",
        detalhe: error.message,
      });
    } else {
      resultado.notificacoes = count ?? alvos.length;
      await registrarLog(supa, {
        destinatario: `sino: ${resultado.notificacoes} usuário(s)`,
        assunto: assuntoLog,
        status: "enviado",
      });
    }
  }

  // 3) E-mail (opcional). O próprio sendEmail registra em logs_notificacoes.
  if (input.email && alvos.length > 0) {
    try {
      const { data: usuarios } = await supa
        .from("usuarios")
        .select("id, email")
        .in("id", alvos)
        .eq("status", "ativo")
        .is("deleted_at", null);

      const emails = [
        ...new Set(
          ((usuarios ?? []) as Array<{ email: string | null }>)
            .map((u) => u.email)
            .filter((e): e is string => !!e && e.includes("@")),
        ),
      ];

      for (const email of emails) {
        const html = generateEmailTemplate({
          title: input.titulo,
          message: input.mensagem,
          ctaLabel: input.link ? (input.emailCtaLabel ?? "Abrir no Sistema") : undefined,
          ctaUrl: input.link ? `${baseUrl()}${input.link}` : undefined,
          details: input.emailDetalhes,
        });
        const r = await sendEmail({
          to: email,
          subject: input.emailAssunto ?? `[HSM Gestão] ${input.titulo}`,
          html,
        });
        if (r.success) resultado.emails++;
        else resultado.emails_falhos++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      resultado.erro = resultado.erro ?? msg;
      logger.error("notificar.email_erro", { error: msg, titulo: input.titulo });
      await registrarLog(supa, {
        destinatario: "e-mail (destinatários não resolvidos)",
        assunto: `[HSM Gestão] ${input.titulo}`,
        status: "erro",
        detalhe: msg,
      });
    }
  }

  return resultado;
}
