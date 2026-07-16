import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ArrowLeft, Users, Building2, ClipboardList, AlertCircle, Clock, CheckCircle2, CalendarRange, RefreshCw, Download, Pencil } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsFilterProvider } from "@/context/analytics-filter-context";
import { PageHeader, KpiCard, DataTable, EmptyState, type DataTableColumn } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadCsv } from "@/lib/csv-export";

export const Route = createFileRoute("/_authenticated/unidades/$id")({
  component: () => (
    <AnalyticsFilterProvider>
      <UnidadePainelPage />
    </AnalyticsFilterProvider>
  ),
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Erro: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Unidade não encontrada.</div>,
});

function UnidadePainelPage() {
  const { id } = Route.useParams();
  const router = useRouter();

  const unidadeQ = useQuery({
    queryKey: ["unidade-painel", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidades")
        .select(
          "id, nome, sigla, cnes, cnpj, tipo_unidade, tipo_atendimento, nivel_complexidade, municipio, distrito, telefone, email_institucional, responsavel_nome, status, secretaria:secretarias(nome, sigla)",
        )
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Mesma fonte que o Dashboard Executivo RH (gestao-rh.tsx), filtrada por unidade.
  const a = useAnalytics({ unidadeId: id });

  // Profissionais ativos da unidade (topo 50 por nome; contagem total via KPI).
  const profissionaisQ = useQuery({
    queryKey: ["unidade-painel", id, "profissionais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("id, nome_completo, matricula, status, cargo:cargos(nome), funcao:funcoes(nome)")
        .eq("unidade_id", id)
        .is("deleted_at", null)
        .order("nome_completo")
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Setores da unidade.
  const setoresQ = useQuery({
    queryKey: ["unidade-painel", id, "setores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setores")
        .select("id, nome, sigla, status")
        .eq("unidade_id", id)
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Competências desta unidade (via competencia_unidades).
  const competenciasQ = useQuery({
    queryKey: ["unidade-painel", id, "competencias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competencia_unidades")
        .select("id, status, competencia:competencias(id, mes, ano, status)")
        .eq("unidade_id", id)
        .is("deleted_at", null)
        .order("id", { ascending: false })
        .limit(24);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        status: string;
        competencia: { id: string; mes: number; ano: number; status: string } | null;
      }>;
    },
  });

  // Pendências desta unidade (agregado real via count exato).
  const pendenciasCountQ = useQuery({
    queryKey: ["unidade-painel", id, "pendencias-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("frequencia_pendencias")
        .select("id, frequencias!inner(competencia_unidades!inner(unidade_id))", { count: "exact", head: true })
        .eq("frequencias.competencia_unidades.unidade_id", id)
        .is("deleted_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const u = unidadeQ.data;
  const secLabel = u?.secretaria?.sigla ?? u?.secretaria?.nome ?? "—";

  // KPIs da unidade — todos vindos de useAnalytics (mesma query do Dashboard RH).
  const kpis = [
    { label: "Profissionais", value: a.totalProfessionals.data ?? 0, loading: a.totalProfessionals.isLoading, icon: <Users className="h-4 w-4" /> },
    { label: "Setores", value: setoresQ.data?.length ?? 0, loading: setoresQ.isLoading, icon: <Building2 className="h-4 w-4" /> },
    { label: "Folhas enviadas", value: a.frequenciasEnviadas, loading: a.frequencias.isLoading, icon: <ClipboardList className="h-4 w-4" /> },
    { label: "Folhas aprovadas", value: a.frequenciasAprovadas, loading: a.frequencias.isLoading, icon: <CheckCircle2 className="h-4 w-4" /> },
    { label: "Horas extras (comp.)", value: a.totalHorasExtras.toLocaleString("pt-BR"), loading: a.frequencias.isLoading, icon: <Clock className="h-4 w-4" /> },
    { label: "Pendências abertas", value: pendenciasCountQ.data ?? 0, loading: pendenciasCountQ.isLoading, hint: "Todas competências", icon: <AlertCircle className="h-4 w-4" /> },
  ];

  const compLabel = useMemo(() => {
    const c = a.competenciaAtiva;
    return c ? `${String(c.mes).padStart(2, "0")}/${c.ano}` : "—";
  }, [a.competenciaAtiva]);

  const profCols: DataTableColumn<(NonNullable<typeof profissionaisQ.data>)[number]>[] = [
    { key: "nome", header: "Nome", cell: (r) => r.nome_completo },
    { key: "mat", header: "Matrícula", cell: (r) => r.matricula ?? "—" },
    { key: "cargo", header: "Cargo", cell: (r) => r.cargo?.nome ?? "—" },
    { key: "funcao", header: "Função", cell: (r) => r.funcao?.nome ?? "—" },
    { key: "st", header: "Status", cell: (r) => <Badge variant="secondary">{r.status}</Badge> },
  ];

  function exportProfCsv() {
    downloadCsv(`unidade-${u?.sigla ?? id}-profissionais`, profissionaisQ.data ?? [], [
      { header: "Nome", value: (r) => r.nome_completo },
      { header: "Matrícula", value: (r) => r.matricula ?? "" },
      { header: "Cargo", value: (r) => r.cargo?.nome ?? "" },
      { header: "Função", value: (r) => r.funcao?.nome ?? "" },
      { header: "Status", value: (r) => r.status },
    ]);
  }

  if (unidadeQ.isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando painel...</div>;
  if (!u) return <div className="p-6">Unidade não encontrada.</div>;

  return (
    <div className="space-y-4">
      <PageHeader
        title={u.nome}
        description={`${secLabel} • Competência ${compLabel}${u.municipio ? ` • ${u.municipio}` : ""}${u.distrito ? ` / ${u.distrito}` : ""}`}
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link to="/unidades"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</Link>
            </Button>
            <Button variant="outline" onClick={() => router.invalidate()}>
              <RefreshCw className="mr-1 h-4 w-4" /> Atualizar
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">{u.status}</Badge>
        {u.sigla && <span>Sigla: {u.sigla}</span>}
        {u.cnes && <span>CNES: {u.cnes}</span>}
        {u.tipo_unidade && <span>Tipo: {u.tipo_unidade}</span>}
        {u.tipo_atendimento && <span>Atendimento: {u.tipo_atendimento}</span>}
        {u.nivel_complexidade && <span>Nível: {u.nivel_complexidade}</span>}
        {u.responsavel_nome && <span>Responsável: {u.responsavel_nome}</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} loading={k.loading} hint={k.hint} icon={k.icon} />
        ))}
      </div>

      <Tabs defaultValue="profissionais" className="space-y-3">
        <TabsList>
          <TabsTrigger value="profissionais">Profissionais</TabsTrigger>
          <TabsTrigger value="setores">Setores</TabsTrigger>
          <TabsTrigger value="competencias">Competências</TabsTrigger>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
        </TabsList>

        <TabsContent value="profissionais">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Profissionais vinculados</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportProfCsv} disabled={!profissionaisQ.data?.length}>
                  <Download className="mr-1 h-4 w-4" /> CSV
                </Button>
                <Button size="sm" asChild>
                  <Link to="/profissionais" search={{ unidade: id } as never}>
                    Ver todos
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {profissionaisQ.isLoading ? (
                <div className="text-sm text-muted-foreground">Carregando...</div>
              ) : (profissionaisQ.data?.length ?? 0) === 0 ? (
                <EmptyState title="Nenhum profissional" description="Nenhum profissional vinculado a esta unidade." />
              ) : (
                <>
                  <DataTable data={profissionaisQ.data ?? []} columns={profCols} rowKey={(r) => r.id} />
                  {(profissionaisQ.data?.length ?? 0) === 50 && (
                    <p className="mt-2 text-xs text-muted-foreground">Exibindo os 50 primeiros. Use o link "Ver todos" para lista completa.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="setores">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Setores</CardTitle>
              <Button size="sm" asChild>
                <Link to="/setores" search={{ unidade: id } as never}><Building2 className="mr-1 h-4 w-4" /> Gerenciar</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {setoresQ.isLoading ? (
                <div className="text-sm text-muted-foreground">Carregando...</div>
              ) : (setoresQ.data?.length ?? 0) === 0 ? (
                <EmptyState title="Sem setores" description="Nenhum setor cadastrado para esta unidade." />
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {setoresQ.data!.map((s) => (
                    <li key={s.id} className="rounded-md border bg-card px-3 py-2 text-sm">
                      <div className="font-medium">{s.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.sigla ?? "—"} • {s.status}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competencias">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Competências (últimas 24)</CardTitle>
              <CalendarRange className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {competenciasQ.isLoading ? (
                <div className="text-sm text-muted-foreground">Carregando...</div>
              ) : (competenciasQ.data?.length ?? 0) === 0 ? (
                <EmptyState title="Nenhuma competência" description="Esta unidade não tem competências vinculadas." />
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1">Competência</th>
                      <th className="px-2 py-1">Status geral</th>
                      <th className="px-2 py-1">Status na unidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competenciasQ.data!.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-2 py-1">
                          {r.competencia ? `${String(r.competencia.mes).padStart(2, "0")}/${r.competencia.ano}` : "—"}
                        </td>
                        <td className="px-2 py-1 text-muted-foreground">{r.competencia?.status ?? "—"}</td>
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
                <Link to="/unidades"><Pencil className="mr-1 h-4 w-4" /> Editar</Link>
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
              <Field label="Secretaria" value={secLabel} />
              <Field label="Status" value={u.status} />
              <Field label="CNES" value={u.cnes ?? "—"} />
              <Field label="CNPJ" value={u.cnpj ?? "—"} />
              <Field label="Tipo de unidade" value={u.tipo_unidade ?? "—"} />
              <Field label="Tipo de atendimento" value={u.tipo_atendimento ?? "—"} />
              <Field label="Nível de complexidade" value={u.nivel_complexidade ?? "—"} />
              <Field label="Município" value={u.municipio ?? "—"} />
              <Field label="Distrito / região" value={u.distrito ?? "—"} />
              <Field label="Telefone" value={u.telefone ?? "—"} />
              <Field label="E-mail" value={u.email_institucional ?? "—"} />
              <Field label="Responsável" value={u.responsavel_nome ?? "—"} />
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