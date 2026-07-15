import React from "react";
import { Outlet } from "@tanstack/react-router";
import { AnalyticsFilterProvider } from "@/context/analytics-filter-context";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { AnalyticsFilters } from "@/components/analytics/AnalyticsFilters";
import { KpiGrid } from "@/components/analytics/KpiGrid";
import { AnalyticsCharts } from "@/components/analytics/AnalyticsCharts";
import { RankingTable } from "@/components/analytics/RankingTable";
import { useContext } from "react";
import { AnalyticsFilterContext } from "@/context/analytics-filter-context";

export default function GestaoRhPage() {
  return (
    <AnalyticsFilterProvider>
      <GestaoRhContent />
    </AnalyticsFilterProvider>
  );
}

function GestaoRhContent() {
  const ctx = useContext(AnalyticsFilterContext);
  const filters = {
    competenciaId: ctx.competenciaId,
    secretariaId: ctx.secretariaId,
    unidadeId: ctx.unidadeId,
    setorId: ctx.setorId,
    cargoId: ctx.cargoId,
    funcaoId: ctx.funcaoId,
    vinculoId: ctx.vinculoId,
    status: ctx.status,
  };

  const analytics = useAnalytics(filters);

  const items = [
    { label: "Profissionais", value: analytics.totalProfessionals.data ?? "—", loading: analytics.totalProfessionals.isLoading },
    { label: "Unidades", value: analytics.totalUnidades.data ?? "—", loading: analytics.totalUnidades.isLoading },
    { label: "Setores", value: analytics.totalSetores.data ?? "—", loading: analytics.totalSetores.isLoading },
    { label: "Cargos", value: analytics.totalCargos.data ?? "—", loading: analytics.totalCargos.isLoading },
    { label: "Funções", value: analytics.totalFuncoes.data ?? "—", loading: analytics.totalFuncoes.isLoading },
    { label: "Competência Atual", value: analytics.competenciaAtiva ? `${analytics.competenciaAtiva.label}` : "—" },
  ];

  return (
    <div className="p-6">
      <AnalyticsHeader lastUpdated={analytics.lastUpdated} onRefresh={() => void analytics.refetch()} onExport={() => { /* export placeholder */ }} />
      <AnalyticsFilters />
      <KpiGrid items={items} />

      <section className="mt-6">
        <h2 className="text-lg font-semibold mb-2">Indicadores Operacionais</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="p-3 border rounded-md">Frequências Enviadas — Preparado</div>
          <div className="p-3 border rounded-md">Frequências Pendentes — Preparado</div>
          <div className="p-3 border rounded-md">Frequências Aprovadas — Preparado</div>
          <div className="p-3 border rounded-md">Horas Extras — Preparado</div>
          <div className="p-3 border rounded-md">Pendências — {analytics.pendencias.data ?? "—"}</div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold mb-2">Gráficos</h2>
        <AnalyticsCharts prepared={analytics.prepared} />
      </section>

      <section className="mt-6">
        <RankingTable prepared={analytics.prepared} />
      </section>

      <Outlet />
    </div>
  );
}
