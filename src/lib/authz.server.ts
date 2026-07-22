// Server-only permission gate + catálogo de Ações + emissor de Eventos de Domínio.
// Importe SOMENTE de handlers de *.functions.ts. SupabaseClient é intencionalmente
// loose-typed para evitar acoplar Database types no call site.
import { logger } from "./logger";

// -----------------------------------------------------------------------------
// Catálogo canônico de AÇÕES do sistema (Autorização Baseada em Ação).
// Toda Server Function DEVE validar através de uma destas ações — nada de
// permissões genéricas. Ampliação: adicione a chave aqui + INSERT em
// public.permissoes via migração.
// -----------------------------------------------------------------------------
export const ACOES = {
  // Competência
  COMPETENCIA_CRIAR: "competencia.criar",
  COMPETENCIA_EDITAR: "competencia.editar",
  COMPETENCIA_REABRIR: "competencia.reabrir",
  COMPETENCIA_ENCERRAR: "competencia.encerrar",
  COMPETENCIA_ARQUIVAR: "competencia.arquivar",
  COMPETENCIA_EXCLUIR: "competencia.excluir",
  COMPETENCIA_VISUALIZAR: "competencia.visualizar",

  // Frequência
  FREQUENCIA_VISUALIZAR: "frequencia.visualizar",
  FREQUENCIA_CRIAR: "frequencia.criar",
  FREQUENCIA_EDITAR: "frequencia.editar",
  FREQUENCIA_ENVIAR: "frequencia.enviar",
  FREQUENCIA_ANALISAR: "frequencia.analisar",
  FREQUENCIA_APROVAR: "frequencia.aprovar",
  FREQUENCIA_REJEITAR: "frequencia.rejeitar",
  FREQUENCIA_REABRIR: "frequencia.reabrir",
  FREQUENCIA_ARQUIVAR: "frequencia.arquivar",
  FREQUENCIA_EXPORTAR: "frequencia.exportar",
  FREQUENCIA_EXCLUIR: "frequencia.excluir",

  // Pendência (institucional / por linha)
  PENDENCIA_VISUALIZAR: "pendencia.visualizar",
  PENDENCIA_CRIAR: "pendencia.criar",
  PENDENCIA_RESPONDER: "pendencia.responder",
  PENDENCIA_RESOLVER: "pendencia.resolver",
  PENDENCIA_ATRIBUIR: "pendencia.atribuir",
  PENDENCIA_CANCELAR: "pendencia.cancelar",
  PENDENCIA_EDITAR: "pendencia.editar",
  PENDENCIA_REABRIR: "pendencia.reabrir",
  PENDENCIA_EXPORTAR: "pendencia.exportar",
  PENDENCIA_IMPRIMIR: "pendencia.imprimir",

  // Documento
  DOCUMENTO_UPLOAD: "documento.upload",
  DOCUMENTO_DOWNLOAD: "documento.download",
  DOCUMENTO_EXCLUIR: "documento.excluir",

  // Usuário / RBAC
  USUARIO_CRIAR: "usuario.criar",
  USUARIO_EDITAR: "usuario.editar",
  USUARIO_INATIVAR: "usuario.inativar",
  USUARIO_PERMISSOES: "usuario.permissoes",

  // Assinatura / Auditoria / Config
  ASSINATURA_APLICAR: "assinatura.aplicar",
  AUDITORIA_VISUALIZAR: "auditoria.visualizar",
  CONFIGURACAO_EDITAR: "configuracao.editar",
} as const;

export type AcaoCodigo = (typeof ACOES)[keyof typeof ACOES];

