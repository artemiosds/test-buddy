import { Link } from "@tanstack/react-router";
import { Activity, Building2, LayoutDashboard, Network, UserCheck } from "lucide-react";

const ATALHOS = [
  { to: "/gestao-pessoas", label: "Dashboard Executivo", icon: LayoutDashboard },
  { to: "/sala-situacao", label: "Sala de Situação", icon: Activity },
  { to: "/gestao-pessoas/situacao-funcional", label: "Situação Funcional", icon: UserCheck },
  { to: "/controle-forca-trabalho", label: "Força de Trabalho", icon: Activity },
  { to: "/gestao-pessoas/lotacao", label: "Lotação das Unidades", icon: Building2 },
  { to: "/gestao-pessoas/distribuicao-setor", label: "Distribuição por Setor", icon: Network },
] as const;

/** Atalhos para as visões analíticas retiradas do menu lateral. */
export function AtalhosGestaoSaude() {
  return (
    <div className="mb-4 flex flex-wrap gap-1 rounded-lg border bg-card p-1">
      {ATALHOS.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" }}
          activeOptions={{ exact: true }}
        >
          <a.icon className="h-4 w-4" />
          {a.label}
        </Link>
      ))}
    </div>
  );
}
