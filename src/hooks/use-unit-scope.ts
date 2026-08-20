import { useCurrentUser } from "./use-permissions";
import { isDiretorUnidade, temAcessoGlobal } from "@/lib/auth-helpers";
import { useMemo, useEffect, useSyncExternalStore, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Store global (fora do React) para a unidade ativa.
 * Necessário porque múltiplos componentes usam useUnitScope simultaneamente
 * e todos precisam compartilhar a MESMA unidade selecionada.
 */
const STORAGE_KEY = "hsm.unidade-ativa";
let currentUnitId: string | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  try {
    currentUnitId = window.localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    currentUnitId = null;
  }
}

function setGlobalUnitId(id: string | null) {
  if (currentUnitId === id) return;
  currentUnitId = id;
  if (typeof window !== "undefined") {
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return currentUnitId;
}

function getServerSnapshot(): string | null {
  return null;
}

/**
 * Hook central de escopo de unidade.
 * Fonte da verdade: array `unidades` retornado por get_my_user_context().
 */
export function useUnitScope() {
  const { data: user, isLoading: isUserLoading } = useCurrentUser();

  // IDs autorizados vêm SEMPRE do contexto do usuário (RPC).
  const contextUnitIds = useMemo(
    () => (Array.isArray(user?.unidades) ? user!.unidades.filter(Boolean) : []),
    [user],
  );

  // Nomes das unidades (apenas para exibição). Nunca bloqueia a seleção.
  const { data: unidadesRows = [], isLoading: isLookupLoading } = useQuery({
    queryKey: ["lookup-unidades-scope", user?.id, contextUnitIds.join(",")],
    queryFn: async () => {
      let q = supabase
        .from("unidades")
        .select("id, nome, sigla")
        .is("deleted_at", null)
        .order("nome");
      if (!user?.is_master && contextUnitIds.length > 0) {
        q = q.in("id", contextUnitIds);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });

  const selectedUnitId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setSelectedUnitId = useCallback((id: string | null) => setGlobalUnitId(id), []);

  const isMaster = !!user?.is_master;
  const isGlobal = isMaster || temAcessoGlobal(user?.perfil_codigo, user?.is_master);

  // Lista efetiva: linhas do banco quando disponíveis, senão placeholders a partir dos IDs do contexto.
  const unidadesList = useMemo(() => {
    if (unidadesRows.length > 0) return unidadesRows;
    return contextUnitIds.map((id) => ({ id, nome: "Unidade vinculada", sigla: null as string | null }));
  }, [unidadesRows, contextUnitIds]);

  const allowedIds = useMemo(() => {
    if (isGlobal) return unidadesList.map((u) => u.id);
    return contextUnitIds.length > 0 ? contextUnitIds : unidadesList.map((u) => u.id);
  }, [isGlobal, contextUnitIds, unidadesList]);

  // AUTO-SELEÇÃO FORÇADA: diretor com unidades nunca fica sem unidade ativa.
  useEffect(() => {
    if (!user) return;
    if (allowedIds.length === 0) return;
    if (selectedUnitId && allowedIds.includes(selectedUnitId)) return;
    if (selectedUnitId && isGlobal) return; // global pode manter qualquer seleção
    setGlobalUnitId(allowedIds[0]);
  }, [user, allowedIds, selectedUnitId, isGlobal]);

  const scopeState = isGlobal ? "GLOBAL" : allowedIds.length > 0 ? "UNIT" : "NONE";

  return {
    isMaster,
    isGlobal,
    isDiretor: isDiretorUnidade(user?.perfil_codigo),
    unidadesPermitidas: allowedIds,
    unidadesList,
    scopeState,
    hasMultipleUnits: allowedIds.length > 1,
    locked: !isMaster && allowedIds.length <= 1,
    isLoading: isUserLoading || !user || (isLookupLoading && unidadesRows.length === 0 && contextUnitIds.length === 0),
    noScope: scopeState === "NONE",
    isResolved: !!user && (allowedIds.length === 0 || !!selectedUnitId),
    selectedUnitId,
    setSelectedUnitId,
    unidadePadraoId: selectedUnitId || allowedIds[0] || null,
  };
}
