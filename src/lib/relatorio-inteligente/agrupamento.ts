/**
 * Agrupamento em árvore + estatísticas por grupo.
 * Puro; alimenta prévia, PDF e Excel.
 */
import type { Row } from "./tipos";
import { statsFor, type Stats } from "./agregacoes";

export type GroupNode = {
  /** Chave do grupo (valor do campo groupBy no nível atual). */
  key: string;
  /** Rótulo exibido (mesmo que key, para facilitar futuras traduções). */
  label: string;
  /** Nível 0 = raiz do primeiro groupBy. */
  nivel: number;
  /** Linhas agregadas neste sub-ramo (folhas). */
  rows: Row[];
  /** Estatísticas por campo numérico do nível. */
  stats: Record<string, Stats>;
  /** Sub-grupos (vazio no nível folha). */
  children: GroupNode[];
};

function keyOf(v: unknown): string {
  if (v == null || v === "") return "— (não informado)";
  return String(v);
}

/** Agrupa `rows` pelos campos `groupBy` (em ordem). */
export function agrupar(
  rows: Row[],
  groupBy: string[],
  numericFieldsIds: string[],
  nivel = 0,
): GroupNode[] {
  if (!groupBy.length || nivel >= groupBy.length) return [];
  const field = groupBy[nivel];
  const buckets = new Map<string, Row[]>();
  for (const r of rows) {
    const k = keyOf(r[field]);
    const arr = buckets.get(k) ?? [];
    arr.push(r);
    buckets.set(k, arr);
  }
  const out: GroupNode[] = [];
  for (const [k, subset] of buckets) {
    const stats: Record<string, Stats> = {};
    for (const f of numericFieldsIds) stats[f] = statsFor(subset, f);
    out.push({
      key: k,
      label: k,
      nivel,
      rows: subset,
      stats,
      children: agrupar(subset, groupBy, numericFieldsIds, nivel + 1),
    });
  }
  out.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  return out;
}

/** Achata a árvore em uma lista linear preservando ordem hierárquica (para PDF/Excel). */
export function flattenGroups(nodes: GroupNode[]): GroupNode[] {
  const out: GroupNode[] = [];
  const walk = (arr: GroupNode[]) => {
    for (const n of arr) {
      out.push(n);
      if (n.children.length) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

/** Retorna os grupos folha (últimos níveis) — usado para renderizar tabelas por grupo. */
export function leafGroups(nodes: GroupNode[]): GroupNode[] {
  const out: GroupNode[] = [];
  const walk = (arr: GroupNode[]) => {
    for (const n of arr) {
      if (!n.children.length) out.push(n);
      else walk(n.children);
    }
  };
  walk(nodes);
  return out;
}
