import type { ReactNode } from "react";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export type KpiTone = "default" | "success" | "danger" | "warning";
export type KpiTrendDirection = "up" | "down" | "flat";

/** Paleta suave usada no círculo do ícone. */
export type KpiIconTone =
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "primary"
  | "purple"
  | "neutral";

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
  /** Cor do círculo que envolve o ícone. Default: "primary". */
  iconTone?: KpiIconTone;
  className?: string;
};

const TONE_VALUE: Record<KpiTone, string> = {
  default: "",
  success: "text-success",
  danger: "text-destructive",
  warning: "text-warning-soft-foreground",
};

const TREND_ICON: Record<KpiTrendDirection, typeof ArrowUp> = {
  up: ArrowUp,
  down: ArrowDown,
  flat: ArrowRight,
};

const TREND_TONE: Record<KpiTrendDirection, string> = {
  up: "text-success",
  down: "text-destructive",
  flat: "text-muted-foreground",
};

const ICON_TONE_CLASS: Record<KpiIconTone, string> = {
  info:    "bg-info-soft text-info-soft-foreground",
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  danger:  "bg-danger-soft text-danger-soft-foreground",
  primary: "bg-accent text-accent-foreground",
  purple:  "bg-[color-mix(in_oklab,var(--color-info)_18%,transparent)] text-[color-mix(in_oklab,var(--color-info)_65%,black)]",
  neutral: "bg-muted text-muted-foreground",
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
  iconTone = "primary",
  className,
}: Props) {
  const foot = description ?? hint;
  const TrendIcon = trend ? TREND_ICON[trend.direction] : null;
  return (
    <Card className={cn("hover-lift p-4", className)} title={tooltip}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="kpi-title text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          {loading ? (
            <Skeleton className="mt-3 h-9 w-24" />
          ) : (
            <div
              className={cn(
                "kpi-number mt-2 text-3xl font-bold leading-none tracking-tight tabular-nums",
                TONE_VALUE[tone],
              )}
            >
              {value}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge}
          {icon && (
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-full [&>svg]:h-5 [&>svg]:w-5",
                ICON_TONE_CLASS[iconTone],
              )}
            >
              {icon}
            </span>
          )}
        </div>
      </div>
      {(foot || trend) && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          {trend && TrendIcon && (
            <span className={cn("inline-flex items-center gap-1", TREND_TONE[trend.direction])}>
              <TrendIcon className="h-3 w-3" />
              {trend.label}
            </span>
          )}
          {foot && <span className="kpi-caption">{foot}</span>}
        </div>
      )}
    </Card>
  );
}

export default KpiCard;