import type { SupabaseClient } from "@supabase/supabase-js";

const PERFIS_GLOBAIS = ["MASTER", "ADMINISTRADOR_MASTER", "ADMIN_MASTER", "GESTOR"];

/**
 * Garante que o usuário tem acesso global (Administrador Master / Gestor).
 * Usado pelas leituras consolidadas ("Todas as Unidades"), que são sempre
 * somente leitura. As políticas de RLS continuam valendo normalmente.
 */
export async function assertAcessoGlobal(supabase: SupabaseClient<any>, userId: string) {
  const { data: isMasterRPC } = await supabase.rpc("is_master", { _user_id: userId });
  if (isMasterRPC === true) return true;

  const { data: profile } = await supabase
    .from("usuarios")
    .select("acesso_todas_unidades, perfil:perfis(codigo)")
    .eq("id", userId)
    .maybeSingle();

  if ((profile as any)?.acesso_todas_unidades === true) return true;
  const codigo = String((profile as any)?.perfil?.codigo ?? "").toUpperCase();
  if (PERFIS_GLOBAIS.includes(codigo)) return true;

  throw new Error(
    "Visão consolidada disponível apenas para Administrador Master e Gestor.",
  );
}
