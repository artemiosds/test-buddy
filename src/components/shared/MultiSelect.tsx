import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type MultiSelectOption = {
  value: string;
  label: string;
  hint?: string | null;
};

type Props = {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Filtro de múltipla escolha com busca, marcação por checkbox, contador,
 * "selecionar todos (filtrados)" e limpar. Valor sempre um array de ids —
 * array vazio significa "todos" (sem filtro aplicado).
 */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Todos",
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhuma opção",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(t) || (o.hint ?? "").toLowerCase().includes(t),
    );
  }, [options, term]);

  const selected = useMemo(() => new Set(value), [value]);

  const label =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? (options.find((o) => o.value === value[0])?.label ?? "1 selecionado")
        : `${value.length} selecionados`;

  const toggle = (v: string) => {
    onChange(selected.has(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selected.has(o.value));

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setTerm("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>
            {label}
          </span>
          <span className="ml-2 flex shrink-0 items-center gap-1">
            {value.length > 0 && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Limpar seleção"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] min-w-64 p-2">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={searchPlaceholder}
          className="mb-2 h-8"
        />
        <div className="mb-1 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
          <button
            type="button"
            className="hover:text-foreground"
            onClick={() => {
              if (allFilteredSelected) {
                const rm = new Set(filtered.map((o) => o.value));
                onChange(value.filter((v) => !rm.has(v)));
              } else {
                const merged = new Set(value);
                filtered.forEach((o) => merged.add(o.value));
                onChange(Array.from(merged));
              }
            }}
          >
            {allFilteredSelected ? "Desmarcar exibidos" : "Selecionar exibidos"}
          </button>
          <button
            type="button"
            className="hover:text-foreground disabled:opacity-40"
            disabled={value.length === 0}
            onClick={() => onChange([])}
          >
            Limpar
          </button>
        </div>
        <ScrollArea className="max-h-64">
          <div className="space-y-0.5 pr-2">
            {filtered.length === 0 && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">{emptyText}</div>
            )}
            {filtered.map((o) => {
              const checked = selected.has(o.value);
              return (
                <label
                  key={o.value}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(o.value)} />
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {checked && <Check className="h-3.5 w-3.5 text-primary" />}
                </label>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export default MultiSelect;
