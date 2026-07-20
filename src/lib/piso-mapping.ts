// Módulo Piso Nacional da Enfermagem — heurística de mapeamento de colunas.
// Puro: sem I/O. Testado por src/lib/piso-mapping.test.ts.

export type PisoDestino =
  | "cpf"
  | "nome"
  | "matricula"
  | "cargo"
  | "unidade"
  | "setor"
  | "vinculo"
  | "salario_base"
  | "piso_complementacao"
  | "insalubridade"
  | "gratificacao"
  | "hora_extra_50"
  | "hora_extra_100"
  | "adicional_noturno"
  | "auxilio_financeiro"
  | "ferias_1_3"
  | "ferias"
  | "inss"
  | "irrf"
  | "valor_liquido"
  | "valor_final"
  | "competencia";

export const CAMPOS_SISTEMA: {
  key: PisoDestino;
  label: string;
  financeiro: boolean;
  /** Campo recalculado internamente pelo sistema — não deve ser importado. */
  calculado?: boolean;
}[] = [
  { key: "cpf", label: "CPF", financeiro: false },
  { key: "nome", label: "Nome", financeiro: false },
  { key: "matricula", label: "Matrícula", financeiro: false },
  { key: "cargo", label: "Cargo", financeiro: false },
  { key: "unidade", label: "Unidade", financeiro: false },
  { key: "setor", label: "Setor", financeiro: false },
  { key: "vinculo", label: "Vínculo", financeiro: false },
  { key: "competencia", label: "Competência", financeiro: false },
  { key: "salario_base", label: "Salário Base", financeiro: true },
  { key: "piso_complementacao", label: "Compl. Piso", financeiro: true },
  { key: "insalubridade", label: "Insalubridade", financeiro: true },
  { key: "gratificacao", label: "Gratificação", financeiro: true },
  { key: "hora_extra_50", label: "Hora Extra 50%", financeiro: true },
  { key: "hora_extra_100", label: "Hora Extra 100%", financeiro: true },
  { key: "adicional_noturno", label: "Adic. Noturno", financeiro: true },
  { key: "auxilio_financeiro", label: "Auxílio Financeiro", financeiro: true },
  { key: "ferias_1_3", label: "1/3 Férias", financeiro: true },
  { key: "ferias", label: "Férias", financeiro: true },
  { key: "inss", label: "INSS", financeiro: true },
  { key: "irrf", label: "IRRF", financeiro: true },
  { key: "valor_liquido", label: "Valor Líquido", financeiro: true, calculado: true },
  { key: "valor_final", label: "Valor Final", financeiro: true, calculado: true },
];

/** Conjunto de destinos calculados (não devem receber auto-map). */
export const CAMPOS_CALCULADOS: ReadonlySet<PisoDestino> = new Set(
  CAMPOS_SISTEMA.filter((c) => c.calculado).map((c) => c.key),
);

/** Destinos padrão marcados na UI de "campos a atualizar" (financeiros). */
export const CAMPOS_UPDATE_DEFAULT: ReadonlySet<PisoDestino> = new Set(
  CAMPOS_SISTEMA.filter((c) => c.financeiro && !c.calculado).map((c) => c.key),
);

/** Remove acentos e normaliza para minúsculas + espaços simples. */
export function normalize(s: string): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
}

