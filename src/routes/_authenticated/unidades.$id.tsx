import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Users,
  Building2,
  Briefcase,
  ClipboardList,
  AlertCircle,
  Clock,
  CalendarRange,
  RefreshCw,
  UserCheck,
  Layers,
  ArrowRightLeft,
  Search,
  Phone,
  Mail,
  MapPin,
  Hash,
  IdCard,
  Stethoscope,
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

export const Route = createFileRoute("/_authenticated/unidades/$id")({ errorComponent: ErrorComponent,
  component: () => (
    <PermissionGate
      permission="unidade.visualizar"
      fallback={
        <div className="p-6 text-sm text-muted-foreground">
          Sem permissão para visualizar este painel.
        </div>
      }
    >
      <AnalyticsFilterProvider>
        <UnidadePainelPage />
      </AnalyticsFilterProvider>
    </PermissionGate>
  ),
  
  notFoundComponent: () => <div className="p-6">Unidade não encontrada.</div>,
});

type ProfRow = {
  id: string;
  nome_completo: string;
  matricula: string | null;
  status: string;
  setor_id: string | null;
  cargo_id: string | null;
  funcao_id: string | null;
  vinculo_id: string | null;
  setor: { nome: string } | null;
  cargo: { nome: string } | null;
  funcao: { nome: string } | null;
  vinculo: { nome: string | null; natureza: string | null } | null;
};

