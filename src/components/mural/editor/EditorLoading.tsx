import { Skeleton } from "@/components/ui/skeleton";

export function EditorLoading() {
  return (
    <div className="space-y-2">
      <div className="flex gap-1 mb-2">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>
      <Skeleton className="h-[200px] w-full rounded-md" />
      <div className="flex justify-center mt-2">
        <span className="text-[10px] text-muted-foreground animate-pulse">Carregando editor...</span>
      </div>
    </div>
  );
}
