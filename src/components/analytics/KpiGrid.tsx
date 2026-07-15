import React from "react";
import { Card } from "@/components/ui/card";

export function KpiGrid({ items }: { items: Array<{ label: string; value: number | string; loading?: boolean; note?: string }> }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((it) => (
        <Card key={it.label} className="p-3">
          <div className="text-xs text-muted-foreground">{it.label}</div>
          <div className="mt-2 text-2xl font-semibold">{it.loading ? "—" : it.value}</div>
          {it.note && <div className="text-xs text-muted-foreground mt-1">{it.note}</div>}
        </Card>
      ))}
    </div>
  );
}
