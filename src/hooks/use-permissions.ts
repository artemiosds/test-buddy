import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { withBreaker } from "@/lib/circuit-breaker";
import { normalizarPerfil, temAcessoGlobal } from "@/lib/auth-helpers";

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
  unidades: string[];
  cpf?: string | null;
  matricula?: string | null;
};

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user-context"],
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    queryFn: async (): Promise<UserContext | null> => {
      return withBreaker(
        "rpc.get_my_user_context",
        async () => {
          console.log('[useCurrentUser] Chamando RPC get_my_user_context...');
          const { data, error } = await supabase.rpc("get_my_user_context");
          console.log('[useCurrentUser] Resultado RPC:', data, error);
          if (error) throw error;
          
          // O RPC já retorna um objeto único devido ao jsonb_build_object
          const row = data as unknown as UserContext;
          if (!row) return null;

          // Normaliza o perfil_codigo para garantir consistência no frontend
          return {
            ...row,
            perfil_codigo: normalizarPerfil(row.perfil_codigo)
          };
        },
        { fallback: () => null },
      );
    },
  });
}

export function usePermissions() {
  const userQuery = useQuery({
    queryKey: ["supabase-user"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    },
    staleTime: 5 * 60_000,
  });

  const rpcFallbackQuery = useQuery({
    queryKey: ["my-permissions-fallback"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc("get_my_permissions");
      if (error) throw error;
      return (data as unknown as string[]) ?? [];
    },
    enabled: !!userQuery.data && !Array.isArray(userQuery.data.app_metadata?.permissions),
    staleTime: 5 * 60_000,
  });

  const codes = useMemo(() => {
    const jwtPerms = userQuery.data?.app_metadata?.permissions;
    if (Array.isArray(jwtPerms)) {
      return new Set(jwtPerms as string[]);
    }
    if (Array.isArray(rpcFallbackQuery.data)) {
      return new Set(rpcFallbackQuery.data);
    }
    return new Set<string>();
  }, [userQuery.data, rpcFallbackQuery.data]);

  const has = (code: string) => codes.has(code);
  const hasAny = (list: string[]) => list.some((c) => codes.has(c));

  const needsRefresh = !!userQuery.data && !Array.isArray(userQuery.data.app_metadata?.permissions);

  return { 
    ...userQuery,
    isLoading: userQuery.isLoading || (needsRefresh && rpcFallbackQuery.isLoading),
    isFallback: needsRefresh,
    codes, 
    has, 
    hasAny,
    refresh: async () => {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      return data;
    }
  };
}
