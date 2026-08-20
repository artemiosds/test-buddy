import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUnidadesLookup } from "@/hooks/use-lookups";
import { useUnitScope } from "@/hooks/use-unit-scope";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface UnidadeFilterProps {
  value: string | string[];
  onChange: (value: any) => void;
  multi?: boolean;
  className?: string;
  placeholder?: string;
}

export function UnidadeFilter({
  value,
  onChange,
  multi = false,
  className,
  placeholder = "Selecione a Unidade"
}: UnidadeFilterProps) {
  const { isGlobal, unidadesList, locked, unidadePadraoId, selectedUnitId, setSelectedUnitId, isLoading } = useUnitScope();

  const unidades = unidadesList || [];

  // Sincroniza o valor local com a unidade ativa global (auto-seleção forçada)
  useEffect(() => {
    const activeValue = Array.isArray(value) ? value[0] : value;
    const target = selectedUnitId || unidadePadraoId;
    if (!activeValue && target) {
      onChange(target);
    }
  }, [value, selectedUnitId, unidadePadraoId, onChange]);

  const handleChange = (v: string) => {
    if (v !== "all" && v !== "none") setSelectedUnitId(v);
    onChange(v);
  };

  const displayValue = Array.isArray(value) ? (value[0] || "") : value;

  if (isLoading) {
    return <Skeleton className={cn("h-10 w-full", className)} />;
  }

  if (locked) {
    const unit = unidades.find(u => u.id === unidadePadraoId);
    return (
      <div className={cn("flex h-10 w-full items-center justify-between rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground", className)}>
        <span>{unit?.nome || (unidades.length > 0 ? "Unidade vinculada" : "")}</span>
        <Lock className="h-4 w-4 opacity-50" />
      </div>
    );
  }

  return (
    <Select value={displayValue || selectedUnitId || undefined} onValueChange={handleChange} disabled={isLoading}>
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {isGlobal && <SelectItem value="all">Todas as Unidades</SelectItem>}
        {unidades.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            {u.nome} {u.sigla ? `(${u.sigla})` : ""}
          </SelectItem>
        ))}
        {!isLoading && unidades.length === 0 && !isGlobal && (
          <SelectItem value="none" disabled>Nenhuma unidade vinculada</SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
