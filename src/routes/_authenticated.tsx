import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, CalendarRange, ClipboardList, Users, Building2, ShieldCheck, LogOut, UserCog, AlertCircle, CheckCircle2, Signature, FileBarChart, Bell, Settings2, Tag, CalendarDays, Megaphone, Menu, PanelLeftOpen, PanelLeftClose, Search, ChevronDown, ChevronRight, Activity, BarChart3, Briefcase, Network, Wrench, KeyRound } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, usePermissions } from "@/hooks/use-permissions";
import { useCompetenciaAtiva } from "@/hooks/use-competencia-ativa";
import { useMunicipioParametros } from "@/hooks/use-municipio-parametros";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Skip on server: this route is ssr:false, and the Supabase client
    // requires envs that may not exist in prerender/SSR environments.
    // The auth check re-runs on the client after hydration.
    if (typeof window === "undefined") {
      return { user: null as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] };
    }
    try {
      await supabase.auth.getSession();
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw redirect({ to: "/auth" });
      return { user: data.user };
    } catch {
      throw redirect({ to: "/auth" });
    }
  },
  component: AuthenticatedLayout,
});

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  perm?: string | string[];
};

type NavGroup = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  items: NavItem[];
};

const GROUPS: NavGroup[] = [
  {
    id: "operacao",
    label: "Operação",
    icon: Activity,
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/analitico", label: "Dashboard Analítico", icon: BarChart3, perm: ["relatorio.visualizar", "relatorio.exportar"] },
      { to: "/competencias", label: "Competências", icon: CalendarRange, perm: "competencia.visualizar" },
      { to: "/frequencias", label: "Frequências (mensal)", icon: ClipboardList, perm: "frequencia.visualizar" },
      { to: "/frequencia/contratados", label: "Folha — Contratados", icon: ClipboardList, perm: "frequencia.visualizar" },
      { to: "/frequencia/efetivos", label: "Folha — Efetivos", icon: ClipboardList, perm: "frequencia.visualizar" },
      { to: "/pendencias", label: "Pendências", icon: AlertCircle, perm: "pendencia.gerenciar" },
      { to: "/aprovacoes", label: "Aprovações", icon: CheckCircle2, perm: "frequencia.aprovar" },
      { to: "/assinaturas", label: "Assinaturas", icon: Signature, perm: ["assinatura.gerenciar", "assinatura.aplicar"] },
      { to: "/notificacoes", label: "Notificações", icon: Bell },
    ],
  },
  {
    id: "gestao_pessoas",
    label: "Gestão de Pessoas",
    icon: Users,
    items: [
      // Dashboard RH - placeholder route (non-destructive)
      { to: "/gestao-rh", label: "Dashboard RH", icon: LayoutDashboard },
      // Reuse existing routes where present (do not duplicate)
      { to: "/profissionais", label: "Profissionais", icon: Users, perm: "profissional.visualizar" },
      { to: "/gestao-profissionais", label: "Centro de Gestão de Profissionais", icon: Users, perm: "profissional.visualizar" },
      { to: "/unidades", label: "Unidades", icon: Building2, perm: "unidade.visualizar" },
      { to: "/setores", label: "Setores", icon: Network, perm: "unidade.editar" },
      { to: "/cargos-funcoes", label: "Cargos e Funções", icon: Briefcase, perm: "configuracao.editar" },
      { to: "/controle-forca-trabalho", label: "Centro de Controle da Força de Trabalho", icon: Activity },
      { to: "/sala-situacao", label: "Sala de Situação", icon: LayoutDashboard },
    ],
  },
  {
    id: "relatorios",
    label: "Relatórios",
    icon: FileBarChart,
    items: [
      { to: "/relatorios", label: "Visão geral", icon: FileBarChart, perm: ["relatorio.visualizar", "relatorio.exportar"] },
    ],
  },
  {
    id: "cadastros",
    label: "Cadastros",
    icon: Tag,
    items: [
      // Profissionais/Unidades/Setores/Cargos e Funções were moved to the new 'Gestão de Pessoas' group above.
      { to: "/tipos-unidade", label: "Tipos de Unidade", icon: Tag, perm: "configuracao.editar" },
      { to: "/feriados", label: "Feriados", icon: CalendarDays, perm: "configuracao.editar" },
    ],
  },
  {
    id: "administracao",
    label: "Administração",
    icon: Wrench,
    items: [
      { to: "/usuarios", label: "Usuários e Permissões", icon: UserCog, perm: "usuario.visualizar" },
      { to: "/auditoria", label: "Auditoria", icon: ShieldCheck, perm: "auditoria.visualizar" },
      { to: "/configuracao", label: "Configuração Municipal", icon: Settings2, perm: "configuracao.editar" },
      { to: "/seguranca", label: "Segurança (MFA)", icon: KeyRound },
    ],
  },
];


