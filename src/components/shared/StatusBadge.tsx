import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { hasStatus, statusMeta, type StatusDomain } from "@/lib/status";

// Cache de avisos para não spammar o console durante DEV.
const warned = new Set<string>();

function warnUnknownStatus(domain: StatusDomain, value: unknown) {
  if (!import.meta.env.DEV) return;
  const key = `${domain}:${String(value)}`;
  if (warned.has(key)) return;
  warned.add(key);
  // Stack fornece o arquivo chamador na maior parte dos casos.
  const stack = new Error().stack?.split("\n").slice(2, 5).join("\n") ?? "";
  // eslint-disable-next-line no-console
  console.warn(
    `[StatusBadge] Status desconhecido no registry.\n` +
      `  domínio: ${domain}\n` +
      `  valor recebido: ${JSON.stringify(value)}\n` +
      `  Registre-o em src/lib/status.ts.\n` +
      (stack ? `  origem:\n${stack}` : ""),
  );
}

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
  if (value != null && !hasStatus(domain, value)) {
    warnUnknownStatus(domain, value);
  }
  return (
    <Badge
      variant={m.variant}
      className={cn(m.className, className)}
      title={title ?? m.description}
    >
      {m.label}
    </Badge>
  );
}

export default StatusBadge;