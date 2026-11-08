/**
 * Regras puras para cobrar somente as unidades com folhas pendentes.
 * Não consulta nem grava banco; usada pelo job de prazos de competência.
 */
export type SituacaoFolha = { unidadeId: string; status: string };
export type GestorCobranca = { id: string; diretor: boolean };

const STATUS_ENVIADOS = new Set(["enviada", "aprovada", "em_analise", "arquivada"]);

/**
 * Unidade sem folha é pendente. Com mais de uma folha, só está concluída
 * quando TODAS foram enviadas ou aprovadas; nunca inferir por uma só.
 */
export function unidadesQuePrecisamEnviar(
  unidadeIds: Iterable<string>,
  folhas: SituacaoFolha[],
): Set<string> {
  const pendentes = new Set(unidadeIds);
  const total = new Map<string, number>();
  const concluidas = new Map<string, number>();
  for (const folha of folhas) {
    if (!pendentes.has(folha.unidadeId)) continue;
    total.set(folha.unidadeId, (total.get(folha.unidadeId) ?? 0) + 1);
    if (STATUS_ENVIADOS.has(folha.status))
      concluidas.set(folha.unidadeId, (concluidas.get(folha.unidadeId) ?? 0) + 1);
  }
  for (const unidadeId of [...pendentes]) {
    const n = total.get(unidadeId) ?? 0;
    if (n > 0 && concluidas.get(unidadeId) === n) pendentes.delete(unidadeId);
  }
  return pendentes;
}

/** Gestores gerais só são avisados se existir algo pendente; diretores
 * somente quando alguma das suas unidades ainda precisa enviar. */
export function destinatariosDaCobranca(
  gestores: GestorCobranca[],
  pendentes: ReadonlySet<string>,
  unidadesPorDiretor: ReadonlyMap<string, ReadonlySet<string>>,
): string[] {
  if (!pendentes.size) return [];
  return gestores.filter(gestor => {
    if (!gestor.diretor) return true;
    const unidades = unidadesPorDiretor.get(gestor.id);
    return unidades ? [...unidades].some(id => pendentes.has(id)) : false;
  }).map(gestor => gestor.id);
}

/** Evita notificar administradores de uma secretaria sem permissão nela. */
export function gestorPodeReceber(
  perfil: string | undefined,
  secretariaUsuario: string | null,
  secretariaCompetencia: string,
  acessoTodasSecretarias = false,
): boolean {
  if (perfil === "MASTER") return true;
  if (perfil === "DIRETOR_UNIDADE") return true; // Escopo limitado pelos vínculos ativos.
  if (perfil === "ADMIN_SMS") return acessoTodasSecretarias || secretariaUsuario === secretariaCompetencia;
  return false;
}
