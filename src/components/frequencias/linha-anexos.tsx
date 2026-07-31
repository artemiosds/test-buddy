import { AnexosEntidade } from "@/components/frequencias/anexos-entidade";

/**
 * Anexos de comprovação da LINHA de folha (atestado, laudo, portaria…).
 * Wrapper fino sobre `AnexosEntidade` — a lógica é compartilhada com os
 * anexos de justificativa da submissão da folha.
 */
export function LinhaAnexos({
  frequenciaProfissionalId,
  unidadeId,
  canEdit = true,
}: {
  frequenciaProfissionalId: string | null | undefined;
  unidadeId: string | null | undefined;
  canEdit?: boolean;
}) {
  return (
    <AnexosEntidade
      entidadeId={frequenciaProfissionalId}
      tipoEntidade="frequencia"
      unidadeId={unidadeId}
      canEdit={canEdit}
      mensagemSemEntidade="Salve a folha desta linha antes de anexar documentos."
    />
  );
}

export default LinhaAnexos;
