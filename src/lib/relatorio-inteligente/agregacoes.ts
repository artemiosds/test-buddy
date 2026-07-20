/** Estatísticas puras aplicadas às linhas de um bloco. */
import type { Row } from "./tipos";

export type Stats = {
  total: number;
  soma: number;
  media: number;
  mediana: number;
  minimo: number;
  maximo: number;
  desvio: number;
};

export function statsFor(rows: Row[], field: string): Stats {
  const values = rows
    .map((r) => r[field])
    .filter((v): v is number => typeof v === "number");
  const total = values.length;
  if (!total) return { total: 0, soma: 0, media: 0, mediana: 0, minimo: 0, maximo: 0, desvio: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const soma = values.reduce((s, v) => s + v, 0);
  const media = soma / total;
  const mediana =
    total % 2 === 0
      ? (sorted[total / 2 - 1] + sorted[total / 2]) / 2
      : sorted[(total - 1) / 2];
  const variancia = values.reduce((s, v) => s + (v - media) ** 2, 0) / total;
  return {
    total,
    soma: round(soma),
    media: round(media),
    mediana: round(mediana),
    minimo: sorted[0],
    maximo: sorted[total - 1],
    desvio: round(Math.sqrt(variancia)),
  };
}

function round(n: number): number { return Math.round(n * 100) / 100; }

export function numericFields(rows: Row[]): string[] {
  if (!rows.length) return [];
  const out: string[] = [];
  for (const k of Object.keys(rows[0])) {
    if (rows.some((r) => typeof r[k] === "number")) out.push(k);
  }
  return out;
}
