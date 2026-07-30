/**
 * HSM Expert — Fase 7: estimativa de tokens e custo por chamada.
 *
 * Os provedores usados pelo roteador não devolvem uso de tokens de forma
 * uniforme, portanto usamos uma estimativa determinística (≈4 caracteres por
 * token) combinada a uma tabela de preços por milhão de tokens. Os valores são
 * aproximações para acompanhamento gerencial — não substituem a fatura do
 * provedor.
 */

type Preco = { entrada: number; saida: number };

/** USD por 1.000.000 de tokens. */
const TABELA: { padrao: RegExp; preco: Preco }[] = [
  { padrao: /(flash|mini|nano|luna|haiku)/i, preco: { entrada: 0.15, saida: 0.6 } },
  { padrao: /(gpt-5|o3|sonnet|pro)/i, preco: { entrada: 3, saida: 12 } },
  { padrao: /(opus)/i, preco: { entrada: 15, saida: 75 } },
  { padrao: /(deepseek|llama|gemma|qwen)/i, preco: { entrada: 0.3, saida: 0.9 } },
];

const PADRAO: Preco = { entrada: 0.5, saida: 1.5 };

export function estimarTokens(texto: string): number {
  return Math.max(1, Math.ceil((texto || "").length / 4));
}

export function estimarCustoUsd(modelo: string, tokensEntrada: number, tokensSaida: number): number {
  const preco = TABELA.find((t) => t.padrao.test(modelo || ""))?.preco ?? PADRAO;
  const total = (tokensEntrada / 1_000_000) * preco.entrada + (tokensSaida / 1_000_000) * preco.saida;
  return Number(total.toFixed(6));
}

export function medirUso(modelo: string, entrada: string, saida: string) {
  const tokens_entrada = estimarTokens(entrada);
  const tokens_saida = estimarTokens(saida);
  return {
    tokens_entrada,
    tokens_saida,
    tokens: tokens_entrada + tokens_saida,
    custo_usd: estimarCustoUsd(modelo, tokens_entrada, tokens_saida),
  };
}
