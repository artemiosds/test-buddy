import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Users, AlertCircle, Clock, ClipboardList, CheckCircle2, RefreshCw, Download, Building2, Pencil } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAnalytics } from "@/hooks/use-analytics";
import { AnalyticsFilterProvider } from "@/context/analytics-filter-context";
import { PageHeader, KpiCard, DataTable, EmptyState, type DataTableColumn } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadCsv } from "@/lib/csv-export";

export const Route = createFileRoute("/_authenticated/setores/$id")({
  component: () => (
    <AnalyticsFilterProvider>
      <SetorPainelPage />
    </AnalyticsFilterProvider>
  ),
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">Erro: {error.message}</div>,
  notFoundComponent: () => <div className="p-6">Setor não encontrado.</div>,
});

function SetorPainelPage() {
  const { id } = Route.useParams();
  const router = useRouter();

  const setorQ = useQuery({
    queryKey: ["setor-painel", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setores")
        .select(
          "id, nome, sigla, status, observacoes, unidade_id, gestor:profissionais!setores_gestor_id_fkey(id, nome_completo), unidade:unidades(id, nome, sigla)",
        )
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as {
        id: string;
        nome: string;
        sigla: string | null;
        status: string;
        observacoes: string | null;
        unidade_id: string;
        gestor: { id: string; nome_completo: string } | null;
        unidade: { id: string; nome: string; sigla: string | null } | null;
      } | null;
    },
  });

  const s = setorQ.data;
  const unidadeId = s?.unidade_id ?? null;

  // Analytics filtrada por setor: usa a mesma fonte do Dashboard RH (useAnalytics).
  // - totalProfessionals já suporta filtro por setorId → count real no servidor.
  // - frequencias/HE/pendências no hook são unidade-scoped (o schema atual não
  //   agrega frequencias por setor); reusamos os totais da unidade-mãe e
  //   deixamos isso explícito na UI com hint.
  const a = useAnalytics({ unidadeId: unidadeId ?? undefined, setorId: id });

  // Profissionais deste setor (top 100).
  const profissionaisQ = useQuery({
    queryKey: ["setor-painel", id, "profissionais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("id, nome_completo, matricula, status, cargo:cargos(nome), funcao:funcoes(nome)")
        .eq("setor_id", id)
        .is("deleted_at", null)
        .order("nome_completo")
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Pendências reais deste setor via join → profissional.setor_id.
  // count exato no servidor; sem limite truncando total.
  const pendenciasCountQ = useQuery({
    queryKey: ["setor-painel", id, "pendencias-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("frequencia_pendencias")
        .select(
          "id, frequencia_profissional!inner(profissional:profissionais!inner(setor_id))",
          { count: "exact", head: true },
        )
        .eq("frequencia_profissional.profissional.setor_id", id)
        .is("deleted_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Comparativo: outros setores da mesma unidade (contagem de profissionais ativos por setor).
  const compQ = useQuery({
    queryKey: ["setor-painel", id, "comparativo", unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data: setores, error: e1 } = await supabase
        .from("setores")
        .select("id, nome, sigla, status")
        .eq("unidade_id", unidadeId!)
        .is("deleted_at", null);
      if (e1) throw e1;
      const { data: profs, error: e2 } = await supabase
        .from("profissionais")
        .select("setor_id")
        .eq("unidade_id", unidadeId!)
        .eq("status", "ativo")
        .is("deleted_at", null)
        .not("setor_id", "is", null);
      if (e2) throw e2;
      const map = new Map<string, number>();
      for (const p of profs ?? []) {
        const k = (p as { setor_id: string | null }).setor_id;
        if (k) map.set(k, (map.get(k) ?? 0) + 1);
      }
      return (setores ?? [])
        .map((x) => ({ ...x, total: map.get(x.id) ?? 0 }))
        .sort((a, b) => b.total - a.total);
    },
  });

  const compLabel = a.competenciaAtiva
    ? `${String(a.competenciaAtiva.mes).padStart(2, "0")}/${a.competenciaAtiva.ano}`
    : "—";

  type ProfRow = {
    id: string;
    nome_completo: string;
    matricula: string | null;
    status: string;
    cargo: { nome: string } | null;
    funcao: { nome: string } | null;
  };
  const profRows = (profissionaisQ.data ?? []) as unknown as ProfRow[];
  const profCols: DataTableColumn<ProfRow>[] = [
    { key: "nome", header: "Nome", cell: (r) => r.nome_completo },
    { key: "mat", header: "Matrícula", cell: (r) => r.matricula ?? "—" },
    { key: "cargo", header: "Cargo", cell: (r) => r.cargo?.nome ?? "—" },
    { key: "funcao", header: "Função", cell: (r) => r.funcao?.nome ?? "—" },
    { key: "st", header: "Status", cell: (r) => <Badge variant="secondary">{r.status}</Badge> },
  ];

  function exportProfCsv() {
    downloadCsv(`setor-${s?.sigla ?? id}-profissionais`, profRows, [
      { header: "Nome", value: (r) => r.nome_completo },
      { header: "Matrícula", value: (r) => r.matricula ?? "" },
      { header: "Cargo", value: (r) => r.cargo?.nome ?? "" },
      { header: "Função", value: (r) => r.funcao?.nome ?? "" },
      { header: "Status", value: (r) => r.status },
    ]);
  }

  if (setorQ.isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando painel...</div>;
  if (!s) return <div className="p-6">Setor não encontrado.</div>;

  return (
    <div className="space-y-4">
      <PageHeader
        title={s.nome}
        description={`${s.unidade?.sigla ?? s.unidade?.nome ?? "Unidade"} • Competência ${compLabel}${s.gestor ? ` • Gestor: ${s.gestor.nome_completo}` : ""}`}
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link to="/unidades/$id" params={{ id: unidadeId ?? "" }}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Painel da unidade
              </Link>
            </Button>
            <Button variant="outline" onClick={() => router.invalidate()}>
              <RefreshCw className="mr-1 h-4 w-4" /> Atualizar
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">{s.status}</Badge>
        {s.sigla && <span>Sigla: {s.sigla}</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Profissionais" value={a.totalProfessionals.data ?? 0} loading={a.totalProfessionals.isLoading} icon={<Users className="h-4 w-4" />} />
        <KpiCard label="Pendências" value={pendenciasCountQ.data ?? 0} loading={pendenciasCountQ.isLoading} hint="Deste setor" icon={<AlertCircle className="h-4 w-4" />} />
        <KpiCard label="Folhas enviadas" value={a.frequenciasEnviadas} loading={a.frequencias.isLoading} hint="Unidade-mãe" icon={<ClipboardList className="h-4 w-4" />} />
        <KpiCard label="Folhas aprovadas" value={a.frequenciasAprovadas} loading={a.frequencias.isLoading} hint="Unidade-mãe" icon={<CheckCircle2 className="h-4 w-4" />} />
        <KpiCard label="Horas extras (comp.)" value={a.totalHorasExtras.toLocaleString("pt-BR")} loading={a.frequencias.isLoading} hint="Unidade-mãe" icon={<Clock className="h-4 w-4" />} />
        <KpiCard label="Outros setores" value={(compQ.data?.length ?? 1) - 1} loading={compQ.isLoading} hint="Na mesma unidade" icon={<Building2 className="h-4 w-4" />} />
      </div>

      <p className="text-xs text-muted-foreground">
        Nota: folhas e horas extras são agregadas por unidade+competência no schema atual e refletem o total da unidade-mãe.
        Contagem de profissionais e pendências é específica deste setor. Os números batem com o painel da unidade e com o Dashboard RH.
      </p>

      <Tabs defaultValue="profissionais" className="space-y-3">
        <TabsList>
          <TabsTrigger value="profissionais">Profissionais</TabsTrigger>
          <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
        </TabsList>

        <TabsContent value="profissionais">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Profissionais vinculados</CardTitle>
              <Button variant="outline" size="sm" onClick={exportProfCsv} disabled={profRows.length === 0}>
                <Download className="mr-1 h-4 w-4" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              {profissionaisQ.isLoading ? (
                <div className="text-sm text-muted-foreground">Carregando...</div>
              ) : profRows.length === 0 ? (
                <EmptyState title="Nenhum profissional" description="Nenhum profissional vinculado a este setor." />
              ) : (
                <>
                  <DataTable rows={profRows} columns={profCols} getRowKey={(r) => r.id} />
                  {profRows.length === 100 && (
                    <p className="mt-2 text-xs text-muted-foreground">Exibindo os 100 primeiros.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparativo">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comparativo — setores da mesma unidade</CardTitle>
            </CardHeader>
            <CardContent>
              {compQ.isLoading ? (
                <div className="text-sm text-muted-foreground">Carregando...</div>
              ) : (compQ.data?.length ?? 0) === 0 ? (
                <EmptyState title="Sem comparativos" description="Nenhum outro setor nesta unidade." />
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1">Setor</th>
                      <th className="px-2 py-1">Sigla</th>
                      <th className="px-2 py-1 text-right">Profissionais ativos</th>
                      <th className="px-2 py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compQ.data!.map((r) => (
                      <tr key={r.id} className={`border-t ${r.id === id ? "bg-muted/40 font-medium" : ""}`}>
                        <td className="px-2 py-1">{r.nome}{r.id === id && " (atual)"}</td>
                        <td className="px-2 py-1 text-muted-foreground">{r.sigla ?? "—"}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{r.total}</td>
                        <td className="px-2 py-1"><Badge variant="secondary">{r.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resumo">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Dados cadastrais</CardTitle>
              <Button size="sm" variant="outline" asChild>
                <Link to="/setores" search={{ unidade: unidadeId ?? undefined }}>
                  <Pencil className="mr-1 h-4 w-4" /> Editar
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
              <Field label="Unidade" value={s.unidade ? `${s.unidade.sigla ?? ""} ${s.unidade.nome}`.trim() : "—"} />
              <Field label="Status" value={s.status} />
              <Field label="Sigla" value={s.sigla ?? "—"} />
              <Field label="Gestor" value={s.gestor?.nome_completo ?? "—"} />
              <div className="sm:col-span-2">
                <Field label="Observações" value={s.observacoes ?? "—"} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}