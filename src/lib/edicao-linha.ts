/**
 * Regra de edição POR PROFISSIONAL (linha) nas folhas de frequência.
 *
 * Depois que a folha vai para análise, o Diretor de Unidade só pode corrigir os
 * profissionais que foram REJEITADOS (ou devolvidos) pela análise. Linhas
 * pendentes ou aprovadas ficam somente leitura para ele.
 *
 * Master / Gestor continuam com bypass total.
 */

export const MSG_LINHA_BLOQUEADA =
  "Somente profissionais com status Rejeitado ou Devolvido podem ser corrigidos após o envio da folha.";

/** Status de folha em que a unidade ainda está montando os lançamentos. */
const FOLHA_EM_ABERTO = new Set(["rascunho", "", "null", "undefined"]);

/** Status de linha/profissional que liberam a correção pela unidade. */
const LINHA_CORRIGIVEL = new Set(["rejeitada", "devolvida", "com_pendencias"]);

/**
 * `true` quando a linha do profissional pode ser editada pelo perfil atual.
 *
 * - Master/Gestor: sempre.
 * - Folha ainda em rascunho: todas as linhas (montagem inicial).
 * - Folha já enviada/em análise/aprovada/devolvida/rejeitada: apenas linhas
 *   com status rejeitada/devolvida/com_pendencias.
 */
export function linhaEditavel(opts: {
  statusLinha?: string | null;
  folhaStatus?: string | null;
  isGestor?: boolean;
}): boolean {
  if (opts.isGestor === true) return true;

  const folha = String(opts.folhaStatus ?? "").trim();
  if (FOLHA_EM_ABERTO.has(folha)) return true;

  const linha = String(opts.statusLinha ?? "pendente").trim();
  return LINHA_CORRIGIVEL.has(linha);
}
