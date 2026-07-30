import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withBreaker } from "@/lib/circuit-breaker";

export type UserContext = {
  id: string;
  nome_completo: string | null;
  email: string | null;
  status: string;
  perfil_id: string | null;
  perfil_codigo: string | null;
  perfil_nome: string | null;
  secretaria_id: string | null;
  acesso_todas_unidades: boolean;
  acesso_todas_secretarias: boolean;
  is_master: boolean;
  perfil_admin_2fa_required: boolean;
};

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user-context"],
    staleTime: 60_000,
    queryFn: async (): Promise<UserContext | null> => {
      return withBreaker(
        "rpc.get_my_user_context",
        async () => {
          const { data, error } = await supabase.rpc("get_my_user_context");
          if (error) throw error;
          const row = Array.isArray(data) ? data[0] : data;
          return (row as UserContext) ?? null;
        },
        // Fallback degradado seguro: sem contexto → tratado como não-master
        // pelo restante da UI (canSee bloqueia rotas master-only).
        { fallback: () => null },
      );
    },
  });
}

export function usePermissions() {
  const query = useQuery({
    queryKey: ["my-permissions"],
    staleTime: 60_000,
    queryFn: async (): Promise<Set<string>> => {
      return withBreaker(
        "rpc.get_my_permissions",
        async () => {
          const { data, error } = await supabase.rpc("get_my_permissions");
          if (error) throw error;
          const list = (data as unknown as string[]) ?? [];
          return new Set(list);
        },
        // Fallback degradado seguro: sem permissões → nega tudo (`has()` false).
        { fallback: () => new Set<string>() },
      );
    },
  });

  const codes = query.data ?? new Set<string>();
  const has = (code: string) => codes.has(code);
  const hasAny = (list: string[]) => list.some((c) => codes.has(c));

  return { ...query, codes, has, hasAny };
}
