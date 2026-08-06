import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  // Redirecionamento no servidor (307) evita troca de rota durante a hidratação.
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
});
