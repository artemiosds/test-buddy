import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, CalendarRange, ClipboardList, Users, Building2, ShieldCheck, LogOut, UserCog, AlertCircle, CheckCircle2, Signature, FileBarChart, Bell, Settings2, Tag, CalendarDays, Megaphone, Menu, PanelLeftOpen, PanelLeftClose, Search, ChevronDown, ChevronRight, Activity, BarChart3, Briefcase, Network, Wrench, KeyRound, Sun, Moon, PenLine } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { auditClient } from "@/lib/audit-client";
import { trackPageView } from "@/lib/usage-tracker";
import { useCurrentUser, usePermissions } from "@/hooks/use-permissions";
import { useCompetenciaAtiva } from "@/hooks/use-competencia-ativa";
import { useMunicipioParametros } from "@/hooks/use-municipio-parametros";
import { useTheme } from "@/hooks/use-theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  masterOnly?: boolean;
  /** Subsecção visual dentro do grupo. Itens sem `section` ficam no topo. */
  section?: string;
  /** Hash opcional (para links que apontam para o mesmo pathname). */
  hash?: string;
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
      { to: "/piso-enfermagem", label: "Piso Nacional da Enfermagem", icon: ClipboardList, perm: "piso.visualizar" },
      { to: "/pendencias", label: "Pendências", icon: AlertCircle, perm: "pendencia.gerenciar" },
      { to: "/aprovacoes", label: "Aprovações", icon: CheckCircle2, perm: "frequencia.aprovar" },
      { to: "/assinaturas", label: "Assinaturas", icon: Signature, perm: ["assinatura.gerenciar", "assinatura.aplicar"] },
      { to: "/meu-perfil/assinatura", label: "Minha Assinatura", icon: PenLine },
      { to: "/notificacoes", label: "Notificações", icon: Bell },
    ],
  },
  {
    id: "gestao_pessoas",
    label: "Gestão da Saúde",
    icon: Users,
    items: [
      // 📊 Visão Executiva
      { to: "/gestao-pessoas", label: "Dashboard Executivo", icon: LayoutDashboard, section: "📊 Visão Executiva" },
      { to: "/sala-situacao", label: "Sala de Situação", icon: Activity, section: "📊 Visão Executiva" },
      { to: "/gestao-rh", label: "Dashboard RH", icon: BarChart3, section: "📊 Visão Executiva" },
      { to: "/analitico", label: "Indicadores", icon: BarChart3, perm: ["relatorio.visualizar", "relatorio.exportar"], section: "📊 Visão Executiva" },
      // 👥 Profissionais
      { to: "/profissionais", label: "Cadastro de Profissionais", icon: Users, perm: "profissional.visualizar", section: "👥 Profissionais" },
      { to: "/gestao-profissionais", label: "Gestão dos Profissionais", icon: UserCog, perm: "profissional.visualizar", section: "👥 Profissionais" },
      { to: "/gestao-pessoas/situacao-funcional", label: "Situação Funcional", icon: Activity, section: "👥 Profissionais" },
      // 🏥 Estrutura Organizacional
      { to: "/unidades", label: "Unidades", icon: Building2, perm: "unidade.visualizar", section: "🏥 Estrutura Organizacional" },
      { to: "/setores", label: "Setores", icon: Network, perm: "unidade.editar", section: "🏥 Estrutura Organizacional" },
      { to: "/cargos-funcoes", label: "Cargos", icon: Briefcase, perm: "configuracao.editar", section: "🏥 Estrutura Organizacional", hash: "cargos" },
      { to: "/cargos-funcoes", label: "Funções", icon: Tag, perm: "configuracao.editar", section: "🏥 Estrutura Organizacional", hash: "funcoes" },
      // 📍 Gestão Operacional
      { to: "/controle-forca-trabalho", label: "Controle da Força de Trabalho", icon: Activity, section: "📍 Gestão Operacional" },
      { to: "/gestao-pessoas/lotacao", label: "Lotação das Unidades", icon: Building2, section: "📍 Gestão Operacional" },
      { to: "/gestao-pessoas/distribuicao-setor", label: "Distribuição por Setor", icon: Network, section: "📍 Gestão Operacional" },
    ],
  },
  {
    id: "relatorios",
    label: "Relatórios",
    icon: FileBarChart,
    items: [
      { to: "/relatorios", label: "Visão geral", icon: FileBarChart, perm: ["relatorio.visualizar", "relatorio.exportar"] },
      { to: "/relatorios-gerenciais", label: "Gerenciais (Secretaria)", icon: FileBarChart, perm: ["relatorio.visualizar", "relatorio.exportar"] },
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
      { to: "/saude", label: "Saúde do Sistema", icon: Activity, masterOnly: true },
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
  const { theme, toggle: toggleTheme } = useTheme();

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
  // Flag do perfil (`admin_2fa_required`) é a fonte de verdade a partir do 5D.
  // Mantemos o fallback para perfis MASTER / ADMIN_SMS caso o backend ainda não
  // tenha refletido a nova coluna (por exemplo, cache de RPC antigo).
  const mfaRequired =
    !!userCtx &&
    (userCtx.perfil_admin_2fa_required ||
      userCtx.is_master ||
      userCtx.perfil_codigo === "ADMIN_SMS");

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4">
        <div className="text-sm text-muted-foreground">Validando sessão...</div>
      </div>
    );
  }

  // Guard 5D: administradores só acessam rotas fora de /seguranca depois de
  // ativar o segundo fator. Executado no render para não bloquear a própria
  // tela de configuração (nem gerar redirect loop).

  async function handleSignOut() {
    await auditClient.logout();
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const canSee = (item: NavItem) => {
    if (item.masterOnly && !userCtx?.is_master) return false;
    const perm = item.perm;
    if (!perm) return true;
    if (permLoading) return false;
    if (userCtx?.is_master) return true;
    return Array.isArray(perm) ? perm.some(has) : has(perm);
  };

  const nome = userCtx?.nome_completo ?? user.email ?? "Usuário";
  const perfil = userCtx?.perfil_nome ?? (userCtx?.is_master ? "MASTER" : "—");

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isSegurancaRoute = pathname === "/seguranca";
  // Sublote 6D — page view anônimo por mudança de rota autenticada.
  useEffect(() => {
    if (!userCtx?.id) return;
    trackPageView(pathname);
  }, [pathname, userCtx?.id]);
  useEffect(() => {
    if (mfaRequired && mfaMissing && !isSegurancaRoute) {
      navigate({ to: "/seguranca", replace: true });
    }
  }, [mfaRequired, mfaMissing, isSegurancaRoute, navigate]);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Filtra grupos por permissão e busca
  const visibleGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((it) => canSee(it) && (!q || it.label.toLowerCase().includes(q))),
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

  // ---- Breadcrumbs ----
  // Constrói mapa plano rota -> label a partir dos GROUPS declarados acima.
  const routeLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of GROUPS) for (const it of g.items) m.set(it.to, it.label);
    // aliases úteis para URLs sem match direto
    m.set("/relatorios-consolidado", "Relatório consolidado");
    m.set("/relatorios-executivo", "Relatório executivo");
    m.set("/relatorios-profissional", "Por profissional");
    m.set("/relatorios-status", "Status");
    return m;
  }, []);

  const currentPageLabel = useMemo(() => {
    // procura match mais específico dentro do path
    let best: { to: string; label: string } | null = null;
    for (const [to, label] of routeLabelMap.entries()) {
      if (to === "/") continue;
      if (pathname === to || pathname.startsWith(to + "/")) {
        if (!best || to.length > best.to.length) best = { to, label };
      }
    }
    if (pathname === "/") return "Dashboard";
    return best?.label ?? "Página";
  }, [pathname, routeLabelMap]);

  const currentGroupLabel = useMemo(() => {
    for (const g of GROUPS) {
      if (g.items.some((it) => (it.to === "/" ? pathname === "/" : pathname === it.to || pathname.startsWith(it.to + "/")))) {
        return g.label;
      }
    }
    return null;
  }, [pathname]);

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
                {g.items.map((item, idx) => {
                  const Icon = item.icon;
                  const active = isItemActive(item.to);
                  const showBadge = item.to === "/pendencias" && pendAbertasCount > 0;
                  const prev = idx > 0 ? g.items[idx - 1] : null;
                  const showSectionHeader =
                    !compact && !!item.section && (!prev || prev.section !== item.section);
                  const linkNode = (
                    <Link
                      to={item.to}
                      hash={item.hash}
                      onClick={() => setMobileOpen(false)}
                      title={compact ? item.label : undefined}
                      className={
                        "group relative flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-all duration-150 " +
                        (active
                          ? "bg-primary/10 font-medium text-primary shadow-[inset_2px_0_0_0_var(--primary)]"
                          : "text-foreground/75 hover:bg-accent hover:text-foreground") +
                        (compact ? " justify-center" : "")
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
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
                  return (
                    <div key={`${item.to}${item.hash ?? ""}-${idx}`}>
                      {showSectionHeader && (
                        <div className="mt-2 border-t border-border/60 px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                          {item.section}
                        </div>
                      )}
                      {linkNode}
                    </div>
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
        <TopBar
          onOpenMobile={() => setMobileOpen(true)}
          nome={nome}
          perfil={perfil}
          competencia={competencia}
          unreadCount={unreadCount}
          currentPageLabel={currentPageLabel}
          currentGroupLabel={currentGroupLabel}
          theme={theme}
          onToggleTheme={toggleTheme}
          onSignOut={handleSignOut}
        />
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
        <main className="flex-1 p-4 md:p-6">
          <div key={pathname} className="route-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

type TopBarProps = {
  onOpenMobile: () => void;
  nome: string;
  perfil: string;
  competencia: { label: string; status: string } | null | undefined;
  unreadCount: number;
  currentPageLabel: string;
  currentGroupLabel: string | null;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onSignOut: () => void | Promise<void>;
};

function TopBar({
  onOpenMobile,
  nome,
  perfil,
  competencia,
  unreadCount,
  currentPageLabel,
  currentGroupLabel,
  theme,
  onToggleTheme,
  onSignOut,
}: TopBarProps) {
  const initial = (nome[0] ?? "U").toUpperCase();
  const compStatusLabel =
    competencia?.status === "aberta"
      ? "Aberta"
      : competencia?.status === "em_processamento"
      ? "Em processamento"
      : competencia?.status ?? "";

  return (
    <TooltipProvider delayDuration={200}>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:px-6">
        <button
          type="button"
          onClick={onOpenMobile}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md transition hover:bg-accent md:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </button>

        {/* Breadcrumbs (desktop) + título compacto (mobile) */}
        <div className="min-w-0 flex-1">
          <Breadcrumb className="hidden md:block">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/" className="text-muted-foreground transition hover:text-foreground">
                    Início
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {currentGroupLabel && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <span className="text-muted-foreground">{currentGroupLabel}</span>
                  </BreadcrumbItem>
                </>
              )}
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-semibold text-foreground">
                  {currentPageLabel}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="truncate text-base font-semibold md:hidden">{currentPageLabel}</h1>
        </div>

        {/* Competência (chip) — recolhida em mobile */}
        {competencia ? (
          <div className="hidden rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary lg:block">
            <span className="text-muted-foreground">Competência:</span>{" "}
            <span className="font-semibold">{competencia.label}</span>
            <span className="mx-1 text-muted-foreground">·</span>
            <span>{compStatusLabel}</span>
          </div>
        ) : (
          <div className="hidden rounded-md bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive lg:block">
            Nenhuma competência aberta
          </div>
        )}

        <div className="flex items-center gap-1">
          {/* Toggle de tema */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleTheme}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-accent"
                aria-label={theme === "dark" ? "Tema claro" : "Tema escuro"}
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <Moon className="h-4 w-4" strokeWidth={1.75} />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {theme === "dark" ? "Alternar para tema claro" : "Alternar para tema escuro"}
            </TooltipContent>
          </Tooltip>

          {/* Notificações */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/notificacoes"
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-accent"
                aria-label="Notificações"
              >
                <Bell className="h-4 w-4" strokeWidth={1.75} />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground shadow-sm">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom">Notificações</TooltipContent>
          </Tooltip>

          {/* Avatar + menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-1 flex items-center gap-2 rounded-full pl-1 pr-2 py-1 transition hover:bg-accent"
                aria-label="Menu do usuário"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {initial}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block max-w-[160px] truncate text-sm font-medium">{nome}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{perfil}</span>
                </span>
                <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" strokeWidth={2} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="truncate text-sm font-semibold">{nome}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">{perfil}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/seguranca" className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" strokeWidth={1.75} />
                  Segurança (MFA)
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onToggleTheme}>
                {theme === "dark" ? (
                  <><Sun className="mr-2 h-4 w-4" strokeWidth={1.75} /> Tema claro</>
                ) : (
                  <><Moon className="mr-2 h-4 w-4" strokeWidth={1.75} /> Tema escuro</>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void onSignOut()} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" strokeWidth={1.75} />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </TooltipProvider>
  );
}
