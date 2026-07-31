// =============================================================================
// APRENDIZADO DE FÓRMULAS DA PLANILHA MODELO — núcleo puro (sem I/O).
//
// Lê as fórmulas do Excel de uma planilha modelo (=H7+I7+J7+K7, =L7*5%,
// =SUM(H2,M2,N2,O2)…), traduz as referências de célula para os cabeçalhos e,
// depois, para os campos internos do sistema. O resultado é um conjunto de
// regras lineares que o importador aplica todo mês, garantindo que BRUTO, ISS
// e V.LÍQUIDO fiquem exatamente iguais aos da planilha.
//
// Camada ADITIVA: não altera o motor de importação nem o cálculo de folha.
// =============================================================================

export type TermoColuna = { coluna: string; fator: number };
export type TermoCampo = { campo: string; fator: number };

/** Regra aprendida em nível de coluna (cabeçalho da planilha). */
export type RegraFormulaColuna = {
  coluna: string;
  /** Fórmula original do Excel, sem o "=". */
  expressao: string;
  termos: TermoColuna[];
  /** Parcela constante da fórmula (raro, mas preservado). */
  constante: number;
};

/** Regra aprendida em nível de campo interno — é o que fica salvo no layout. */
export type RegraFormulaCampo = {
  destino: string;
  expressao: string;
  termos: TermoCampo[];
  constante: number;
};

// -----------------------------------------------------------------------------
// Referências de célula
// -----------------------------------------------------------------------------

