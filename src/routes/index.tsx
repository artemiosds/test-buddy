import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  // Sem ssr:false: o redirecionamento acontece no servidor (302), evitando
  // que o cliente troque de rota durante a hidratação.
  beforeLoad: async () => {
    // Redirecionamos para /analitico para garantir que o layout autenticado
    // (com sidebar) seja carregado corretamente. O "/" por ser raiz e flat
    // as vezes não renderiza o layout de _authenticated dependendo da hierarquia.
    // O /analitico está sob _authenticated e forçará o login se necessário.
    throw redirect({ to: "/analitico" });
  },
  component: () => null,
});
