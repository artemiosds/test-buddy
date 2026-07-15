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
    <div className={"mb-4 flex flex-wrap items-end gap-2 " + (className ?? "")}>
      <div className="grid flex-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {children}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export default FilterBar;