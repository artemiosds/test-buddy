// Sublote 6B — Auditoria de ações críticas iniciadas no cliente.
// Encaminha para RPC log_client_action (SECURITY DEFINER) que força
// usuario_id = auth.uid() e restringe operacao a login|logout|custom.
// Nunca derruba a operação de negócio — falhas são apenas logadas.

import { supabase } from "@/integrations/supabase/client";
import { logger } from "./logger";

export type AuditOperacao = "login" | "logout" | "custom";

// Catálogo de ações auditáveis a partir do cliente.
export const AUDIT_ACOES = {
  // Autenticação
  LOGIN_SUCESSO:        "auth.login_sucesso",
  LOGIN_FALHA:          "auth.login_falha",
  LOGOUT:               "auth.logout",
  MFA_CHALLENGE_INICIADO:"auth.mfa_challenge",
  MFA_VERIFICADO:       "auth.mfa_verificado",
  MFA_FALHA:            "auth.mfa_falha",
  MFA_ATIVADO:          "auth.mfa_ativado",
  MFA_REMOVIDO:         "auth.mfa_removido",
  BACKUP_CODES_GERADOS: "auth.backup_codes_gerados",

  // Exportação / Impressão
  EXPORT_CSV:           "export.csv",
  EXPORT_PDF:           "export.pdf",
  IMPRESSAO:            "export.impressao",

  // Assinatura digital
  ASSINATURA_APLICADA:  "assinatura.aplicada_client",
} as const;

export type AuditAcao = (typeof AUDIT_ACOES)[keyof typeof AUDIT_ACOES] | string;

interface LogOpts {
  contexto?: Record<string, unknown>;
  registro_id?: string | null;
  tabela?: string | null;
}

function safeUserAgent(): string | null {
  if (typeof navigator === "undefined") return null;
  return navigator.userAgent ?? null;
}

async function callRpc(operacao: AuditOperacao, acao: AuditAcao, opts: LogOpts = {}) {
  try {
    const { error } = await supabase.rpc("log_client_action", {
      _operacao: operacao,
      _acao: acao,
      _contexto: (opts.contexto ?? {}) as never,
      _user_agent: safeUserAgent(),
      _registro_id: opts.registro_id ?? null,
      _tabela: opts.tabela ?? "_client_action",
    });
    if (error) {
      logger.warn("audit_client.rpc_error", { acao, message: error.message });
    }
  } catch (e) {
    logger.warn("audit_client.exception", { acao, message: (e as Error).message });
  }
}

export const auditClient = {
  login: (acao: AuditAcao, opts?: LogOpts) => callRpc("login", acao, opts),
  logout: (acao: AuditAcao = AUDIT_ACOES.LOGOUT, opts?: LogOpts) =>
    callRpc("logout", acao, opts),
  action: (acao: AuditAcao, opts?: LogOpts) => callRpc("custom", acao, opts),
};