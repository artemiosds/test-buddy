import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Network, Users, AlertTriangle, CheckCircle2, Building2, Layers, ArrowRight, UserCog, Info } from "lucide-react";
import { useState, useMemo } from "react";

import { useAnalytics } from "@/hooks/use-analytics";
import { EmptyState, KpiCard, PageHeader, FilterBar, DataTable, type DataTableColumn } from "@/components/shared";
import { PermissionGate } from "@/components/permission-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useUnidadesLookup } from "@/hooks/use-lookups";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { z } from "zod";

const searchSchema = z.object({
  unidadeId: z.string().optional().catch(undefined),
  activeTab: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/gestao-pessoas/distribuicao-setor")({
  errorComponent: ErrorComponent,
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Distribuição por Setor — Gestão da Saúde" },
      { name: "description", content: "Distribuição de profissionais por setor." },
    ],
  }),
  component: () => (
    <PermissionGate
      permission="profissional.visualizar"
      fallback={
        <div className="p-6 text-sm text-muted-foreground">
          Sem permissão para visualizar este painel.
        </div>
      }
    >
      <DistribuicaoSetor />
    </PermissionGate>
  ),
});

function DistribuicaoSetor() {
  const { unidadeId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const unidadesQ = useUnidadesLookup({ ativasOnly: true });

  const a = useAnalytics({ unidadeId });
  const data = a.distribuicaoSetor.data;
  const isLoading = a.distribuicaoSetor.isLoading;

  const rawProfs = data?.raw?.professionals ?? [];
  const rawSectors = data?.raw?.sectors ?? [];

  const summary = useMemo(() => {
    const profWithUnit = rawProfs.length;
    const profWithSetor = rawProfs.filter((p: any) => !!p.setor_id).length;
    const profWithoutSetor = rawProfs.filter((p: any) => !p.setor_id).length;
    const totalSectors = rawSectors.length;
    
    const usedSectorIds = new Set(rawProfs.map((p: any) => p.setor_id).filter(Boolean));
    const sectorsWithProfCount = usedSectorIds.size;
    const emptySectors = rawSectors.filter((s: any) => !usedSectorIds.has(s.id));
    
    const sectorsActive = rawSectors.filter((s: any) => s.status === 'ativa').length;
    const sectorsInactive = rawSectors.filter((s: any) => s.status === 'inativa').length;
    const sectorsInactiveWithProfs = rawSectors.filter((s: any) => s.status === 'inativa' && usedSectorIds.has(s.id));

    const cobertura = profWithUnit > 0 ? (profWithSetor / profWithUnit) * 100 : 0;

    const coberturaPorUnidade = data?.unidades?.map((u: any) => ({
      id: u.id,
      unidade: u.nome,
      sigla: u.sigla,
      total: u.total,
      comSetor: u.comSetor,
      semSetor: u.semSetor,
      cobertura: u.total > 0 ? (u.comSetor / u.total) * 100 : 0,
      setoresUtilizados: u.setoresCount
    })).sort((a: any, b: any) => b.semSetor - a.semSetor) ?? [];

    const semSetorDetalhado = rawProfs
      .filter((p: any) => !p.setor_id)
      .map((p: any) => ({
        id: p.id,
        nome: p.nome_completo,
        cpf: p.cpf,
        unidade: p.unidades?.nome || "—",
        cargo: p.cargos?.nome || "—",
        funcao: p.funcoes?.nome || "—",
        situacao: p.situacao_funcional || "Ativo"
      }));

    return {
      profWithUnit,
      profWithSetor,
      profWithoutSetor,
      cobertura,
      sectorsWithProfCount,
      totalSectors,
      sectorsActive,
      sectorsInactive,
      emptySectors,
      coberturaPorUnidade,
      semSetorDetalhado,
      sectorsInactiveWithProfs
    };
  }, [data]);

  const rows = useMemo(() => {
    const sectorStats = new Map();
    rawProfs.forEach((p: any) => {
      if (!p.setor_id) return;
      const sid = p.setor_id;
      if (!sectorStats.has(sid)) {
        sectorStats.set(sid, { 
          id: sid, 
          nome: p.setores?.nome || "Setor Desconhecido", 
          total: 0,
          status: p.setores?.status
        });
      }
      sectorStats.get(sid).total++;
    });
    return Array.from(sectorStats.values()).sort((a, b) => b.total - a.total);
  }, [rawProfs]);

  const patchFilter = (id: string | undefined) => {
    navigate({
      search: (prev: any) => ({ ...prev, unidadeId: id }),
      replace: true,
    });
  };

  const getClassificacao = (cobertura: number) => {
    if (cobertura >= 100) return { label: "Completa", color: "bg-green-100 text-green-700 border-green-200" };
    if (cobertura >= 90) return { label: "Quase completa", color: "bg-blue-100 text-blue-700 border-blue-200" };
    if (cobertura >= 70) return { label: "Atenção", color: "bg-amber-100 text-amber-700 border-amber-200" };
    return { label: "Crítica", color: "bg-red-100 text-red-700 border-red-200" };
  };

  const coberturaCols: DataTableColumn<any>[] = [
    { key: "unidade", header: "Unidade", cell: (r) => (
      <div className="flex flex-col">
        <span className="font-medium">{r.unidade}</span>
        {r.sigla && <span className="text-[10px] text-muted-foreground">{r.sigla}</span>}
      </div>
    )},
    { key: "total", header: "Total Prof.", className: "text-right tabular-nums", cell: (r) => r.total },
    { key: "comSetor", header: "Com Setor", className: "text-right tabular-nums text-green-600", cell: (r) => r.comSetor },
    { key: "semSetor", header: "Sem Setor", className: "text-right tabular-nums text-amber-600", cell: (r) => r.semSetor },
    { key: "cobertura", header: "Cobertura", className: "w-32", cell: (r) => (
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-[10px]">
          <span>{r.cobertura.toFixed(1)}%</span>
        </div>
        <Progress value={r.cobertura} className="h-1" />
      </div>
    )},
    { key: "status", header: "Status", cell: (r) => {
      const cls = getClassificacao(r.cobertura);
      return <Badge variant="outline" className={`${cls.color} text-[10px] font-normal`}>{cls.label}</Badge>;
    }},
    { key: "setores", header: "Setores", className: "text-right text-muted-foreground", cell: (r) => r.setoresUtilizados }
  ];

  const semSetorCols: DataTableColumn<any>[] = [
    { key: "nome", header: "Profissional", cell: (r) => (
      <div className="flex flex-col">
        <span className="font-medium">{r.nome}</span>
        <span className="text-[10px] text-muted-foreground">{r.cpf || "CPF não informado"}</span>
      </div>
    )},
    { key: "unidade", header: "Unidade", cell: (r) => r.unidade },
    { key: "cargo", header: "Cargo/Função", cell: (r) => (
      <div className="flex flex-col text-[11px]">
        <span>{r.cargo}</span>
        <span className="text-muted-foreground">{r.funcao}</span>
      </div>
    )},
    { key: "situacao", header: "Situação", cell: (r) => (
      <Badge variant="secondary" className="text-[10px] font-normal">{r.situacao}</Badge>
    )},
    {
      key: "actions",
      header: "Ações",
      className: "w-20",
      cell: (r) => (
        <PermissionGate permission="profissional.editar">
          <Link 
            to="/gestao-profissionais" 
            search={{ id: r.id }}
            className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            Regularizar <ArrowRight className="h-3 w-3" />
          </Link>
        </PermissionGate>
      )
    }
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Distribuição por Setor"
        description="Análise da setorização da força de trabalho por unidades de saúde."
      />

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3 shadow-sm">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm flex-1">
          <p className="font-semibold text-amber-900">Atenção: Pendência de Setorização</p>
          <p className="text-amber-700">
            Existem <strong>{summary.profWithoutSetor.toLocaleString("pt-BR")} profissionais</strong> vinculados a uma Unidade, mas ainda sem Setor definido. 
          </p>
        </div>
        <Link 
          to="/gestao-pessoas/distribuicao-setor" 
          search={{ ...Route.useSearch(), activeTab: 'pendencias' }}
          className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-md hover:bg-amber-700 transition-colors font-medium self-center"
        >
          Ver pendências
        </Link>
      </div>

      <FilterBar>
        <FilterBar.Field label="Filtrar por Unidade">
          <Select
            value={unidadeId || "__all__"}
            onValueChange={(v) => patchFilter(v === "__all__" ? undefined : v)}
          >
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Todas as unidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as unidades</SelectItem>
              {(unidadesQ.data ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.sigla ? `${u.sigla} — ${u.nome}` : u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
      </FilterBar>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Profissionais com Unidade"
          value={summary.profWithUnit.toLocaleString("pt-BR")}
          loading={isLoading}
          icon={<Building2 className="h-4 w-4" />}
          description="Base total de profissionais com lotação (A)."
        />
        <KpiCard
          label="Com Setor"
          value={summary.profWithSetor.toLocaleString("pt-BR")}
          loading={isLoading}
          icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
          description={`${summary.profWithSetor} de ${summary.profWithUnit} possuem setor definido (B).`}
        />
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-amber-700 flex items-center justify-between">
              SEM SETOR
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900">
              {isLoading ? "..." : summary.profWithoutSetor.toLocaleString("pt-BR")}
            </div>
            <p className="text-[10px] text-amber-600 mt-1">Pendência de setorização (C).</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              COBERTURA GERAL
              <Users className="h-4 w-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : summary.cobertura.toFixed(1)}%</div>
            <Progress value={summary.cobertura} className="h-1.5 mt-2" />
            <p className="text-[10px] text-muted-foreground mt-1">Meta de setorização atingida.</p>
          </CardContent>
        </Card>
        <KpiCard
          label="Setores com Profissionais"
          value={summary.sectorsWithProfCount.toLocaleString("pt-BR")}
          loading={isLoading}
          icon={<Layers className="h-4 w-4 text-purple-500" />}
          description="Total de setores ocupados."
        />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className={`cursor-help ${summary.sectorsInactiveWithProfs.length > 0 ? 'border-red-200 bg-red-50/20' : ''}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                    ESTADO DOS SETORES
                    {summary.sectorsInactiveWithProfs.length > 0 ? <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" /> : <Network className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{isLoading ? "..." : summary.totalSectors.toLocaleString("pt-BR")}</div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {summary.sectorsActive} ativos · {summary.sectorsInactive} inativos
                  </p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              {summary.sectorsInactiveWithProfs.length > 0 ? (
                <p className="text-red-600 font-medium">⚠ {summary.sectorsInactiveWithProfs.length} setor(es) inativo(s) com profissionais!</p>
              ) : (
                <p>Total de setores cadastrados no sistema</p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-full text-blue-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Melhor Cobertura</p>
              <p className="font-bold">
                {summary.coberturaPorUnidade.find((u: any) => u.cobertura === Math.max(...summary.coberturaPorUnidade.map((x: any) => x.cobertura)))?.unidade || "—"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-full text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Unidade com Maior Pendência</p>
              <p className="font-bold">
                {summary.coberturaPorUnidade[0]?.unidade || "—"} ({summary.coberturaPorUnidade[0]?.semSetor || 0} pendentes)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="distribuicao" className="w-full">
        <TabsList>
          <TabsTrigger value="distribuicao">Ranking por Setor</TabsTrigger>
          <TabsTrigger value="cobertura">Cobertura por Unidade</TabsTrigger>
          <TabsTrigger value="pendencias" className="text-amber-700 data-[state=active]:bg-amber-50">
            Profissionais sem Setor ({summary.profWithoutSetor})
          </TabsTrigger>
          <TabsTrigger value="setores-vazios">Setores Vazios ({summary.emptySectors.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="distribuicao" className="mt-4">
          <Card>
            <CardHeader className="py-3 border-b bg-muted/20">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Ranking baseado nos {summary.profWithSetor} profissionais com setor
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Distribuição dos profissionais que possuem setor definido na unidade selecionada.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Carregando dados...</div>
              ) : rows.length === 0 ? (
                <EmptyState
                  className="m-6"
                  title="Sem distribuição registrada"
                  description="Nenhum profissional vinculado a setores nesta visão."
                />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-muted-foreground bg-muted/10">
                      <th className="w-10 px-4 py-3 text-left">#</th>
                      <th className="px-4 py-3 text-left">Setor</th>
                      <th className="w-32 px-4 py-3 text-right">Profissionais</th>
                      <th className="w-24 px-4 py-3 text-right">% dos prof. com setor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r: any, i: number) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/5 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                        <td className="px-4 py-3 font-medium">
                          {r.nome}
                          {r.status === 'inativa' && (
                            <Badge variant="destructive" className="ml-2 text-[8px] h-4">⚠ Inativo com profissionais</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {r.total.toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {summary.profWithSetor > 0 ? ((r.total / summary.profWithSetor) * 100).toFixed(1) : "0"}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cobertura" className="mt-4">
          <Card>
            <CardHeader className="py-3 border-b bg-muted/20">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                Indicadores de Setorização por Unidade
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                rows={summary.coberturaPorUnidade}
                columns={coberturaCols}
                loading={isLoading}
                getRowKey={(r) => r.id}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pendencias" className="mt-4">
          <Card className="border-amber-200">
            <CardHeader className="py-3 border-b bg-amber-50/50 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm font-semibold text-amber-800">
                  Lista de Profissionais sem Setor Definido
                </CardTitle>
                <p className="text-[10px] text-amber-600">Somente profissionais ativos, com unidade e sem setor.</p>
              </div>
              <div className="px-2 py-1 bg-amber-100 rounded text-[10px] text-amber-700 border border-amber-200 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Diagnóstico: A ({summary.profWithUnit}) = B ({summary.profWithSetor}) + C ({summary.profWithoutSetor})
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                rows={summary.semSetorDetalhado}
                columns={semSetorCols}
                loading={isLoading}
                emptyTitle="Nenhuma pendência encontrada"
                getRowKey={(r) => r.id}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="setores-vazios" className="mt-4">
          <Card>
            <CardHeader className="py-3 border-b">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                Setores sem Profissionais Vinculados
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {summary.emptySectors.length === 0 ? (
                <div className="text-sm text-center text-muted-foreground py-8">Todos os setores possuem pelo menos um profissional.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {summary.emptySectors.map((s: any) => (
                    <div key={s.id} className="flex items-center gap-2 p-2 rounded border bg-muted/10">
                      <Layers className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs">{s.nome}</span>
                      <Badge variant="outline" className="ml-auto text-[10px]">Vazio</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <div className="text-[10px] text-muted-foreground text-center border-t pt-4">
        Regra de Consistência: {summary.profWithUnit} (Total com Unidade) = {summary.profWithSetor} (Com Setor) + {summary.profWithoutSetor} (Sem Setor)
      </div>
    </div>
  );
}
