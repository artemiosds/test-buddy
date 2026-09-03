/**
 * Regra de negócio do prazo de envio das folhas de frequência.
 *
 * O bloqueio por prazo vencido atinge EXCLUSIVAMENTE o Diretor de Unidade.
 * Administrador Master e Gestor têm bypass total (editam/enviam a qualquer momento).
 */

import { normalizarPerfil, PERFIS } from "@/lib/auth-helpers";

export const MSG_PRAZO_ENCERRADO =
  "Prazo de envio encerrado. A edição desta folha está bloqueada. Solicite a extensão do prazo à Gestão.";

/** true quando "agora" já passou de prazo_envio às 23:59:59 (UTC-3). */
export function prazoEnvioExpirado(prazo?: string | null, agora: Date = new Date()): boolean {
  if (!prazo) return false;
  const base = String(prazo).slice(0, 10);
  const limite = new Date(`${base}T23:59:59-03:00`);
  if (Number.isNaN(limite.getTime())) return false;
  return agora.getTime() > limite.getTime();
}

/** Perfis que nunca são bloqueados pelo prazo. */
export function temBypassPrazo(perfilCodigo?: string | null, isMaster?: boolean): boolean {
  if (isMaster === true) return true;
  const p = normalizarPerfil(perfilCodigo);
  return (
    p === PERFIS.MASTER ||
    p === PERFIS.ADMINISTRADOR_MASTER ||
    p === PERFIS.GESTOR ||
    p === PERFIS.ADMIN_SMS
  );
}

/** Bloqueio efetivo: diretor de unidade (sem bypass) com prazo vencido. */
export function bloqueadoPorPrazo(opts: {
  prazo?: string | null;
  perfilCodigo?: string | null;
  isMaster?: boolean;
  agora?: Date;
}): boolean {
  if (temBypassPrazo(opts.perfilCodigo, opts.isMaster)) return false;
  return prazoEnvioExpirado(opts.prazo, opts.agora ?? new Date());
}

/**
 * Validação server-side. Lança erro de permissão quando o requisitante é
 * Diretor de Unidade e o prazo de envio já expirou.
 */
export async function assertPrazoEnvio(
  supabase: any,
  userId: string,
  competenciaId: string,
): Promise<void> {
  if (!competenciaId) return;

  const { data: comp } = await supabase
    .from("competencias")
    .select("prazo_envio")
    .eq("id", competenciaId)
    .maybeSingle();

  const prazo = (comp as any)?.prazo_envio as string | null | undefined;
  if (!prazoEnvioExpirado(prazo)) return;

  const { data: isMasterRPC } = await supabase.rpc("is_master", { _user_id: userId });
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("perfil:perfis(codigo)")
    .eq("id", userId)
    .maybeSingle();
  const codigo = ((usuario as any)?.perfil as any)?.codigo as string | undefined;

  if (temBypassPrazo(codigo, isMasterRPC === true)) return;

  throw new Error(MSG_PRAZO_ENCERRADO);
}

/** Mesma validação a partir de uma frequência (rota genérica). */
export async function assertPrazoEnvioPorFrequencia(
  supabase: any,
  userId: string,
  frequenciaId: string,
): Promise<void> {
  const { data: freq } = await supabase
    .from("frequencias")
    .select("competencia_unidades(competencia_id)")
    .eq("id", frequenciaId)
    .maybeSingle();
  const competenciaId = (freq as any)?.competencia_unidades?.competencia_id as string | undefined;
  if (competenciaId) await assertPrazoEnvio(supabase, userId, competenciaId);
}
