import { createFileRoute } from "@tanstack/react-router";
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
} from "lucide-react";

import { useAnalytics } from "@/hooks/use-analytics";
import { EmptyState, KpiCard, PageHeader, StatusBadge } from "@/components/shared";

export const Route = createFileRoute("/_authenticated/gestao-pessoas/")({
  head: () => ({
    meta: [
      { title: "Dashboard Executivo — Gestão de Pessoas" },
      { name: "description", content: "Visão executiva consolidada de pessoas, estrutura e operação." },
    ],
  }),
  component: DashboardExecutivo,
});

function n(v: number | undefined | null) {
  return (v ?? 0).toLocaleString("pt-BR");
}

function DashboardExecutivo() {
  const a = useAnalytics({});

  const status = a.statusBreakdown.data ?? {};
  const vinc = a.vinculoBreakdown.data;
  const alertas = a.alertas.data;

  const topUnidades = useMemo(
    () => (a.distribuicaoUnidade.data ?? []).slice(0, 10),
    [a.distribuicaoUnidade.data],
  );
  const topCargos = useMemo(
    () => (a.distribuicaoCargo.data ?? []).slice(0, 10),
    [a.distribuicaoCargo.data],
  );

  const alertItems: { key: string; label: string; count: number }[] = alertas
    ? [
        { key: "u", label: "Profissionais sem unidade", count: alertas.semUnidade },
        { key: "s", label: "Profissionais sem setor", count: alertas.semSetor },
        { key: "c", label: "Profissionais sem cargo", count: alertas.semCargo },
        { key: "f", label: "Profissionais sem função", count: alertas.semFuncao },
        { key: "ug", label: "Unidades sem gestor", count: alertas.unidadesSemGestor },
        { key: "sv", label: "Setores vazios", count: alertas.setoresVazios },
      ]
    : [];

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Dashboard Executivo"
        description="Visão consolidada de pessoas, estrutura e operação — dados em tempo real."
      />

      <Section title="Pessoas">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Total de profissionais" value={n(a.totalProfessionals.data)} loading={a.totalProfessionals.isLoading} icon={<Users className="h-4 w-4" />} />
          <KpiCard label="Ativos" value={n(status["ativo"])} loading={a.statusBreakdown.isLoading} tone="success" icon={<UserCheck className="h-4 w-4" />} />
          <KpiCard label="Afastados" value={n(status["afastado"])} loading={a.statusBreakdown.isLoading} tone="warning" icon={<UserMinus className="h-4 w-4" />} />
          <KpiCard label="Férias" value={n(status["ferias"])} loading={a.statusBreakdown.isLoading} icon={<Umbrella className="h-4 w-4" />} />
          <KpiCard label="Licenças" value={n(status["licenca"])} loading={a.statusBreakdown.isLoading} icon={<FileText className="h-4 w-4" />} />
          <KpiCard label="Desligados" value={n(status["desligado"])} loading={a.statusBreakdown.isLoading} tone="danger" icon={<UserX className="h-4 w-4" />} />
          <KpiCard label="Efetivos" value={n(vinc?.efetivos)} loading={a.vinculoBreakdown.isLoading} icon={<Briefcase className="h-4 w-4" />} />
          <KpiCard label="Temporários" value={n(vinc?.temporarios)} loading={a.vinculoBreakdown.isLoading} icon={<Briefcase className="h-4 w-4" />} />
        </div>
      </Section>

      <Section title="Estrutura">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Total de unidades" value={n(a.totalUnidades.data)} loading={a.totalUnidades.isLoading} icon={<Building2 className="h-4 w-4" />} />
          <KpiCard label="Total de setores" value={n(a.totalSetores.data)} loading={a.totalSetores.isLoading} icon={<Network className="h-4 w-4" />} />
          <KpiCard label="Total de cargos" value={n(a.totalCargos.data)} loading={a.totalCargos.isLoading} icon={<Briefcase className="h-4 w-4" />} />
          <KpiCard label="Total de funções" value={n(a.totalFuncoes.data)} loading={a.totalFuncoes.isLoading} icon={<Tag className="h-4 w-4" />} />
        </div>
      </Section>

      <Section title="Operação">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Pendências abertas" value={n(a.pendencias.data)} loading={a.pendencias.isLoading} icon={<AlertCircle className="h-4 w-4" />} />
          <KpiCard label="Horas extras (total)" value={n(a.totalHorasExtras)} loading={a.frequencias.isLoading} hint="Somatório da competência ativa" icon={<Clock className="h-4 w-4" />} />
          <KpiCard label="Faltas (total)" value={n(a.totalFaltas)} loading={a.frequencias.isLoading} hint="Somatório da competência ativa" icon={<AlertCircle className="h-4 w-4" />} />
          <KpiCard label="Competência ativa" value={a.competenciaAtiva?.label ?? "—"} icon={<CalendarRange className="h-4 w-4" />} />
        </div>
      </Section>

      <Section title="Alertas" icon={<ShieldAlert className="h-4 w-4" />}>
        {a.alertas.isLoading ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">Carregando alertas…</div>
        ) : alertItems.every((i) => i.count === 0) ? (
          <EmptyState title="Nenhum alerta ativo" description="Todos os cadastros críticos estão preenchidos." />
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {alertItems.map((i) => (
              <div
                key={i.key}
                className={
                  "flex items-center justify-between rounded-md border p-3 text-sm " +
                  (i.count > 0 ? "border-warning-soft-foreground/30 bg-warning-soft/30" : "")
                }
              >
                <span className="text-foreground">{i.label}</span>
                <span className={"font-semibold tabular-nums " + (i.count > 0 ? "text-warning-soft-foreground" : "text-muted-foreground")}>
                  {n(i.count)}
                </span>
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
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
                <td className="w-24 px-3 py-2 text-right font-medium tabular-nums">{r.total.toLocaleString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}