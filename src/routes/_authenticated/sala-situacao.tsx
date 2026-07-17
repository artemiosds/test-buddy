import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { retainSearchParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users, Building2, Network, ClipboardList, AlertCircle, Clock, CalendarRange,
  RefreshCw, ShieldAlert, UserCheck, UserMinus, Umbrella, FileText, ArrowRight,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAnalytics } from "@/hooks/use-analytics";
import { useIntelligence } from "@/hooks/use-intelligence";
import { useCompetenciaAtiva } from "@/hooks/use-competencia-ativa";
import {
  useCompetenciasLookup, useUnidadesLookup,
} from "@/hooks/use-lookups";
import { ALERT_RULES } from "@/lib/sala-situacao-alerts";
import { buildWorkforceAlertItems } from "@/lib/workforce-alerts";
import {
  workforceFiltersValidator,
  resolveWorkforceFilters,
  mergeWorkforceFilters,
  WORKFORCE_FILTER_KEYS,
  type WorkforceFilters,
} from "@/lib/workforce-filters";
import {
  PageHeader, KpiCard, DataTable, EmptyState, FilterBar,
  type DataTableColumn,
} from "@/components/shared";
import { PermissionGate } from "@/components/permission-gate";
import {
  SemaforoCard,
  TendenciaKpi,
  InsightsCard,
} from "@/components/intelligence";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/sala-situacao")({
  validateSearch: workforceFiltersValidator,
  search: { middlewares: [retainSearchParams([...WORKFORCE_FILTER_KEYS])] },
  component: () => (
    <PermissionGate
      permission="profissional.visualizar"
      fallback={<div className="p-6 text-sm text-muted-foreground">Sem permissão para visualizar este painel.</div>}
    >
      <SalaSituacaoPage />
    </PermissionGate>
  ),
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Erro: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Não encontrado.</div>,
});

const STATUS_LABEL = "Ativos|Afastados|Férias|Licenças".split("|");
const STATUS_VALUE = ["ativo", "afastado", "ferias", "licenca"];

function SalaSituacaoPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: competenciaAtiva } = useCompetenciaAtiva();
  const competenciasQ = useCompetenciasLookup();
  const unidadesQ = useUnidadesLookup({ ativasOnly: true });

  const { competenciaId, unidadeId, status } = resolveWorkforceFilters(
    search,
    competenciaAtiva?.id ?? null,
  );
  const compSel = search.competencia === "" ? "__ativa__" : search.competencia;
  const unidadeSel = search.unidade === "" ? "__all__" : search.unidade;
  const statusSel = search.status === "" ? "__all__" : search.status;
  const patchFilter = (patch: Parameters<typeof mergeWorkforceFilters>[1]) =>
    navigate({
      search: (prev: WorkforceFilters) => mergeWorkforceFilters(prev, patch),
      replace: true,
    });

  const a = useAnalytics({ competenciaId, unidadeId, status });
  const intel = useIntelligence(a);

  // Pendências críticas (vencidas) — regra ALERT_RULES.pendenciaDiasCritico.
  const pendCriticasQ = useQuery({
    queryKey: ["sala-situacao", "pend-criticas", unidadeId],
    staleTime: 60_000,
    queryFn: async () => {
      const cutoff = new Date(
        Date.now() - ALERT_RULES.pendenciaDiasCritico * 24 * 3600 * 1000,
      ).toISOString();
      let q = supabase
        .from("frequencia_pendencias")
        .select("id, titulo, status, created_at, frequencias!inner(competencia_unidades!inner(unidade_id, unidades(nome, sigla)))")
        .in("status", ["aberta", "respondida"])
        .is("deleted_at", null)
        .lt("created_at", cutoff)
        .order("created_at", { ascending: true })
        .limit(100);
      if (unidadeId) q = q.eq("frequencias.competencia_unidades.unidade_id", unidadeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        titulo: string | null;
        status: string;
        created_at: string;
        frequencias: {
          competencia_unidades: {
            unidade_id: string;
            unidades: { nome: string; sigla: string | null } | null;
          };
        };
      }>;
    },
  });

  // Últimas movimentações — origem: profissional_historico_funcional.
  const movQ = useQuery({
    queryKey: ["sala-situacao", "movimentacoes", unidadeId],
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase
        .from("profissional_historico_funcional")
        .select(
          "id, data_inicio, tipo_evento, profissional:profissionais(nome_completo), unidade_anterior:unidades!profissional_historico_funcional_unidade_anterior_id_fkey(nome, sigla), unidade_novo:unidades!profissional_historico_funcional_unidade_novo_id_fkey(nome, sigla)",
        )
        .is("deleted_at", null)
        .order("data_inicio", { ascending: false })
        .limit(10);
      if (unidadeId) {
        q = q.or(
          `unidade_novo_id.eq.${unidadeId},unidade_anterior_id.eq.${unidadeId}`,
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        data_inicio: string;
        tipo_evento: string;
        profissional: { nome_completo: string } | null;
        unidade_anterior: { nome: string; sigla: string | null } | null;
        unidade_novo: { nome: string; sigla: string | null } | null;
      }>;
    },
  });

  // Rankings vindos de useAnalytics (mesma fonte usada nas demais telas).
  const rankingUnidades = a.ranking.slice(0, 10);
  const rankingSetores = (a.distribuicaoSetor.data ?? []).slice(0, 10);
  const rankingCargos = (a.distribuicaoCargo.data ?? []).slice(0, 10);
  const rankingFuncoes = (a.distribuicaoFuncao.data ?? []).slice(0, 10);
  // "Maiores HE" — o dado disponível no modelo é por unidade (limitação
  // documentada no Módulo 05). Reordenamos o ranking por HE.
  const rankingHe = useMemo(
    () => [...a.ranking].sort((x, y) => y.total_horas_extras - x.total_horas_extras).slice(0, 10),
    [a.ranking],
  );
  // "Unidades críticas" — mais pendências vencidas.
  const rankingCriticas = useMemo(() => {
    const map = new Map<string, { unidade_id: string; unidade_nome: string; sigla: string | null; total: number }>();
    for (const p of pendCriticasQ.data ?? []) {
      const cu = p.frequencias?.competencia_unidades;
      if (!cu?.unidade_id) continue;
      const cur = map.get(cu.unidade_id) ?? {
        unidade_id: cu.unidade_id,
        unidade_nome: cu.unidades?.nome ?? "—",
        sigla: cu.unidades?.sigla ?? null,
        total: 0,
      };
      cur.total += 1;
      map.set(cu.unidade_id, cur);
    }
    return Array.from(map.values()).sort((x, y) => y.total - x.total).slice(0, 10);
  }, [pendCriticasQ.data]);

  // KPIs de status — quando "Todos", derivamos do statusBreakdown.
  const sb = a.statusBreakdown.data ?? {};
  const kpiAtivos = status ? (status === "ativo" ? a.totalProfessionals.data ?? 0 : 0) : sb["ativo"] ?? 0;
  const kpiAfast = status ? (status === "afastado" ? a.totalProfessionals.data ?? 0 : 0) : sb["afastado"] ?? 0;
  const kpiFerias = status ? (status === "ferias" ? a.totalProfessionals.data ?? 0 : 0) : sb["ferias"] ?? 0;
  const kpiLic = status ? (status === "licenca" ? a.totalProfessionals.data ?? 0 : 0) : sb["licenca"] ?? 0;

  const alertas = a.alertas.data;
  void alertas;

  const competenciaLabel = (mes: number, ano: number) =>
    `${String(mes).padStart(2, "0")}/${ano}`;

  // ---- Column defs ----
  const colsUnidades: DataTableColumn<(typeof a.ranking)[number]>[] = [
    { key: "u", header: "Unidade", cell: (r) => (
      <Link to="/unidades/$id" params={{ id: r.unidade_id }} className="font-medium hover:underline">
        {r.unidade_nome}
      </Link>
    ) },
    { key: "p", header: "Profissionais", cell: (r) => r.total_profissionais.toLocaleString("pt-BR") },
    { key: "f", header: "Folhas", cell: (r) => `${r.aprovadas}/${r.total_folhas}` },
  ];
  const colsSetores: DataTableColumn<{ id: string; nome: string; total: number }>[] = [
    { key: "s", header: "Setor", cell: (r) => (
      <Link to="/setores/$id" params={{ id: r.id }} className="font-medium hover:underline">{r.nome}</Link>
    ) },
    { key: "t", header: "Profissionais", cell: (r) => r.total.toLocaleString("pt-BR") },
  ];
  const colsCargos: DataTableColumn<{ id: string; nome: string; total: number }>[] = [
    { key: "c", header: "Cargo", cell: (r) => (
      <Link to="/cargos/$id" params={{ id: r.id }} className="font-medium hover:underline">{r.nome}</Link>
    ) },
    { key: "t", header: "Profissionais", cell: (r) => r.total.toLocaleString("pt-BR") },
  ];
  const colsFuncoes: DataTableColumn<{ id: string; nome: string; total: number }>[] = [
    { key: "f", header: "Função", cell: (r) => (
      <Link to="/funcoes/$id" params={{ id: r.id }} className="font-medium hover:underline">{r.nome}</Link>
    ) },
    { key: "t", header: "Profissionais", cell: (r) => r.total.toLocaleString("pt-BR") },
  ];
  const colsHe: DataTableColumn<(typeof a.ranking)[number]>[] = [
    { key: "u", header: "Unidade", cell: (r) => (
      <Link to="/unidades/$id" params={{ id: r.unidade_id }} className="font-medium hover:underline">
        {r.unidade_nome}
      </Link>
    ) },
    { key: "he", header: "Horas extras", cell: (r) => <span className="tabular-nums">{r.total_horas_extras.toLocaleString("pt-BR")}</span> },
    { key: "fl", header: "Faltas", cell: (r) => <span className="tabular-nums">{r.total_faltas.toLocaleString("pt-BR")}</span> },
  ];
  const colsCriticas: DataTableColumn<(typeof rankingCriticas)[number]>[] = [
    { key: "u", header: "Unidade", cell: (r) => (
      <Link to="/unidades/$id" params={{ id: r.unidade_id }} className="font-medium hover:underline">
        {r.unidade_nome}{r.sigla ? ` (${r.sigla})` : ""}
      </Link>
    ) },
    { key: "t", header: "Pendências vencidas", cell: (r) => <Badge variant="destructive">{r.total}</Badge> },
  ];

  const colsMov: DataTableColumn<NonNullable<typeof movQ.data>[number]>[] = [
    { key: "d", header: "Data", cell: (m) => (
      <span className="text-xs text-muted-foreground" title={new Date(m.data_inicio).toLocaleString("pt-BR")}>
        {formatDistanceToNow(new Date(m.data_inicio), { addSuffix: true, locale: ptBR })}
      </span>
    ) },
    { key: "p", header: "Profissional", cell: (m) => m.profissional?.nome_completo ?? "—" },
    { key: "de", header: "De → Para", cell: (m) => (
      <span className="text-xs">
        {m.unidade_anterior?.nome ?? "—"} → <strong>{m.unidade_novo?.nome ?? "—"}</strong>
      </span>
    ) },
    { key: "t", header: "Tipo", cell: (m) => <Badge variant="outline">{m.tipo_evento}</Badge> },
  ];

  // ---- Alertas de Força de Trabalho (somente leitura) ----
  const alertaItems = buildWorkforceAlertItems({
    alertas: a.alertas.data,
    pendenciasVencidas: pendCriticasQ.data?.length ?? 0,
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Sala de Situação — Força de Trabalho"
        description="Painel executivo do módulo Gestão de Pessoas — visão consolidada da força de trabalho."
        actions={
          <Button variant="outline" size="sm" onClick={() => a.refetch()}>
            <RefreshCw className="mr-1 h-4 w-4" /> Atualizar
          </Button>
        }
      />

      <SemaforoCard
        semaforo={intel.semaforo}
        loading={intel.isLoading}
        lastUpdated={a.lastUpdated}
        onRefresh={() => a.refetch()}
      />

      {/* Filtros globais */}
      <FilterBar>
        <FilterBar.Field label="Unidade">
          <Select
            value={unidadeSel}
            onValueChange={(v) => patchFilter({ unidade: v === "__all__" ? "" : v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas</SelectItem>
              {(unidadesQ.data ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.sigla ? `${u.sigla} — ${u.nome}` : u.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="Status">
          <Select
            value={statusSel}
            onValueChange={(v) => patchFilter({ status: v === "__all__" ? "" : v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {STATUS_VALUE.map((v, i) => (
                <SelectItem key={v} value={v}>{STATUS_LABEL[i]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="Período">
          <Select
            value={compSel}
            onValueChange={(v) => patchFilter({ competencia: v === "__ativa__" ? "" : v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__ativa__">
                Ativa {competenciaAtiva ? `(${competenciaLabel(competenciaAtiva.mes, competenciaAtiva.ano)})` : ""}
              </SelectItem>
              {(competenciasQ.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {competenciaLabel(c.mes, c.ano)}{c.status ? ` · ${c.status}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
      </FilterBar>

      {/* Resumo Geral */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Profissionais" value={(a.totalProfessionals.data ?? 0).toLocaleString("pt-BR")} icon={<Users className="h-4 w-4" />} loading={a.totalProfessionals.isLoading} />
        <KpiCard label="Ativos" value={kpiAtivos.toLocaleString("pt-BR")} icon={<UserCheck className="h-4 w-4" />} loading={a.statusBreakdown.isLoading} />
        <KpiCard label="Afastados" value={kpiAfast.toLocaleString("pt-BR")} icon={<UserMinus className="h-4 w-4" />} loading={a.statusBreakdown.isLoading} />
        <KpiCard label="Férias" value={kpiFerias.toLocaleString("pt-BR")} icon={<Umbrella className="h-4 w-4" />} loading={a.statusBreakdown.isLoading} />
        <KpiCard label="Licenças" value={kpiLic.toLocaleString("pt-BR")} icon={<FileText className="h-4 w-4" />} loading={a.statusBreakdown.isLoading} />
        <KpiCard label="Pendências críticas" value={(pendCriticasQ.data?.length ?? 0).toLocaleString("pt-BR")} icon={<AlertCircle className="h-4 w-4" />} loading={pendCriticasQ.isLoading} />
        <KpiCard label="Horas extras (comp.)" value={a.totalHorasExtras.toLocaleString("pt-BR")} icon={<Clock className="h-4 w-4" />} hint={`Faltas: ${a.totalFaltas.toLocaleString("pt-BR")}`} />
        <KpiCard
          label="Período ativo"
          value={competenciaAtiva ? competenciaLabel(competenciaAtiva.mes, competenciaAtiva.ano) : "—"}
          icon={<CalendarRange className="h-4 w-4" />}
        />
      </section>

      {/* Tendências vs período anterior */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tendências (vs. período anterior)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <TendenciaKpi label="Horas extras" tendencia={intel.tendencias.horasExtras} invertBad />
            <TendenciaKpi label="Faltas" tendencia={intel.tendencias.faltas} invertBad />
            <TendenciaKpi label="Pendências abertas" tendencia={intel.tendencias.pendencias} invertBad />
            <TendenciaKpi label="Frequências aprovadas" tendencia={intel.tendencias.aprovadas} />
          </div>
        </CardContent>
      </Card>

      {/* Inteligência Gerencial */}
      <InsightsCard insights={intel.insights} />

      {/* Rankings em Tabs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rankings (top 10)</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="unidades">
            <TabsList className="mb-3 flex flex-wrap">
              <TabsTrigger value="unidades"><Building2 className="mr-1 h-3.5 w-3.5" />Unidades</TabsTrigger>
              <TabsTrigger value="setores"><Network className="mr-1 h-3.5 w-3.5" />Setores</TabsTrigger>
              <TabsTrigger value="cargos">Cargos</TabsTrigger>
              <TabsTrigger value="funcoes">Funções</TabsTrigger>
              <TabsTrigger value="he"><Clock className="mr-1 h-3.5 w-3.5" />Horas Extras</TabsTrigger>
              <TabsTrigger value="criticas"><ShieldAlert className="mr-1 h-3.5 w-3.5" />Críticas</TabsTrigger>
            </TabsList>

            <TabsContent value="unidades">
              {rankingUnidades.length === 0 ? <EmptyState title="Sem dados" description="Nenhuma folha processada no período." /> :
                <DataTable rows={rankingUnidades} columns={colsUnidades} getRowKey={(r) => r.unidade_id} />}
            </TabsContent>
            <TabsContent value="setores">
              {rankingSetores.length === 0 ? <EmptyState title="Sem dados" /> :
                <DataTable rows={rankingSetores} columns={colsSetores} getRowKey={(r) => r.id} />}
            </TabsContent>
            <TabsContent value="cargos">
              {rankingCargos.length === 0 ? <EmptyState title="Sem dados" /> :
                <DataTable rows={rankingCargos} columns={colsCargos} getRowKey={(r) => r.id} />}
            </TabsContent>
            <TabsContent value="funcoes">
              {rankingFuncoes.length === 0 ? <EmptyState title="Sem dados" /> :
                <DataTable rows={rankingFuncoes} columns={colsFuncoes} getRowKey={(r) => r.id} />}
            </TabsContent>
            <TabsContent value="he">
              {rankingHe.length === 0 ? <EmptyState title="Sem dados" /> : (
                <>
                  <DataTable rows={rankingHe} columns={colsHe} getRowKey={(r) => r.unidade_id} />
                  <div className="mt-2 text-xs text-muted-foreground">
                    HE agregada por unidade — o modelo atual não sustenta HE por profissional (limitação documentada no Módulo 05).
                  </div>
                </>
              )}
            </TabsContent>
            <TabsContent value="criticas">
              {rankingCriticas.length === 0 ? <EmptyState title="Nenhuma unidade crítica" description={`Nenhuma pendência aberta há mais de ${ALERT_RULES.pendenciaDiasCritico} dias.`} /> :
                <DataTable rows={rankingCriticas} columns={colsCriticas} getRowKey={(r) => r.unidade_id} />}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Alertas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4" /> Alertas de Força de Trabalho
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 md:grid-cols-2">
            {alertaItems.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                <span className="flex-1">{it.label}</span>
                <Badge variant={it.count === 0 ? "outline" : it.tone === "danger" ? "destructive" : "secondary"}>
                  {it.count.toLocaleString("pt-BR")}
                </Badge>
                <Button asChild size="sm" variant="ghost" disabled={it.count === 0}>
                  <Link to={it.to} search={it.search as never}>
                    Ver detalhes <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
          {(a.alertas.data?.setoresSemResponsavel ?? 0) > 0 && (
            <div className="mt-3 text-xs text-muted-foreground">
              {a.alertas.data?.setoresSemResponsavel} setor(es) sem responsável cadastrado.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Últimas Movimentações */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" /> Últimas movimentações
          </CardTitle>
          <Button asChild size="sm" variant="ghost">
            <Link to="/auditoria">
              Ver auditoria <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {(movQ.data ?? []).length === 0 ? (
            <EmptyState title="Sem movimentações recentes" description="Nenhuma alteração funcional registrada." />
          ) : (
            <DataTable rows={movQ.data ?? []} columns={colsMov} getRowKey={(m) => m.id} />
          )}
          <div className="mt-2 text-xs text-muted-foreground">
            Origem: <code>profissional_historico_funcional</code>.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
