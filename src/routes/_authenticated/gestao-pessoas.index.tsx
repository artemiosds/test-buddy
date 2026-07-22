import { createFileRoute, Link, retainSearchParams } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Users,
  UserCheck,
  UserMinus,
  Umbrella,
  FileText,
  UserX,
  Briefcase,
  Building2,
  Network,
  Tag,
  AlertCircle,
  Clock,
  CalendarRange,
  ShieldAlert,
  LayoutDashboard,
  Activity,
  ChevronRight,
} from "lucide-react";

import { useAnalytics } from "@/hooks/use-analytics";
import { useIntelligence } from "@/hooks/use-intelligence";
import { buildWorkforceAlertItems } from "@/lib/workforce-alerts";
import { EmptyState, KpiCard, PageHeader, StatusBadge, FilterBar } from "@/components/shared";
import { PermissionGate } from "@/components/permission-gate";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SemaforoCard,
  TendenciaKpi,
  IntegridadeCard,
  InsightsCard,
} from "@/components/intelligence";
import { useNavigate } from "@tanstack/react-router";
import { useCompetenciaAtiva } from "@/hooks/use-competencia-ativa";
import { useCompetenciasLookup, useUnidadesLookup } from "@/hooks/use-lookups";
import {
  workforceFiltersValidator,
  resolveWorkforceFilters,
  mergeWorkforceFilters,
  WORKFORCE_FILTER_KEYS,
  type WorkforceFilters,
} from "@/lib/workforce-filters";

export const Route = createFileRoute("/_authenticated/gestao-pessoas/")({
  validateSearch: workforceFiltersValidator,
  search: { middlewares: [retainSearchParams([...WORKFORCE_FILTER_KEYS])] },
  head: () => ({
    meta: [
      { title: "Dashboard Executivo — Gestão da Saúde" },
      {
        name: "description",
        content: "Visão executiva consolidada de pessoas, estrutura e operação.",
      },
    ],
  }),
  component: () => (
    <PermissionGate
      permission="dashboard.visualizar"
      fallback={
        <div className="p-6 text-sm text-muted-foreground">
          Sem permissão para visualizar este painel.
        </div>
      }
    >
      <DashboardExecutivo />
    </PermissionGate>
  ),
});

function n(v: number | undefined | null) {
  return (v ?? 0).toLocaleString("pt-BR");
}

