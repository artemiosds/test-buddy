/**
 * Normalização das categorias de enfermagem elegíveis ao Piso Nacional.
 *
 * A fonte oficial dos profissionais é o Cadastro de Profissionais; aqui apenas
 * traduzimos as diversas grafias de cargo para três categorias canônicas.
 */

export type CategoriaPiso = "ENFERMEIRO" | "TECNICO_ENFERMAGEM" | "AUXILIAR_ENFERMAGEM";

export const CATEGORIA_LABEL: Record<CategoriaPiso, string> = {
  ENFERMEIRO: "ENFERMEIRO",
  TECNICO_ENFERMAGEM: "TÉCNICO DE ENFERMAGEM",
  AUXILIAR_ENFERMAGEM: "AUXILIAR DE ENFERMAGEM",
};

export const CATEGORIAS_PISO: CategoriaPiso[] = [
  "ENFERMEIRO",
  "TECNICO_ENFERMAGEM",
  "AUXILIAR_ENFERMAGEM",
];

/** Remove acentos, pontuação e espaços redundantes; retorna caixa alta. */
export function normalizarTexto(v: string | null | undefined): string {
  if (!v) return "";
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/**
 * Cargos que contêm palavras da enfermagem por coincidência mas NÃO são
 * elegíveis (evita falsos positivos como "AUX. SERV. GERAIS" ou
 * "TEC. LABORATÓRIO").
 */
const TERMOS_EXCLUIDOS = [
  "FONO",
  "FONOAUDIOLOG",
  "BIOMEDIC",
  "ADMINISTRATIV",
  "ASSISTENTE",
  "SOCIAL",
  "PSICOLOG",
  "FARMACEUTIC",
  "ODONTOLOG",
  "MEDIC",
  "NUTRICIONISTA",
  "FISIOTERAPEUTA",
  "TERAPEUTA",
  "COZINH",
  "SERV GERAIS",
  "SERVICOS GERAIS",
  "SERVICOS",
  "SERV",
  "LABORATORIO",
  "RADIOLOG",
  "INFORMATICA",
  "SEGURANCA",
  "LIMPEZA",
  "MANUTENCAO",
  "CONTABIL",
  "VETERINARI",
];

/** Marca de "enfermagem" em qualquer grafia, inclusive abreviada (ENF). */
const RE_ENFERMAGEM = /\b(ENFERMAGEM|ENFERMEIR[OA]?|ENF)\b/;
const RE_AUXILIAR = /\b(AUX|AUXILIAR)\b/;
const RE_TECNICO = /\b(TEC|TECN|TECNIC[OA]|TECNICO A)\b/;
const RE_ENFERMEIRO = /\b(ENFERMEIR[OA]|ENF)\b/;

/**
 * Converte um cargo livre na categoria canônica do Piso.
 * Retorna `null` quando o cargo não pertence à enfermagem elegível.
 */
export function normalizarCategoriaPiso(cargo: string | null | undefined): CategoriaPiso | null {
  const t = normalizarTexto(cargo);
  if (!t) return null;

  // 1. Descarta cargos de outras áreas mesmo que contenham AUX/TEC/ENF.
  for (const termo of TERMOS_EXCLUIDOS) {
    if (t.includes(termo)) return null;
  }

  // 2. Precisa conter alguma marca de enfermagem.
  if (!RE_ENFERMAGEM.test(t)) return null;

  // 3. Auxiliar tem precedência sobre técnico/enfermeiro quando aparece junto.
  if (RE_AUXILIAR.test(t)) return "AUXILIAR_ENFERMAGEM";
  if (RE_TECNICO.test(t)) return "TECNICO_ENFERMAGEM";
  if (RE_ENFERMEIRO.test(t)) return "ENFERMEIRO";
  return null;
}


export function ehCargoElegivel(cargo: string | null | undefined): boolean {
  return normalizarCategoriaPiso(cargo) !== null;
}

export function labelCategoria(c: CategoriaPiso | null): string {
  return c ? CATEGORIA_LABEL[c] : "—";
}
