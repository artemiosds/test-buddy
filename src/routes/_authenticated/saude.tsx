import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, AlertTriangle, BarChart3, Bell, CheckCircle2, Clock, Info, RefreshCw, ShieldAlert, Timer, Users, Zap, RotateCcw, Trash2, Inbox } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-permissions";
import { formatDateTime } from "@/lib/formatters";
import { withBreaker, listBreakers, subscribeBreakers, getBreaker, type BreakerSnapshot } from "@/lib/circuit-breaker";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { auditClient } from "@/lib/audit-client";
import { computeSaudeAlerts, type SaudeAlert } from "@/lib/saude-alerts";
import { useServerFn } from "@tanstack/react-start";
import { getPerfMetrics } from "@/lib/perf-metrics.functions";

export const Route = createFileRoute("/_authenticated/saude")({
  component: SaudePage,
});

type EventosResp = {
  por_status: Record<string, number>;
  mais_antigo_pendente: string | null;
  retry_alto: number;
  top_falhas: Array<{ tipo: string; agregado: string; qtd: number; ultimo_erro: string | null }>;
  gerado_em: string;
};
type SlaResp = {
  abertas: number;
  vencidas: number;
  proximas_24h: number;
  por_prioridade: Record<string, number>;
  gerado_em: string;
};
type CronResp = {
  disponivel: boolean;
  jobs: Array<{ jobid: number; jobname: string | null; schedule: string; active: boolean }>;
  falhas_24h: Array<{ jobid: number; jobname: string | null; status: string; start_time: string; end_time: string | null; return_message: string | null }>;
  gerado_em: string;
};
type UsoResp = {
  periodo_dias: number;
  total_eventos: number;
  por_evento: Array<{ evento: string; qtd: number }>;
  top_rotas: Array<{ rota: string; qtd: number }>;
  dau: Array<{ dia: string; sessoes: number }>;
  por_perfil: Array<{ perfil: string; qtd: number }>;
  gerado_em: string;
};

function KpiCard({ icon: Icon, label, value, tone = "default" }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  tone?: "default" | "warn" | "danger" | "ok";
}) {
  const toneCls =
    tone === "danger" ? "text-destructive"
    : tone === "warn" ? "text-amber-600 dark:text-amber-400"
    : tone === "ok" ? "text-emerald-600 dark:text-emerald-400"
    : "text-foreground";
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className={`mt-2 text-3xl font-semibold ${toneCls}`}>{value}</div>
    </Card>
  );
}