function DashboardExecutivo() {
  const search = Route.useSearch();
  const routeNavigate = useNavigate({ from: Route.fullPath });
  const { data: competenciaAtiva } = useCompetenciaAtiva();
  const competenciasQ = useCompetenciasLookup();
  const unidadesQ = useUnidadesLookup({ ativasOnly: true });
  const resolved = resolveWorkforceFilters(search, competenciaAtiva?.id ?? null);
  const compSel = search.competencia === "" ? "__ativa__" : search.competencia;
  const unidadeSel = search.unidade === "" ? "__all__" : search.unidade;
  const statusSel = search.status === "" ? "__all__" : search.status;
  const patchFilter = (patch: Partial<WorkforceFilters>) =>
    routeNavigate({
      search: (prev: WorkforceFilters) => mergeWorkforceFilters(prev, patch),
      replace: true,
    });

  const a = useAnalytics({
    competenciaId: resolved.competenciaId,
    unidadeId: resolved.unidadeId,
    status: resolved.status,
  });
  const intel = useIntelligence(a);
  const navigate = useNavigate();

  const competenciaLabel = (mes: number, ano: number) => `${String(mes).padStart(2, "0")}/${ano}`;

  const status = a.statusBreakdown.data ?? {};
  const vinc = a.vinculoBreakdown.data;

  const topUnidades = useMemo(
    () => (a.distribuicaoUnidade.data ?? []).slice(0, 10),
    [a.distribuicaoUnidade.data],
  );
  const topCargos = useMemo(
    () => (a.distribuicaoCargo.data ?? []).slice(0, 10),
    [a.distribuicaoCargo.data],
  );

  const alertItems = useMemo(
    () =>
      buildWorkforceAlertItems({
        alertas: a.alertas.data,
        // O Dashboard Executivo não faz a query de "pendências vencidas"
        // (isso é da Sala de Situação). Usamos 0 aqui — a fonte oficial
        // continua a Sala de Situação, evitando divergência de números.
        pendenciasVencidas: 0,
      }),
    [a.alertas.data],
  );

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Dashboard Executivo"
        description="Visão consolidada de pessoas, estrutura e operação — dados em tempo real."
      />

      <div className="mt-4">
        <SemaforoCard
          semaforo={intel.semaforo}
          loading={intel.isLoading}
          lastUpdated={a.lastUpdated}
          onRefresh={() => a.refetch()}
        />
      </div>

      <div className="mt-4">
        <FilterBar>
          <FilterBar.Field label="Unidade">
            <Select
              value={unidadeSel}
              onValueChange={(v) => patchFilter({ unidade: v === "__all__" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {(unidadesQ.data ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.sigla ? `${u.sigla} — ${u.nome}` : u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterBar.Field>
          <FilterBar.Field label="Status">
            <Select
              value={statusSel}
              onValueChange={(v) => patchFilter({ status: v === "__all__" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="afastado">Afastados</SelectItem>
                <SelectItem value="ferias">Férias</SelectItem>
                <SelectItem value="licenca">Licenças</SelectItem>
                <SelectItem value="desligado">Desligados</SelectItem>
              </SelectContent>
            </Select>
          </FilterBar.Field>
          <FilterBar.Field label="Período">
            <Select
              value={compSel}
              onValueChange={(v) => patchFilter({ competencia: v === "__ativa__" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__ativa__">
                  Ativa{" "}
                  {competenciaAtiva
                    ? `(${competenciaLabel(competenciaAtiva.mes, competenciaAtiva.ano)})`
                    : ""}
                </SelectItem>
                {(competenciasQ.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {competenciaLabel(c.mes, c.ano)}
                    {c.status ? ` · ${c.status}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterBar.Field>
        </FilterBar>
      </div>

      <Section title="Blocos funcionais">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <BlockCard
            to="/sala-situacao"
            title="Visão Executiva"
            description="Sala de Situação, Dashboard RH e Indicadores."
            icon={<LayoutDashboard className="h-5 w-5" />}
            accent="📊"
          />
          <BlockCard
            to="/profissionais"
            title="Profissionais"
            description="Cadastro, gestão e situação funcional."
            icon={<Users className="h-5 w-5" />}
            accent="👥"
          />
          <BlockCard
            to="/unidades"
            title="Estrutura Organizacional"
            description="Unidades, setores, cargos e funções."
            icon={<Building2 className="h-5 w-5" />}
            accent="🏥"
          />
          <BlockCard
            to="/controle-forca-trabalho"
            title="Gestão Operacional"
            description="Força de trabalho, lotação e distribuição."
            icon={<Activity className="h-5 w-5" />}
            accent="📍"
          />
        </div>
      </Section>

      <Section title="Tendências (vs. período anterior)">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <TendenciaKpi label="Horas extras" tendencia={intel.tendencias.horasExtras} invertBad />
          <TendenciaKpi label="Faltas" tendencia={intel.tendencias.faltas} invertBad />
          <TendenciaKpi
            label="Pendências abertas"
            tendencia={intel.tendencias.pendencias}
            invertBad
          />
          <TendenciaKpi label="Frequências aprovadas" tendencia={intel.tendencias.aprovadas} />
        </div>
      </Section>

      <Section title="Pessoas">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Total de profissionais"
            value={n(a.totalProfessionals.data)}
            loading={a.totalProfessionals.isLoading}
            icon={<Users className="h-4 w-4" />}
          />
          <KpiCard
            label="Ativos"
            value={n(status["ativo"])}
            loading={a.statusBreakdown.isLoading}
            tone="success"
            icon={<UserCheck className="h-4 w-4" />}
          />
          <KpiCard
            label="Afastados"
            value={n(status["afastado"])}
            loading={a.statusBreakdown.isLoading}
            tone="warning"
            icon={<UserMinus className="h-4 w-4" />}
          />
          <KpiCard
            label="Férias"
            value={n(status["ferias"])}
            loading={a.statusBreakdown.isLoading}
            icon={<Umbrella className="h-4 w-4" />}
          />
          <KpiCard
            label="Licenças"
            value={n(status["licenca"])}
            loading={a.statusBreakdown.isLoading}
            icon={<FileText className="h-4 w-4" />}
          />
          <KpiCard
            label="Desligados"
            value={n(status["desligado"])}
            loading={a.statusBreakdown.isLoading}
            tone="danger"
            icon={<UserX className="h-4 w-4" />}
          />
          <KpiCard
            label="Efetivos"
            value={n(vinc?.efetivos)}
            loading={a.vinculoBreakdown.isLoading}
            icon={<Briefcase className="h-4 w-4" />}
          />
          <KpiCard
            label="Temporários"
            value={n(vinc?.temporarios)}
            loading={a.vinculoBreakdown.isLoading}
            icon={<Briefcase className="h-4 w-4" />}
          />
        </div>
      </Section>

      <Section title="Estrutura">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Total de unidades"
            value={n(a.totalUnidades.data)}
            loading={a.totalUnidades.isLoading}
            icon={<Building2 className="h-4 w-4" />}
          />
          <KpiCard
            label="Total de setores"
            value={n(a.totalSetores.data)}
            loading={a.totalSetores.isLoading}
            icon={<Network className="h-4 w-4" />}
          />
          <KpiCard
            label="Total de cargos"
            value={n(a.totalCargos.data)}
            loading={a.totalCargos.isLoading}
            icon={<Briefcase className="h-4 w-4" />}
          />
          <KpiCard
            label="Total de funções"
            value={n(a.totalFuncoes.data)}
            loading={a.totalFuncoes.isLoading}
            icon={<Tag className="h-4 w-4" />}
          />
        </div>
      </Section>

      <Section title="Operação">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Pendências abertas"
            value={n(a.pendencias.data)}
            loading={a.pendencias.isLoading}
            icon={<AlertCircle className="h-4 w-4" />}
          />
          <KpiCard
            label="Horas extras (total)"
            value={n(a.totalHorasExtras)}
            loading={a.frequencias.isLoading}
            hint="Somatório do período ativo"
            icon={<Clock className="h-4 w-4" />}
          />
          <KpiCard
            label="Faltas (total)"
            value={n(a.totalFaltas)}
            loading={a.frequencias.isLoading}
            hint="Somatório do período ativo"
            icon={<AlertCircle className="h-4 w-4" />}
          />
          <KpiCard
            label="Período ativo"
            value={a.competenciaAtiva?.label ?? "—"}
            icon={<CalendarRange className="h-4 w-4" />}
          />
        </div>
      </Section>

      <Section title="Integridade & Inteligência">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <IntegridadeCard
            integridade={intel.integridade}
            onCampoClick={(chave) => {
              const map: Record<string, string> = {
                cargo: "sem-cargo",
                funcao: "sem-funcao",
                setor: "sem-setor",
                unidade: "sem-unidade",
                vinculo: "sem-vinculo",
              };
              const filtro = map[chave];
              if (filtro) {
                navigate({ to: "/profissionais", search: { integridade: filtro } as never });
              } else {
                navigate({ to: "/profissionais" });
              }
            }}
          />
          <InsightsCard insights={intel.insights} />
        </div>
      </Section>

      <Section title="Alertas de Força de Trabalho" icon={<ShieldAlert className="h-4 w-4" />}>
        {a.alertas.isLoading ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            Carregando alertas…
          </div>
        ) : alertItems.every((i) => i.count === 0) ? (
          <EmptyState
            title="Nenhum alerta ativo"
            description="Todos os cadastros críticos estão preenchidos."
          />
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {alertItems.map((i) => (
              <div
                key={i.id}
                className={
                  "flex items-center justify-between gap-2 rounded-md border p-3 text-sm " +
                  (i.count > 0 ? "border-warning-soft-foreground/30 bg-warning-soft/30" : "")
                }
              >
                <span className="flex-1 text-foreground">{i.label}</span>
                <span
                  className={
                    "font-semibold tabular-nums " +
                    (i.count > 0 ? "text-warning-soft-foreground" : "text-muted-foreground")
                  }
                >
                  {n(i.count)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={i.count === 0}
                  onClick={() => navigate({ to: i.to, search: (i.search ?? {}) as never })}
                >
                  Ver detalhes
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Distribuição">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DistribuicaoTable
            title="Profissionais por unidade (top 10)"
            loading={a.distribuicaoUnidade.isLoading}
            rows={topUnidades.map((r) => ({
              id: r.id,
              nome: r.sigla ? `${r.sigla} — ${r.nome}` : r.nome,
              total: r.total,
            }))}
          />
          <DistribuicaoTable
            title="Profissionais por cargo (top 10)"
            loading={a.distribuicaoCargo.isLoading}
            rows={topCargos.map((r) => ({ id: r.id, nome: r.nome, total: r.total }))}
          />
        </div>
      </Section>

      {/* Referência de estados para o usuário */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(["ativo", "afastado", "ferias", "licenca", "desligado"] as const).map((s) => (
          <StatusBadge key={s} domain="profissional" value={s} />
        ))}
      </div>
    </div>
  );
}

function BlockCard({
  to,
  title,
  description,
  icon,
  accent,
}: {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <Link
      to={to}
      className="hover-lift group flex items-start gap-3 rounded-md border bg-card p-3 transition hover:border-primary/40 hover:bg-accent/40"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
          <span aria-hidden>{accent}</span>
          <span className="truncate">{title}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function DistribuicaoTable({
  title,
  rows,
  loading,
}: {
  title: string;
  rows: { id: string; nome: string; total: number }[];
  loading?: boolean;
}) {
  return (
    <div className="rounded-md border">
      <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {loading ? (
        <div className="p-4 text-sm text-muted-foreground">Carregando…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Sem dados" description="Nenhum registro para exibir." className="m-3" />
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="w-10 px-3 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2">{r.nome}</td>
                <td className="w-24 px-3 py-2 text-right font-medium tabular-nums">
                  {r.total.toLocaleString("pt-BR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
