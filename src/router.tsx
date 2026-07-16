import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Onda 2 — Performance React Query (Sprint de Produção)
// -----------------------------------------------------------------------------
// Defaults conservadores aplicados APENAS onde o hook não define sua própria
// opção. Objetivo: eliminar refetches desnecessários (troca de aba, remontagem
// de rota) e reduzir latência em falhas transitórias. Nenhuma alteração de
// comportamento funcional, regra de negócio, cálculo ou permissão.
//
// - staleTime 60s: dados considerados frescos por 1 min → não refaz fetch em
//   remontagens rápidas de componente/rota. Hooks que precisam de dado mais
//   fresco (mutations onSuccess → invalidateQueries) continuam funcionando
//   pois a invalidação explícita ignora staleTime.
// - gcTime 5min: mantém entradas em cache por 5 min após ficarem sem
//   observadores (facilita navegação entre telas relacionadas).
// - refetchOnWindowFocus false: elimina refetch a cada troca de aba
//   (comportamento comum em painéis operacionais 24/7).
// - refetchOnReconnect true: mantém refresh após reconexão de rede.
// - retry 1: falha rápida em vez de multiplicar latência 4× em erros
//   transitórios. Mutações continuam sem retry por padrão do RQ.
//
// Hooks que sobrescrevem essas opções continuam prevalecendo (ex.:
// useAnalytics, sala-situacao, controle-forca-trabalho).
export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
