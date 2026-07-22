import { createFileRoute } from "@tanstack/react-router";
import { UserCheck, UserMinus, Umbrella, FileText, UserX } from "lucide-react";

import { useAnalytics } from "@/hooks/use-analytics";
import { EmptyState, KpiCard, PageHeader, StatusBadge } from "@/components/shared";
import { PermissionGate } from "@/components/permission-gate";

export const Route = createFileRoute("/_authenticated/gestao-pessoas/situacao-funcional")({
  head: () => ({
    meta: [
      { title: "Situação Funcional — Gestão da Saúde" },
      { name: "description", content: "Distribuição dos profissionais por situação funcional." },
    ],
  }),
  component: () => (
    <PermissionGate
      permission="profissional.visualizar"
      fallback={
        <div className="p-6 text-sm text-muted-foreground">
          Sem permissão para visualizar este painel.
        </div>
      }
    >
      <SituacaoFuncional />
    </PermissionGate>
  ),
});

const ORDER: {
  key: string;
  label: string;
  icon: React.ReactNode;
  tone?: "success" | "warning" | "danger";
}[] = [
  { key: "ativo", label: "Ativos", icon: <UserCheck className="h-4 w-4" />, tone: "success" },
  { key: "afastado", label: "Afastados", icon: <UserMinus className="h-4 w-4" />, tone: "warning" },
  { key: "ferias", label: "Férias", icon: <Umbrella className="h-4 w-4" /> },
  { key: "licenca", label: "Licenças", icon: <FileText className="h-4 w-4" /> },
  { key: "desligado", label: "Desligados", icon: <UserX className="h-4 w-4" />, tone: "danger" },
  { key: "inativo", label: "Inativos", icon: <UserMinus className="h-4 w-4" /> },
];

function SituacaoFuncional() {
  const a = useAnalytics({});
  const status = a.statusBreakdown.data ?? {};
  const total = Object.values(status).reduce((s, n) => s + n, 0);

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Situação Funcional"
        description="Distribuição dos profissionais por situação funcional atual."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {ORDER.map((s) => (
          <KpiCard
            key={s.key}
            label={s.label}
            value={(status[s.key] ?? 0).toLocaleString("pt-BR")}
            loading={a.statusBreakdown.isLoading}
            icon={s.icon}
            tone={s.tone}
            badge={<StatusBadge domain="profissional" value={s.key} />}
          />
        ))}
      </div>

      <div className="mt-6 rounded-md border p-4 text-sm text-muted-foreground">
        Total considerado:{" "}
        <span className="font-medium text-foreground">{total.toLocaleString("pt-BR")}</span>{" "}
        profissionais (não deletados).
      </div>

      {!a.statusBreakdown.isLoading && total === 0 && (
        <EmptyState
          className="mt-6"
          title="Sem profissionais cadastrados"
          description="Nenhum registro disponível para o escopo atual."
        />
      )}
    </div>
  );
}
