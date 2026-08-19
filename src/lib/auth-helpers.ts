/**
 * Helpers para normalização e validação de perfis e permissões.
 * Centraliza a lógica para evitar variações literais no código.
 */

export const PERFIS = {
  MASTER: "MASTER",
  GESTOR: "GESTOR",
  DIRETOR_UNIDADE: "DIRETOR_UNIDADE",
  ADMINISTRADOR_MASTER: "ADMINISTRADOR_MASTER",
  ADMIN_SMS: "ADMIN_SMS",
  RECEPCAO: "RECEPCAO",
} as const;

export type PerfilCodigo = typeof PERFIS[keyof typeof PERFIS];

/**
 * Normaliza o código do perfil para garantir comparações seguras.
 */
export function normalizarPerfil(codigo?: string | null): PerfilCodigo | string | null {
  if (!codigo) return null;
  const c = codigo.trim().toUpperCase().replace(/\s+/g, '_');
  
  // Mapeamento de variações conhecidas
  if (c === "DIRETOR_DE_UNIDADE" || c === "DIRETOR_UNIDADE") return PERFIS.DIRETOR_UNIDADE;
  if (c === "ADMINISTRADOR") return PERFIS.GESTOR;
  
  return c;
}

/**
 * Verifica se o perfil é de Diretor de Unidade ou superior (com acesso restrito).
 */
export function isDiretorUnidade(perfil?: string | null): boolean {
  const p = normalizarPerfil(perfil);
  return p === PERFIS.DIRETOR_UNIDADE;
}

/**
 * Verifica se o perfil possui acesso a todas as unidades (Master ou Gestor).
 * IMPORTANTE: No Sublote 5D+, a fonte de verdade para privilégios elevados
 * é o claim 'is_master' (backend), que já valida flags de acesso + MFA.
 */
export function temAcessoGlobal(perfil?: string | null, isMasterClaim?: boolean): boolean {
  // Se o claim de master estiver ativo, o acesso é global por definição.
  if (isMasterClaim === true) return true;

  const p = normalizarPerfil(perfil);
  // Master, Gestor e Administrador Master (legado) possuem acesso global.
  return p === PERFIS.MASTER || p === PERFIS.ADMINISTRADOR_MASTER || p === PERFIS.GESTOR;
}
