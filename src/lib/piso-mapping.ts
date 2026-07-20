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

export const CAMPOS_SISTEMA: { key: PisoDestino; label: string; financeiro: boolean }[] = [
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
  { key: "valor_liquido", label: "Valor Líquido", financeiro: true },
  { key: "valor_final", label: "Valor Final", financeiro: true },
];

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
  cpf: ["cpf"],
  nome: ["nome", "funcionario", "servidor", "colaborador", "nome completo"],
  matricula: ["matricula", "mat", "registro", "chapa"],
  cargo: ["cargo", "funcao cargo"],
  unidade: ["unidade", "lotacao", "estabelecimento"],
  setor: ["setor", "departamento"],
  vinculo: ["vinculo", "regime", "tipo vinculo"],
  competencia: ["competencia", "referencia", "mes referencia", "mes ano"],
  salario_base: ["salario base", "vencimento", "salario", "base"],
  piso_complementacao: ["piso", "complementacao piso", "complementacao", "compl piso"],
  insalubridade: ["insalubridade", "adic insalubridade"],
  gratificacao: ["gratificacao", "gratif"],
  hora_extra_50: ["hora extra 50", "he 50", "h e 50", "hora extra 50%"],
  hora_extra_100: ["hora extra 100", "he 100", "h e 100", "hora extra 100%"],
  adicional_noturno: ["adicional noturno", "adic noturno", "adn"],
  auxilio_financeiro: ["auxilio financeiro", "auxilio", "ajuda de custo"],
  ferias_1_3: ["1 3 ferias", "terco ferias", "abono ferias", "1 3"],
  ferias: ["ferias"],
  inss: ["inss"],
  irrf: ["irrf", "ir", "imposto renda"],
  valor_liquido: ["valor liquido", "liquido", "salario liquido"],
  valor_final: ["valor final", "total", "total geral", "total liquido"],
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
    if (sug && !usados.has(sug)) {
      out[h] = sug;
      usados.add(sug);
    } else {
      out[h] = null;
    }
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