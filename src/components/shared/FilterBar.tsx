import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/**
 * Contêiner responsivo para filtros de listagem.
 * Cada filho é um controle (input/select). O slot `actions` fica à direita
 * (limpar, aplicar, exportar).
 */
export function FilterBar({ children, actions, className }: Props) {
  return (
    <div className={"mb-4 flex flex-wrap items-end gap-3 " + (className ?? "")}>
      <div className="grid flex-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {children}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Helper para padronizar campo de filtro: rótulo + controle.
 * Uso: <FilterBar.Field label="Unidade"><Select .../></FilterBar.Field>
 */
function FilterBarField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

FilterBar.Field = FilterBarField;

export default FilterBar;
