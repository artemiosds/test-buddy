import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, RefreshCw, ArrowRight, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useCompetenciaAtiva } from "@/hooks/use-competencia-ativa";
import { PageHeader, KpiCard, DataTable, EmptyState, type DataTableColumn } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/controle-forca-trabalho")({
  component: ControleForcaTrabalhoPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Erro: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Não encontrado.</div>,
});

type UnidadeRow = {
  id: string;
  nome: string;
  sigla: string | null;
  status: string;
  profissionais: number;
  setores: number;
  pendencias: number;
  frequencias_pendentes: number;
  frequencias_aprovadas: number;
  horas_extras: number;
  faltas: number;
  ultima_atualizacao: string | null;
};

function maxDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function ControleForcaTrabalhoPage() {
  const { data: competencia } = useCompetenciaAtiva();
  // Reusa o mesmo hook do Dashboard RH / Painel de Unidades (Módulos 01/04/05).
  const a = useAnalytics({});

  const unidadesQ = useQuery({
    queryKey: ["controle-fw", "unidades"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidades")
        .select("id, nome, sigla, status, updated_at")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const profissionaisQ = useQuery({
    queryKey: ["controle-fw", "profissionais"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("id, unidade_id, updated_at")
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const setoresQ = useQuery({
    queryKey: ["controle-fw", "setores"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setores")
        .select("id, unidade_id, updated_at")
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const pendenciasQ = useQuery({
    queryKey: ["controle-fw", "pendencias", competencia?.id ?? null],
    staleTime: 60_000,
    enabled: !!competencia?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("frequencia_pendencias")
        .select(
          "id, updated_at, frequencias!inner(competencia_unidades!inner(unidade_id, competencia_id))",
        )
        .is("deleted_at", null)
        .eq("frequencias.competencia_unidades.competencia_id", competencia!.id);
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

  // Timestamp real da folha por unidade (para "última atualização").
  const frequenciasMetaQ = useQuery({
    queryKey: ["controle-fw", "freq-meta", competencia?.id ?? null],
    staleTime: 60_000,
    enabled: !!competencia?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("frequencias")
        .select("id, updated_at, competencia_unidades!inner(unidade_id, competencia_id)")
        .is("deleted_at", null)
        .eq("competencia_unidades.competencia_id", competencia!.id);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        updated_at: string;
        competencia_unidades: { unidade_id: string; competencia_id: string };
      }>;
    },
  });

  const rows: UnidadeRow[] = useMemo(() => {
    const unidades = unidadesQ.data ?? [];
    const profs = profissionaisQ.data ?? [];
    const setores = setoresQ.data ?? [];
    const pends = pendenciasQ.data ?? [];
    const freqMeta = frequenciasMetaQ.data ?? [];
    const rankByUnit = new Map(a.ranking.map((r) => [r.unidade_id, r]));

    // Contagem de folhas pendentes (status rascunho) por unidade — a partir do
    // resultado bruto que useAnalytics já carregou, sem query extra.
    const freqsRaw = a.frequencias.data ?? [];
    const pendPorUnidade = new Map<string, number>();
    const aprovPorUnidade = new Map<string, number>();
    for (const f of freqsRaw) {
      const uid = f.competencia_unidades.unidade_id;
      if (f.status === "rascunho") pendPorUnidade.set(uid, (pendPorUnidade.get(uid) ?? 0) + 1);
      if (f.status === "aprovada") aprovPorUnidade.set(uid, (aprovPorUnidade.get(uid) ?? 0) + 1);
    }

    return unidades.map((u) => {
      const uProfs = profs.filter((p) => p.unidade_id === u.id);
      const uSetores = setores.filter((s) => s.unidade_id === u.id);
      const uPends = pends.filter((p) => p.frequencias?.competencia_unidades?.unidade_id === u.id);
      const uFreqs = freqMeta.filter(
        (f) => f.competencia_unidades?.unidade_id === u.id,
      );
      const rank = rankByUnit.get(u.id);

      let last: string | null = u.updated_at ?? null;
      for (const p of uProfs) last = maxDate(last, p.updated_at);
      for (const s of uSetores) last = maxDate(last, s.updated_at);
      for (const p of uPends) last = maxDate(last, p.updated_at);
      for (const f of uFreqs) last = maxDate(last, f.updated_at);

      return {
        id: u.id,
        nome: u.nome,
        sigla: u.sigla,
        status: u.status,
        profissionais: uProfs.length,
        setores: uSetores.length,
        pendencias: uPends.length,
        frequencias_pendentes: pendPorUnidade.get(u.id) ?? 0,
        frequencias_aprovadas: aprovPorUnidade.get(u.id) ?? 0,
        horas_extras: rank?.total_horas_extras ?? 0,
        faltas: rank?.total_faltas ?? 0,
        ultima_atualizacao: last,
      };
    });
  }, [
    unidadesQ.data,
    profissionaisQ.data,
    setoresQ.data,
    pendenciasQ.data,
    frequenciasMetaQ.data,
    a.ranking,
    a.frequencias.data,
  ]);

  const totalUltima = rows.reduce<string | null>(
    (acc, r) => maxDate(acc, r.ultima_atualizacao),
    null,
  );

  const loading =
    unidadesQ.isLoading ||
    profissionaisQ.isLoading ||
    setoresQ.isLoading ||
    a.frequencias.isLoading ||
    (competencia?.id ? pendenciasQ.isLoading || frequenciasMetaQ.isLoading : false);

  const refetchAll = () => {
    unidadesQ.refetch();
    profissionaisQ.refetch();
    setoresQ.refetch();
    pendenciasQ.refetch();
    frequenciasMetaQ.refetch();
    a.refetch();
  };

  const columns: DataTableColumn<UnidadeRow>[] = [
    {
      key: "nome",
      header: "Unidade",
      cell: (r) => (
        <div>
          <div className="font-medium">{r.nome}</div>
          {r.sigla ? (
            <div className="text-xs text-muted-foreground">{r.sigla}</div>
          ) : null}
        </div>
      ),
    },
    { key: "profissionais", header: "Profissionais", cell: (r) => r.profissionais },
    { key: "setores", header: "Setores", cell: (r) => r.setores },
    {
      key: "freq_pend",
      header: "Folhas em rascunho",
      cell: (r) =>
        r.frequencias_pendentes > 0 ? (
          <Badge variant="secondary">{r.frequencias_pendentes}</Badge>
        ) : (
          <span className="text-muted-foreground">0</span>
        ),
    },
    {
      key: "freq_aprov",
      header: "Folhas aprovadas",
      cell: (r) => r.frequencias_aprovadas,
    },
    {
      key: "pendencias",
      header: "Pendências",
      cell: (r) =>
        r.pendencias > 0 ? (
          <Badge variant="destructive">{r.pendencias}</Badge>
        ) : (
          <span className="text-muted-foreground">0</span>
        ),
    },
    { key: "he", header: "Horas extras", cell: (r) => r.horas_extras.toLocaleString("pt-BR") },
    { key: "faltas", header: "Faltas", cell: (r) => r.faltas.toLocaleString("pt-BR") },
    {
      key: "ultima",
      header: "Última atualização",
      cell: (r) =>
        r.ultima_atualizacao ? (
          <span
            className="text-xs text-muted-foreground"
            title={new Date(r.ultima_atualizacao).toLocaleString("pt-BR")}
          >
            {formatDistanceToNow(new Date(r.ultima_atualizacao), {
              addSuffix: true,
              locale: ptBR,
            })}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "acoes",
      header: "",
      cell: (r) => (
        <Button asChild size="sm" variant="ghost">
          <Link to="/unidades/$id" params={{ id: r.id }}>
            Painel <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      ),
    },
  ];

  const totalProfs = rows.reduce((s, r) => s + r.profissionais, 0);
  const totalPends = rows.reduce((s, r) => s + r.pendencias, 0);
  const totalHe = rows.reduce((s, r) => s + r.horas_extras, 0);
  const totalFaltas = rows.reduce((s, r) => s + r.faltas, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Centro de Controle da Força de Trabalho"
        description={
          competencia
            ? `Competência atual: ${competencia.mes.toString().padStart(2, "0")}/${competencia.ano}`
            : "Sem competência ativa"
        }
        actions={
          <Button variant="outline" size="sm" onClick={refetchAll}>
            <RefreshCw className="mr-1 h-4 w-4" /> Atualizar
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Unidades" value={rows.length} icon={<Building2 className="h-4 w-4" />} />
        <KpiCard label="Profissionais ativos" value={totalProfs} />
        <KpiCard label="Pendências abertas" value={totalPends} />
        <KpiCard label="Horas extras (competência)" value={totalHe.toLocaleString("pt-BR")} />
      </div>

      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground flex items-center gap-2">
        <Clock className="h-3.5 w-3.5" />
        <span>
          Última atualização de dados:{" "}
          {totalUltima
            ? `${new Date(totalUltima).toLocaleString("pt-BR")} (${formatDistanceToNow(
                new Date(totalUltima),
                { addSuffix: true, locale: ptBR },
              )})`
            : "sem registros"}
          . Horas extras e faltas são agregados por unidade — no nível de setor
          reproduzimos o mesmo valor da unidade-mãe (limitação documentada no
          Módulo 05, o modelo atual não sustenta HE por setor).
        </span>
      </div>

      {loading && rows.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nenhuma unidade acessível"
          description="Você não tem acesso a nenhuma unidade ou nenhuma foi cadastrada."
        />
      ) : (
        <DataTable<UnidadeRow> rows={rows} columns={columns} getRowKey={(r) => r.id} />
      )}

      <div className="text-xs text-muted-foreground">
        Total de faltas na competência: {totalFaltas.toLocaleString("pt-BR")}.
      </div>
    </div>
  );
}