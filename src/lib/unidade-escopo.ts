/**
 * Sentinela usada pelos seletores de unidade para representar a visão
 * consolidada ("Todas as Unidades"). Disponível apenas para perfis com
 * acesso global (Administrador Master / Gestor) e sempre SOMENTE LEITURA
 * nas folhas — cada folha pertence a uma unidade e tem fluxo próprio.
 */
export const ALL_UNITS = "all";

export function isTodasUnidades(v: string | null | undefined) {
  return v === ALL_UNITS;
}

export const MSG_VISAO_CONSOLIDADA =
  "Visão consolidada (todas as unidades) — somente conferência e exportação. Selecione uma unidade específica para lançar, salvar ou enviar a folha.";
