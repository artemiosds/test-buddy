// Contrato dos templates de importação (padrão Strategy).
// Cada modelo de arquivo do RH (UBS, Educação, Hospitalar…) implementa este
// contrato e é registrado em `./index.ts`. Nenhuma regra de cálculo vive aqui.

export type LinhaCalculavel = Record<string, unknown>;

export interface ImportTemplateConfig {
  /** Identificador estável do template. Ex.: "UBS_SAUDE". */
  id: string;
  /** Nome exibido na interface. */
  nome: string;
  /** Casamento pelo nome do arquivo. Ex.: /SAUDE.*UBS/i */
  filePattern: RegExp;
  /**
   * Cabeçalhos que devem existir no arquivo para confirmar o template.
   * Comparados já normalizados (sem acento/pontuação, maiúsculas).
   */
  cabecalhosEsperados: string[];
  /**
   * Linha do cabeçalho quando fixa no modelo (0-based). Quando `null`, o
   * assistente usa a detecção dinâmica já existente.
   */
  headerRowIndex: number | null;
  /** Cabeçalho do arquivo → campo interno do sistema. */
  columnMap: Record<string, string>;
  /** Ordem das colunas da planilha final gerada. */
  colunasSaida: string[];
  /** Regras de cálculo/normalização do modelo. Puro, sem I/O. */
  calculationRules: (linha: LinhaCalculavel) => LinhaCalculavel;
  /** Descrição legível das fórmulas, para exibir na auditoria. */
  descricaoRegras: string[];
}

/** Normaliza um cabeçalho para comparação (sem acento, pontuação ou espaço). */
export function normalizarCabecalho(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toUpperCase();
}

/** Arredondamento monetário (2 casas, meio para cima) usado pelos modelos. */
export function moeda(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/** Converte texto/planilha em número, aceitando "1.234,56" e "1234.56". */
export function numero(valor: unknown): number {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const txt = String(valor ?? "").trim();
  if (!txt) return 0;
  const limpo = txt
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

/** Texto institucional: sem espaços duplicados e em caixa alta. */
export function textoUpper(valor: unknown): string | null {
  const txt = String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return txt || null;
}

/** CPF: apenas dígitos (chave de busca). */
export function cpfDigitos(valor: unknown): string | null {
  const d = String(valor ?? "").replace(/\D+/g, "");
  return d || null;
}

/** CPF formatado para exibição: XXX.XXX.XXX-XX. */
export function cpfFormatado(valor: unknown): string {
  const d = cpfDigitos(valor) ?? "";
  if (d.length !== 11) return d;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
