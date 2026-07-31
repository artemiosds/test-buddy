// =============================================================================
// MATEMÁTICA APLICADA — descrita a partir da planilha modelo enviada.
//
// Nada é deduzido nem generalizado. O painel da tela é montado lendo o mapa de
// referência do modelo (planilha-clone.ts) e mostrando SOMENTE as colunas em que
// TODAS as linhas de dados são fórmula — ou seja, as regras estruturais que
// valem para todos os funcionários daquele modelo.
//
// Consequência direta: colunas como INSALUBRIDADE ou AUX. TRANSP., que em
// algumas linhas do modelo são valor digitado, NUNCA aparecem aqui (não existe
// "INSALUBRIDADE = BASE × 20%").
//
// Cada modelo produz o seu próprio painel: UBS mostra as fórmulas da UBS, H.M.O
// mostra as do H.M.O, CER mostra as do CER.
// =============================================================================

import type { MapaModelo } from "./planilha-clone";

export type RegraEstrutural = {
  /** Cabeçalho da coluna calculada, como está escrito no modelo. */
  coluna: string;
  /** Fórmula exata da célula no modelo (sem "="). */
  formula: string;
  /** Leitura humana: "BRUTO = BASE + INSALUBRIDADE + HORA EXTRA". */
  descricao: string;
  /** Quantas linhas do modelo usam essa mesma fórmula. */
  linhas: number;
};

const RE_REF = /(\$?)([A-Z]{1,3})(\$?)(\d+)/g;

function indiceColuna(letras: string): number {
  let n = 0;
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** Remove a linha das referências e troca a letra pelo título do cabeçalho. */
export function descreverFormulaComTitulos(
  formula: string,
  titulos: Map<number, string>,
): string {
  const texto = String(formula ?? "").replace(/^=/, "");
  const comTitulos = texto.replace(RE_REF, (ref, _a, letras: string) => {
    const titulo = titulos.get(indiceColuna(letras));
    return titulo ? titulo.replace(/\s+/g, " ").trim() : ref;
  });
  return comTitulos
    .replace(/\bSUM\b/gi, "SOMA")
    .replace(/\bROUND\b/gi, "ARRED")
    .replace(/\*/g, " × ")
    .replace(/(?<![(;,\s])-/g, " − ")
    .replace(/\+/g, " + ")
    .replace(/,/g, "; ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fórmulas estruturais do modelo: presentes (e idênticas) em todas as linhas de
 * dados. É exatamente o que o motor de cópia vai reproduzir mês a mês.
 */
export function matematicaEstrutural(mapa: MapaModelo): RegraEstrutural[] {
  const total = mapa.linhas.length;
  if (total === 0) return [];
  const out: RegraEstrutural[] = [];

  for (let col = 1; col <= mapa.ultimaColuna; col += 1) {
    const titulo = (mapa.titulos.get(col) ?? "").trim();
    if (!titulo) continue;

    // Normaliza cada fórmula da coluna para a MESMA linha, para comparar receitas.
    const receitas = new Map<string, { formula: string; linhas: number }>();
    let comFormula = 0;
    let comValorDigitado = 0;
    for (const linha of mapa.linhas) {
      const rec = linha.celulas.get(col);
      if (!rec) continue;
      if (rec.tipo !== "formula") {
        // Célula vazia não descaracteriza a regra; valor digitado sim.
        const v = rec.valor;
        if (v !== null && v !== undefined && String(v).trim() !== "") comValorDigitado += 1;
        continue;
      }
      comFormula += 1;
      const chave = rec.formula.replace(/(\$?[A-Z]{1,3}\$?)\d+/g, "$1#");
      const atual = receitas.get(chave);
      if (atual) atual.linhas += 1;
      else receitas.set(chave, { formula: rec.formula, linhas: 1 });
    }

    // Regra estrutural: a coluna é calculada pelo modelo em todas as linhas que
    // têm conteúdo. Se alguma linha traz valor digitado (insalubridade, auxílio
    // transporte…), a coluna é copiada como está e não gera regra.
    if (comFormula === 0 || comValorDigitado > 0) continue;
    const dominante = Array.from(receitas.values()).sort((a, b) => b.linhas - a.linhas)[0];

    out.push({
      coluna: titulo,
      formula: dominante.formula.replace(/^=/, ""),
      descricao: `${titulo} = ${descreverFormulaComTitulos(dominante.formula, mapa.titulos)}`,
      linhas: dominante.linhas,
    });
  }

  return out;
}
