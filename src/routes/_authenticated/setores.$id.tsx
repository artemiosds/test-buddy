import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Users,
  Briefcase,
  ClipboardList,
  AlertCircle,
  Clock,
  RefreshCw,
  UserCheck,
  Layers,
  ArrowRightLeft,
  Search,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAnalytics } from "@/hooks/use-analytics";
import { AnalyticsFilterProvider } from "@/context/analytics-filter-context";
import { PermissionGate } from "@/components/permission-gate";
import {
  PageHeader,
  KpiCard,
  DataTable,
  EmptyState,
  StatusBadge,
  type DataTableColumn,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export const Route = createFileRoute("/_authenticated/setores/$id")({
  component: () => (
    <PermissionGate
      anyOf={["unidade.visualizar", "profissional.visualizar"]}
      fallback={
        <div className="p-6 text-sm text-muted-foreground">
          Sem permissão para visualizar este painel.
        </div>
      }
    >
      <AnalyticsFilterProvider>
        <SetorPainelPage />
      </AnalyticsFilterProvider>
    </PermissionGate>
  ),
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Erro: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Setor não encontrado.</div>,
});

type ProfRow = {
  id: string;
  nome_completo: string;
  matricula: string | null;
  status: string;
  cargo_id: string | null;
  funcao_id: string | null;
  vinculo_id: string | null;
  cargo: { nome: string } | null;
  funcao: { nome: string } | null;
  vinculo: { nome: string | null; natureza: string | null } | null;
};

function SetorPainelPage() {
  const { id } = Route.useParams();
  const router = useRouter();

  const setorQ = useQuery({
    queryKey: ["setor-painel", id, "meta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setores")
        .select(
          "id, nome, sigla, status, unidade_id, gestor:profissionais!setores_gestor_id_fkey(id, nome_completo), unidade:unidades(id, nome, sigla)",
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
        unidade_id: string;
        gestor: { id: string; nome_completo: string } | null;
        unidade: { id: string; nome: string; sigla: string | null } | null;
      } | null;
    },
  });

  const profsQ = useQuery({
    queryKey: ["setor-painel", id, "profs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select(
          "id, nome_completo, matricula, status, cargo_id, funcao_id, vinculo_id, cargo:cargos(nome), funcao:funcoes(nome), vinculo:vinculos(nome, natureza)",
        )
        .eq("setor_id", id)
        .is("deleted_at", null)
        .order("nome_completo")
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as ProfRow[];
    },
  });

  const movsQ = useQuery({
    queryKey: ["setor-painel", id, "movs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissional_historico_funcional")
        .select(
          "id, data_inicio, tipo_evento, setor_anterior_id, setor_novo_id, profissional:profissionais(nome_completo), setor_ant:setores!profissional_historico_funcional_setor_anterior_id_fkey(nome, sigla), setor_novo:setores!profissional_historico_funcional_setor_novo_id_fkey(nome, sigla)",
        )
        .or(`setor_anterior_id.eq.${id},setor_novo_id.eq.${id}`)
        .is("deleted_at", null)
        .order("data_inicio", { ascending: false })
        .limit(5);
      if (error) return [];
      return data ?? [];
    },
    retry: false,
  });

  const s = setorQ.data;
  const a = useAnalytics({ unidadeId: s?.unidade_id ?? undefined, setorId: id });
  const profs = profsQ.data ?? [];

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {};
    const cargos = new Set<string>();
    const funcoes = new Set<string>();
    for (const p of profs) {
      byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
      if (p.cargo_id) cargos.add(p.cargo_id);
      if (p.funcao_id) funcoes.add(p.funcao_id);
    }
    return {
      byStatus,
      ativos: byStatus["ativo"] ?? 0,
      afastados: byStatus["afastado"] ?? 0,
      ferias: byStatus["ferias"] ?? 0,
      licencas: byStatus["licenca"] ?? 0,
      cargos: cargos.size,
      funcoes: funcoes.size,
    };
  }, [profs]);

  const distCargo = useMemo(() => rankBy(profs, (p) => p.cargo?.nome ?? "Sem cargo"), [profs]);
  const distVinculo = useMemo(
    () => rankBy(profs, (p) => p.vinculo?.nome ?? p.vinculo?.natureza ?? "Sem vínculo"),
    [profs],
  );
  const distStatus = useMemo(() => rankBy(profs, (p) => p.status), [profs]);

  const [teamSearch, setTeamSearch] = useState("");
  const teamFiltered = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    if (!q) return profs;
    return profs.filter(
      (p) =>
        p.nome_completo.toLowerCase().includes(q) ||
        (p.matricula ?? "").toLowerCase().includes(q) ||
        (p.cargo?.nome ?? "").toLowerCase().includes(q),
    );
  }, [profs, teamSearch]);

  if (setorQ.isLoading)
    return <div className="p-6 text-sm text-muted-foreground">Carregando painel...</div>;
  if (!s) return <div className="p-6">Setor não encontrado.</div>;

  const compAtiva = a.competenciaAtiva;

  const teamCols: DataTableColumn<ProfRow>[] = [
    {
      key: "nome",
      header: "Nome",
      cell: (r) => <span className="font-medium">{r.nome_completo}</span>,
    },
    { key: "mat", header: "Matrícula", cell: (r) => r.matricula ?? "—" },
    { key: "cargo", header: "Cargo", cell: (r) => r.cargo?.nome ?? "—" },
    { key: "funcao", header: "Função", cell: (r) => r.funcao?.nome ?? "—" },
    {
      key: "st",
      header: "Status",
      cell: (r) => <StatusBadge domain="profissional" value={r.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/gestao-pessoas">Gestão da Saúde</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/setores">Setores</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{s.nome}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title={s.nome}
        description={[
          s.unidade ? `Unidade: ${s.unidade.sigla ?? s.unidade.nome}` : null,
          s.sigla ? `Sigla: ${s.sigla}` : null,
          compAtiva
            ? `Competência ${String(compAtiva.mes).padStart(2, "0")}/${compAtiva.ano}`
            : null,
        ]
          .filter(Boolean)
          .join(" • ")}
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link to="/unidades/$id" params={{ id: s.unidade_id }}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Painel da unidade
              </Link>
            </Button>
            <Button variant="outline" onClick={() => router.invalidate()}>
              <RefreshCw className="mr-1 h-4 w-4" /> Atualizar
            </Button>
          </>
        }
      />

      <Section title="Resumo">
        <KpiGrid>
          <KpiCard
            label="Profissionais"
            value={profs.length}
            loading={profsQ.isLoading}
            icon={<Users className="h-4 w-4" />}
          />
          <KpiCard
            label="Ativos"
            value={counts.ativos}
            loading={profsQ.isLoading}
            icon={<UserCheck className="h-4 w-4" />}
          />
          <KpiCard label="Afastados" value={counts.afastados} loading={profsQ.isLoading} />
          <KpiCard label="Férias" value={counts.ferias} loading={profsQ.isLoading} />
          <KpiCard label="Licenças" value={counts.licencas} loading={profsQ.isLoading} />
          <KpiCard
            label="Cargos"
            value={counts.cargos}
            loading={profsQ.isLoading}
            icon={<Briefcase className="h-4 w-4" />}
          />
          <KpiCard
            label="Funções"
            value={counts.funcoes}
            loading={profsQ.isLoading}
            icon={<Layers className="h-4 w-4" />}
          />
          <KpiCard
            label="Unidade"
            value={s.unidade?.sigla ?? s.unidade?.nome ?? "—"}
            loading={false}
          />
        </KpiGrid>
      </Section>

      <Section title="Distribuição">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <DistCard
            title="Profissionais por Cargo"
            rows={distCargo}
            loading={profsQ.isLoading}
            labelHeader="Cargo"
          />
          <DistCard
            title="Profissionais por Vínculo"
            rows={distVinculo}
            loading={profsQ.isLoading}
            labelHeader="Vínculo"
          />
          <DistCard
            title="Profissionais por Status"
            rows={distStatus}
            loading={profsQ.isLoading}
            labelHeader="Status"
            renderLabel={(v) => <StatusBadge domain="profissional" value={v} />}
          />
        </div>
      </Section>

      <Section title="Operação">
        <KpiGrid>
          <KpiCard
            label="Pendências abertas"
            value={a.pendencias.data ?? 0}
            loading={a.pendencias.isLoading}
            hint="Unidade-mãe"
            icon={<AlertCircle className="h-4 w-4" />}
          />
          <KpiCard
            label="Horas extras (competência)"
            value={a.totalHorasExtras.toLocaleString("pt-BR")}
            loading={a.frequencias.isLoading}
            hint="Unidade-mãe"
            icon={<Clock className="h-4 w-4" />}
          />
          <KpiCard
            label="Faltas (competência)"
            value={a.totalFaltas.toLocaleString("pt-BR")}
            loading={a.frequencias.isLoading}
            hint="Unidade-mãe"
            icon={<ClipboardList className="h-4 w-4" />}
          />
        </KpiGrid>
        <p className="text-xs text-muted-foreground">
          Frequências são agregadas por unidade+competência no schema atual e refletem o total da
          unidade-mãe.
        </p>
      </Section>

      <Section title="Equipe">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">Profissionais do setor</CardTitle>
              <div className="text-xs text-muted-foreground">
                Responsável:{" "}
                <span className="font-medium text-foreground">
                  {s.gestor?.nome_completo ?? "—"}
                </span>
              </div>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                placeholder="Buscar na equipe..."
                className="pl-8"
              />
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={teamFiltered}
              columns={teamCols}
              getRowKey={(r) => r.id}
              loading={profsQ.isLoading}
              emptyTitle="Nenhum profissional"
              emptyDescription={
                teamSearch
                  ? "Nenhum resultado para a busca."
                  : "Nenhum profissional vinculado a este setor."
              }
            />
          </CardContent>
        </Card>
      </Section>

      <Section title="Últimas movimentações">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" /> Últimas 5 alterações de lotação
            </CardTitle>
          </CardHeader>
          <CardContent>
            {movsQ.isLoading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : (movsQ.data?.length ?? 0) === 0 ? (
              <EmptyState
                title="Nenhuma movimentação registrada"
                description="Não há histórico de lotação envolvendo este setor."
              />
            ) : (
              <ul className="divide-y text-sm">
                {(movsQ.data ?? []).map((m) => {
                  const row = m as unknown as {
                    id: string;
                    data_inicio: string;
                    tipo_evento: string;
                    profissional: { nome_completo: string } | null;
                    setor_ant: { nome: string; sigla: string | null } | null;
                    setor_novo: { nome: string; sigla: string | null } | null;
                  };
                  return (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <div>
                        <div className="font-medium">{row.profissional?.nome_completo ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.tipo_evento} • {row.setor_ant?.sigla ?? row.setor_ant?.nome ?? "—"} →{" "}
                          {row.setor_novo?.sigla ?? row.setor_novo?.nome ?? "—"}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {new Date(row.data_inicio).toLocaleDateString("pt-BR")}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{children}</div>;
}

function rankBy<T>(items: T[], keyFn: (x: T) => string): Array<{ label: string; total: number }> {
  const map = new Map<string, number>();
  for (const it of items) {
    const k = keyFn(it) || "—";
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);
}

function DistCard({
  title,
  rows,
  loading,
  labelHeader = "Item",
  renderLabel,
}: {
  title: string;
  rows: Array<{ label: string; total: number }>;
  loading?: boolean;
  labelHeader?: string;
  renderLabel?: (v: string) => React.ReactNode;
}) {
  const cols: DataTableColumn<{ label: string; total: number }>[] = [
    {
      key: "label",
      header: labelHeader,
      cell: (r) => (renderLabel ? renderLabel(r.label) : r.label),
    },
    {
      key: "total",
      header: "Total",
      cell: (r) => <span className="tabular-nums">{r.total}</span>,
      className: "text-right w-24",
      headerClassName: "text-right",
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          rows={rows}
          columns={cols}
          loading={loading}
          getRowKey={(r) => r.label}
          emptyTitle="Sem dados"
        />
      </CardContent>
    </Card>
  );
}
