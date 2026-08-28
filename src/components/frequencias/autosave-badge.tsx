import { AlertCircle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AutosaveStatus } from "@/hooks/use-autosave-folha";

type Props = {
  status: AutosaveStatus;
  onRetry?: () => void;
  className?: string;
};

/** Indicador discreto de sincronização automática da grade. */
export function AutosaveBadge({ status, onRetry, className }: Props) {
  if (status === "idle") return null;

  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors";

  if (status === "saving") {
    return (
      <span
        className={cn(base, "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400", className)}
        aria-live="polite"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando alterações...
      </span>
    );
  }

  if (status === "saved") {
    return (
      <span
        className={cn(base, "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", className)}
        aria-live="polite"
      >
        <Check className="h-3.5 w-3.5" /> Todas as alterações salvas
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onRetry}
      title="Clique para tentar salvar novamente"
      className={cn(base, "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20", className)}
      aria-live="assertive"
    >
      <AlertCircle className="h-3.5 w-3.5" /> Erro ao salvar alterações — tentar novamente
    </button>
  );
}
