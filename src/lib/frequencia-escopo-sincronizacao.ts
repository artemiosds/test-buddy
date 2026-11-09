/** Preserva o escopo físico da folha em qualquer evento de sincronização. */
export function escopoDaSincronizacaoLinha(input: {
  tipo: "efetivos" | "contratados" | "mensal";
  competencia_id: string;
  unidade_id: string;
  setor_id?: string | null;
}) {
  return {
    evento: "LINHA_ALTERADA" as const,
    tipo: input.tipo,
    competencia_id: input.competencia_id,
    unidade_id: input.unidade_id,
    setor_id: input.setor_id || undefined,
  };
}
