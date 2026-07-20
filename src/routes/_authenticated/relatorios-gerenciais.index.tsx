import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, Building2, Network, Briefcase, Tag, Sitemap as SitemapIcon, BarChart3, Coins, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/relatorios-gerenciais/")({
  component: HubGerenciais,
});

type Card = { to: string; title: string; desc: string; icon: LucideIcon };

const CARDS: Card[] = [
  { to: "/relatorios-gerenciais/profissionais", title: "Profissionais", desc: "Cadastro geral, por unidade/setor/cargo/função/vínculo, status e pendências cadastrais.", icon: Users },
  { to: "/relatorios-gerenciais/unidades", title: "Unidades", desc: "Relação, por tipo, ativas/inativas, sem diretor/coordenador/telefone/CNES/CNPJ/email, lotação.", icon: Building2 },
  { to: "/relatorios-gerenciais/setores", title: "Setores", desc: "Relação, por unidade, sem coordenador, sem profissionais, com apenas 1 servidor, distribuição.", icon: Network },
  { to: "/relatorios-gerenciais/cargos", title: "Cargos", desc: "Relação, quantidade por cargo, cargos sem profissionais, mais utilizados.", icon: Briefcase },
  { to: "/relatorios-gerenciais/funcoes", title: "Funções", desc: "Relação, quantidade por função, funções sem profissionais.", icon: Tag },
  { to: "/relatorios-gerenciais/estrutura", title: "Estrutura Organizacional", desc: "Organograma Diretor → Coordenador → Profissionais. Responsáveis por unidade e setor.", icon: SitemapIcon as unknown as LucideIcon },
  { to: "/relatorios-gerenciais/indicadores", title: "Indicadores", desc: "Resumo executivo e distribuições (vínculo, sexo, idade, unidade, cargo, função, setor).", icon: BarChart3 },
  { to: "/relatorios-gerenciais/piso", title: "Piso da Enfermagem", desc: "Piso Efetivos/Contratados, comparativo entre meses, divergências, histórico e resumo financeiro.", icon: Coins },
  { to: "/relatorios-gerenciais/auditoria", title: "Auditoria", desc: "Quem alterou cadastro, unidade, setor, cargo, função, usuário, importou/recalculou piso, excluiu.", icon: ShieldCheck },
];

function HubGerenciais() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {CARDS.map((c) => (
        <Link
          key={c.to}
          to={c.to}
          className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/60 hover:bg-muted/50"
        >
          <div className="mb-2 flex items-center gap-2">
            <c.icon className="h-5 w-5 text-primary" />
            <div className="font-semibold text-foreground">{c.title}</div>
          </div>
          <p className="text-sm text-muted-foreground">{c.desc}</p>
          <div className="mt-3 text-xs font-medium text-primary opacity-80 group-hover:opacity-100">Abrir →</div>
        </Link>
      ))}
    </div>
  );
}