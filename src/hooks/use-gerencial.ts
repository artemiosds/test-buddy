import { useQuery } from "@tanstack/react-query";
import { getGerencialAggregate } from "@/lib/relatorios-gerenciais-intelligence";

/** Hook único compartilhado entre TODOS os relatórios gerenciais.
 *  Cache com staleTime longo para evitar re-execução por página. */
export function useGerencial() {
  return useQuery({
    queryKey: ["rel-ger-aggregate"],
    queryFn: getGerencialAggregate,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}
