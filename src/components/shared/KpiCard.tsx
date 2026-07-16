import type { ReactNode } from "react";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export type KpiTone = "default" | "success" | "danger" | "warning";
export type KpiTrendDirection = "up" | "down" | "flat";

type Props = {
  label: string;
  value: ReactNode;
  /** Texto curto abaixo do valor (dica/contexto). Sinônimo de `description`. */
  hint?: string;
  /** Alias de `hint`, mais explícito. */
  description?: string;
  loading?: boolean;
  icon?: ReactNode;
  /** Tooltip nativo aplicado ao card (title HTML). */
  tooltip?: string;
  /** Indicador de tendência opcional. */
  trend?: { direction: KpiTrendDirection; label?: string };
  /** Slot livre para Badge/StatusBadge no canto superior direito. */
  badge?: ReactNode;
  /** Semântica de cor do valor. */
  tone?: KpiTone;
  className?: string;
};

const TONE_VALUE: Record<KpiTone, string> = {
  default: "",
  success: "text-emerald-600",
  danger: "text-destructive",
  warning: "text-amber-600",
};

const TREND_ICON: Record<KpiTrendDirection, typeof ArrowUp> = {
  up: ArrowUp,
  down: ArrowDown,
  flat: ArrowRight,
};

const TREND_TONE: Record<KpiTrendDirection, string> = {
  up: "text-emerald-600",
  down: "text-destructive",
  flat: "text-muted-foreground",
};

/**
 * Cartão compacto de KPI: rótulo + valor + dica/descrição/badge/trend/tooltip.
 * Não faz nenhuma consulta — recebe valor pronto. É o único componente de KPI
 * do projeto: não crie variantes locais.
 */
export function KpiCard({
  label,
  value,
  hint,
  description,
  loading,
  icon,
  tooltip,
  trend,
  badge,
  tone = "default",
  className,
}: Props) {
  const foot = description ?? hint;
  const TrendIcon = trend ? TREND_ICON[trend.direction] : null;
  return (
    <Card className={cn("p-3", className)} title={tooltip}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          {badge}
          {icon}
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-20" />
      ) : (
        <div className={cn("mt-2 text-2xl font-semibold", TONE_VALUE[tone])}>
          {value}
        </div>
      )}
      {(foot || trend) && (
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {trend && TrendIcon && (
            <span className={cn("inline-flex items-center gap-1", TREND_TONE[trend.direction])}>
              <TrendIcon className="h-3 w-3" />
              {trend.label}
            </span>
          )}
          {foot && <span>{foot}</span>}
        </div>
      )}
    </Card>
  );
}

export default KpiCard;