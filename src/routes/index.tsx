import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  errorComponent: ErrorComponent,
  loader: async () => {
    // Redireciona para o dashboard analítico por padrão.
    throw redirect({
      to: "/analitico",
    });
  },
  component: () => null,
});
