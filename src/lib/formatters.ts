/**
 * Formatação padronizada (pt-BR) para todo o frontend.
 *
 * Regras:
 *  - Toda função aceita `null | undefined` sem quebrar.
 *  - Valores ausentes/ inválidos devolvem `placeholder` (padrão "—").
 *  - Nunca criar `fmt*` / `format*` locais em rotas/componentes: importe daqui.
 */

const DEFAULT_PLACEHOLDER = "—";

/** Remove tudo que não é dígito. */
export function onlyDigits(v: string | null | undefined): string {
  if (v == null) return "";
  return String(v).replace(/\D+/g, "");
}

function toDate(v: string | number | Date | null | undefined): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------- Datas ----------

export function formatDate(
  v: string | number | Date | null | undefined,
  placeholder: string = DEFAULT_PLACEHOLDER,
): string {
  const d = toDate(v);
  return d ? d.toLocaleDateString("pt-BR") : placeholder;
}

export function formatDateTime(
  v: string | number | Date | null | undefined,
  placeholder: string = DEFAULT_PLACEHOLDER,
): string {
  const d = toDate(v);
  return d ? d.toLocaleString("pt-BR") : placeholder;
}

export function formatTime(
  v: string | number | Date | null | undefined,
  placeholder: string = DEFAULT_PLACEHOLDER,
): string {
  const d = toDate(v);
  return d
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : placeholder;
}

// ---------- Números / moeda ----------

export function formatNumber(
  v: number | string | null | undefined,
  opts: Intl.NumberFormatOptions = {},
  placeholder: string = DEFAULT_PLACEHOLDER,
): string {
  if (v == null || v === "" || Number.isNaN(Number(v))) return placeholder;
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
    ...opts,
  }).format(Number(v));
}

export function formatInteger(
  v: number | string | null | undefined,
  placeholder: string = DEFAULT_PLACEHOLDER,
): string {
  return formatNumber(v, { maximumFractionDigits: 0 }, placeholder);
}

export function formatCurrency(
  v: number | string | null | undefined,
  placeholder: string = DEFAULT_PLACEHOLDER,
): string {
  if (v == null || v === "" || Number.isNaN(Number(v))) return placeholder;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(v));
}

export function formatHoras(
  v: number | string | null | undefined,
  placeholder: string = DEFAULT_PLACEHOLDER,
): string {
  const s = formatNumber(v, { maximumFractionDigits: 2 }, placeholder);
  return s === placeholder ? placeholder : `${s}h`;
}

// ---------- Documentos / máscaras ----------

export function formatCPF(
  v: string | null | undefined,
  placeholder: string = DEFAULT_PLACEHOLDER,
): string {
  const d = onlyDigits(v).slice(0, 11);
  if (!d) return placeholder;
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function formatCNPJ(
  v: string | null | undefined,
  placeholder: string = DEFAULT_PLACEHOLDER,
): string {
  const d = onlyDigits(v).slice(0, 14);
  if (!d) return placeholder;
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/** CNES sempre 7 dígitos: exibe zero-padded. */
export function formatCNES(
  v: string | number | null | undefined,
  placeholder: string = DEFAULT_PLACEHOLDER,
): string {
  const d = onlyDigits(v == null ? "" : String(v));
  if (!d) return placeholder;
  return d.padStart(7, "0").slice(-7);
}

export function formatPhone(
  v: string | null | undefined,
  placeholder: string = DEFAULT_PLACEHOLDER,
): string {
  const d = onlyDigits(v).slice(0, 11);
  if (!d) return placeholder;
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

// ---------- Competência ----------

const MESES_LONG = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const MESES_SHORT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

/**
 * Formata competência (mes 1-12 + ano) em três variantes:
 *  - "long":  "Janeiro/2026"
 *  - "short": "Jan/2026"
 *  - "num":   "01/2026"
 */
export function formatCompetencia(
  mes: number | null | undefined,
  ano: number | null | undefined,
  variant: "long" | "short" | "num" = "long",
  placeholder: string = DEFAULT_PLACEHOLDER,
): string {
  if (!mes || !ano || mes < 1 || mes > 12) return placeholder;
  switch (variant) {
    case "short":
      return `${MESES_SHORT[mes - 1]}/${ano}`;
    case "num":
      return `${String(mes).padStart(2, "0")}/${ano}`;
    case "long":
    default:
      return `${MESES_LONG[mes - 1]}/${ano}`;
  }
}

export const MESES_PT_LONG = MESES_LONG;
export const MESES_PT_SHORT = MESES_SHORT;