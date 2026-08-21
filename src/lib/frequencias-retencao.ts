/** Retenção legal do binário após a remoção (lixeira). */
export const RETENCAO_ANOS_FREQUENCIA = 5; // comprovação de despesa pública (TCE)
export const RETENCAO_ANOS_OUTROS = 2;

export const TIPOS_ANEXO_FOLHA = ["frequencia", "frequencia_submissao"] as const;

/** Data-limite de purga do binário conforme o tipo de entidade do documento. */
export function calcularPurgaApos(tipoEntidade: string | null | undefined): string {
  const anos = (TIPOS_ANEXO_FOLHA as readonly string[]).includes(tipoEntidade ?? "")
    ? RETENCAO_ANOS_FREQUENCIA
    : RETENCAO_ANOS_OUTROS;
  const d = new Date();
  d.setFullYear(d.getFullYear() + anos);
  return d.toISOString();
}