// -----------------------------------------------------------------------------
// Portões de autorização
// -----------------------------------------------------------------------------
export async function ensurePermission(
  supabase: any,
  userId: string,
  codigo: AcaoCodigo | string,
  extra?: { _unidade_id?: string | null; _secretaria_id?: string | null },
) {
  const { data, error } = await supabase.rpc("has_permission", {
    _user_id: userId,
    _codigo: codigo,
    _unidade_id: extra?._unidade_id ?? null,
    _secretaria_id: extra?._secretaria_id ?? null,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Acesso negado: permissão ${codigo} necessária.`);
}

export async function ensureMaster(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_master", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas o perfil Master pode executar esta ação.");
}

// -----------------------------------------------------------------------------
// Barramento de Eventos de Domínio (arquitetura Event Driven).
// Hoje persiste em public.eventos_dominio via SECURITY DEFINER emit_evento.
// No futuro pode disparar notificações, e-mails, WhatsApp, integrações — sem
// alterar as regras de negócio de quem chama.
// -----------------------------------------------------------------------------
export const EVENTOS = {
  // Competência
  COMPETENCIA_CRIADA: "competencia.criada",
  COMPETENCIA_EDITADA: "competencia.editada",
  COMPETENCIA_REABERTA: "competencia.reaberta",
  COMPETENCIA_ENCERRADA: "competencia.encerrada",
  COMPETENCIA_ARQUIVADA: "competencia.arquivada",

  // Frequência
  FREQUENCIA_INICIADA: "frequencia.iniciada",
  FREQUENCIA_ENVIADA: "frequencia.enviada",
  FREQUENCIA_EM_ANALISE: "frequencia.em_analise",
  FREQUENCIA_APROVADA: "frequencia.aprovada",
  FREQUENCIA_REJEITADA: "frequencia.rejeitada",
  FREQUENCIA_COM_PENDENCIAS: "frequencia.com_pendencias",
  FREQUENCIA_REABERTA: "frequencia.reaberta",
  FREQUENCIA_ARQUIVADA: "frequencia.arquivada",

  // Pendência
  PENDENCIA_CRIADA: "pendencia.criada",
  PENDENCIA_ATRIBUIDA: "pendencia.atribuida",
  PENDENCIA_EM_ANALISE: "pendencia.em_analise",
  PENDENCIA_RESPONDIDA: "pendencia.respondida",
  PENDENCIA_RESOLVIDA: "pendencia.resolvida",
  PENDENCIA_REABERTA: "pendencia.reaberta",
  PENDENCIA_CANCELADA: "pendencia.cancelada",

  // Usuário / RBAC
  USUARIO_CRIADO: "usuario.criado",
  USUARIO_EDITADO: "usuario.editado",
  USUARIO_BLOQUEADO: "usuario.bloqueado",
  USUARIO_EXCLUIDO: "usuario.excluido",
  USUARIO_PERFIL_ALTERADO: "usuario.perfil_alterado",
  PERMISSAO_ALTERADA: "permissao.alterada",
  VINCULOS_ALTERADOS: "usuario.vinculos_alterados",

  // Documento / Assinatura
  DOCUMENTO_ANEXADO: "documento.anexado",
  DOCUMENTO_REMOVIDO: "documento.removido",
  ASSINATURA_APLICADA: "assinatura.aplicada",
} as const;

export type EventoTipo = (typeof EVENTOS)[keyof typeof EVENTOS];

// Eventos técnicos (observabilidade) — não substituem auditoria.
export const EVENTOS_TECNICOS = {
  SERVER_ERROR: "tech.server_error",
  VALIDATION_ERROR: "tech.validation_error",
  PERMISSION_DENIED: "tech.permission_denied",
  DATABASE_ERROR: "tech.database_error",
  UPLOAD_ERROR: "tech.upload_error",
} as const;

export type Agregado =
  | "competencia"
  | "frequencia"
  | "frequencia_profissional"
  | "pendencia"
  | "usuario"
  | "permissao"
  | "documento"
  | "assinatura"
  | "sistema";

export interface EmitEventoOptions {
  correlation_id?: string | null;
  causation_id?: string | null;
  idempotency_key?: string | null;
  versao?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Única porta de entrada para eventos. Grava em public.eventos_dominio via RPC
 * emit_evento (SECURITY DEFINER). Retorna o id do evento (ou o id existente
 * quando a idempotency_key colide). Falhas de emissão NÃO derrubam a operação.
 */
export async function emitEvento(
  supabase: any,
  tipo: EventoTipo | string,
  agregado: Agregado,
  agregado_id: string | null,
  dados: Record<string, unknown> = {},
  opts: EmitEventoOptions = {},
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("emit_evento", {
      _tipo: tipo,
      _agregado: agregado,
      _agregado_id: agregado_id,
      _dados: dados,
      _metadata: opts.metadata ?? {},
      _correlation_id: opts.correlation_id ?? null,
      _causation_id: opts.causation_id ?? null,
      _idempotency_key: opts.idempotency_key ?? null,
      _versao: opts.versao ?? 1,
    });
    if (error) {
      logger.warn("emit_evento.rpc_error", { tipo, message: error.message });
      return null;
    }
    return (data as string) ?? null;
  } catch (e) {
    logger.warn("emit_evento.exception", { tipo, message: (e as Error).message });
    return null;
  }
}

/**
 * Classifica um erro em um tipo técnico para observabilidade.
 */
function classifyError(err: Error): string {
  const m = err.message || "";
  if (/permiss[aã]o|acesso negado|apenas.*master/i.test(m))
    return EVENTOS_TECNICOS.PERMISSION_DENIED;
  if (/valida|zod|invalid input|required/i.test(m)) return EVENTOS_TECNICOS.VALIDATION_ERROR;
  if (/upload|storage|bucket/i.test(m)) return EVENTOS_TECNICOS.UPLOAD_ERROR;
  if (/duplicate key|foreign key|constraint|sql/i.test(m)) return EVENTOS_TECNICOS.DATABASE_ERROR;
  return EVENTOS_TECNICOS.SERVER_ERROR;
}

/**
 * Envolve um handler de server function para registrar eventos técnicos
 * automaticamente em qualquer exceção. Preserva o erro original.
 *
 *   .handler(withObservability("competencia.criar", async ({ data, context }) => { ... }))
 */
export function withObservability<TArgs extends { context: any }, TResult>(
  operacao: string,
  handler: (args: TArgs) => Promise<TResult>,
): (args: TArgs) => Promise<TResult> {
  return async (args: TArgs) => {
    try {
      return await handler(args);
    } catch (err) {
      const e = err as Error;
      const tipo = classifyError(e);
      try {
        await emitEvento(args.context.supabase, tipo, "sistema", null, {
          operacao,
          mensagem: e.message,
        });
      } catch {
        /* observação nunca derruba negócio */
      }
      throw err;
    }
  };
}
