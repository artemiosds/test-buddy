import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { blocosPdfCompletos } from "@/lib/pdf-blocos-completos";

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
import { ConsolidacaoOficialPanel, exportarDetalheCsv, linhasDaVisao, type VisaoOficial } from "@/components/relatorios/consolidacao-oficial-panel";
import { AlertasComparativoPanel } from "@/components/relatorios/alertas-comparativo-panel";
import { AnalisesAvancadasPanel } from "@/components/relatorios/analises-avancadas-panel";

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

  const [visao, setVisao] = useState<VisaoOficial>("consolidado");
  const a = useAnalytics({ ...filters, tipo: "all" });
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
      label: "Folhas em análise / devolvidas",
      value: a.totals.folhasPendentes,
      loading: a.loading,
      hint: "Enviadas, em análise, com pendências ou devolvidas",
      icon: <ClipboardList className="h-4 w-4" />,
    },
    {
      label: "Folhas em rascunho",
      value: a.totals.folhasRascunho,
      loading: a.loading,
      hint: "Ainda não enviadas",
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: "Folhas aprovadas",
      value: `${a.totals.folhasAprovadas}/${a.totals.totalFolhas}`,
      loading: a.loading,
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
    {
      label: "HE 50% (aprovadas)",
      value: (a.oficial?.[visao].he50 ?? 0).toLocaleString("pt-BR"),
      loading: a.loading,
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: "HE 100% (aprovadas)",
      value: (a.oficial?.[visao].he100 ?? 0).toLocaleString("pt-BR"),
      loading: a.loading,
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: "Horas extras total (aprovadas)",
      value: (a.oficial?.[visao].heTotal ?? 0).toLocaleString("pt-BR"),
      loading: a.loading,
      hint: "HE 50% + HE 100%, somente folhas aprovadas",
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: "Dias trabalhados (aprovadas)",
      value: (a.oficial?.[visao].diasTrabalhados ?? 0).toLocaleString("pt-BR"),
      loading: a.loading,
      icon: <CalendarRange className="h-4 w-4" />,
    },
    {
      label: "Faltas (aprovadas)",
      value: (a.oficial?.[visao].faltas ?? 0).toLocaleString("pt-BR"),
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
              relatorio={async () =>
                relatorioPainelAbnt({
                  arquivo: "dashboard-executivo-rh",
                  titulo: "Dashboard Executivo — RH",
                  subtitulo: `Indicadores da competência ${competenciaLabel}`,
                  orientacao: "landscape",
                  filtros: [
                    { label: "Competência", valor: competenciaLabel },
                    { label: "Visão", valor: visao === "consolidado" ? "Consolidado" : visao === "efetivos" ? "Efetivos" : "Contratados" },
                    { label: "Fonte", valor: "Somente folhas aprovadas" },
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
                    ...(await blocosPdfCompletos({ oficial: a.oficial, visao, competenciaId: filters.competenciaId ?? a.competenciaId, unidadeId: filters.unidadeId })),
                    {
                      titulo: "Ranking de unidades (somente aprovadas)",
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
                    "Frequência oficial: somente lançamentos de folhas aprovadas, cada profissional contado uma vez por unidade. HE total = HE 50% + HE 100% (em horas).",
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
              onClick={() => exportarDetalheCsv(`dashboard-rh-${visao}-${filters.competenciaId ?? a.competenciaId ?? "atual"}`, linhasDaVisao(a.oficial, visao))}
              disabled={rankingRows.length === 0}
            >
              <Download className="mr-2 h-4 w-4" /> Exportar CSV (detalhado)
            </Button>
            <Button variant="outline" size="sm" onClick={exportRanking}>
              <Download className="mr-2 h-4 w-4" /> CSV ranking
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

      <ConsolidacaoOficialPanel
        oficial={a.oficial}
        loading={a.loading}
        visao={visao}
        onVisaoChange={setVisao}
        arquivoBase={`dashboard-rh-${filters.competenciaId ?? a.competenciaId ?? "atual"}`}
      />
      <AlertasComparativoPanel
        oficial={a.oficial}
        visao={visao}
        competenciaId={filters.competenciaId ?? a.competenciaId ?? null}
        unidadeId={filters.unidadeId}
        arquivoBase={`dashboard-rh-${filters.competenciaId ?? a.competenciaId ?? "atual"}`}
      />
      <AnalisesAvancadasPanel
        oficial={a.oficial}
        visao={visao}
        competenciaId={filters.competenciaId ?? a.competenciaId ?? null}
        unidadeId={filters.unidadeId}
        arquivoBase={`dashboard-rh-${filters.competenciaId ?? a.competenciaId ?? "atual"}`}
      />


      <section className="mt-6">
        <h2 className="mb-2 text-lg font-semibold">Ranking de unidades — somente lançamentos aprovados</h2>
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
