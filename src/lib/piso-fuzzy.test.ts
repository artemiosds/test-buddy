import { describe, it, expect } from "vitest";
import { bestFuzzy, levenshtein, similarity } from "./piso-fuzzy";

describe("piso-fuzzy", () => {
  it("levenshtein básico", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("abc", "abc")).toBe(0);
  });
  it("similaridade ignora acento/caixa", () => {
    expect(similarity("Maria da Silva", "MARIA DA SILVA")).toBeGreaterThan(0.99);
    expect(similarity("João Souza", "Joao Souza")).toBeGreaterThan(0.99);
  });
  it("bestFuzzy respeita minScore", () => {
    const cands = [
      { id: "1", nome: "Maria da Silva" },
      { id: "2", nome: "João Pereira" },
    ];
    expect(bestFuzzy("Maria Silva", cands, 0.6)?.id).toBe("1");
    expect(bestFuzzy("Xpto", cands, 0.85)).toBeNull();
  });
});
