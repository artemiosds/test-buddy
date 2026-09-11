import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Download,
  RefreshCw,
  Users,
  Building2,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  Clock,
  CalendarRange,
} from "lucide-react";

import { useAnalytics, type AnalyticsFilters as AF } from "@/hooks/use-analytics";
import { useUnitScope } from "@/hooks/use-unit-scope";
import { useCompetenciasLookup, useUnidadesLookup } from "@/hooks/use-lookups";
import { formatCompetencia } from "@/lib/formatters";
import { AnalyticsFilterProvider } from "@/context/analytics-filter-context";
import {
  PageHeader,
  KpiCard,
  FilterBar,
  DataTable,
  type DataTableColumn,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { BotaoRelatorioAbnt } from "@/components/relatorios-gerenciais/botao-relatorio-abnt";
import { relatorioPainelAbnt } from "@/lib/painel-abnt";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadCsv } from "@/lib/csv-export";
import { useContext } from "react";
import { AnalyticsFilterContext } from "@/context/analytics-filter-context";
import type { RankingRow } from "@/lib/analytics-aggregations";

export const Route = createFileRoute("/_authenticated/gestao-rh")({ 
  errorComponent: ErrorComponent,
  component: () => (
    <AnalyticsFilterProvider>
      <GestaoRhContent />
    </AnalyticsFilterProvider>
  ),
});

const NONE = "__all__";

