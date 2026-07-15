import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/relatorios", label: "Frequências" },
  { to: "/relatorios-executivo", label: "Executivo" },
  { to: "/relatorios-consolidado", label: "Consolidado" },
  { to: "/relatorios-status", label: "Status por Unidade" },
  { to: "/relatorios-profissional", label: "Por Profissional" },
] as const;

export function RelatoriosTabs() {
  const { pathname } = useLocation();
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
      {TABS.map((t) => {
        const active = pathname === t.to;
        return (
          <Link
            key={t.to}
            to={t.to}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