function UnidadePainelPage() {
  const { id } = Route.useParams();
  const router = useRouter();

  const unidadeQ = useQuery({
    queryKey: ["unidade-painel", id, "meta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidades")
        .select(
          "id, nome, sigla, cnes, cnpj, tipo_unidade, nivel_complexidade, horario_funcionamento, telefone, email_institucional, endereco, status, municipio, distrito, responsavel_nome, secretaria:secretarias(nome, sigla)",
        )
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const setoresListQ = useQuery({
    queryKey: ["unidade-painel", id, "setores-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setores")
        .select("id, nome")
        .eq("unidade_id", id)
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const profsQ = useQuery({
    queryKey: ["unidade-painel", id, "profs", (setoresListQ.data ?? []).map((s) => s.id).join(",")],
    enabled: !setoresListQ.isLoading,
    queryFn: async () => {
      const setorIds = (setoresListQ.data ?? []).map((s) => s.id);
      let query = supabase
        .from("profissionais")
        .select(
          "id, nome_completo, matricula, status, setor_id, cargo_id, funcao_id, vinculo_id, setor:setores!profissionais_setor_id_fkey(nome), cargo:cargos(nome), funcao:funcoes(nome), vinculo:vinculos(nome, natureza)",
        )
        .is("deleted_at", null)
        .order("nome_completo")
        .limit(200); // Reduzido drasticamente para exibição na lista de equipe

      if (setorIds.length) {
        query = query.or(`unidade_id.eq.${id},setor_id.in.(${setorIds.join(",")})`);
      } else {
        query = query.eq("unidade_id", id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as ProfRow[];
    },
  });

  const ultimaCompQ = useQuery({
    queryKey: ["unidade-painel", id, "ultima-comp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competencia_unidades")
        .select("status, competencia:competencias(mes, ano)")
        .eq("unidade_id", id)
        .is("deleted_at", null)
        .limit(50);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Array<{
        status: string;
        competencia: { mes: number; ano: number } | null;
      }>;
      const processadas = rows.filter(
        (r) => r.competencia && ["aprovada", "encerrada", "processada"].includes(String(r.status)),
      );
      const sorted = (processadas.length ? processadas : rows.filter((r) => r.competencia)).sort(
        (a, b) =>
          b.competencia!.ano - a.competencia!.ano || b.competencia!.mes - a.competencia!.mes,
      );
      return sorted[0]?.competencia ?? null;
    },
  });

  const movimentacoesQ = useQuery({
    queryKey: ["unidade-painel", id, "movs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissional_historico_funcional")
        .select(
          "id, data_inicio, tipo_evento, unidade_anterior_id, unidade_novo_id, profissional:profissionais(nome_completo), unid_ant:unidades!profissional_historico_funcional_unidade_anterior_id_fkey(nome, sigla), unid_novo:unidades!profissional_historico_funcional_unidade_novo_id_fkey(nome, sigla)",
        )
        .or(`unidade_anterior_id.eq.${id},unidade_novo_id.eq.${id}`)
        .is("deleted_at", null)
        .order("data_inicio", { ascending: false })
        .limit(5);
      if (error) return [];
      return data ?? [];
    },
    retry: false,
  });

  const a = useAnalytics({ unidadeId: id });
  const summaryQ = useQuery({
    queryKey: ["unidade-painel", id, "summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_unidade_dashboard_summary", {
        p_unidade_id: id,
      });
      if (error) throw error;
      return data as {
        total_profissionais: number;
        ativos: number;
        afastados: number;
        ferias: number;
        licencas: number;
        cargos: number;
        funcoes: number;
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const counts = summaryQ.data ?? {
    total_profissionais: 0,
    ativos: 0,
    afastados: 0,
    ferias: 0,
    licencas: 0,
    cargos: 0,
    funcoes: 0,
  };


  const distSetor = useMemo(() => [], []);
  const distCargo = useMemo(() => [], []);
  const distVinculo = useMemo(() => [], []);
  const distStatus = useMemo(() => [], []);


  const [teamSearch, setTeamSearch] = useState("");
  const teamFiltered = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    const data = (profsQ.data ?? []) as ProfRow[];
    if (!q) return data;
    return data.filter(
      (p) =>
        p.nome_completo.toLowerCase().includes(q) ||
        (p.matricula ?? "").toLowerCase().includes(q) ||
        (p.cargo?.nome ?? "").toLowerCase().includes(q) ||
        (p.funcao?.nome ?? "").toLowerCase().includes(q),
    );
  }, [profsQ.data, teamSearch]);


  const u = unidadeQ.data;
  const compAtivaId = a.competenciaId;
  const ultimaProcessada = ultimaCompQ.data;

  if (unidadeQ.isLoading)
    return <div className="p-6 text-sm text-muted-foreground">Carregando painel...</div>;
  if (!u) return <div className="p-6">Unidade não encontrada.</div>;

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
              <Link to="/unidades">Unidades</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{u.nome}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title={u.nome}
        description={[
          u.secretaria?.sigla ?? u.secretaria?.nome,
          u.municipio,
          u.distrito,
          u.cnes ? `CNES ${u.cnes}` : null,
        ]
          .filter(Boolean)
          .join(" • ")}
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link to="/unidades">
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
              </Link>
            </Button>
            <Button variant="outline" onClick={() => router.invalidate()}>
              <RefreshCw className="mr-1 h-4 w-4" /> Atualizar
            </Button>
          </>
        }
      />

      <Section title="Informações da Unidade">
        <Card>
          <CardContent className="grid gap-3 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <InfoItem icon={<Building2 className="h-4 w-4" />} label="Tipo" value={u.tipo_unidade} />
            <InfoItem icon={<Stethoscope className="h-4 w-4" />} label="Nível de complexidade" value={u.nivel_complexidade} />
            <InfoItem icon={<Hash className="h-4 w-4" />} label="CNES" value={u.cnes} mono />
            <InfoItem icon={<IdCard className="h-4 w-4" />} label="CNPJ" value={u.cnpj} mono />
            <InfoItem icon={<Phone className="h-4 w-4" />} label="Telefone" value={u.telefone as string | null} />
            <InfoItem icon={<Mail className="h-4 w-4" />} label="E-mail" value={u.email_institucional} />
            <InfoItem icon={<Clock className="h-4 w-4" />} label="Horário" value={u.horario_funcionamento as string | null} />
            <InfoItem icon={<UserCheck className="h-4 w-4" />} label="Responsável" value={u.responsavel_nome} />
            <InfoItem icon={<MapPin className="h-4 w-4" />} label="Endereço" value={u.endereco as string | null} className="sm:col-span-2 lg:col-span-3" />
          </CardContent>
        </Card>
      </Section>


      <Section title="Resumo">
        <KpiGrid>
          <KpiCard
            label="Profissionais"
            value={counts.total_profissionais}
            loading={summaryQ.isLoading}

            icon={<Users className="h-4 w-4" />}
          />
          <KpiCard
            label="Ativos"
            value={counts.ativos}
            loading={summaryQ.isLoading}

            icon={<UserCheck className="h-4 w-4" />}
          />
          <KpiCard label="Afastados" value={counts.afastados} loading={summaryQ.isLoading} />
          <KpiCard label="Férias" value={counts.ferias} loading={summaryQ.isLoading} />
          <KpiCard label="Licenças" value={counts.licencas} loading={summaryQ.isLoading} />

          <KpiCard
            label="Setores"
            value={setoresListQ.data?.length ?? 0}
            loading={setoresListQ.isLoading}
            icon={<Building2 className="h-4 w-4" />}
          />
          <KpiCard
            label="Cargos"
            value={counts.cargos}
            loading={summaryQ.isLoading}
            icon={<Briefcase className="h-4 w-4" />}
          />
          <KpiCard
            label="Funções"
            value={counts.funcoes}
            loading={summaryQ.isLoading}

            icon={<Layers className="h-4 w-4" />}
          />
        </KpiGrid>
      </Section>

      <Section title="Distribuição">
        <div className="grid gap-3 md:grid-cols-2">
          <DistCard
            title="Profissionais por Setor (top 10)"
            rows={distSetor}
            loading={profsQ.isLoading}
          />
          <DistCard
            title="Profissionais por Cargo (top 10)"
            rows={distCargo}
            loading={profsQ.isLoading}
          />
          <DistCard
            title="Profissionais por Vínculo"
            rows={distVinculo}
            loading={profsQ.isLoading}
          />
          <DistCard
            title="Profissionais por Status"
            rows={distStatus}
            loading={profsQ.isLoading}
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
            icon={<AlertCircle className="h-4 w-4" />}
          />
          <KpiCard
            label="Horas extras (competência)"
            value={a.totals.horasExtras.toLocaleString("pt-BR")}
            loading={a.loading}
            hint={
              compAtivaId ? `Competência selecionada` : undefined
            }
            icon={<Clock className="h-4 w-4" />}
          />
          <KpiCard
            label="Faltas (competência)"
            value={a.totals.faltas.toLocaleString("pt-BR")}
            loading={a.loading}
            icon={<ClipboardList className="h-4 w-4" />}
          />
          <KpiCard
            label="Última competência processada"
            value={
              ultimaProcessada
                ? `${String(ultimaProcessada.mes).padStart(2, "0")}/${ultimaProcessada.ano}`
                : "—"
            }
            loading={ultimaCompQ.isLoading}
            icon={<CalendarRange className="h-4 w-4" />}
          />
        </KpiGrid>
      </Section>

      <Section title="Equipe">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">Profissionais lotados</CardTitle>
              <div className="text-xs text-muted-foreground">
                Gestor da unidade:{" "}
                <span className="font-medium text-foreground">{u.responsavel_nome ?? "—"}</span>
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
                  : "Nenhum profissional vinculado a esta unidade."
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
            {movimentacoesQ.isLoading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : (movimentacoesQ.data?.length ?? 0) === 0 ? (
              <EmptyState
                title="Nenhuma movimentação registrada"
                description="Não há histórico de lotação envolvendo esta unidade."
              />
            ) : (
              <ul className="divide-y text-sm">
                {(movimentacoesQ.data ?? []).map((m) => {
                  const row = m as unknown as {
                    id: string;
                    data_inicio: string;
                    tipo_evento: string;
                    profissional: { nome_completo: string } | null;
                    unid_ant: { nome: string; sigla: string | null } | null;
                    unid_novo: { nome: string; sigla: string | null } | null;
                  };
                  return (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <div>
                        <div className="font-medium">{row.profissional?.nome_completo ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.tipo_evento} • {row.unid_ant?.sigla ?? row.unid_ant?.nome ?? "—"} →{" "}
                          {row.unid_novo?.sigla ?? row.unid_novo?.nome ?? "—"}
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

function InfoItem({
  icon,
  label,
  value,
  mono,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={"flex items-start gap-2 " + (className ?? "")}>
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={"truncate " + (mono ? "font-mono text-xs" : "text-sm")}>
          {value?.trim() ? value : <span className="text-muted-foreground">—</span>}
        </div>
      </div>
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
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
      {children}
    </div>
  );
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
  renderLabel,
}: {
  title: string;
  rows: Array<{ label: string; total: number }>;
  loading?: boolean;
  renderLabel?: (v: string) => React.ReactNode;
}) {
  const cols: DataTableColumn<{ label: string; total: number }>[] = [
    {
      key: "label",
      header: title.includes("Status")
        ? "Status"
        : title.includes("Vínculo")
          ? "Vínculo"
          : title.includes("Setor")
            ? "Setor"
            : title.includes("Cargo")
              ? "Cargo"
              : "Item",
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
