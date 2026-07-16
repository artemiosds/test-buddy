import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarRange, ClipboardList, CheckSquare, Users2, AlertTriangle,
  FileClock, Building2, Bell, Clock, ArrowUpRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, usePermissions } from "@/hooks/use-permissions";
import { useCompetenciaAtiva } from "@/hooks/use-competencia-ativa";
import { useMunicipioParametros } from "@/hooks/use-municipio-parametros";
import { KpiCard, KpiGridSkeleton, EmptyState } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";


export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

type CardData = {
  label: string;
  value: React.ReactNode;
  icon: typeof CalendarRange;
  hint?: string;
  to?: string;
  tone?: "default" | "warning" | "danger" | "success";
  loading?: boolean;
};

function Dashboard() {
  const { data: userCtx } = useCurrentUser();
  const { has } = usePermissions();
  const { data: competencia } = useCompetenciaAtiva();
  const { data: parametros } = useMunicipioParametros();

  const isMaster = userCtx?.is_master ?? false;
  const canApprove = isMaster || has("frequencia.aprovar") || has("frequencia.analisar");
  const compId = competencia?.id;
  const canDraft = isMaster || has("frequencia.editar") || has("frequencia.criar");
  const isDiretor = canDraft && !canApprove && !isMaster;

  // Prazo de envio da competência ativa
  const { data: compFull } = useQuery({
    queryKey: ["dash", "comp-prazo", compId],
    enabled: !!compId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competencias")
        .select("id, mes, ano, prazo_envio")
        .eq("id", compId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Aviso de prazo p/ diretores: unidade ainda sem envio
  const { data: minhasUnidadesSemEnvio = 0 } = useQuery({
    queryKey: ["dash", "diretor-sem-envio", compId, userCtx?.id],
    enabled: isDiretor && !!compId && !!userCtx?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("competencia_unidades")
        .select("id", { count: "exact", head: true })
        .eq("competencia_id", compId!)
        .is("data_envio", null)
        .is("deleted_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const diasAviso = parametros?.dias_aviso_prazo_fechamento ?? 5;
  const prazoDate = compFull?.prazo_envio ? new Date(compFull.prazo_envio + "T23:59:59") : null;
  const diasParaFechamento = prazoDate ? Math.ceil((prazoDate.getTime() - Date.now()) / 86400000) : null;
  const showPrazoAviso =
    isDiretor &&
    prazoDate !== null &&
    diasParaFechamento !== null &&
    diasParaFechamento >= 0 &&
    diasParaFechamento <= diasAviso &&
    minhasUnidadesSemEnvio > 0;


  // === Métricas GESTOR / MASTER ===
  const { data: pendAprovacao = 0 } = useQuery({
    queryKey: ["dash", "pend-aprovacao", compId],
    enabled: canApprove && !!compId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("frequencias")
        .select("id, competencia_unidades!inner(competencia_id)", { count: "exact", head: true })
        .in("status", ["enviada", "em_analise"])
        .eq("competencia_unidades.competencia_id", compId!);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: unidadesSemEnvio = 0 } = useQuery({
    queryKey: ["dash", "unidades-sem-envio", compId],
    enabled: canApprove && !!compId,
    queryFn: async () => {
      const [{ count: totalUnidades }, { count: comEnvio }] = await Promise.all([
        supabase.from("unidades").select("id", { count: "exact", head: true }).eq("status", "ativa").is("deleted_at", null),
        supabase
          .from("competencia_unidades")
          .select("unidade_id", { count: "exact", head: true })
          .eq("competencia_id", compId!)
          .not("data_envio", "is", null),
      ]);
      return Math.max(0, (totalUnidades ?? 0) - (comEnvio ?? 0));
    },
  });

  const { data: profissionaisAtivos = 0 } = useQuery({
    queryKey: ["dash", "profissionais-ativos"],
    enabled: isMaster,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profissionais")
        .select("id", { count: "exact", head: true })
        .eq("status", "ativo");
      if (error) throw error;
      return count ?? 0;
    },
  });

  // === Métricas DIRETOR / ADMINISTRATIVO ===


  const { data: rascunhos = 0 } = useQuery({
    queryKey: ["dash", "rascunhos", compId, userCtx?.id],
    enabled: canDraft && !!compId && !isMaster,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("frequencias")
        .select("id, competencia_unidades!inner(competencia_id)", { count: "exact", head: true })
        .eq("status", "rascunho")
        .eq("competencia_unidades.competencia_id", compId!);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: devolvidas = 0 } = useQuery({
    queryKey: ["dash", "devolvidas", compId],
    enabled: canDraft && !!compId && !isMaster,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("frequencias")
        .select("id, competencia_unidades!inner(competencia_id)", { count: "exact", head: true })
        .in("status", ["com_pendencias", "rejeitada"])
        .eq("competencia_unidades.competencia_id", compId!);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // === Notificações não lidas ===
  const { data: notifNaoLidas = 0 } = useQuery({
    queryKey: ["dash", "notif-nao-lidas", userCtx?.id],
    enabled: !!userCtx?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notificacoes")
        .select("id", { count: "exact", head: true })
        .eq("usuario_id", userCtx!.id)
        .eq("lida", false);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const cards: CardData[] = [
    {
      label: "Competência ativa",
      value: competencia?.label ?? "—",
      hint: competencia?.status ?? "nenhuma aberta",
      icon: CalendarRange,
      to: "/competencias",
    },
  ];

  if (canApprove) {
    cards.push(
      {
        label: "Aguardando aprovação",
        value: pendAprovacao,
        hint: "Folhas enviadas ou em análise",
        icon: CheckSquare,
        to: "/aprovacoes",
        tone: pendAprovacao > 0 ? "warning" : "success",
      },
      {
        label: "Unidades sem envio",
        value: unidadesSemEnvio,
        hint: "Ainda não enviaram nesta competência",
        icon: Building2,
        tone: unidadesSemEnvio > 0 ? "danger" : "success",
      },
    );
  }

  if (canDraft && !canApprove) {
    cards.push(
      {
        label: "Rascunhos abertos",
        value: rascunhos,
        hint: "Da sua unidade",
        icon: ClipboardList,
        to: "/frequencias",
      },
      {
        label: "Devolvidas para correção",
        value: devolvidas,
        hint: "Precisam de atenção",
        icon: AlertTriangle,
        to: "/pendencias",
        tone: devolvidas > 0 ? "danger" : "success",
      },
    );
  }

  if (isMaster) {
    cards.push({
      label: "Profissionais ativos",
      value: profissionaisAtivos,
      icon: Users2,
      to: "/profissionais",
    });
  }

  cards.push({
    label: "Notificações não lidas",
    value: notifNaoLidas,
    icon: Bell,
    to: "/notificacoes",
    tone: notifNaoLidas > 0 ? "warning" : "default",
  });

  const primeiro = userCtx?.nome_completo?.split(" ")[0] ?? "seja bem-vindo";

  // Loading agregado das queries dos KPIs para skeleton unificado.
  const kpisLoading = !userCtx || (!!compId && competencia == null);

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
            Olá, {primeiro}.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sistema de Gestão de Frequência e Folha — Secretaria Municipal de Saúde de Oriximiná.
          </p>
        </div>
        {competencia && (
          <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {competencia.label}
          </span>
        )}
      </header>

      {!competencia && (
        <EmptyState
          icon={<AlertTriangle className="h-5 w-5" strokeWidth={1.75} />}
          title="Nenhuma competência aberta"
          description="Um gestor precisa abrir a competência do mês para liberar o lançamento de frequências."
        />
      )}

      {showPrazoAviso && competencia && (
        <div className="rounded-lg border-2 border-warning bg-warning-soft p-4 text-warning-soft-foreground animate-in fade-in slide-in-from-top-1 duration-300">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <div className="font-semibold">Prazo de fechamento se aproximando</div>
              <div className="mt-1">
                {diasParaFechamento === 0
                  ? `O prazo de envio da competência ${competencia.label} vence hoje`
                  : `Faltam ${diasParaFechamento} dia${diasParaFechamento === 1 ? "" : "s"} para o fechamento da competência ${competencia.label}`}
                {" "}e sua folha ainda não foi enviada.
              </div>
            </div>
          </div>
        </div>
      )}

      {kpisLoading ? (
        <KpiGridSkeleton count={4} className="sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => {
            const Icon = c.icon;
            const kpiTone =
              c.tone === "danger" ? "danger"
              : c.tone === "warning" ? "warning"
              : c.tone === "success" ? "success"
              : "default";
            const card = (
              <KpiCard
                label={c.label}
                value={c.value}
                hint={c.hint}
                tone={kpiTone}
                icon={<Icon className="h-4 w-4 text-primary" strokeWidth={1.75} />}
                className="h-full"
              />
            );
            return c.to ? (
              <Link
                key={c.label}
                to={c.to}
                className="block rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
              >
                {card}
              </Link>
            ) : (
              <div key={c.label}>{card}</div>
            );
          })}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <QuickLinks canApprove={canApprove} canDraft={canDraft} isMaster={isMaster} />
        <RecentActivity />
      </section>
    </div>
  );
}

function QuickLinks({ canApprove, canDraft, isMaster }: { canApprove: boolean; canDraft: boolean; isMaster: boolean }) {
  const links: { to: string; label: string }[] = [];
  if (canDraft) links.push({ to: "/frequencias", label: "Lançar frequências" });
  if (canApprove) links.push({ to: "/aprovacoes", label: "Aprovar folhas enviadas" });
  links.push({ to: "/relatorios", label: "Gerar relatórios" });
  if (isMaster) links.push({ to: "/usuarios", label: "Gerenciar usuários e permissões" });

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold">Atalhos</h2>
      <ul className="space-y-1">
        {links.map((l) => (
          <li key={l.to}>
            <Link
              to={l.to}
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground/80 transition hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            >
              <ArrowUpRight className="h-3.5 w-3.5 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2} />
              <span>{l.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function RecentActivity() {
  const { data: userCtx } = useCurrentUser();
  const { data = [], isLoading } = useQuery({
    queryKey: ["dash", "recent-notif", userCtx?.id],
    enabled: !!userCtx?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("id, titulo, created_at, lida, tipo")
        .eq("usuario_id", userCtx!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <FileClock className="h-4 w-4 text-primary" strokeWidth={1.75} />
        <h2 className="text-sm font-semibold">Atividade recente</h2>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2">
              <Skeleton className="mt-1.5 h-1.5 w-1.5 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          title="Sem notificações recentes"
          description="Novas notificações aparecerão aqui."
          className="border-0 py-6"
        />
      ) : (
        <ul className="space-y-2">
          {data.map((n) => (
            <li key={n.id} className="flex items-start gap-2 text-sm">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${n.lida ? "bg-muted-foreground/40" : "bg-primary"}`} />
              <div className="min-w-0 flex-1">
                <div className={`truncate ${n.lida ? "text-muted-foreground" : "font-medium"}`}>
                  {n.titulo}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(n.created_at).toLocaleString("pt-BR")}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