function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: userCtx } = useCurrentUser();
  const { has, isLoading: permLoading } = usePermissions();
  const { data: competencia } = useCompetenciaAtiva();
  const { data: parametros } = useMunicipioParametros();

  const { data: unreadCount = 0, refetch: refetchUnread } = useQuery({
    queryKey: ["notificacoes-unread", userCtx?.id],
    queryFn: async () => {
      if (!userCtx?.id) return 0;
      const { count, error } = await supabase
        .from("notificacoes")
        .select("id", { count: "exact", head: true })
        .eq("usuario_id", userCtx.id)
        .eq("lida", false);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!userCtx?.id,
    refetchInterval: 60_000,
  });

  const { data: pendAbertasCount = 0 } = useQuery({
    queryKey: ["pendencias-abertas-count"],
    enabled: !!userCtx?.id && (userCtx.is_master || has("pendencia.gerenciar")),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("frequencia_pendencias")
        .select("id", { count: "exact", head: true })
        .in("status", ["aberta", "respondida"])
        .is("deleted_at", null);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!userCtx?.id) return;
    const ch = supabase
      .channel(`notif-${userCtx.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificacoes", filter: `usuario_id=eq.${userCtx.id}` },
        (payload) => {
          refetchUnread();
          if (
            payload.eventType === "INSERT" &&
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted" &&
            document.visibilityState !== "visible"
          ) {
            const n = payload.new as { titulo?: string; mensagem?: string };
            try {
              new Notification(n.titulo || "Nova notificação", {
                body: n.mensagem || "",
                icon: "/icon-192.png",
                badge: "/icon-192.png",
              });
            } catch { /* noop */ }
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userCtx?.id, refetchUnread]);
  const { data: mfaMissing } = useQuery({
    queryKey: ["mfa-status", userCtx?.id],
    queryFn: async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = (data?.totp ?? []).some((f) => f.status === "verified");
      return !verified;
    },
    enabled: !!userCtx?.id,
  });
  const mfaRequired = !!userCtx && (userCtx.is_master || userCtx.perfil_codigo === "ADMIN_SMS");

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4">
        <div className="text-sm text-muted-foreground">Validando sessão...</div>
      </div>
    );
  }

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const canSee = (perm?: string | string[]) => {
    if (!perm) return true;
    if (permLoading) return false;
    if (userCtx?.is_master) return true;
    return Array.isArray(perm) ? perm.some(has) : has(perm);
  };

  const nome = userCtx?.nome_completo ?? user.email ?? "Usuário";
  const perfil = userCtx?.perfil_nome ?? (userCtx?.is_master ? "MASTER" : "—");

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Filtra grupos por permissão e busca
  const visibleGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((it) => canSee(it.perm) && (!q || it.label.toLowerCase().includes(q))),
    })).filter((g) => g.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, permLoading, userCtx?.is_master]);

  // Auto-abre grupo da rota ativa (ou todos, se houver busca)
  const activeGroupId = useMemo(() => {
    for (const g of GROUPS) {
      if (g.items.some((it) => (it.to === "/" ? pathname === "/" : pathname.startsWith(it.to)))) {
        return g.id;
      }
    }
    return null;
  }, [pathname]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setOpenGroups((prev) => (activeGroupId && !prev[activeGroupId] ? { ...prev, [activeGroupId]: true } : prev));
  }, [activeGroupId]);
  const isGroupOpen = (id: string) => !!search.trim() || !!openGroups[id];
  const toggleGroup = (id: string) => setOpenGroups((p) => ({ ...p, [id]: !p[id] }));

  const isItemActive = (to: string) => (to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/"));

  const renderNav = (compact: boolean) => (
    <nav className="flex-1 overflow-y-auto p-2">
      {!compact && (
        <div className="relative mb-2 px-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar no menu..."
            className="w-full rounded-md border bg-background py-1.5 pl-8 pr-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-primary"
          />
        </div>
      )}
      {visibleGroups.map((g) => {
        const GroupIcon = g.icon;
        const open = compact ? true : isGroupOpen(g.id);
        return (
          <div key={g.id} className="mb-1">
            {!compact && (
              <button
                type="button"
                onClick={() => toggleGroup(g.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <GroupIcon className="h-3.5 w-3.5" />
                <span className="flex-1 text-left">{g.label}</span>
                {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            )}
            {open && (
              <div className={compact ? "space-y-0.5" : "mt-0.5 space-y-0.5 pl-2"}>
                {g.items.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(item.to);
                  const showBadge = item.to === "/pendencias" && pendAbertasCount > 0;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      title={compact ? item.label : undefined}
                      className={
                        "group relative flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition " +
                        (active ? "bg-accent font-medium text-foreground" : "text-foreground/75 hover:bg-accent hover:text-foreground") +
                        (compact ? " justify-center" : "")
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!compact && <span className="flex-1 truncate">{item.label}</span>}
                      {showBadge && (
                        <span className={
                          (compact ? "absolute -right-0.5 -top-0.5 " : "ml-auto ") +
                          "flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
                        }>
                          {pendAbertasCount > 99 ? "99+" : pendAbertasCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {visibleGroups.length === 0 && (
        <p className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhum item encontrado.</p>
      )}
    </nav>
  );

  const sidebarInner = (compact: boolean) => (
    <>
      <div className={"flex items-center gap-2 border-b " + (compact ? "justify-center px-2 py-3" : "justify-between px-4 py-3")}>
        {!compact && (
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold uppercase tracking-wider text-primary">GESTÃO SAÚDE</h2>
            <p className="truncate text-xs text-muted-foreground">ORIXIMINÁ - SMS</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="hidden h-7 w-7 items-center justify-center rounded-md hover:bg-accent md:inline-flex"
          title={compact ? "Expandir menu" : "Recolher menu"}
          aria-label={compact ? "Expandir menu" : "Recolher menu"}
        >
          {compact ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
      {renderNav(compact)}
      <div className={"border-t " + (compact ? "p-2" : "p-3")}>
        <button
          onClick={handleSignOut}
          className={"flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-accent " + (compact ? "justify-center" : "justify-center")}
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
          {!compact && <span>Sair</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen w-full bg-muted/20">
      {/* Desktop sidebar */}
      <aside className={"hidden flex-col border-r bg-card transition-[width] md:flex " + (collapsed ? "w-16" : "w-64")}>
        {sidebarInner(collapsed)}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r bg-card shadow-xl">
            {sidebarInner(false)}
          </aside>
        </div>
      )}


      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b bg-card px-4 md:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent md:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          {competencia ? (
            <div className="rounded-md bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              Competência: {competencia.label} — {competencia.status === "aberta" ? "Aberta" : competencia.status === "em_processamento" ? "Em processamento" : competencia.status}
            </div>
          ) : (
            <div className="rounded-md bg-destructive/10 px-3 py-1 text-sm font-semibold text-destructive">
              Nenhuma competência aberta no momento
            </div>
          )}
          <div className="flex items-center gap-3 text-sm">
            <Link
              to="/notificacoes"
              className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
              aria-label="Notificações"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
            <div className="text-right leading-tight">
              <div className="font-medium">{nome}</div>
              <div className="text-xs text-muted-foreground">{perfil}</div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {(nome[0] ?? "U").toUpperCase()}
            </div>
          </div>
        </header>
        {parametros?.mensagem_topo && parametros.mensagem_topo.trim() && (
          <div className="flex items-start gap-2 border-b bg-warning-soft px-6 py-2 text-sm text-warning-soft-foreground">
            <Megaphone className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{parametros.mensagem_topo}</span>
          </div>
        )}
        {mfaRequired && mfaMissing && (
          <div className="flex items-start gap-2 border-b bg-destructive/10 px-6 py-2 text-sm text-destructive">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Seu perfil exige verificação em duas etapas (MFA).{" "}
              <Link to="/seguranca" className="font-semibold underline">Ativar agora</Link>
            </span>
          </div>
        )}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
