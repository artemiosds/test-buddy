import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState";

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

type Props<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
};

/**
 * Tabela simples e reutilizável. Não faz paginação nem sort — dono decide.
 * Estilização segue o design system (border/muted/accent).
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading,
  emptyTitle = "Nenhum registro",
  emptyDescription,
  onRowClick,
}: Props<T>) {
  if (!loading && rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={"px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground " + (c.headerClassName ?? "")}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-muted-foreground">
                Carregando…
              </td>
            </tr>
          )}
          {!loading &&
            rows.map((row, i) => (
              <tr
                key={getRowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={
                  "border-t transition " +
                  (onRowClick ? "cursor-pointer hover:bg-accent/50" : "")
                }
              >
                {columns.map((c) => (
                  <td key={c.key} className={"px-3 py-2 align-middle " + (c.className ?? "")}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;