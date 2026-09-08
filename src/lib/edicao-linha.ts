/**
 * Regra institucional de edição por linha da folha.
 *
 * Depois que a folha sai da unidade (enviada/em análise/aprovada), o Diretor de
 * Unidade só volta a editar o profissional cuja LINHA foi rejeitada ou devolvida
 * para correção. Linha aprovada nunca é editável (exceto Master/Gestor).
 */

export const MSG_LINHA_BLOQUEADA =
  "Este lançamento está bloqueado. A correção só é permitida quando a linha for rejeitada ou devolvida pela análise.";

const FOLHA_EDITAVEL = ["rascunho", "com_pendencias", "rejeitada", "devolvida"];

export function linhaEditavel(params: {
  statusLinha?: string | null;
  folhaStatus?: string | null;
  isGestor?: boolean;
}): boolean {
  const { statusLinha, folhaStatus, isGestor } = params;
  if (isGestor) return true;
  const s = statusLinha ?? "pendente";
  if (s === "aprovada") return false;
  if (FOLHA_EDITAVEL.includes(folhaStatus ?? "rascunho")) return true;
  return s === "rejeitada" || s === "devolvida";
}
