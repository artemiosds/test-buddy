import { logger } from "./logger";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolverCredenciaisSmtp, criarTransporter } from "./configuracoes-smtp.server";

/**
 * Helper para envio de e-mails via SMTP.
 * Credenciais: 1) public.configuracoes_sistema (painel de Configurações),
 *              2) variáveis de ambiente (SMTP_HOST, SMTP_PORT, ...) como fallback.
 *
 * Este arquivo é seguro para importação em funções de servidor (*.functions.ts ou *.server.ts).
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}) {
  const resolvido = await resolverCredenciaisSmtp();

  if (!resolvido.ok) {
    logger.warn("email.send.skipped", { reason: resolvido.motivo, to, subject });
    return { success: false, skipped: true, error: new Error(resolvido.motivo) };
  }

  const { host, port, secure, user, pass, from, fromName } = resolvido.cred;
  const transporter = criarTransporter({ host, port, secure, user, pass });


  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${from}>`,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      text: text || "Abra este e-mail em um cliente compatível com HTML para visualizar o conteúdo.",
      html,
    });

    logger.info("email.send.success", { messageId: info.messageId, to, subject });
    
    // Log success to DB
    await supabaseAdmin.from("logs_notificacoes").insert({
      destinatario: Array.isArray(to) ? to.join(", ") : to,
      assunto: subject,
      status: "enviado",
    } as never);

    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error("email.send.error", { error, to, subject });

    // Log error to DB
    await supabaseAdmin.from("logs_notificacoes").insert({
      destinatario: Array.isArray(to) ? to.join(", ") : to,
      assunto: subject,
      status: "erro",
      detalhe_erro: (error as Error)?.message || String(error),
    } as never);

    return { success: false, error };
  }
}

/**
 * Gera o template HTML padrão para notificações do sistema.
 */
export function generateEmailTemplate({
  title,
  message,
  ctaLabel,
  ctaUrl,
  details,
}: {
  title: string;
  message: string;
  ctaLabel?: string;
  ctaUrl?: string;
  details?: { label: string; value: string }[];
}) {
  const detailsHtml = details
    ?.map(
      (d) => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #edf2f7; color: #4a5568; font-size: 14px;"><strong>${d.label}:</strong></td>
      <td style="padding: 8px 0; border-bottom: 1px solid #edf2f7; color: #2d3748; font-size: 14px; text-align: right;">${d.value}</td>
    </tr>
  `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #2d3748; margin: 0; padding: 0; background-color: #f7fafc; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background-color: #0d9488; color: white; padding: 24px; text-align: center; }
        .content { padding: 32px; }
        .footer { background-color: #f7fafc; color: #718096; padding: 24px; text-align: center; font-size: 12px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #0d9488; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 24px; }
        .details-table { width: 100%; border-collapse: collapse; margin: 24px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 20px;">${title}</h1>
        </div>
        <div class="content">
          <p style="font-size: 16px; margin-top: 0;">${message}</p>
          
          ${
            detailsHtml
              ? `<table class="details-table">${detailsHtml}</table>`
              : ""
          }

          ${
            ctaUrl && ctaLabel
              ? `<div style="text-align: center;"><a href="${ctaUrl}" class="button">${ctaLabel}</a></div>`
              : ""
          }
          
          <p style="margin-top: 32px; font-size: 14px; color: #718096;">
            Data/Hora da Ação: ${new Date().toLocaleString("pt-BR")}
          </p>
        </div>
        <div class="footer">
          <p>Secretaria Municipal de Saúde — Oriximiná, Pará</p>
          <p>Este é um e-mail automático, por favor não responda.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
