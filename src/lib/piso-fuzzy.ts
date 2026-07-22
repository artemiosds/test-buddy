// Similaridade de nomes (Levenshtein normalizado).
// Puro; testado em piso-fuzzy.test.ts.

import { normalize } from "./piso-mapping";

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length,
    n = b.length;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Similaridade [0..1] entre duas strings, após normalização. */
export function similarity(a: string, b: string): number {
  const A = normalize(a),
    B = normalize(b);
  if (!A && !B) return 1;
  if (!A || !B) return 0;
  const d = levenshtein(A, B);
  return 1 - d / Math.max(A.length, B.length);
}

export type FuzzyCandidate = { id: string; nome: string };
export type FuzzyMatch = { id: string; nome: string; score: number };

/** Devolve o melhor candidato com score >= minScore (default 0.85). */
export function bestFuzzy(
  nome: string,
  candidates: FuzzyCandidate[],
  minScore = 0.85,
): FuzzyMatch | null {
  if (!nome || candidates.length === 0) return null;
  let best: FuzzyMatch | null = null;
  for (const c of candidates) {
    const s = similarity(nome, c.nome);
    if (!best || s > best.score) best = { id: c.id, nome: c.nome, score: s };
  }
  return best && best.score >= minScore ? best : null;
}
