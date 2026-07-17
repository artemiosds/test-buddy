import { createFileRoute, useNavigate, retainSearchParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, RefreshCw, Clock, Users, Layers, UserCheck, UserMinus, Umbrella, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { useAnalytics } from "@/hooks/use-analytics";
import { useCompetenciaAtiva } from "@/hooks/use-competencia-ativa";
import { useCompetenciasLookup } from "@/hooks/use-lookups";
import {
  workforceFiltersValidator,
  resolveWorkforceFilters,
  mergeWorkforceFilters,
  WORKFORCE_FILTER_KEYS,
  type WorkforceFilters,
} from "@/lib/workforce-filters";
import {
  PageHeader, KpiCard, StatusBadge, EmptyState, FilterBar,
} from "@/components/shared";
import { PermissionGate } from "@/components/permission-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/controle-forca-trabalho")({
  validateSearch: workforceFiltersValidator,
  search: { middlewares: [retainSearchParams([...WORKFORCE_FILTER_KEYS])] },
  component: () => (
    <PermissionGate
      anyOf={["dashboard.visualizar", "unidade.visualizar"]}
      fallback={<div className="p-6 text-sm text-muted-foreground">Sem permissão para visualizar este painel.</div>}
    >
      <ControleForcaTrabalhoPage />
    </PermissionGate>
  ),
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Erro: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Não encontrado.</div>,
});

type UnidadeCardData = {
  id: string;
  nome: string;
  sigla: string | null;
  total: number;
  ativos: number;
  afastados: number;
  ferias: number;
  licencas: number;
  horas_extras: number;
  faltas: number;
  pendencias: number;
  ultima_atualizacao: string | null;
};

function maxDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function ControleForcaTrabalhoPage() {
  const navigate = useNavigate();
  const routeNavigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const { data: competenciaAtiva } = useCompetenciaAtiva();
  const competenciasQ = useCompetenciasLookup();
  const resolved = resolveWorkforceFilters(search, competenciaAtiva?.id ?? null);
  const effectiveCompId = resolved.competenciaId;
  const competenciaSel = search.competencia === "" ? "__ativa__" : search.competencia;
  const patchFilter = (patch: Partial<WorkforceFilters>) =>
    routeNavigate({
      search: (prev: WorkforceFilters) => mergeWorkforceFilters(prev, patch),
      replace: true,
    });

  const a = useAnalytics({
    competenciaId: effectiveCompId,
    unidadeId: resolved.unidadeId,
    status: resolved.status,
  });

  const unidadesQ = useQuery({
    queryKey: ["controle-fw", "unidades"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidades")
        .select("id, nome, sigla, status, updated_at")
        .is("deleted_at", null)
        .eq("status", "ativa")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Contagem de profissionais por unidade, quebrada por status.
  const profsPorUnidadeQ = useQuery({
    queryKey: ["controle-fw", "profs-por-unidade"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("unidade_id, status, updated_at")
        .is("deleted_at", null)
        .limit(10000);
      if (error) throw error;
      return (data ?? []) as Array<{
        unidade_id: string | null;
        status: string | null;
        updated_at: string;
      }>;
    },
  });

  // Pendências abertas por unidade no período selecionado.
  const pendenciasPorUnidadeQ = useQuery({
    queryKey: ["controle-fw", "pendencias-unidade", effectiveCompId ?? null],
    staleTime: 60_000,
    enabled: !!effectiveCompId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("frequencia_pendencias")
        .select(
          "id, updated_at, frequencias!inner(competencia_unidades!inner(unidade_id, competencia_id))",
        )
        .is("deleted_at", null)
        .eq("frequencias.competencia_unidades.competencia_id", effectiveCompId!);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        updated_at: string;
        frequencias: {
          competencia_unidades: { unidade_id: string; competencia_id: string };
        };
      }>;
    },
  });

  // Última atualização de folha por unidade.
  const freqMetaQ = useQuery({
    queryKey: ["controle-fw", "freq-meta", effectiveCompId ?? null],
    staleTime: 60_000,
    enabled: !!effectiveCompId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("frequencias")
        .select("id, updated_at, competencia_unidades!inner(unidade_id, competencia_id)")
        .is("deleted_at", null)
        .eq("competencia_unidades.competencia_id", effectiveCompId!);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        updated_at: string;
        competencia_unidades: { unidade_id: string; competencia_id: string };
      }>;
    },
  });

  const cards: UnidadeCardData[] = useMemo(() => {
    const unidades = unidadesQ.data ?? [];
    const profs = profsPorUnidadeQ.data ?? [];
    const pends = pendenciasPorUnidadeQ.data ?? [];
    const freqs = freqMetaQ.data ?? [];
    const rankByUnit = new Map(a.ranking.map((r) => [r.unidade_id, r]));

    return unidades.map((u) => {
      const uProfs = profs.filter((p) => p.unidade_id === u.id);
      const rank = rankByUnit.get(u.id);
      const uPends = pends.filter(
        (p) => p.frequencias?.competencia_unidades?.unidade_id === u.id,
      );
      const uFreqs = freqs.filter((f) => f.competencia_unidades?.unidade_id === u.id);

      let ativos = 0, afastados = 0, ferias = 0, licencas = 0;
      let last: string | null = u.updated_at ?? null;
      for (const p of uProfs) {
        if (p.status === "ativo") ativos += 1;
        else if (p.status === "afastado") afastados += 1;
        else if (p.status === "ferias") ferias += 1;
        else if (p.status === "licenca") licencas += 1;
        last = maxDate(last, p.updated_at);
      }
      for (const p of uPends) last = maxDate(last, p.updated_at);
      for (const f of uFreqs) last = maxDate(last, f.updated_at);

      return {
        id: u.id,
        nome: u.nome,
        sigla: u.sigla,
        total: uProfs.length,
        ativos, afastados, ferias, licencas,
        horas_extras: rank?.total_horas_extras ?? 0,
        faltas: rank?.total_faltas ?? 0,
        pendencias: uPends.length,
        ultima_atualizacao: last,
      };
    });
  }, [unidadesQ.data, profsPorUnidadeQ.data, pendenciasPorUnidadeQ.data, freqMetaQ.data, a.ranking]);

  const totalProf = cards.reduce((s, r) => s + r.total, 0);
  const totalAtivos = cards.reduce((s, r) => s + r.ativos, 0);
  const totalAfast = cards.reduce((s, r) => s + r.afastados, 0);
  const totalFerias = cards.reduce((s, r) => s + r.ferias, 0);
  const totalLic = cards.reduce((s, r) => s + r.licencas, 0);
  const totalUltima = cards.reduce<string | null>(
    (acc, r) => maxDate(acc, r.ultima_atualizacao),
    null,
  );

  const loading =
    unidadesQ.isLoading || profsPorUnidadeQ.isLoading ||
    (effectiveCompId ? pendenciasPorUnidadeQ.isLoading || freqMetaQ.isLoading || a.frequencias.isLoading : false);

  const refetchAll = () => {
    unidadesQ.refetch();
    profsPorUnidadeQ.refetch();
    pendenciasPorUnidadeQ.refetch();
    freqMetaQ.refetch();
    a.refetch();
  };

  const competenciaLabel = (mes: number, ano: number) =>
    `${String(mes).padStart(2, "0")}/${ano}`;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Centro de Controle da Força de Trabalho"
        description="Visão operacional por Unidade — período selecionável."
        actions={
          <Button variant="outline" size="sm" onClick={refetchAll}>
            <RefreshCw className="mr-1 h-4 w-4" /> Atualizar
          </Button>
        }
      />

      <FilterBar>
        <FilterBar.Field label="Período">
          <Select
            value={competenciaSel}
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

      {/* Visão geral */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Profissionais" value={totalProf.toLocaleString("pt-BR")} icon={<Users className="h-4 w-4" />} loading={loading && cards.length === 0} />
        <KpiCard label="Ativos" value={totalAtivos.toLocaleString("pt-BR")} icon={<UserCheck className="h-4 w-4" />} loading={loading && cards.length === 0} />
        <KpiCard label="Afastados" value={totalAfast.toLocaleString("pt-BR")} icon={<UserMinus className="h-4 w-4" />} loading={loading && cards.length === 0} />
        <KpiCard label="Férias" value={totalFerias.toLocaleString("pt-BR")} icon={<Umbrella className="h-4 w-4" />} loading={loading && cards.length === 0} />
        <KpiCard label="Licenças" value={totalLic.toLocaleString("pt-BR")} icon={<FileText className="h-4 w-4" />} loading={loading && cards.length === 0} />
        <KpiCard label="Unidades" value={(a.totalUnidades.data ?? cards.length).toLocaleString("pt-BR")} icon={<Building2 className="h-4 w-4" />} loading={a.totalUnidades.isLoading} />
        <KpiCard label="Setores" value={(a.totalSetores.data ?? 0).toLocaleString("pt-BR")} icon={<Layers className="h-4 w-4" />} loading={a.totalSetores.isLoading} />
      </section>

      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground flex items-center gap-2">
        <Clock className="h-3.5 w-3.5" />
        <span>
          Última atualização:{" "}
          {totalUltima
            ? `${new Date(totalUltima).toLocaleString("pt-BR")} (${formatDistanceToNow(new Date(totalUltima), { addSuffix: true, locale: ptBR })})`
            : "sem registros"}
        </span>
      </div>

      {cards.length === 0 && !loading ? (
        <EmptyState
          title="Nenhuma unidade acessível"
          description="Você não tem acesso a nenhuma unidade ou nenhuma foi cadastrada."
        />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => navigate({ to: "/unidades/$id", params: { id: c.id } })}
              className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
              aria-label={`Abrir painel da unidade ${c.nome}`}
            >
              <Card className="h-full transition hover:border-primary/50 hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span className="truncate">{c.nome}</span>
                    {c.sigla && (
                      <span className="text-xs font-normal text-muted-foreground">{c.sigla}</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Total</span>
                    <span className="text-2xl font-semibold tabular-nums">{c.total.toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge domain="profissional" value="ativo" />
                    <span className="text-sm tabular-nums">{c.ativos}</span>
                    <StatusBadge domain="profissional" value="ferias" />
                    <span className="text-sm tabular-nums">{c.ferias}</span>
                    <StatusBadge domain="profissional" value="licenca" />
                    <span className="text-sm tabular-nums">{c.licencas}</span>
                    <StatusBadge domain="profissional" value="afastado" />
                    <span className="text-sm tabular-nums">{c.afastados}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t pt-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Horas extras</div>
                      <div className="tabular-nums font-medium">{c.horas_extras.toLocaleString("pt-BR")}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Faltas</div>
                      <div className="tabular-nums font-medium">{c.faltas.toLocaleString("pt-BR")}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Pendências</div>
                      <div className={"tabular-nums font-medium " + (c.pendencias > 0 ? "text-destructive" : "")}>
                        {c.pendencias.toLocaleString("pt-BR")}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {c.ultima_atualizacao ? (
                      <>Atualizado {formatDistanceToNow(new Date(c.ultima_atualizacao), { addSuffix: true, locale: ptBR })}</>
                    ) : (
                      "Sem atualização registrada"
                    )}
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