// Palavras/aliases por destino (todas já normalizadas).
const ALIASES: Record<PisoDestino, string[]> = {
  cpf: ["cpf", "cpf do servidor", "cpf servidor", "cpf funcionario", "cpf do funcionario", "n cpf", "num cpf"],
  nome: ["nome", "funcionario", "servidor", "colaborador", "nome completo", "nome do servidor", "nome funcionario"],
  matricula: ["matricula", "mat", "registro", "chapa", "matr", "n matricula"],
  cargo: ["cargo", "funcao cargo", "cargo funcao", "descricao cargo"],
  unidade: ["unidade", "lotacao", "estabelecimento", "local trabalho", "unidade lotacao"],
  setor: ["setor", "departamento", "sub setor", "area"],
  vinculo: ["vinculo", "regime", "tipo vinculo", "situacao"],
  competencia: ["competencia", "referencia", "mes referencia", "mes ano", "periodo"],
  salario_base: ["salario base", "vencimento", "salario", "base", "sal base", "venc base"],
  piso_complementacao: [
    "piso", "complementacao piso", "complementacao", "compl piso",
    "compl", "complemento piso", "compl salarial",
  ],
  insalubridade: ["insalubridade", "adic insalubridade", "insalub", "ad insalub", "adic insalub"],
  gratificacao: [
    "gratificacao", "gratif", "gratificacoes",
    "gratificacao funcao", "grat fun", "gratif fun", "gratificacao de funcao",
  ],
  hora_extra_50: [
    "hora extra 50", "he 50", "h e 50", "hora extra 50%", "he50",
    "hr ex 50", "hr ex 50%", "hr extra 50", "he 50%",
  ],
  hora_extra_100: [
    "hora extra 100", "he 100", "h e 100", "hora extra 100%", "he100",
    "hr ex 100", "hr ex 100%", "hr extra 100", "he 100%",
  ],
  adicional_noturno: ["adicional noturno", "adic noturno", "adn", "ad noturno", "ad not"],
  auxilio_financeiro: [
    "auxilio financeiro", "auxilio", "ajuda de custo",
    "aux financ", "aux financeiro", "aux fin", "auxilio financ",
  ],
  ferias_1_3: ["1 3 ferias", "terco ferias", "abono ferias", "1 3", "1 3 constitucional"],
  ferias: ["ferias"],
  inss: ["inss", "desc inss", "desconto inss"],
  irrf: ["irrf", "ir", "imposto renda", "irpf", "desc irrf"],
  valor_liquido: ["valor liquido", "liquido", "salario liquido", "liquido a receber"],
  valor_final: [
    "valor final", "total", "total geral", "total liquido",
    "total positivos", "total descontos", "total bruto",
  ],
};

/**
 * Sugere um destino para um header do arquivo. Devolve `null` quando não há
 * palavra-chave clara. Prioriza correspondência exata; depois `includes`.
 */
export function suggestDestino(header: string): PisoDestino | null {
  const norm = normalize(header);
  if (!norm) return null;

  // Exact match primeiro
  for (const [dest, aliases] of Object.entries(ALIASES) as [PisoDestino, string[]][]) {
    if (aliases.some((a) => a === norm)) return dest;
  }
  // Match por inclusão — evita palavras curtas ambíguas
  for (const [dest, aliases] of Object.entries(ALIASES) as [PisoDestino, string[]][]) {
    if (aliases.some((a) => a.length >= 3 && norm.includes(a))) return dest;
  }
  return null;
}

/**
 * Recebe a lista de headers do arquivo e devolve o mapeamento sugerido:
 * { headerOriginal: destinoOuNull }.
 */
export function autoMap(headers: string[]): Record<string, PisoDestino | null> {
  const out: Record<string, PisoDestino | null> = {};
  const usados = new Set<PisoDestino>();
  for (const h of headers) {
    const sug = suggestDestino(h);
    // Nunca auto-mapear campos calculados — o sistema recalcula.
    if (sug && !usados.has(sug) && !CAMPOS_CALCULADOS.has(sug)) {
      out[h] = sug;
      usados.add(sug);
    } else {
      out[h] = null;
    }
  }
  return out;
}

/**
 * Detecta colunas do arquivo que correspondem a campos calculados (Total, Líquido,
 * Valor Final), para exibir aviso ao usuário. Retorna pares { header, destino }.
 */
export function detectCalculatedColumns(
  headers: string[],
): { header: string; destino: PisoDestino }[] {
  const out: { header: string; destino: PisoDestino }[] = [];
  for (const h of headers) {
    const sug = suggestDestino(h);
    if (sug && CAMPOS_CALCULADOS.has(sug)) out.push({ header: h, destino: sug });
  }
  return out;
}

/** Regex de CPF (com ou sem máscara). */
export const CPF_REGEX = /(\d{3}\.\d{3}\.\d{3}-\d{2})|(\d{11})/;

/** Converte valor cru (string/number) para número, aceitando "R$ 1.234,56". */
export function parseNumeric(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v)
    .replace(/[R$\s]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "") // remove separador de milhar
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Só dígitos, útil para CPF. */
export function onlyDigits(v: unknown): string {
  return String(v ?? "").replace(/\D+/g, "");
}