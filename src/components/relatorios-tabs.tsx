import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const OPERACIONAIS = [
  { to: "/relatorios", label: "Frequências" },
  { to: "/relatorios-executivo", label: "Executivo" },
  { to: "/relatorios-consolidado", label: "Consolidado" },
  { to: "/relatorios-status", label: "Status por Unidade" },
  { to: "/relatorios-profissional", label: "Por Profissional" },
  { to: "/relatorios-piso", label: "Piso Enfermagem" },
] as const;

const GERENCIAIS = [
  { to: "/relatorios-gerenciais/profissionais", label: "Profissionais" },
  { to: "/relatorios-gerenciais/unidades", label: "Unidades" },
  { to: "/relatorios-gerenciais/setores", label: "Setores" },
  { to: "/relatorios-gerenciais/cargos", label: "Cargos" },
  { to: "/relatorios-gerenciais/funcoes", label: "Funções" },
  { to: "/relatorios-gerenciais/estrutura", label: "Estrutura" },
  { to: "/relatorios-gerenciais/indicadores", label: "Indicadores" },
  { to: "/relatorios-gerenciais/piso", label: "Piso (gerencial)" },
  { to: "/relatorios-gerenciais/auditoria", label: "Auditoria" },
  { to: "/relatorio-inteligente", label: "⭐ Relatório Geral Inteligente" },
] as const;

function Row({
  tabs,
  activeGroup,
  currentPath,
}: {
  tabs: ReadonlyArray<{ to: string; label: string }>;
  activeGroup: boolean;
  currentPath: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-1 rounded-lg border bg-card p-1",
        activeGroup ? "ring-1 ring-primary/40" : "opacity-90",
      )}
    >
      {tabs.map((t) => {
        const active = currentPath === t.to || currentPath.startsWith(t.to + "/");
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

export function RelatoriosTabs() {
  const { pathname } = useLocation();
  const isGerencial =
    pathname.startsWith("/relatorios-gerenciais") || pathname.startsWith("/relatorio-inteligente");
  return (
    <div className="space-y-2">
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Operacionais{" "}
          <span className="font-normal normal-case text-muted-foreground/70">
            (por competência)
          </span>
        </div>
        <Row tabs={OPERACIONAIS} activeGroup={!isGerencial} currentPath={pathname} />
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Gerenciais{" "}
          <span className="font-normal normal-case text-muted-foreground/70">
            (cadastros atuais)
          </span>
        </div>
        <Row tabs={GERENCIAIS} activeGroup={isGerencial} currentPath={pathname} />
      </div>
    </div>
  );
}
