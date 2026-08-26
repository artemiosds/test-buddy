import nodemailer from "nodemailer";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const SENHA_MASCARA = "••••••••";
export const CHAVE_SMTP = "smtp_principal";

export type SmtpConfigRow = {
  id: string;
  chave: string;
  smtp_host: string | null;
  smtp_port: number;
  smtp_user: string | null;
  smtp_password: string | null;
  smtp_from_email: string | null;
  smtp_from_name: string;
  smtp_secure: boolean;
  smtp_ativo: boolean;
  updated_at: string;
  updated_by: string | null;
};

/** Lê o registro salvo de SMTP (com senha em claro). Uso restrito ao servidor. */
export async function lerConfigSmtpDb(): Promise<SmtpConfigRow | null> {
  const { data, error } = await supabaseAdmin
    .from("configuracoes_sistema" as never)
    .select("*")
    .eq("chave", CHAVE_SMTP)
    .maybeSingle();
  if (error) return null;
  return (data as SmtpConfigRow | null) ?? null;
}

export type CredenciaisSmtp = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  fromName: string;
  origem: "banco" | "env";
};

/**
 * Resolve as credenciais SMTP efetivas:
 * 1) registro ativo em configuracoes_sistema
 * 2) variáveis de ambiente (fallback)
 * Retorna null quando não há credenciais completas, ou quando o serviço está desativado.
 */
export async function resolverCredenciaisSmtp(): Promise<
  { ok: true; cred: CredenciaisSmtp } | { ok: false; motivo: string }
> {
  const row = await lerConfigSmtpDb();

  if (row && row.smtp_ativo === false) {
    return { ok: false, motivo: "Serviço de e-mail desativado nas Configurações do Sistema." };
  }

  if (row?.smtp_host && row.smtp_user && row.smtp_password) {
    return {
      ok: true,
      cred: {
        host: row.smtp_host,
        port: row.smtp_port || 587,
        secure: row.smtp_secure ?? row.smtp_port === 465,
        user: row.smtp_user,
        pass: row.smtp_password,
        from: row.smtp_from_email || row.smtp_user,
        fromName: row.smtp_from_name || "HSM Gestão — SMS Oriximiná",
        origem: "banco",
      },
    };
  }

  const host = process.env.SMTP_HOST || process.env.VITE_SMTP_HOST;
  const user = process.env.SMTP_USER || process.env.VITE_SMTP_USER;
  const pass = process.env.SMTP_PASSWORD || process.env.VITE_SMTP_PASSWORD;
  const portStr = process.env.SMTP_PORT || process.env.VITE_SMTP_PORT;
  const from = process.env.SMTP_FROM || process.env.VITE_SMTP_FROM || user;
  const fromName = process.env.SMTP_FROM_NAME || "HSM Gestão — SMS Oriximiná";

  if (!host || !user || !pass) {
    const faltando = [
      !host ? "SMTP_HOST" : null,
      !user ? "SMTP_USER" : null,
      !pass ? "SMTP_PASSWORD" : null,
    ].filter(Boolean);
    return { ok: false, motivo: `Configuração SMTP incompleta. Faltando: ${faltando.join(", ")}` };
  }

  const port = Number(portStr || (host.includes("gmail.com") ? 587 : 465));
  return {
    ok: true,
    cred: { host, port, secure: port === 465, user, pass, from: from!, fromName, origem: "env" },
  };
}

export function criarTransporter(cred: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}) {
  return nodemailer.createTransport({
    host: cred.host,
    port: cred.port,
    secure: cred.secure,
    auth: { user: cred.user, pass: cred.pass },
    tls: { rejectUnauthorized: false },
  });
}
