import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Briefcase, Users, Building2, Layers, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAnalytics } from "@/hooks/use-analytics";
import { PermissionGate } from "@/components/permission-gate";
import {
  PageHeader, KpiCard, DataTable, EmptyState, StatusBadge,
  type DataTableColumn,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export const Route = createFileRoute("/_authenticated/funcoes/$id")({
  component: FuncaoPainel,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Erro: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Função não encontrada.</div>,
});

function FuncaoPainel() {
  return (
    <PermissionGate
      permission="profissional.visualizar"
      fallback={<div className="p-6 text-sm text-muted-foreground">Sem permissão para visualizar este painel.</div>}
    >
      <FuncaoPainelContent />
    </PermissionGate>
  );
}

function FuncaoPainelContent() {
  const { id } = Route.useParams();

  const metaQ = useQuery({
    queryKey: ["funcao-painel", id, "meta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcoes")
        .select("id, nome, codigo, gratificacao_percentual, status, cargo:cargos(nome)")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const a = useAnalytics({ funcaoId: id });
  const equipe = a.equipeProfissionais.data ?? [];
  const status = a.statusBreakdown.data ?? {};
  const vinc = a.vinculoBreakdown.data ?? { efetivos: 0, temporarios: 0, outros: 0 };
  const porUnidade = a.distribuicaoUnidade.data ?? [];
  const porSetor = a.distribuicaoSetor.data ?? [];
  const total = a.totalProfessionals.data ?? 0;

  const [q, setQ] = useState("");
  const equipeFiltrada = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return equipe;
    return equipe.filter(
      (p) =>
        p.nome_completo.toLowerCase().includes(s) ||
        (p.matricula ?? "").toLowerCase().includes(s) ||
        (p.setor?.nome ?? "").toLowerCase().includes(s) ||
        (p.unidade?.nome ?? "").toLowerCase().includes(s),
    );
  }, [equipe, q]);

  const cols: DataTableColumn<typeof equipe[number]>[] = [
    { key: "nome", header: "Nome", cell: (p) => <span className="font-medium">{p.nome_completo}</span> },
    { key: "unidade", header: "Unidade", cell: (p) => p.unidade?.sigla ?? p.unidade?.nome ?? "—" },
    { key: "setor", header: "Setor", cell: (p) => p.setor?.nome ?? "—" },
    { key: "status", header: "Status", cell: (p) => <StatusBadge domain="profissional" value={p.status} /> },
  ];

  const rankCols = <T extends { nome: string; total: number }>(): DataTableColumn<T>[] => [
    { key: "nome", header: "Nome", cell: (r) => r.nome },
    { key: "total", header: <span className="block text-right">Total</span>, cell: (r) => <span className="block text-right tabular-nums">{r.total}</span>, className: "text-right" },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink asChild><Link to="/gestao-pessoas">Gestão da Saúde</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink asChild><Link to="/cargos-funcoes" hash="funcoes">Funções</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{metaQ.data?.nome ?? "…"}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title={metaQ.data?.nome ?? "Função"}
        description={[
          metaQ.data?.codigo && `Código ${metaQ.data.codigo}`,
          metaQ.data?.cargo?.nome && `Cargo: ${metaQ.data.cargo.nome}`,
          metaQ.data?.gratificacao_percentual != null && `Gratificação ${metaQ.data.gratificacao_percentual}%`,
        ].filter(Boolean).join(" · ") || "Painel da função"}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/cargos-funcoes" hash="funcoes"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</Link>
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Profissionais" value={total.toLocaleString("pt-BR")} loading={a.totalProfessionals.isLoading} icon={<Users className="h-4 w-4" />} />
        <KpiCard label="Ativos" value={(status.ativo ?? 0).toLocaleString("pt-BR")} loading={a.statusBreakdown.isLoading} />
        <KpiCard label="Afastados" value={(status.afastado ?? 0).toLocaleString("pt-BR")} loading={a.statusBreakdown.isLoading} />
        <KpiCard label="Férias" value={(status.ferias ?? 0).toLocaleString("pt-BR")} loading={a.statusBreakdown.isLoading} />
        <KpiCard label="Licenças" value={(status.licenca ?? 0).toLocaleString("pt-BR")} loading={a.statusBreakdown.isLoading} />
        <KpiCard label="Unidades" value={porUnidade.length.toLocaleString("pt-BR")} loading={a.distribuicaoUnidade.isLoading} icon={<Building2 className="h-4 w-4" />} />
        <KpiCard label="Setores" value={porSetor.length.toLocaleString("pt-BR")} loading={a.distribuicaoSetor.isLoading} icon={<Layers className="h-4 w-4" />} />
        <KpiCard label="Efetivos / Temporários" value={`${vinc.efetivos} / ${vinc.temporarios}`} loading={a.vinculoBreakdown.isLoading} icon={<Briefcase className="h-4 w-4" />} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Profissionais por Unidade</CardTitle></CardHeader>
          <CardContent>
            <DataTable
              rows={porUnidade.slice(0, 10)}
              getRowKey={(r) => r.id}
              columns={rankCols<{ id: string; nome: string; sigla: string | null; total: number }>()}
              loading={a.distribuicaoUnidade.isLoading}
              emptyTitle="Sem lotação"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Profissionais por Setor</CardTitle></CardHeader>
          <CardContent>
            <DataTable
              rows={porSetor.slice(0, 10)}
              getRowKey={(r) => r.id}
              columns={rankCols<{ id: string; nome: string; total: number }>()}
              loading={a.distribuicaoSetor.isLoading}
              emptyTitle="Sem lotação"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Por Vínculo</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="flex justify-between"><span>Efetivos</span><span className="tabular-nums">{vinc.efetivos}</span></div>
            <div className="flex justify-between"><span>Temporários</span><span className="tabular-nums">{vinc.temporarios}</span></div>
            <div className="flex justify-between"><span>Outros</span><span className="tabular-nums">{vinc.outros}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Por Status</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            {Object.entries(status).length === 0 ? (
              <EmptyState title="Sem dados" />
            ) : (
              Object.entries(status).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <StatusBadge domain="profissional" value={k} />
                  <span className="tabular-nums">{v}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-sm">Equipe ({equipeFiltrada.length})</CardTitle>
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, matrícula, setor…" className="pl-8" />
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={equipeFiltrada}
              getRowKey={(p) => p.id}
              columns={cols}
              loading={a.equipeProfissionais.isLoading}
              emptyTitle="Nenhum profissional com esta função"
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