export function letraParaIndice(letras: string): number {
  let n = 0;
  for (const ch of letras.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function indiceParaLetra(indice: number): string {
  let n = indice + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const RE_REF = /^\$?([A-Z]{1,3})\$?(\d+)$/i;

function refParaColuna(ref: string): number | null {
  const m = RE_REF.exec(ref.trim());
  return m ? letraParaIndice(m[1]) : null;
}

// -----------------------------------------------------------------------------
// Parser de fórmulas (subconjunto linear: + − × constante, SUM/SOMA)
// -----------------------------------------------------------------------------

/** Expande SUM(A1,B1,C1) e SUM(A1:D1) em uma soma simples de referências. */
function expandirSomas(f: string): string {
  let out = f;
  const re = /\b(?:SUM|SOMA)\s*\(([^()]*)\)/i;
  for (let i = 0; i < 6 && re.test(out); i++) {
    out = out.replace(re, (_all, args: string) => {
      const partes: string[] = [];
      for (const bruto of args.split(/[,;]/)) {
        const arg = bruto.trim();
        if (!arg) continue;
        const faixa = /^\$?([A-Z]{1,3})\$?(\d+):\$?([A-Z]{1,3})\$?(\d+)$/i.exec(arg);
        if (faixa && faixa[2] === faixa[4]) {
          const de = letraParaIndice(faixa[1]);
          const ate = letraParaIndice(faixa[3]);
          for (let c = Math.min(de, ate); c <= Math.max(de, ate); c++)
            partes.push(`${indiceParaLetra(c)}${faixa[2]}`);
        } else {
          partes.push(arg);
        }
      }
      return `(${partes.join("+") || "0"})`;
    });
  }
  return out;
}

function valorNumerico(token: string): number | null {
  const t = token.trim();
  if (!t) return null;
  if (/%$/.test(t)) {
    const n = Number(t.replace("%", "").replace(",", "."));
    return Number.isFinite(n) ? n / 100 : null;
  }
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Interpreta uma fórmula linear do Excel e devolve os termos por coluna.
 * Fórmulas fora do subconjunto suportado devolvem `null` (são ignoradas).
 */
export function interpretarFormula(
  formulaBruta: string,
): { termos: TermoColuna[]; constante: number } | null {
  const f = expandirSomas(String(formulaBruta ?? "").replace(/^=/, "").trim())
    .replace(/\s+/g, "")
    .replace(/[()]/g, "");
  if (!f) return null;
  if (/[/^:'"!]/.test(f)) return null; // divisões, potências, outras abas: fora do escopo
  if (/[A-Z]{1,3}\d+[A-Z]/i.test(f)) return null;

  const termos: TermoColuna[] = [];
  let constante = 0;

  // separa em parcelas mantendo o sinal
  const parcelas = f.replace(/-/g, "+-").split("+").filter(Boolean);
  for (const parcela of parcelas) {
    const negativo = parcela.startsWith("-");
    const corpo = negativo ? parcela.slice(1) : parcela;
    if (!corpo) continue;
    const fatores = corpo.split("*");
    let ref: number | null = null;
    let escalar = 1;
    for (const fator of fatores) {
      const col = refParaColuna(fator);
      if (col !== null) {
        if (ref !== null) return null; // produto de duas colunas: não linear
        ref = col;
        continue;
      }
      const num = valorNumerico(fator);
      if (num === null) return null;
      escalar *= num;
    }
    const sinal = negativo ? -1 : 1;
    if (ref === null) constante += sinal * escalar;
    else termos.push({ coluna: String(ref), fator: sinal * escalar });
  }

  return termos.length || constante ? { termos, constante } : null;
}

// -----------------------------------------------------------------------------
// Extração a partir da planilha modelo
// -----------------------------------------------------------------------------

/** Fórmula bruta encontrada em uma célula da primeira linha de dados. */
export type CelulaFormula = { colunaIndice: number; formula: string };

/**
 * Converte as fórmulas da primeira linha de dados em regras por cabeçalho.
 * `headers[i]` é o cabeçalho da coluna de índice `i` na planilha.
 */
export function extrairRegrasDeColunas(
  celulas: CelulaFormula[],
  headers: string[],
): RegraFormulaColuna[] {
  const out: RegraFormulaColuna[] = [];
  for (const c of celulas) {
    const destino = headers[c.colunaIndice];
    if (!destino || !String(destino).trim()) continue;
    const parsed = interpretarFormula(c.formula);
    if (!parsed) continue;
    const termos: TermoColuna[] = [];
    let ok = true;
    for (const t of parsed.termos) {
      const h = headers[Number(t.coluna)];
      if (!h || !String(h).trim()) {
        ok = false;
        break;
      }
      termos.push({ coluna: h, fator: t.fator });
    }
    if (!ok || termos.length === 0) continue;
    out.push({
      coluna: destino,
      expressao: String(c.formula).replace(/^=/, ""),
      termos,
      constante: parsed.constante,
    });
  }
  return out;
}

/** Traduz regras de colunas para campos internos usando o mapeamento do layout. */
export function regrasParaCampos(
  regras: RegraFormulaColuna[],
  mapeamento: Record<string, string | null>,
): RegraFormulaCampo[] {
  const out: RegraFormulaCampo[] = [];
  for (const r of regras) {
    const destino = mapeamento[r.coluna] ?? null;
    if (!destino) continue;
    const termos: TermoCampo[] = [];
    let ok = true;
    for (const t of r.termos) {
      const campo = mapeamento[t.coluna] ?? null;
      if (!campo) {
        ok = false;
        break;
      }
      termos.push({ campo, fator: t.fator });
    }
    if (!ok || termos.length === 0) continue;
    if (termos.some((t) => t.campo === destino)) continue; // autorreferência
    out.push({ destino, expressao: r.expressao, termos, constante: r.constante });
  }
  return out;
}

// -----------------------------------------------------------------------------



/** Descrição legível de uma regra (para exibir na tela). */
export function descreverRegra(
  regra: RegraFormulaCampo,
  label: (campo: string) => string,
): string {
  const partes = regra.termos.map((t, i) => {
    const sinal = t.fator < 0 ? "−" : i === 0 ? "" : "+";
    const abs = Math.abs(t.fator);
    const peso = abs === 1 ? "" : abs < 1 ? ` × ${(abs * 100).toFixed(2).replace(/\.?0+$/, "")}%` : ` × ${abs}`;
    return `${sinal} ${label(t.campo)}${peso}`.trim();
  });
  const constante =
    regra.constante > 0 ? ` + ${regra.constante}` : regra.constante < 0 ? ` − ${Math.abs(regra.constante)}` : "";
  return `${label(regra.destino)} = ${partes.join(" ")}${constante}`;
}

// -----------------------------------------------------------------------------
// Aplicação nas linhas importadas
// -----------------------------------------------------------------------------

function numero(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v == null || v === "") return 0;
  const n = Number(
    String(v)
      .replace(/[^\d,.-]/g, "")
      .replace(/\.(?=\d{3}\b)/g, "")
      .replace(",", "."),
  );
  return Number.isFinite(n) ? n : 0;
}

/**
 * Arredondamento de MOEDA (2 casas), com correção de erro binário.
 * Toda operação monetária passa por aqui — igual ao comportamento do Excel
 * quando os valores da planilha são valores em reais.
 */
export function arredondarMoeda(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const escalado = n * 100;
  // 258.59899999999996 * 100 = 25859.899999999998 → corrige antes do round
  const corrigido = Math.round((escalado + Number.EPSILON * Math.sign(escalado) * 1e6) * 1e6) / 1e6;
  return Math.round(corrigido) / 100;
}

const arredondar = arredondarMoeda;

/**
 * Ordena as regras por dependência (BRUTO → ISS → TOTAL → LÍQUIDO),
 * para que cada campo já use o valor final (arredondado) do anterior.
 */
function ordenarPorDependencia(regras: RegraFormulaCampo[]): RegraFormulaCampo[] {
  const porDestino = new Map<string, RegraFormulaCampo>();
  for (const r of regras) if (!porDestino.has(r.destino)) porDestino.set(r.destino, r);
  const ordenadas: RegraFormulaCampo[] = [];
  const estado = new Map<string, 1 | 2>();
  const visitar = (r: RegraFormulaCampo) => {
    const s = estado.get(r.destino);
    if (s) return; // já visitado ou em ciclo
    estado.set(r.destino, 1);
    for (const t of r.termos) {
      const dep = porDestino.get(t.campo);
      if (dep && dep !== r) visitar(dep);
    }
    estado.set(r.destino, 2);
    ordenadas.push(r);
  };
  for (const r of porDestino.values()) visitar(r);
  return ordenadas;
}

/**
 * Aplica as regras aprendidas às linhas já resolvidas.
 *
 * REGRA DE OURO (moeda): todo campo calculado é arredondado para 2 casas
 * decimais a cada operação — o produto de cada termo e a soma acumulada.
 * Assim `BRUTO*5%` = 258,60 (e não 258,599), e o líquido fecha com a planilha.
 *
 * As regras são avaliadas em ordem de dependência e depois refinadas em
 * algumas passagens, para cadeias encadeadas. Não altera campos fora das regras.
 */
export function aplicarRegrasFormulas<T extends Record<string, unknown>>(
  linhas: T[],
  regras: RegraFormulaCampo[],
): T[] {
  if (regras.length === 0) return linhas;
  const ordenadas = ordenarPorDependencia(regras);
  const passagens = Math.min(6, Math.max(1, ordenadas.length));
  return linhas.map((linha) => {
    const atual: Record<string, unknown> = { ...linha };
    for (let p = 0; p < passagens; p++) {
      for (const r of ordenadas) {
        let soma = arredondar(r.constante);
        for (const t of r.termos) {
          const parcela = arredondar(t.fator * numero(atual[t.campo]));
          soma = arredondar(soma + parcela);
        }
        atual[r.destino] = soma;
      }
    }
    return atual as T;
  });
}


// -----------------------------------------------------------------------------
// Persistência (config da versão do layout)
// -----------------------------------------------------------------------------

export const CHAVE_CONFIG_FORMULAS = "formulas";

export function serializarRegras(regras: RegraFormulaCampo[]): string {
  return JSON.stringify(regras);
}

export function lerRegrasDoConfig(
  config: Record<string, unknown> | null | undefined,
): RegraFormulaCampo[] {
  const bruto = config?.[CHAVE_CONFIG_FORMULAS];
  if (!bruto) return [];
  try {
    const parsed = typeof bruto === "string" ? JSON.parse(bruto) : bruto;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r: any) => r && typeof r.destino === "string" && Array.isArray(r.termos))
      .map((r: any) => ({
        destino: String(r.destino),
        expressao: String(r.expressao ?? ""),
        constante: Number(r.constante) || 0,
        termos: r.termos
          .filter((t: any) => t && typeof t.campo === "string")
          .map((t: any) => ({ campo: String(t.campo), fator: Number(t.fator) || 0 })),
      }))
      .filter((r) => r.termos.length > 0);
  } catch {
    return [];
  }
}
