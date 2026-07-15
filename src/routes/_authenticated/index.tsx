import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarRange, ClipboardList, CheckSquare, Users2, AlertTriangle,
  FileClock, Building2, Bell, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, usePermissions } from "@/hooks/use-permissions";
import { useCompetenciaAtiva } from "@/hooks/use-competencia-ativa";
import { useMunicipioParametros } from "@/hooks/use-municipio-parametros";


export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

type CardData = {
  label: string;
  value: string | number;
  icon: typeof CalendarRange;
  hint?: string;
  to?: string;
  tone?: "default" | "warn" | "danger" | "ok";
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
        tone: pendAprovacao > 0 ? "warn" : "ok",
      },
      {
        label: "Unidades sem envio",
        value: unidadesSemEnvio,
        hint: "Ainda não enviaram nesta competência",
        icon: Building2,
        tone: unidadesSemEnvio > 0 ? "danger" : "ok",
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
        tone: devolvidas > 0 ? "danger" : "ok",
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
    tone: notifNaoLidas > 0 ? "warn" : "default",
  });

  const primeiro = userCtx?.nome_completo?.split(" ")[0] ?? "seja bem-vindo";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Olá, {primeiro}.</h1>
        <p className="text-sm text-muted-foreground">
          Sistema de Gestão de Frequência e Folha — Secretaria Municipal de Saúde de Oriximiná.
        </p>
      </header>

      {!competencia && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              Nenhuma competência aberta no momento. Um gestor precisa abrir a competência do mês
              para liberar o lançamento de frequências.
            </div>
          </div>
        </div>
      )}

      {showPrazoAviso && competencia && (
        <div className="rounded-md border-2 border-orange-400 bg-orange-50 p-4 text-orange-900">
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



      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          const toneClass =
            c.tone === "danger" ? "border-destructive/40 bg-destructive/5"
            : c.tone === "warn" ? "border-amber-200 bg-amber-50/50"
            : c.tone === "ok" ? "border-emerald-200/60 bg-emerald-50/40"
            : "";
          const inner = (
            <div className={`rounded-lg border bg-card p-4 transition hover:shadow-sm ${toneClass}`}>
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {c.label}
                </div>
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-2 text-2xl font-semibold">{c.value}</div>
              {c.hint && <div className="mt-1 text-xs text-muted-foreground">{c.hint}</div>}
            </div>
          );
          return c.to ? (
            <Link key={c.label} to={c.to} className="block">{inner}</Link>
          ) : (
            <div key={c.label}>{inner}</div>
          );
        })}
      </div>

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
    <div className="rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold mb-3">Atalhos</h2>
      <ul className="space-y-1">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="text-sm text-primary hover:underline">
              → {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecentActivity() {
  const { data: userCtx } = useCurrentUser();
  const { data = [] } = useQuery({
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
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileClock className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Atividade recente</h2>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma notificação recente.</p>
      ) : (
        <ul className="space-y-2">
          {data.map((n) => (
            <li key={n.id} className="flex items-start gap-2 text-sm">
              <span className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${n.lida ? "bg-muted-foreground/40" : "bg-primary"}`} />
              <div className="flex-1 min-w-0">
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
    </div>
  );
}
