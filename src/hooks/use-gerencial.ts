import { useQuery } from "@tanstack/react-query";
import { getGerencialAggregate } from "@/lib/relatorios-gerenciais-intelligence";
import { useCurrentUser } from "@/hooks/use-permissions";

/** 
 * Hook único compartilhado entre TODOS os relatórios gerenciais.
 * Cache com staleTime longo para evitar re-execução por página. 
 */
export function useGerencial() {
  const { data: user } = useCurrentUser();
  const unidades = user?.unidades?.join(",") || "none";
  const isMaster = !!user?.is_master;

  return useQuery({
    queryKey: ["rel-ger-aggregate", isMaster, unidades],
    queryFn: getGerencialAggregate,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}
