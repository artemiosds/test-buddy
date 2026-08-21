import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RelatoriosTabs } from "@/components/relatorios-tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { useCurrentUser } from "@/hooks/use-permissions";

export const Route = createFileRoute("/_authenticated/relatorios-gerenciais")({ errorComponent: ErrorComponent,
  component: RelatoriosGerenciaisLayout,
});

function RelatoriosGerenciaisLayout() {
  const { data: user } = useCurrentUser();
  const isMaster = !!user?.is_master;

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title={isMaster ? "Relatórios Gerenciais da Secretaria" : "Relatórios Gerenciais da Unidade"}
        description={
          isMaster
            ? "Consultas sobre cadastros atuais da secretaria — não dependem de competência."
            : "Consultas sobre cadastros atuais da unidade — não dependem de competência."
        }
      />
      <RelatoriosTabs />
      <Outlet />
    </div>
  );
}
