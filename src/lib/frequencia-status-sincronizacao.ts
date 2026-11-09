/**
 * A sincronização de metadados nunca pode desfazer a reabertura para
 * retificação durante autosave, carregamento de tela ou sincronização paralela.
 * O status oficial só sai de em_analise por uma transição explícita de
 * aprovação da folha, acompanhada de todas as linhas aprovadas.
 */
export function statusSincronizadoContratados(
  statusAtual: string,
  estadosLinhas: readonly string[],
  evento: string,
): string {
  if (!estadosLinhas.length) return statusAtual;
  const todasAprovadas = estadosLinhas.every(s => s === "aprovada");

  if (statusAtual === "em_analise") {
    return evento === "FOLHA_APROVADA" && todasAprovadas ? "aprovada" : "em_analise";
  }
  if (todasAprovadas) return "aprovada";
  if (estadosLinhas.some(s => ["rascunho", "devolvida", "rejeitada", "com_pendencias"].includes(s)))
    return "rascunho";
  if (estadosLinhas.some(s => s === "em_analise")) return "em_analise";
  if (estadosLinhas.some(s => s === "enviada")) return "enviada";
  return statusAtual;
}