function SaudePage() {
  const { data: me } = useCurrentUser();
  const isMaster = !!me?.is_master;

  const eventosQ = useQuery({
    queryKey: ["saude", "eventos"],
    enabled: isMaster,
    refetchInterval: 30_000,
    queryFn: async () => {
      return withBreaker("rpc.health_eventos_dominio", async () => {
        const { data, error } = await supabase.rpc("health_eventos_dominio" as never);
        if (error) throw error;
        return data as unknown as EventosResp;
      });
    },
  });
  const slaQ = useQuery({
    queryKey: ["saude", "sla"],
    enabled: isMaster,
    refetchInterval: 60_000,
    queryFn: async () => {
      return withBreaker("rpc.health_pendencias_sla", async () => {
        const { data, error } = await supabase.rpc("health_pendencias_sla" as never);
        if (error) throw error;
        return data as unknown as SlaResp;
      });
    },
  });
  const cronQ = useQuery({
    queryKey: ["saude", "cron"],
    enabled: isMaster,
    refetchInterval: 60_000,
    queryFn: async () => {
      return withBreaker("rpc.health_cron_jobs", async () => {
        const { data, error } = await supabase.rpc("health_cron_jobs" as never);
        if (error) throw error;
        return data as unknown as CronResp;
      });
    },
  });
  const usoQ = useQuery({
    queryKey: ["saude", "uso", 7],
    enabled: isMaster,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      return withBreaker("rpc.uso_metricas", async () => {
        const { data, error } = await supabase.rpc("uso_metricas" as never, { _dias: 7 } as never);
        if (error) throw error;
        return data as unknown as UsoResp;
      });
    },
  });

  if (!me) return <div className="p-6 text-muted-foreground">Carregando...</div>;
  if (!isMaster) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Saúde do sistema</h1>
        <p className="mt-2 text-muted-foreground">Somente usuários Master podem acessar este painel.</p>
      </div>
    );
  }

  const ev = eventosQ.data;
  const sla = slaQ.data;
  const cron = cronQ.data;
  const uso = usoQ.data;
  const refetchAll = () => {
    void eventosQ.refetch(); void slaQ.refetch(); void cronQ.refetch(); void usoQ.refetch();
  };

  const pendentes = (ev?.por_status?.["pendente"] ?? 0) + (ev?.por_status?.["falhou_retry"] ?? 0);
  const falhou = ev?.por_status?.["falhou"] ?? 0;

  const travadosQ = useQuery({
    queryKey: ["saude", "eventos-travados"],
    enabled: isMaster,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("eventos_travados" as never, { _limit: 100 } as never);
      if (error) throw error;
      return data as unknown as { rows: unknown[]; gerado_em: string };
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" /> Saúde do sistema
          </h1>
          <p className="text-sm text-muted-foreground">
            Atualiza automaticamente. Última leitura de eventos: {ev ? formatDateTime(ev.gerado_em) : "—"}.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetchAll}>
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
      </div>

      <AlertsBanner
        eventos={ev ?? null}
        sla={sla ?? null}
        cron={cron ?? null}
        travados={travadosQ.data ?? null}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Barramento de eventos</h2>
        {eventosQ.isError && <p className="text-sm text-destructive">Falha ao carregar eventos.</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={Clock} label="Pendentes / retry" value={pendentes}
            tone={pendentes > 50 ? "warn" : "default"} />
          <KpiCard icon={AlertTriangle} label="Retry alto (≥5)" value={ev?.retry_alto ?? "—"}
            tone={(ev?.retry_alto ?? 0) > 0 ? "warn" : "ok"} />
          <KpiCard icon={ShieldAlert} label="Falhou (definitivo)" value={falhou}
            tone={falhou > 0 ? "danger" : "ok"} />
          <KpiCard icon={Timer} label="Mais antigo pendente"
            value={ev?.mais_antigo_pendente ? formatDateTime(ev.mais_antigo_pendente) : "—"} />
        </div>
        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Top falhas por tipo</div>
          {ev?.top_falhas?.length ? (
            <ul className="space-y-2 text-sm">
              {ev.top_falhas.map((f, i) => (
                <li key={i} className="flex flex-col border-b border-border last:border-0 pb-2 last:pb-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{f.qtd}</Badge>
                    <span className="font-mono text-xs">{f.tipo}</span>
                    <span className="text-muted-foreground text-xs">/ {f.agregado}</span>
                  </div>
                  {f.ultimo_erro && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{f.ultimo_erro}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sem falhas registradas.</p>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">SLA de pendências</h2>
        {slaQ.isError && <p className="text-sm text-destructive">Falha ao carregar SLA.</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={Clock} label="Abertas" value={sla?.abertas ?? "—"} />
          <KpiCard icon={AlertTriangle} label="Vencidas" value={sla?.vencidas ?? "—"}
            tone={(sla?.vencidas ?? 0) > 0 ? "danger" : "ok"} />
          <KpiCard icon={Timer} label="Vencem em 24h" value={sla?.proximas_24h ?? "—"}
            tone={(sla?.proximas_24h ?? 0) > 0 ? "warn" : "ok"} />
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <ShieldAlert className="h-4 w-4" /> Por prioridade
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {sla && Object.keys(sla.por_prioridade).length ? Object.entries(sla.por_prioridade).map(([k, v]) => (
                <Badge key={k} variant="outline">{k}: {v}</Badge>
              )) : <span className="text-sm text-muted-foreground">—</span>}
            </div>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Jobs agendados (pg_cron)</h2>
        {cronQ.isError && <p className="text-sm text-destructive">Falha ao carregar cron.</p>}
        {cron && !cron.disponivel ? (
          <p className="text-sm text-muted-foreground">pg_cron não está instalado neste projeto.</p>
        ) : (
          <>
            <Card className="p-4">
              <div className="text-sm font-medium mb-2">Jobs ativos</div>
              {cron?.jobs?.length ? (
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr><th className="text-left py-1">Nome</th><th className="text-left">Agenda</th><th className="text-left">Ativo</th></tr>
                  </thead>
                  <tbody>
                    {cron.jobs.map((j) => (
                      <tr key={j.jobid} className="border-t border-border">
                        <td className="py-1 font-mono text-xs">{j.jobname ?? `#${j.jobid}`}</td>
                        <td className="font-mono text-xs">{j.schedule}</td>
                        <td>{j.active ? <Badge variant="secondary">ativo</Badge> : <Badge variant="outline">inativo</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum job agendado.</p>
              )}
            </Card>
            <Card className="p-4">
              <div className="text-sm font-medium mb-2">Falhas nas últimas 24h</div>
              {cron?.falhas_24h?.length ? (
                <ul className="space-y-2 text-sm">
                  {cron.falhas_24h.map((f, i) => (
                    <li key={i} className="border-b border-border last:border-0 pb-2 last:pb-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">{f.status}</Badge>
                        <span className="font-mono text-xs">{f.jobname ?? `#${f.jobid}`}</span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(f.start_time)}</span>
                      </div>
                      {f.return_message && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{f.return_message}</p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Sem falhas nas últimas 24 horas.</p>
              )}
            </Card>
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Uso do sistema (7 dias — anônimo)</h2>
        {usoQ.isError && <p className="text-sm text-destructive">Falha ao carregar métricas de uso.</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={BarChart3} label="Eventos" value={uso?.total_eventos ?? "—"} />
          <KpiCard
            icon={Users}
            label="Sessões únicas (7d)"
            value={uso ? new Set(uso.dau.map((d) => d.dia)).size ? uso.dau.reduce((s, d) => s + d.sessoes, 0) : 0 : "—"}
          />
          <KpiCard
            icon={Activity}
            label="Rotas distintas"
            value={uso?.top_rotas?.length ?? "—"}
          />
          <KpiCard
            icon={Clock}
            label="Última leitura"
            value={uso ? formatDateTime(uso.gerado_em) : "—"}
          />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="p-4">
            <div className="text-sm font-medium mb-2">Top rotas</div>
            {uso?.top_rotas?.length ? (
              <ul className="space-y-1 text-sm">
                {uso.top_rotas.slice(0, 10).map((r, i) => (
                  <li key={i} className="flex items-center justify-between border-b border-border last:border-0 py-1">
                    <span className="font-mono text-xs truncate">{r.rota}</span>
                    <Badge variant="secondary">{r.qtd}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sem eventos ainda.</p>
            )}
          </Card>
          <Card className="p-4">
            <div className="text-sm font-medium mb-2">Eventos por tipo</div>
            {uso?.por_evento?.length ? (
              <ul className="space-y-1 text-sm">
                {uso.por_evento.map((e, i) => (
                  <li key={i} className="flex items-center justify-between border-b border-border last:border-0 py-1">
                    <span className="font-mono text-xs">{e.evento}</span>
                    <Badge variant="outline">{e.qtd}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </Card>
          <Card className="p-4">
            <div className="text-sm font-medium mb-2">Sessões por dia</div>
            {uso?.dau?.length ? (
              <ul className="space-y-1 text-sm">
                {uso.dau.map((d, i) => (
                  <li key={i} className="flex items-center justify-between border-b border-border last:border-0 py-1">
                    <span className="font-mono text-xs">{d.dia}</span>
                    <Badge variant="secondary">{d.sessoes}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </Card>
          <Card className="p-4">
            <div className="text-sm font-medium mb-2">Por perfil</div>
            {uso?.por_perfil?.length ? (
              <div className="flex flex-wrap gap-2">
                {uso.por_perfil.map((p, i) => (
                  <Badge key={i} variant="outline">{p.perfil}: {p.qtd}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </Card>
        </div>
      </section>

      <BreakersSection />

      <EventosTravadosSection isMaster={isMaster} />

      <PerformanceSection isMaster={isMaster} />
    </div>
  );
}

// ---------------- Sublote 8C — Fila de reprocessamento manual ----------------

type EventoTravado = {
  id: string;
  tipo: string;
  agregado: string;
  agregado_id: string | null;
  status: string;
  tentativas: number;
  ultimo_erro: string | null;
  created_at: string;
  updated_at: string;
  proxima_tentativa_em: string | null;
};
type TravadosResp = { rows: EventoTravado[]; gerado_em: string };

function EventosTravadosSection({ isMaster }: { isMaster: boolean }) {
  const qc = useQueryClient();
  const confirm = useConfirm();

  const q = useQuery({
    queryKey: ["saude", "eventos-travados"],
    enabled: isMaster,
    refetchInterval: 60_000,
    queryFn: async () => {
      return withBreaker("rpc.eventos_travados", async () => {
        const { data, error } = await supabase.rpc("eventos_travados" as never, { _limit: 100 } as never);
        if (error) throw error;
        return data as unknown as TravadosResp;
      });
    },
  });

  const reprocessar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("reprocessar_evento_dominio" as never, { _id: id } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento re-enfileirado como pendente.");
      qc.invalidateQueries({ queryKey: ["saude", "eventos-travados"] });
      qc.invalidateQueries({ queryKey: ["saude", "eventos"] });
    },
    onError: (e: Error) => {
      logger.error("evento.reprocessar_falha", { message: e.message });
      toast.error(e.message || "Falha ao reprocessar evento.");
    },
  });

  const descartar = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string | null }) => {
      const { error } = await supabase.rpc(
        "descartar_evento_dominio" as never,
        { _id: id, _motivo: motivo } as never,
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento descartado.");
      qc.invalidateQueries({ queryKey: ["saude", "eventos-travados"] });
      qc.invalidateQueries({ queryKey: ["saude", "eventos"] });
    },
    onError: (e: Error) => {
      logger.error("evento.descartar_falha", { message: e.message });
      toast.error(e.message || "Falha ao descartar evento.");
    },
  });

  const onReprocessar = async (ev: EventoTravado) => {
    const ok = await confirm({
      title: "Reprocessar evento?",
      description: `Volta o evento ${ev.tipo} (${ev.agregado}) para a fila como pendente. Será re-tentado imediatamente.`,
      confirmLabel: "Reprocessar",
    });
    if (!ok) return;
    reprocessar.mutate(ev.id);
  };

  const onDescartar = async (ev: EventoTravado) => {
    const ok = await confirm({
      title: "Descartar evento?",
      description: `O evento ${ev.tipo} (${ev.agregado}) será marcado como descartado e não será mais processado. Ação registrada em auditoria.`,
      confirmLabel: "Descartar",
      tone: "destructive",
    });
    if (!ok) return;
    descartar.mutate({ id: ev.id, motivo: "descartado_via_dashboard" });
  };

  if (!isMaster) return null;
  const rows = q.data?.rows ?? [];

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Inbox className="h-5 w-5" /> Eventos travados
      </h2>
      {q.isError && <p className="text-sm text-destructive">Falha ao carregar eventos travados.</p>}
      <Card className="p-4">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum evento travado. (Considerados travados: <span className="font-mono">falhou_retry</span> com ≥5 tentativas ou <span className="font-mono">falhou</span> definitivo.)
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="text-left py-1">Tipo / agregado</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Tentativas</th>
                  <th className="text-left">Último erro</th>
                  <th className="text-left">Atualizado</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((ev) => (
                  <tr key={ev.id} className="border-t border-border align-top">
                    <td className="py-2">
                      <div className="font-mono text-xs">{ev.tipo}</div>
                      <div className="text-xs text-muted-foreground">
                        {ev.agregado}{ev.agregado_id ? ` · ${ev.agregado_id}` : ""}
                      </div>
                    </td>
                    <td>
                      <Badge variant={ev.status === "falhou" ? "destructive" : "secondary"}>
                        {ev.status}
                      </Badge>
                    </td>
                    <td className="tabular-nums">{ev.tentativas}</td>
                    <td className="max-w-md">
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {ev.ultimo_erro ?? "—"}
                      </p>
                    </td>
                    <td className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(ev.updated_at)}
                    </td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onReprocessar(ev)}
                          disabled={reprocessar.isPending || descartar.isPending}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reprocessar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onDescartar(ev)}
                          disabled={reprocessar.isPending || descartar.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Descartar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Ações restritas a MASTER. Cada reprocessamento/descartamento é registrado em <span className="font-mono">audit_log</span>.
        </p>
      </Card>
    </section>
  );
}

function AlertsBanner({ eventos, sla, cron, travados }: {
  eventos: EventosResp | null;
  sla: SlaResp | null;
  cron: CronResp | null;
  travados: { rows: unknown[]; gerado_em: string } | null;
}) {
  const [breakers, setBreakers] = useState<BreakerSnapshot[]>(() => listBreakers());
  useEffect(() => {
    setBreakers(listBreakers());
    const off = subscribeBreakers(() => setBreakers(listBreakers()));
    const iv = setInterval(() => setBreakers(listBreakers()), 5_000);
    return () => { off(); clearInterval(iv); };
  }, []);

  const alerts = computeSaudeAlerts({ eventos, sla, cron, travados, breakers });

  if (alerts.length === 0) {
    return (
      <Card className="p-4 border-emerald-500/40 bg-emerald-500/5">
        <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          Nenhum alerta ativo. Sistema operando dentro dos parâmetros.
        </div>
      </Card>
    );
  }

  const iconFor = (s: SaudeAlert["severity"]) =>
    s === "critical" ? <ShieldAlert className="h-4 w-4" />
    : s === "warn" ? <AlertTriangle className="h-4 w-4" />
    : <Info className="h-4 w-4" />;
  const toneFor = (s: SaudeAlert["severity"]) =>
    s === "critical" ? "border-destructive/50 bg-destructive/5 text-destructive"
    : s === "warn" ? "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300"
    : "border-border bg-muted/40 text-muted-foreground";

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Bell className="h-5 w-5" /> Alertas proativos
        <Badge variant="secondary">{alerts.length}</Badge>
      </h2>
      <div className="grid gap-2 md:grid-cols-2">
        {alerts.map((a) => (
          <div key={a.id} className={`rounded-md border p-3 text-sm ${toneFor(a.severity)}`}>
            <div className="flex items-center gap-2 font-medium">
              {iconFor(a.severity)} {a.title}
            </div>
            <p className="mt-1 text-xs opacity-90">{a.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function BreakersSection() {
  const [snap, setSnap] = useState<BreakerSnapshot[]>(() => listBreakers());
  const [lastReset, setLastReset] = useState<Record<string, number>>({});
  const confirm = useConfirm();
  useEffect(() => {
    const tick = () => setSnap(listBreakers());
    tick();
    const off = subscribeBreakers(tick);
    const iv = setInterval(tick, 5_000);
    return () => { off(); clearInterval(iv); };
  }, []);

  const badgeFor = (s: BreakerSnapshot) => {
    if (s.state === "open") return <Badge variant="destructive">aberto</Badge>;
    if (s.state === "half_open") return <Badge variant="secondary">meia-abertura</Badge>;
    return <Badge variant="outline">fechado</Badge>;
  };

  const RESET_COOLDOWN_MS = 5 * 60_000;
  const cooldownRemaining = (key: string) => {
    const last = lastReset[key];
    if (!last) return 0;
    return Math.max(0, RESET_COOLDOWN_MS - (Date.now() - last));
  };

  const onReset = async (s: BreakerSnapshot) => {
    const remaining = cooldownRemaining(s.key);
    if (remaining > 0) {
      toast.error(`Aguarde ${Math.ceil(remaining / 1000)}s antes de resetar novamente.`);
      return;
    }
    const ok = await confirm({
      title: "Forçar reset do disjuntor?",
      description: `Zera o contador de falhas de ${s.key} e fecha o circuito imediatamente. Use apenas após confirmar que a causa raiz foi resolvida.`,
      confirmLabel: "Resetar",
      tone: "destructive",
    });
    if (!ok) return;
    try {
      getBreaker(s.key).reset();
      setLastReset((prev) => ({ ...prev, [s.key]: Date.now() }));
      await auditClient.action("circuit_breaker.reset", {
        contexto: { breaker: s.key, estado_anterior: s.state, falhas_anteriores: s.failures },
      });
      logger.info("circuit_breaker.reset", { key: s.key, from: s.state });
      toast.success(`Disjuntor ${s.key} resetado.`);
      setSnap(listBreakers());
    } catch (e) {
      const err = e as Error;
      logger.error("circuit_breaker.reset_falha", { key: s.key, message: err.message });
      toast.error("Falha ao registrar reset em auditoria.");
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Zap className="h-5 w-5" /> Disjuntores de RPC
      </h2>
      <Card className="p-4">
        {snap.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum disjuntor registrado ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="text-left py-1">RPC</th>
                <th className="text-left">Estado</th>
                <th className="text-left">Falhas (janela)</th>
                <th className="text-left">Tripes</th>
                <th className="text-left">Próxima tentativa</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {snap.map((s) => (
                <tr key={s.key} className="border-t border-border">
                  <td className="py-1 font-mono text-xs">{s.key}</td>
                  <td>{badgeFor(s)}</td>
                  <td>{s.failures}</td>
                  <td>{s.totalTrips}</td>
                  <td className="text-xs text-muted-foreground">
                    {s.state === "open" && s.nextAttemptAt ? formatDateTime(new Date(s.nextAttemptAt).toISOString()) : "—"}
                  </td>
                  <td className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onReset(s)}
                      disabled={cooldownRemaining(s.key) > 0}
                      title={cooldownRemaining(s.key) > 0
                        ? `Aguarde ${Math.ceil(cooldownRemaining(s.key) / 1000)}s`
                        : "Zerar contador e fechar circuito"}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Forçar reset
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Regra: 5 falhas em 30s abrem o disjuntor por 60s. Em meia-abertura, uma requisição de teste decide se ele
          volta a fechar ou reabre por mais 60s. Fallback degradado seguro é aplicado quando disponível.
          Ações de <span className="font-mono">Forçar reset</span> são registradas em auditoria
          (<span className="font-mono">circuit_breaker.reset</span>) e limitadas a 1 por breaker a cada 5 minutos no cliente.
        </p>
      </Card>
    </section>
  );
}