import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusMeta, type StatusDomain } from "@/lib/status";

type Props = {
  domain: StatusDomain;
  value: string | null | undefined;
  className?: string;
  title?: string;
};

/**
 * Badge de status padronizado. Consome sempre `src/lib/status.ts`.
 * Não aceita label/variant customizados de fora: para acrescentar novos
 * estados, adicione no registry central.
 */
export function StatusBadge({ domain, value, className, title }: Props) {
  const m = statusMeta(domain, value);
  return (
    <Badge variant={m.variant} className={cn(m.className, className)} title={title}>
      {m.label}
    </Badge>
  );
}

export default StatusBadge;