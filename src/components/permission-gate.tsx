import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/use-permissions";

type Props = {
  permission?: string;
  anyOf?: string[];
  fallback?: ReactNode;
  children: ReactNode;
};

/**
 * Renderiza o conteúdo somente se o usuário autenticado tiver a permissão indicada.
 * Uso:
 *   <PermissionGate permission="unidade.criar">...</PermissionGate>
 *   <PermissionGate anyOf={["frequencia.aprovar", "frequencia.rejeitar"]}>...</PermissionGate>
 */
export function PermissionGate({ permission, anyOf, fallback = null, children }: Props) {
  const { has, hasAny, isLoading } = usePermissions();
  if (isLoading) return null;
  const allowed = permission ? has(permission) : anyOf ? hasAny(anyOf) : false;
  return <>{allowed ? children : fallback}</>;
}
