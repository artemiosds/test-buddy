/** Aplica ordenação e projeção de campos às linhas de um bloco. */
import type { Row, SortSpec } from "./tipos";

export function applySort(rows: Row[], sort: SortSpec): Row[] {
  if (!sort) return rows;
  const { fieldId, dir } = sort;
  const factor = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = a[fieldId];
    const bv = b[fieldId];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
    return String(av).localeCompare(String(bv), "pt-BR") * factor;
  });
}

export function projectFields(rows: Row[], fieldIds: string[]): Row[] {
  if (!fieldIds.length) return rows;
  return rows.map((r) => {
    const out: Row = {};
    for (const id of fieldIds) out[id] = r[id] ?? null;
    return out;
  });
}

export function fmtCell(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString("pt-BR");
  return String(v);
}
