import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RelatoriosTabs } from "@/components/relatorios-tabs";
import { PageHeader } from "@/components/shared/PageHeader";

export const Route = createFileRoute("/_authenticated/relatorios-gerenciais")({
  component: RelatoriosGerenciaisLayout,
});

function RelatoriosGerenciaisLayout() {
  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title="Relatórios Gerenciais da Secretaria"
        description="Consultas sobre cadastros atuais — não dependem de competência. Use para responder perguntas administrativas do Secretário."
      />
      <RelatoriosTabs />
      <Outlet />
    </div>
  );
}