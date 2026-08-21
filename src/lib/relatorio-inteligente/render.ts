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

export function fmtCell(v: unknown, fieldId?: string): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number") {
    // Lista completa de campos que devem ser tratados como moeda BRL
    const salariais = [
      "salario_base",
      "salario_bruto",
      "salario_liquido",
      "horas_extras",
      "adicional_noturno",
      "gratificacao_incentivo",
      "vencimento_liquido",
      "valor_piso",
      "valor_bruto",
      "valor_liquido",
      "remuneracao_bruta",
      "remuneracao_liquida",
      "piso_complementacao",
      "valor_final",
      "valor_a",
      "valor_b",
      "diff",
    ];
    
    const k = fieldId?.toLowerCase() || "";
    const matches = salariais.includes(k) || 
                   k.includes("salario") || 
                   k.includes("valor") || 
                   k.includes("vencimento") || 
                   k.includes("remunera") ||
                   k.includes("total_pago");

    if (matches) {
      return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
    
    // Heurística para valores que parecem ser salários se o campo for ambíguo
    if (v > 200 && (k.includes("soma") || k.includes("media") || k.includes("total"))) {
       return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
    
    return v.toLocaleString("pt-BR");
  }
  return String(v);
}
