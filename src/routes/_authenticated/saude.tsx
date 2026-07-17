import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, AlertTriangle, Clock, RefreshCw, ShieldAlert, Timer } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-permissions";
import { formatDateTime } from "@/lib/formatters";

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
      const { data, error } = await supabase.rpc("health_eventos_dominio" as never);
      if (error) throw error;
      return data as unknown as EventosResp;
    },
  });
  const slaQ = useQuery({
    queryKey: ["saude", "sla"],
    enabled: isMaster,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("health_pendencias_sla" as never);
      if (error) throw error;
      return data as unknown as SlaResp;
    },
  });
  const cronQ = useQuery({
    queryKey: ["saude", "cron"],
    enabled: isMaster,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("health_cron_jobs" as never);
      if (error) throw error;
      return data as unknown as CronResp;
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
  const refetchAll = () => {
    void eventosQ.refetch(); void slaQ.refetch(); void cronQ.refetch();
  };

  const pendentes = (ev?.por_status?.["pendente"] ?? 0) + (ev?.por_status?.["falhou_retry"] ?? 0);
  const falhou = ev?.por_status?.["falhou"] ?? 0;

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
    </div>
  );
}