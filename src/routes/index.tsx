import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    // Redirecionamos para /analitico para garantir que o layout autenticado
    // (com sidebar) seja carregado corretamente. O "/" por ser raiz e flat
    // as vezes não renderiza o layout de _authenticated dependendo da hierarquia.
    // O /analitico está sob _authenticated e forçará o login se necessário.
    throw redirect({ to: "/analitico" });
  },
  component: () => null,
});
