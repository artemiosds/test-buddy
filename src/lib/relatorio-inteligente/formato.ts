/**
 * Formatação única de células dos relatórios gerenciais.
 *
 * A decisão é pelo TIPO declarado do campo — não pelo nome. Quantidades saem
 * como inteiro pt-BR, percentuais com uma decimal e "%", e "R$" aparece só em
 * campos realmente financeiros.
 */

export type TipoCampo = "text" | "number" | "moeda" | "percentual";

/** Chaves financeiras dos blocos consolidados (que não declaram tipo). */
const CHAVES_MOEDA = ["salario", "massa", "custo", "vencimento", "remunera", "folha_bruta"];

function ehMoedaPelaChave(fieldId?: string): boolean {
  const k = (fieldId ?? "").toLowerCase();
  if (!k) return false;
  return CHAVES_MOEDA.some((c) => k.includes(c));
}

export function moedaBrl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function percentualBr(v: number): string {
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function quantidadeBr(v: number): string {
  return v.toLocaleString("pt-BR");
}

/** Formata um valor de célula conforme o tipo do campo. */
export function formatarValor(v: unknown, tipo?: TipoCampo, fieldId?: string): string {
  if (v == null || v === "") return "";
  if (typeof v !== "number") return String(v);
  if (tipo === "moeda") return moedaBrl(v);
  if (tipo === "percentual") return percentualBr(v);
  if (!tipo && ehMoedaPelaChave(fieldId)) return moedaBrl(v);
  return quantidadeBr(v);
}