function GestaoRhContent() {
  const ctx = useContext(AnalyticsFilterContext);
  const setFilters = ctx.setFilters!;
  const { unidadePadraoId, isMaster } = useUnitScope();

  const filters: AF = {
    competenciaId: ctx.competenciaId ?? null,
    unidadeId: ctx.unidadeId || (!isMaster ? unidadePadraoId : null),
    setorId: ctx.setorId ?? null,
    cargoId: ctx.cargoId ?? null,
    funcaoId: ctx.funcaoId ?? null,
    vinculoId: ctx.vinculoId ?? null,
  };

  const a = useAnalytics(filters);
  const rankingData = a.ranking;

  const { data: competencias } = useCompetenciasLookup();
  const { data: unidades } = useUnidadesLookup({ ativasOnly: true });

  const competenciaLabel = useMemo(() => {
    const id = filters.competenciaId ?? a.competenciaId;
    const c = competencias?.find((x) => x.id === id);
    if (!c) return "—";
    return formatCompetencia(c.mes, c.ano, "num");
  }, [filters.competenciaId, a.competenciaId, competencias]);

  // Números de força de trabalho pela regra institucional única
  // (src/lib/kpis-forca-trabalho.ts) — os mesmos de Profissionais.
  const kpisSit = a.kpisSituacao.data;

  const kpis = [
    {
      label: "Profissionais",
      value: kpisSit.total || (a.totalProfessionals.data ?? 0),
      loading: a.totalProfessionals.isLoading,
      icon: <Users className="h-4 w-4" />,
    },
    {
      label: "Ativos",
      value: kpisSit.ativos,
      loading: a.kpisSituacao.isLoading,
      hint: "Em exercício + férias + licença prêmio",
      icon: <Users className="h-4 w-4" />,
    },
    {
      label: "Disponível p/ escala",
      value: kpisSit.disponiveis,
      loading: a.kpisSituacao.isLoading,
      hint: "Em exercício pleno hoje",
      icon: <Users className="h-4 w-4" />,
    },
    {
      label: "Afastados",
      value: kpisSit.afastados,
      loading: a.kpisSituacao.isLoading,
      hint: "Afastamentos e licenças legais",
      icon: <AlertCircle className="h-4 w-4" />,
    },
    {
      label: "Unidades ativas",
      value: a.totalUnidades.data ?? 0,
      loading: a.totalUnidades.isLoading,
      icon: <Building2 className="h-4 w-4" />,
    },
    { label: "Competência", value: competenciaLabel, icon: <CalendarRange className="h-4 w-4" /> },
    {
      label: "Frequências enviadas",
      value: a.totals.totalFolhas - a.totals.folhasPendentes - a.totals.folhasAprovadas, // Aproximação de enviadas
      loading: a.loading,
      hint: "Enviadas / em análise / com pendências",
      icon: <ClipboardList className="h-4 w-4" />,
    },
    {
      label: "Frequências pendentes",
      value: a.totals.folhasPendentes,
      loading: a.loading,
      hint: "Ainda em rascunho",
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: "Frequências aprovadas",
      value: a.totals.folhasAprovadas,
      loading: a.loading,
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
    {
      label: "Horas extras (total)",
      value: a.totals.horasExtras.toLocaleString("pt-BR"),
      loading: a.loading,
      hint: "Somatório da competência",
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: "Faltas (total)",
      value: a.totals.faltas.toLocaleString("pt-BR"),
      loading: a.loading,
      icon: <AlertCircle className="h-4 w-4" />,
    },
    {
      label: "Pendências abertas",
      value: a.pendencias.data ?? 0,
      loading: a.pendencias.isLoading,
      hint: "Filtro por unidade aplicado via join",
      icon: <AlertCircle className="h-4 w-4" />,
    },
  ];

  const rankingColumns: DataTableColumn<RankingRow>[] = [
    { key: "pos", header: "#", cell: (_) => "", className: "w-10 text-muted-foreground" },
    {
      key: "unidade",
      header: "Unidade",
      cell: (r) => (r.unidade_sigla ? `${r.unidade_sigla} — ${r.unidade_nome}` : r.unidade_nome),
      className: "font-medium",
    },
    {
      key: "profs",
      header: "Profissionais",
      cell: (r) => r.total_profissionais.toLocaleString("pt-BR"),
      className: "text-right tabular-nums",
    },
    {
      key: "he",
      header: "Horas extras",
      cell: (r) => r.total_horas_extras.toLocaleString("pt-BR"),
      className: "text-right tabular-nums",
    },
    {
      key: "faltas",
      header: "Faltas",
      cell: (r) => r.total_faltas.toLocaleString("pt-BR"),
      className: "text-right tabular-nums",
    },
    {
      key: "aprov",
      header: "Folhas aprovadas",
      cell: (r) => `${r.aprovadas}/${r.total_folhas}`,
      className: "text-right tabular-nums",
    },
  ];

  const rankingRows = rankingData.map((r, i) => ({ ...r, _pos: i + 1 }));
  const rankingColumnsWithPos: DataTableColumn<(typeof rankingRows)[number]>[] = [
    { key: "pos", header: "#", cell: (r) => r._pos, className: "w-10 text-muted-foreground" },
    ...rankingColumns.slice(1),
  ];

  const exportRanking = () => {
    downloadCsv(
      `ranking-unidades-${filters.competenciaId ?? a.competenciaId ?? "atual"}`,
      rankingRows,
      [
        { header: "Posição", value: (r) => r._pos },
        { header: "Unidade", value: (r) => r.unidade_nome },
        { header: "Sigla", value: (r) => r.unidade_sigla },
        { header: "Profissionais", value: (r) => r.total_profissionais },
        { header: "Horas extras", value: (r) => r.total_horas_extras },
        { header: "Faltas", value: (r) => r.total_faltas },
        { header: "Folhas aprovadas", value: (r) => r.aprovadas },
        { header: "Total folhas", value: (r) => r.total_folhas },
      ],
    );
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Dashboard Executivo — RH"
        description={`Indicadores da competência ${competenciaLabel}. Filtre por unidade para ver o recorte específico.`}
        actions={
          <>
            <BotaoRelatorioAbnt
              label="Imprimir PDF (ABNT)"
              variant="outline"
              disabled={a.loading}
              relatorio={() =>
                relatorioPainelAbnt({
                  arquivo: "dashboard-executivo-rh",
                  titulo: "Dashboard Executivo — RH",
                  subtitulo: `Indicadores da competência ${competenciaLabel}`,
                  orientacao: "landscape",
                  filtros: [
                    { label: "Competência", valor: competenciaLabel },
                    {
                      label: "Unidade",
                      valor: filters.unidadeId
                        ? unidades?.find((u) => u.id === filters.unidadeId)?.nome ?? "—"
                        : "Todas",
                    },
                  ],
                  kpis: kpis.map((k) => ({ label: k.label, valor: String(k.value) })),
                  registros: rankingRows.length,
                  blocos: [
                    {
                      titulo: "Ranking de unidades",
                      head: [
                        "#",
                        "Unidade",
                        "Profissionais",
                        "Horas extras",
                        "Faltas",
                        "Folhas aprovadas",
                      ],
                      body: rankingRows.map((r) => [
                        r._pos,
                        r.unidade_sigla ? `${r.unidade_sigla} — ${r.unidade_nome}` : r.unidade_nome,
                        r.total_profissionais,
                        r.total_horas_extras,
                        r.total_faltas,
                        `${r.aprovadas}/${r.total_folhas}`,
                      ]),
                      align: ["right", "left", "right", "right", "right", "right"],
                      keepTogether: false,
                    },
                  ],
                  graficos: [
                    {
                      tipo: "barras",
                      titulo: "Profissionais por unidade",
                      dados: rankingRows.map((r) => ({
                        label: r.unidade_sigla ?? r.unidade_nome,
                        valor: r.total_profissionais,
                      })),
                      limite: 12,
                    },
                  ],
                  notas: [
                    "Ativos = em exercício + férias + licença prêmio; Disponível para escala = apenas em exercício pleno.",
                  ],
                })
              }
            />
            <Button variant="outline" size="sm" onClick={() => void a.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportRanking}
              disabled={rankingRows.length === 0}
            >
              <Download className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
          </>
        }

      />

      <FilterBar>
        <FilterBar.Field label="Competência">
          <Select
            value={filters.competenciaId ?? NONE}
            onValueChange={(v) => setFilters({ competenciaId: v === NONE ? null : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Ativa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Ativa</SelectItem>
              {competencias?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {formatCompetencia(c.mes, c.ano, "num")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
        {isMaster && (
          <FilterBar.Field label="Unidade">
            <Select
              value={filters.unidadeId ?? NONE}
              onValueChange={(v) => setFilters({ unidadeId: v === NONE ? null : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Todas</SelectItem>
                {unidades?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.sigla ? `${u.sigla} — ${u.nome}` : u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterBar.Field>
        )}
      </FilterBar>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            loading={k.loading}
            hint={k.hint}
            icon={k.icon}
          />
        ))}
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-semibold">Ranking de unidades — competência atual</h2>
        <DataTable
          columns={rankingColumnsWithPos}
          rows={rankingRows}
          getRowKey={(r) => r.unidade_id}
          loading={a.loading}
          emptyTitle="Sem folhas de frequência nesta competência"
          emptyDescription="Assim que as unidades iniciarem folhas na competência selecionada, o ranking aparece aqui."
        />
      </section>
    </div>
  );
}
