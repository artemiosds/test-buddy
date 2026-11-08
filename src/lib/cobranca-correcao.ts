/** Regras de lembrete de folhas devolvidas (sem acesso a rede ou banco). */
export const STATUS_CORRECAO = ["devolvida", "rejeitada", "com_pendencias"] as const;
export type FolhaCorrecao = {
  id: string;
  status: string;
  tipo: string;
  updated_at: string | null;
  unidade_id: string;
  competencia_id: string;
  competencia_status: string;
  secretaria_id: string;
};
const DIA = 86_400_000;

/**
 * Aguarda 24h desde a última alteração da folha; folhas já reenviadas ou
 * aprovadas não voltam a gerar lembretes. Não lembra competências arquivadas.
 */
export function exigeLembreteCorrecao(folha: FolhaCorrecao, agora: Date): boolean {
  if (!STATUS_CORRECAO.some(s => s === folha.status)) return false;
  if (["arquivada", "cancelada"].includes(folha.competencia_status)) return false;
  if (!folha.unidade_id || !folha.competencia_id || !folha.secretaria_id) return false;
  if (!folha.updated_at) return false;
  const alterada = Date.parse(folha.updated_at);
  return Number.isFinite(alterada) && alterada <= agora.getTime() - DIA;
}

/** Uma chave estável por folha, status e dia civil no horário Brasília. */
export function eventoLembreteCorrecao(folha: Pick<FolhaCorrecao,"id"|"status">, agora: Date): string {
  const diaBrasil = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(agora);
  return `folha_correcao:${folha.id}:${folha.status}:${diaBrasil}`;
}
