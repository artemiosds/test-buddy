import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute } from "@tanstack/react-router";
import { UserCheck, UserMinus, Umbrella, FileText, UserX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

import { useAnalytics } from "@/hooks/use-analytics";
import { useUnitScope } from "@/hooks/use-unit-scope";
import { EmptyState, KpiCard, PageHeader, StatusBadge } from "@/components/shared";
import { PermissionGate } from "@/components/permission-gate";

export const Route = createFileRoute("/_authenticated/gestao-pessoas/situacao-funcional")({ errorComponent: ErrorComponent,
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
  const { unidadePadraoId, isMaster } = useUnitScope();
  const a = useAnalytics({ unidadeId: unidadePadraoId });
  const { data: professionals, isLoading: isLoadingDirect } = useQuery({
    queryKey: ["profissionais-status-direct", unidadePadraoId, isMaster],
    queryFn: async () => {
      let q = supabase
        .from("profissionais")
        .select("status, unidade_id")
        .is("deleted_at", null);
      
      if (unidadePadraoId) {
        q = q.eq("unidade_id", unidadePadraoId);
      }
      
      const { data, error } = await q;
      if (error) throw error;
      return data as { status: string | null }[];
    },
  });

  const isLoading = a.statusBreakdown.isLoading || isLoadingDirect;
  
  // Agregação no frontend para garantir resiliência se a RPC falhar ou retornar zeros incorretamente
  const statusCounts = useMemo(() => {
    // Se a RPC trouxe dados, usamos como base, mas validamos se não está tudo zerado
    const rpcData = a.statusBreakdown.data as Record<string, number> | undefined;
    const hasRpcData = rpcData && Object.values(rpcData).some(v => v > 0);
    
    if (hasRpcData) return rpcData;

    // Fallback: agregamos manualmente os profissionais se a RPC falhar
    const counts: Record<string, number> = {
      ativo: 0,
      afastado: 0,
      ferias: 0,
      licenca: 0,
      desligado: 0,
      inativo: 0
    };

    if (!professionals) return counts;

    professionals.forEach((p) => {
      const s = p.status?.toLowerCase();
      if (!s) return;
      
      if (s === 'ativo') counts.ativo++;
      else if (['afastado', 'afastamento_inss', 'cedido'].includes(s)) counts.afastado++;
      else if (s === 'ferias') counts.ferias++;
      else if (s.startsWith('licenca_')) counts.licenca++;
      else if (['desligado', 'vacancia', 'falta_pad'].includes(s)) counts.desligado++;
      else if (s === 'inativo') counts.inativo++;
    });

    return counts;
  }, [a.statusBreakdown.data, professionals]);

  const total = Object.values(statusCounts).reduce((s: number, n: number) => s + n, 0);

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
            value={(statusCounts[s.key] ?? 0).toLocaleString("pt-BR")}
            loading={isLoading}
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

      {!isLoading && total === 0 && (
        <EmptyState
          className="mt-6"
          title="Sem profissionais cadastrados"
          description="Nenhum registro disponível para o escopo atual."
        />
      )}
    </div>
  );
}
