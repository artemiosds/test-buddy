/** Status oficial da unidade de Contratados para apresentação na folha.
 *
 * A folha Geral governa aprovação, análise, devolução e arquivamento.
 * Os setores apenas informam o progresso de envio enquanto a Geral
 * permanece em rascunho. Nunca aprovar ou rebaixar o cabeçalho a partir
 * da situação visual dos setores.
 */
export function resolverStatusUnidadeContratados({
  statusGeral,
  visaoGeral,
  setoresCarregados,
  statusSetores,
}: {
  statusGeral: string;
  visaoGeral: boolean;
  setoresCarregados: boolean;
  statusSetores: readonly string[];
}): string {
  const oficial = statusGeral.toLowerCase();

  // A Geral já percorreu uma etapa oficial: preservá-la integralmente.
  if (oficial !== "rascunho") return oficial;
  if (!visaoGeral || !setoresCarregados || statusSetores.length === 0) return oficial;

  const concluidos = statusSetores.filter((status) =>
    ["enviada", "em_analise", "aprovada", "aprovadas", "arquivada"].includes(status.toLowerCase()),
  ).length;

  if (concluidos === 0) return "rascunho";
  if (concluidos < statusSetores.length) return "parcialmente_enviada";
  // Envio completo dos setores não equivale a aprovação da Folha Geral.
  return "enviada";
}
