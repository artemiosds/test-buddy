import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/analitico" });
  },
  component: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-background text-sm text-muted-foreground">
      e-mail de verificação: artemiosouza99@gmail.com
    </div>
  ),
});
