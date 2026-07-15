import React from "react";
import { Button } from "@/components/ui/button";
import { useContext } from "react";
import { AnalyticsFilterContext } from "@/context/analytics-filter-context";
import { RefreshCw, Download } from "lucide-react";

export function AnalyticsHeader({ lastUpdated, onRefresh, onExport }: { lastUpdated?: number; onRefresh?: () => void; onExport?: () => void }) {
  const ctx = useContext(AnalyticsFilterContext);
  return (
    <header className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <a href="/gestao-rh" className="hover:underline">Gestão de Pessoas</a>
            <span className="mx-2">/</span>
            <span className="text-foreground">Dashboard Executivo RH</span>
          </nav>
        </div>
        <p className="text-sm text-muted-foreground">Última atualização: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "—"}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={onRefresh} title="Atualizar">
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
        <Button variant="outline" onClick={onExport} title="Exportar">
          <Download className="mr-2 h-4 w-4" /> Exportar
        </Button>
      </div>
    </header>
  );
}
