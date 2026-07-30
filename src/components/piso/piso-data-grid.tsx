/**
 * Grade avançada do módulo Piso Nacional da Enfermagem.
 *
 * Somente experiência de interface: ordenação, seleção de linhas,
 * redimensionamento e ocultação de colunas. Não consulta o banco, não altera
 * regras de negócio — recebe as linhas já prontas do consumidor.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableSkeleton } from "@/components/shared/Skeletons";
import { cn } from "@/lib/utils";

export type GridColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** valor usado na ordenação (string ou número). */
  sortValue?: (row: T) => string | number | null | undefined;
  width?: number;
  align?: "left" | "right";
  /** coluna oculta por padrão. */
  hiddenByDefault?: boolean;
};

type Props<T> = {
  columns: GridColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  toolbar?: ReactNode;
  /** Notifica as chaves das colunas visíveis (respeitando o menu "Colunas"). */
  onVisibleColumnsChange?: (keys: string[]) => void;
};

export function PisoDataGrid<T>({
  columns,
  rows,
  getRowKey,
  loading,
  onRowClick,
  selectable,
  selected = [],
  onSelectedChange,
  emptyTitle = "Nenhum registro",
  emptyDescription,
  toolbar,
  onVisibleColumnsChange,
}: Props<T>) {
  const [hidden, setHidden] = useState<string[]>(() =>
    columns.filter((c) => c.hiddenByDefault).map((c) => c.key),
  );
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const drag = useRef<{ key: string; startX: number; startW: number } | null>(null);

  const visibleCols = columns.filter((c) => !hidden.includes(c.key));
  const visibleKeysStr = visibleCols.map((c) => c.key).join("|");

  useEffect(() => {
    onVisibleColumnsChange?.(visibleKeysStr ? visibleKeysStr.split("|") : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKeysStr]);


  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
      return String(va).localeCompare(String(vb), "pt-BR") * factor;
    });
  }, [rows, sort, columns]);

  const allKeys = sortedRows.map(getRowKey);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.includes(k));

  function toggleAll() {
    if (!onSelectedChange) return;
    onSelectedChange(allSelected ? [] : allKeys);
  }
  function toggleOne(id: string) {
    if (!onSelectedChange) return;
    onSelectedChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id],
    );
  }

  function startResize(e: React.MouseEvent, key: string) {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.target as HTMLElement).closest("th");
    drag.current = { key, startX: e.clientX, startW: th?.offsetWidth ?? 140 };
    const move = (ev: MouseEvent) => {
      if (!drag.current) return;
      const next = Math.max(70, drag.current.startW + (ev.clientX - drag.current.startX));
      setWidths((w) => ({ ...w, [drag.current!.key]: next }));
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function toggleSort(key: string) {
    const col = columns.find((c) => c.key === key);
    if (!col?.sortValue) return;
    setSort((s) =>
      s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null,
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {selectable && selected.length > 0
            ? `${selected.length} linha(s) selecionada(s)`
            : `${rows.length} linha(s) nesta página`}
        </div>
        <div className="flex items-center gap-2">
          {toolbar}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="mr-2 h-4 w-4" /> Colunas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
              <DropdownMenuLabel>Exibir colunas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.key}
                  checked={!hidden.includes(c.key)}
                  onCheckedChange={(v) =>
                    setHidden((h) => (v ? h.filter((k) => k !== c.key) : [...h, c.key]))
                  }
                >
                  {c.header}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {!loading && rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm" style={{ tableLayout: "fixed", minWidth: "100%" }}>
            <colgroup>
              {selectable && <col style={{ width: 40 }} />}
              {visibleCols.map((c) => (
                <col key={c.key} style={{ width: widths[c.key] ?? c.width ?? 150 }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-muted/70 text-left backdrop-blur">
              <tr>
                {selectable && (
                  <th className="px-2 py-2">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Selecionar todos"
                    />
                  </th>
                )}
                {visibleCols.map((c) => (
                  <th
                    key={c.key}
                    className="group relative select-none px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cn(
                        "flex w-full items-center gap-1 truncate",
                        c.align === "right" && "justify-end",
                        c.sortValue ? "cursor-pointer hover:text-foreground" : "cursor-default",
                      )}
                    >
                      <span className="truncate">{c.header}</span>
                      {c.sortValue &&
                        (sort?.key !== c.key ? (
                          <ChevronsUpDown className="h-3 w-3 opacity-0 group-hover:opacity-60" />
                        ) : sort.dir === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        ))}
                    </button>
                    <span
                      role="separator"
                      onMouseDown={(e) => startResize(e, c.key)}
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-primary/40"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            {loading ? (
              <TableSkeleton rows={8} columns={visibleCols.length + (selectable ? 1 : 0)} />
            ) : (
              <tbody>
                {sortedRows.map((row) => {
                  const id = getRowKey(row);
                  return (
                    <tr
                      key={id}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={cn(
                        "border-t transition",
                        onRowClick && "cursor-pointer hover:bg-accent/50",
                        selected.includes(id) && "bg-accent/40",
                      )}
                    >
                      {selectable && (
                        <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.includes(id)}
                            onCheckedChange={() => toggleOne(id)}
                            aria-label="Selecionar linha"
                          />
                        </td>
                      )}
                      {visibleCols.map((c) => (
                        <td
                          key={c.key}
                          className={cn(
                            "truncate px-3 py-2 align-middle",
                            c.align === "right" && "text-right tabular-nums",
                          )}
                        >
                          {c.cell(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

export default PisoDataGrid;
