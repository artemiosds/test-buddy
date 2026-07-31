/**
 * Regras compartilhadas dos anexos de comprovação da linha de folha
 * (atestado médico, laudo, portaria etc.).
 *
 * O binário do arquivo fica SEMPRE no Storage (bucket privado `documentos`).
 * A tabela `documentos` guarda apenas metadados + o caminho no Storage.
 */

export const ANEXO_MIMES_ACEITOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AnexoMime = (typeof ANEXO_MIMES_ACEITOS)[number];

/** Limite por arquivo: 10 MB. */
export const ANEXO_TAMANHO_MAX = 10 * 1024 * 1024;

export const ANEXO_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

const EXT_POR_MIME: Record<AnexoMime, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function formatarBytes(bytes: number): string {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Valida tipo e tamanho. Retorna o mime normalizado ou uma mensagem de erro. */
export function validarArquivoAnexo(
  file: File,
): { ok: true; mime: AnexoMime } | { ok: false; erro: string } {
  const mime = (file.type || "").toLowerCase();
  if (!(ANEXO_MIMES_ACEITOS as readonly string[]).includes(mime)) {
    return {
      ok: false,
      erro: "Formato não aceito. Envie PDF, JPG, PNG ou WEBP.",
    };
  }
  if (file.size <= 0) return { ok: false, erro: "Arquivo vazio." };
  if (file.size > ANEXO_TAMANHO_MAX) {
    return {
      ok: false,
      erro: `Arquivo muito grande (${formatarBytes(file.size)}). Limite de 10 MB.`,
    };
  }
  return { ok: true, mime: mime as AnexoMime };
}

/** Tipos de entidade que podem receber anexos de folha. */
export type TipoAnexoEntidade = "frequencia" | "frequencia_submissao";

const PASTA_POR_TIPO: Record<TipoAnexoEntidade, string> = {
  frequencia: "frequencias",
  frequencia_submissao: "submissoes",
};

/**
 * Caminho no bucket `documentos`, no formato exigido pelas policies de
 * storage: `{secretaria_id}/{unidade_id}/...`.
 */
export function montarCaminhoAnexo(params: {
  secretariaId: string;
  unidadeId: string;
  entidadeId: string;
  tipoEntidade?: TipoAnexoEntidade;
  mime: AnexoMime;
}): string {
  const ext = EXT_POR_MIME[params.mime];
  const nome = `${crypto.randomUUID()}.${ext}`;
  const pasta = PASTA_POR_TIPO[params.tipoEntidade ?? "frequencia"];
  return `${params.secretariaId}/${params.unidadeId}/${pasta}/${params.entidadeId}/${nome}`;
}
