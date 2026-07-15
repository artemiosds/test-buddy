import React from "react";
import { Card } from "@/components/ui/card";

export function AnalyticsCharts({ prepared }: { prepared?: { charts?: any } }) {
  if (prepared?.charts?.prepared) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Card className="p-3">Profissionais por Unidade — Preparado para implementação (requere view/RPC)</Card>
        <Card className="p-3">Profissionais por Setor — Preparado para implementação (requere view/RPC)</Card>
        <Card className="p-3">Profissionais por Vínculo — Preparado para implementação (requere view/RPC)</Card>
      </div>
    );
  }

  return <div />;
}
