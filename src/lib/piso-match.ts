// Chaves de correspondência com o Cadastro de Profissionais.
// Mesma lógica usada nas telas de Frequência (Contratados) e Folha (Efetivos):
// o profissional é localizado por CPF → matrícula → nome normalizado, sempre
// comparando valores normalizados (sem máscara, sem zeros à esquerda, sem acento).

/** CPF apenas com dígitos, completado com zeros à esquerda até 11 posições. */
export function normCpf(v: string | null | undefined): string {
  const d = (v ?? "").replace(/\D+/g, "");
  if (!d) return "";
  if (d.length > 11) return d.slice(-11);
  return d.padStart(11, "0");
}

/** Matrícula em caixa alta, sem separadores e sem zeros à esquerda. */
export function normMatricula(v: string | null | undefined): string {
  const s = (v ?? "").toString().trim().toUpperCase().replace(/[\s.\-/]/g, "");
  if (!s) return "";
  const semZeros = s.replace(/^0+/, "");
  return semZeros || s;
}

/** Nome sem acentos, sem pontuação, com espaços colapsados e em caixa alta. */
export function normNome(v: string | null | undefined): string {
  return (v ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Situações que devem ficar de fora da busca (igual às telas de folha). */
export const STATUS_EXCLUIDOS = ["desligado", "inativo"] as const;
