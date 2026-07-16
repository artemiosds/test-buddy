import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Skeletons compartilhados para listagens, KPIs e páginas de detalhe.
 * Não introduzem novos tokens de cor — usam `bg-muted` via Skeleton do shadcn.
 */

type TableSkeletonProps = {
  rows?: number;
  columns?: number;
  className?: string;
};

export function TableSkeleton({ rows = 5, columns = 4, className }: TableSkeletonProps) {
  return (
    <tbody className={className}>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-t">
          {Array.from({ length: columns }).map((__, c) => (
            <td key={c} className="px-3 py-2 align-middle">
              <Skeleton className="h-4 w-full max-w-[180px]" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export function KpiCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("p-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <Skeleton className="mt-3 h-7 w-20" />
      <Skeleton className="mt-2 h-3 w-32" />
    </Card>
  );
}

export function KpiGridSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <KpiCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function DetailSkeleton({ blocks = 3 }: { blocks?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: blocks }).map((_, i) => (
        <Card key={i} className="p-4">
          <Skeleton className="h-5 w-40" />
          <div className="mt-3 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </Card>
      ))}
    </div>
  );
}