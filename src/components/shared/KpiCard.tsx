import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

type Props = {
  label: string;
  value: ReactNode;
  hint?: string;
  loading?: boolean;
  icon?: ReactNode;
};

/**
 * Cartão compacto de KPI: rótulo + valor + dica opcional.
 * Não faz nenhuma consulta — recebe valor pronto.
 */
export function KpiCard({ label, value, hint, loading, icon }: Props) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-semibold">
        {loading ? "—" : value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

export default KpiCard;