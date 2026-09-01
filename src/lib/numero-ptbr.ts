/**
 * Parser numérico tolerante ao formato pt-BR.
 *
 * Regras:
 *  - "1.500"    -> 1500 (ponto seguido de exatamente 3 dígitos = milhar)
 *  - "1.500,00" -> 1500 (havendo vírgula, o ponto é sempre milhar)
 *  - "1500,75"  -> 1500.75
 *  - "1,5"      -> 1.5
 *  - "R$ 1.500,00" -> 1500
 */
export function parseNumeroPtBr(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  s = s.replace(/[^\d.,-]/g, "");
  if (!s) return 0;

  const temVirgula = s.includes(",");
  if (temVirgula) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    // 1.500 / 1.234.567 => separador de milhar
    s = s.replace(/\./g, "");
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Formata valor em pt-BR: inteiro sem decimais, fracionado com 2 casas. */
export function formatarNumeroPtBr(n: number): string {
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n)
    ? n.toLocaleString("pt-BR")
    : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Valor bruto de uma célula da folha para exportação.
 * Numérico (ou vazio) => number; marcação textual ("X", "SIM") => string original.
 */
export function valorCelula(v: unknown): number | string {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  if (/^R?\$?\s*-?[\d.,]+$/.test(s)) return parseNumeroPtBr(s);
  return s;
}
