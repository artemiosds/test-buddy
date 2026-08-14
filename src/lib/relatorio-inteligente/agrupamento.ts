/**
 * Agrupamento em árvore + estatísticas por grupo.
 * Puro; alimenta prévia, PDF e Excel.
 */
import type { Row } from "./tipos";
import { statsFor, type Stats, numericFields } from "./agregacoes";

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

function normalizeLabel(v: unknown): string {
  if (v == null || v === "") return "— (não informado)";
  const s = String(v).trim();
  
  // Normalização agressiva de cargos para evitar fragmentação
  const upper = s.toUpperCase();
  if (upper.includes("ENFERMEIR")) {
    if (upper.includes("TECNICO")) return "Técnico(a) em Enfermagem";
    if (upper.includes("AUXILIAR")) return "Auxiliar de Enfermagem";
    return "Enfermeiro(a)";
  }
  if (upper.includes("AUX") && upper.includes("GERAIS")) return "Auxiliar de Serviços Gerais";
  if (upper.includes("TECNICO") && (upper.includes("ENFERM") || upper.includes("ENF."))) return "Técnico(a) em Enfermagem";
  if (upper.includes("MEDICO")) return "Médico(a)";
  if (upper.includes("AGENTE") && (upper.includes("COMUNI") || upper.includes("ACS"))) return "Agente Comunitário de Saúde (ACS)";
  if (upper.includes("AGENTE") && (upper.includes("ENDEMIA") || upper.includes("ACE"))) return "Agente de Combate às Endemias (ACE)";
  if (upper.includes("MOTORISTA")) return "Motorista";
  if (upper.includes("ADMINISTRA")) return "Administrativo";
  if (upper.includes("RECEPCIONISTA")) return "Recepcionista";
  if (upper.includes("OPERACIONAL")) return "Apoio Operacional";
  if (upper.includes("SERVICO") && upper.includes("GERAL")) return "Serviços Gerais";
  if (upper.includes("VIGIA")) return "Vigia";
  if (upper.includes("PSICOLOG")) return "Psicólogo(a)";
  if (upper.includes("ODONTOLOG") || upper.includes("DENTISTA")) return "Odontólogo(a)";
  if (upper.includes("FISIOTERAP")) return "Fisioterapeuta";
  if (upper.includes("ASSISTENTE SOCIAL")) return "Assistente Social";
  if (upper.includes("COZINHEIR") || upper.includes("MERENDEIR")) return "Cozinheiro(a) / Merendeiro(a)";
  if (upper.includes("ZELADOR") || upper.includes("LIMPEZA")) return "Zelador(a) / Limpeza";
  
  return s;
}

function keyOf(v: unknown): string {
  return normalizeLabel(v);
}

/** Agrupa `rows` pelos campos `groupBy` (em ordem). */
export function agrupar(
  rows: Row[],
  groupBy: string[],
  numericFieldsIds: string[] = [],
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

  // Garantir que cargos/unidades vazios apareçam de forma consistente e ordenados
  const keys = Array.from(buckets.keys()).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const out: GroupNode[] = [];
  for (const k of keys) {
    const subset = buckets.get(k)!;
    const stats: Record<string, Stats> = {};
    const effectiveNumericFields = numericFieldsIds.length > 0 ? numericFieldsIds : numericFields(subset);
    for (const f of effectiveNumericFields) {
      stats[f] = statsFor(subset, f);
    }
    out.push({
      key: k,
      label: k,
      nivel,
      rows: subset,
      stats,
      children: agrupar(subset, groupBy, numericFieldsIds, nivel + 1),
    });
  }
  // Ordenação já feita no loop do Map
  return out;
}

/** Calcula o total geral de um conjunto de linhas. */
export function totalGeral(rows: Row[], numericFieldsIds: string[] = []): Record<string, Stats> {
  const stats: Record<string, Stats> = {};
  const effectiveNumericFields = numericFieldsIds.length > 0 ? numericFieldsIds : numericFields(rows);
  for (const f of effectiveNumericFields) {
    stats[f] = statsFor(rows, f);
  }
  return stats;
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
