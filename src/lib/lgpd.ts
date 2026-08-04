/**
 * Matriz de Privacidade / Máscara LGPD.
 *
 * Perfis operacional/fiscal: veem CPF mascarado e dados bancários ocultos.
 * Perfil Master/Gestor: acesso completo (com marca d'água dinâmica no PDF).
 */

export type NivelPrivacidade = "completo" | "mascarado";

/** Define o nível de visualização de dados pessoais do usuário atual. */
export function nivelPrivacidade(opts: {
  isMaster?: boolean | null;
  has?: (codigo: string) => boolean;
}): NivelPrivacidade {
  if (opts.isMaster) return "completo";
  if (opts.has?.("relatorio.dados_sensiveis")) return "completo";
  return "mascarado";
}

/** ***.567.890-** */
export function maskCpf(cpf: string | null | undefined): string {
  const d = String(cpf ?? "").replace(/\D/g, "");
  if (d.length !== 11) return cpf ? "CPF inválido" : "—";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

export function formatCpf(cpf: string | null | undefined): string {
  const d = String(cpf ?? "").replace(/\D/g, "");
  if (d.length !== 11) return cpf ? String(cpf) : "—";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Aplica a matriz de privacidade a um CPF. */
export function cpfVisivel(cpf: string | null | undefined, nivel: NivelPrivacidade): string {
  return nivel === "completo" ? formatCpf(cpf) : maskCpf(cpf);
}

/** Dados bancários: ocultos para o nível mascarado. */
export function bancarioVisivel(valor: string | null | undefined, nivel: NivelPrivacidade): string {
  if (nivel !== "completo") return "•••• (oculto — LGPD)";
  return valor?.trim() ? valor : "—";
}

export const MATRIZ_PRIVACIDADE = [
  {
    perfil: "Operacional / Fiscal",
    cpf: "Mascarado (***.567.890-**)",
    bancario: "Oculto",
    marcaDagua: "Não aplicável",
  },
  {
    perfil: "Master / Gestor",
    cpf: "Completo",
    bancario: "Completo",
    marcaDagua: "Nome + CPF + data/hora + IP no PDF",
  },
] as const;
