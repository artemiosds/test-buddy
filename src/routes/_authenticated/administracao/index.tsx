import { createFileRoute, Link } from "@tanstack/react-router";
import {
  UserCog,
  Settings2,
  KeyRound,
  CalendarDays,
  Tag,
  Megaphone,
  ShieldCheck,
  Activity,
  Mail,
  Globe,
  Landmark,
  ChevronRight,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { useCurrentUser, usePermissions } from "@/hooks/use-permissions";

export const Route = createFileRoute("/_authenticated/administracao/")({
  head: () => ({
    meta: [
      { title: "Central de Governança — SMS Oriximiná" },
      { name: "description", content: "Acessos, parâmetros, auditoria e infraestrutura da Secretaria Municipal de Saúde." },
      { property: "og:title", content: "Central de Governança — SMS Oriximiná" },
      { property: "og:description", content: "Hub administrativo da Gestão da Saúde de Oriximiná." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CentralGovernanca,
});

type Item = {
  to: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  perm?: string | string[];
  masterOnly?: boolean;
};
type Bloco = { titulo: string; subtitulo: string; icon: LucideIcon; itens: Item[] };

const BLOCOS: Bloco[] = [
  {
    titulo: "Acessos & Identidade",
    subtitulo: "Quem entra no sistema e o que pode fazer",
    icon: UserCog,
    itens: [
      { to: "/usuarios", label: "Usuários e Permissões", desc: "Operadores, unidades vinculadas e acessos", icon: UserCog, perm: "usuario.visualizar" },
      { to: "/configuracao/perfis", label: "Perfis & Matriz de Permissões", desc: "O que cada perfil pode fazer", icon: Settings2, masterOnly: true },
      { to: "/seguranca", label: "Segurança da Conta (2FA)", desc: "Verificação em duas etapas", icon: KeyRound },
    ],
  },
  {
    titulo: "Parâmetros & Institucional",
    subtitulo: "Regras do município e comunicação",
    icon: Landmark,
    itens: [
      { to: "/configuracao", label: "Configuração Municipal", desc: "Folha financeira, brasão, assinaturas, e-mail", icon: Settings2, perm: "configuracao.editar" },
      { to: "/feriados", label: "Calendário & Feriados", desc: "Feriados e pontos facultativos", icon: CalendarDays, perm: "configuracao.editar" },
      { to: "/tipos-unidade", label: "Tipos de Unidade", desc: "Classificação dos estabelecimentos", icon: Tag, perm: "configuracao.editar" },
      { to: "/administracao/mural", label: "Mural de Avisos", desc: "Comunicados aos operadores", icon: Megaphone },
    ],
  },
  {
    titulo: "Conformidade & Auditoria",
    subtitulo: "Rastreabilidade e LGPD",
    icon: ShieldCheck,
    itens: [
      { to: "/auditoria", label: "Trilha de Auditoria", desc: "Histórico de operações e alterações", icon: ShieldCheck, perm: "auditoria.visualizar" },
      { to: "/relatorio-notificacoes", label: "Logs de Notificações", desc: "Entregas de e-mails e alertas", icon: Mail, masterOnly: true },
    ],
  },
  {
    titulo: "Infraestrutura & TI",
    subtitulo: "Diagnóstico e integrações",
    icon: Activity,
    itens: [
      { to: "/saude", label: "Saúde do Sistema", desc: "Diagnóstico dos serviços", icon: Activity, masterOnly: true },
      { to: "/administracao/sistemas-externos", label: "Sistemas Externos", desc: "Conexões com outros sistemas", icon: Globe, perm: ["configuracao.editar", "usuario.gerenciar"] },
    ],
  },
];

function CentralGovernanca() {
  const { data: userCtx } = useCurrentUser();
  const { has, hasAny } = usePermissions();
  const isMaster = !!userCtx?.is_master;

  const pode = (it: Item) => {
    if (it.masterOnly) return isMaster;
    if (!it.perm || isMaster) return true;
    return Array.isArray(it.perm) ? hasAny(it.perm) : has(it.perm);
  };

  const blocos = BLOCOS.map((b) => ({ ...b, itens: b.itens.filter(pode) })).filter((b) => b.itens.length);
  const total = blocos.reduce((s, b) => s + b.itens.length, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="relative overflow-hidden rounded-2xl border bg-card p-6">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Landmark className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">SMS Oriximiná</p>
              <h1 className="text-2xl font-semibold tracking-tight">Central de Governança</h1>
              <p className="text-sm text-muted-foreground">Acessos, parâmetros, auditoria e infraestrutura em um só lugar.</p>
            </div>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="rounded-full border bg-background px-3 py-1">{blocos.length} áreas</span>
            <span className="rounded-full border bg-background px-3 py-1">{total} ferramentas</span>
            {isMaster && (
              <span className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-primary">
                <Lock className="h-3 w-3" /> Acesso Master
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {blocos.map((b) => {
          const BIcon = b.icon;
          return (
            <section key={b.titulo} className="rounded-2xl border bg-card p-5 transition hover:border-primary/40">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary">
                  <BIcon className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold">{b.titulo}</h2>
                  <p className="text-xs text-muted-foreground">{b.subtitulo}</p>
                </div>
              </div>
              <ul className="space-y-1">
                {b.itens.map((it) => {
                  const I = it.icon;
                  return (
                    <li key={it.to}>
                      <Link
                        to={it.to}
                        className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-accent"
                      >
                        <I className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            {it.label}
                            {it.masterOnly && (
                              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">Master</span>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{it.desc}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
