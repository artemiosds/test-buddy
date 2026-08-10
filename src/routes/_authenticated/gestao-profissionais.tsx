import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/gestao-profissionais")({
  beforeLoad: () => {
    throw redirect({
      to: "/profissionais",
      replace: true,
    });
  },
  component: () => null,
});
