import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
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
  unidades: string[];
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
  // 1. Carrega o usuário para extrair permissões do app_metadata (JWT)
  const userQuery = useQuery({
    queryKey: ["supabase-user"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    },
    staleTime: 5 * 60_000,
  });

  // 2. Fallback: Se o app_metadata não tiver permissões, carrega via RPC
  const rpcFallbackQuery = useQuery({
    queryKey: ["my-permissions-fallback"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc("get_my_permissions");
      if (error) throw error;
      return (data as unknown as string[]) ?? [];
    },
    // Só habilita se o usuário estiver carregado mas SEM a lista de permissões no metadata
    enabled: !!userQuery.data && !Array.isArray(userQuery.data.app_metadata?.permissions),
    staleTime: 5 * 60_000,
  });

  // 3. Consolidação: Prioriza JWT, faz fallback para RPC
  const codes = useMemo(() => {
    // Tenta JWT
    const jwtPerms = userQuery.data?.app_metadata?.permissions;
    if (Array.isArray(jwtPerms)) {
      return new Set(jwtPerms as string[]);
    }
    // Tenta RPC Fallback
    if (Array.isArray(rpcFallbackQuery.data)) {
      return new Set(rpcFallbackQuery.data);
    }
    return new Set<string>();
  }, [userQuery.data, rpcFallbackQuery.data]);

  const has = (code: string) => codes.has(code);
  const hasAny = (list: string[]) => list.some((c) => codes.has(c));

  // Dispara refresh automático se detectou fallback (sessão antiga)
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
