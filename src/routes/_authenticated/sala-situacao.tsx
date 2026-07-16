import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users,
  Building2,
  Network,
  ClipboardList,
  AlertCircle,
  Clock,
  CalendarRange,
  MapPin,
  ArrowRight,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useCompetenciaAtiva } from "@/hooks/use-competencia-ativa";
import { PageHeader, KpiCard, DataTable, EmptyState, type DataTableColumn } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/sala-situacao")({
  component: SalaSituacaoPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Erro: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Não encontrado.</div>,
});

// Regra dos alertas — documentada e testável:
// - PENDÊNCIA CRÍTICA: frequencia_pendencias.status IN ('aberta','respondida')
//   e created_at < now() - 7 dias (mais de uma semana sem resolução).
// - FOLHA EM RASCUNHO NA COMPETÊNCIA: frequencias.status = 'rascunho' na
//   competência ativa (o painel de origem já sinaliza; aqui virá alerta).
// - HORAS EXTRAS ELEVADAS: unidade com total_horas_extras > 200h na
//   competência ativa (limiar operacional simples — ajustável).
const ALERT_RULES = {
  pendenciaDiasCritico: 7,
  heCriticoUnidade: 200,
} as const;

function SalaSituacaoPage() {
  const { data: competencia } = useCompetenciaAtiva();
  // MESMA fonte dos Módulos 01/04/05/07 — não recalcula nada.
  const a = useAnalytics({});

  // Últimas movimentações — origem única: audit_log. Mesma fonte usada em
  // /auditoria; aqui é apenas leitura resumida (top 10).
  const movQ = useQuery({
    queryKey: ["sala-situacao", "movimentacoes"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, ocorrido_em, usuario_email, operacao, tabela, registro_id")
        .order("ocorrido_em", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Pendências críticas (regra ALERT_RULES.pendenciaDiasCritico) — origem
  // única: frequencia_pendencias. Reproduz o mesmo padrão do Módulo 07,
  // apenas filtrando por idade.
  const alertPendCriticasQ = useQuery({
    queryKey: ["sala-situacao", "alertas-pendencias"],
    staleTime: 60_000,
    queryFn: async () => {
      const cutoff = new Date(
        Date.now() - ALERT_RULES.pendenciaDiasCritico * 24 * 3600 * 1000,
      ).toISOString();
      const { data, error } = await supabase
        .from("frequencia_pendencias")
        .select("id, titulo, status, created_at")
        .in("status", ["aberta", "respondida"])
        .is("deleted_at", null)
        .lt("created_at", cutoff)
        .order("created_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Cobertura geo do mapa — verificação sem simulação.
  const geoQ = useQuery({
    queryKey: ["sala-situacao", "geo"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const totalRes = await supabase
        .from("unidades")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null);
      const geoRes = await supabase
        .from("unidades")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (totalRes.error) throw totalRes.error;
      if (geoRes.error) throw geoRes.error;
      return { total: totalRes.count ?? 0, comGeo: geoRes.count ?? 0 };
    },
  });

  const heCriticoUnidades = useMemo(
    () => a.ranking.filter((r) => r.total_horas_extras > ALERT_RULES.heCriticoUnidade),
    [a.ranking],
  );

  type Alerta = {
    id: string;
    tipo: "pendencia" | "he" | "rascunho";
    titulo: string;
    detalhe: string;
    origem: string;
  };
  const alertas: Alerta[] = useMemo(() => {
    const list: Alerta[] = [];
    for (const p of alertPendCriticasQ.data ?? []) {
      const dias = Math.floor(
        (Date.now() - new Date(p.created_at).getTime()) / (24 * 3600 * 1000),
      );
      list.push({
        id: `pend-${p.id}`,
        tipo: "pendencia",
        titulo: p.titulo ?? "Pendência sem título",
        detalhe: `${dias} dias em aberto (status ${p.status})`,
        origem: "frequencia_pendencias",
      });
    }
    for (const u of heCriticoUnidades) {
      list.push({
        id: `he-${u.unidade_id}`,
        tipo: "he",
        titulo: u.unidade_nome,
        detalhe: `${u.total_horas_extras.toLocaleString("pt-BR")}h de HE na competência`,
        origem: "useAnalytics.ranking",
      });
    }
    if (a.frequenciasPendentes > 0) {
      list.push({
        id: "rascunho-global",
        tipo: "rascunho",
        titulo: "Folhas ainda em rascunho",
        detalhe: `${a.frequenciasPendentes} folha(s) sem envio na competência atual`,
        origem: "useAnalytics.frequenciasPendentes",
      });
    }
    return list;
  }, [alertPendCriticasQ.data, heCriticoUnidades, a.frequenciasPendentes]);

  const rankingCols: DataTableColumn<(typeof a.ranking)[number]>[] = [
    {
      key: "unidade",
      header: "Unidade",
      cell: (r) => (
        <Link
          to="/unidades/$id"
          params={{ id: r.unidade_id }}
          className="font-medium hover:underline"
        >
          {r.unidade_nome}
        </Link>
      ),
    },
    { key: "profs", header: "Profissionais", cell: (r) => r.total_profissionais },
    { key: "he", header: "Horas extras", cell: (r) => r.total_horas_extras.toLocaleString("pt-BR") },
    { key: "faltas", header: "Faltas", cell: (r) => r.total_faltas.toLocaleString("pt-BR") },
    { key: "folhas", header: "Folhas", cell: (r) => `${r.aprovadas}/${r.total_folhas}` },
  ];

  const rankingTop = a.ranking.slice(0, 10);

  const movCols: DataTableColumn<NonNullable<typeof movQ.data>[number]>[] = [
    {
      key: "quando",
      header: "Quando",
      cell: (m) => (
        <span
          className="text-xs text-muted-foreground"
          title={new Date(m.ocorrido_em).toLocaleString("pt-BR")}
        >
          {formatDistanceToNow(new Date(m.ocorrido_em), { addSuffix: true, locale: ptBR })}
        </span>
      ),
    },
    { key: "usuario", header: "Usuário", cell: (m) => m.usuario_email ?? "—" },
    { key: "operacao", header: "Operação", cell: (m) => <Badge variant="outline">{m.operacao}</Badge> },
    { key: "tabela", header: "Tabela", cell: (m) => <code className="text-xs">{m.tabela}</code> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sala de Situação da Secretaria"
        description={
          competencia
            ? `Painel executivo — competência ${competencia.mes.toString().padStart(2, "0")}/${competencia.ano}`
            : "Sem competência ativa"
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => a.refetch()}>
            <RefreshCw className="mr-1 h-4 w-4" /> Atualizar
          </Button>
        }
      />

      {/* KPIs — todos os números vêm de useAnalytics (Módulos 01/04/05/07). */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Profissionais"
          value={(a.totalProfessionals.data ?? 0).toLocaleString("pt-BR")}
          icon={<Users className="h-4 w-4" />}
        />
        <KpiCard
          label="Unidades"
          value={(a.totalUnidades.data ?? 0).toLocaleString("pt-BR")}
          icon={<Building2 className="h-4 w-4" />}
        />
        <KpiCard
          label="Setores"
          value={(a.totalSetores.data ?? 0).toLocaleString("pt-BR")}
          icon={<Network className="h-4 w-4" />}
        />
        <KpiCard
          label="Competência"
          value={
            competencia
              ? `${competencia.mes.toString().padStart(2, "0")}/${competencia.ano}`
              : "—"
          }
          icon={<CalendarRange className="h-4 w-4" />}
        />

        <KpiCard
          label="Folhas em rascunho"
          value={a.frequenciasPendentes}
          icon={<ClipboardList className="h-4 w-4" />}
          hint="Ainda não enviadas na competência"
        />
        <KpiCard
          label="Folhas aprovadas"
          value={a.frequenciasAprovadas}
          icon={<ClipboardList className="h-4 w-4" />}
        />
        <KpiCard
          label="Pendências abertas"
          value={(a.pendencias.data ?? 0).toLocaleString("pt-BR")}
          icon={<AlertCircle className="h-4 w-4" />}
        />
        <KpiCard
          label="Horas extras (comp.)"
          value={a.totalHorasExtras.toLocaleString("pt-BR")}
          icon={<Clock className="h-4 w-4" />}
          hint={`Faltas: ${a.totalFaltas.toLocaleString("pt-BR")}`}
        />
      </div>

      {/* Alertas — regras documentadas no topo do arquivo. */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4" />
            Alertas
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              (pendência &gt; {ALERT_RULES.pendenciaDiasCritico} dias · HE por unidade &gt;{" "}
              {ALERT_RULES.heCriticoUnidade}h · folhas em rascunho)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alertas.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum alerta ativo.</div>
          ) : (
            <ul className="space-y-2">
              {alertas.map((al) => (
                <li
                  key={al.id}
                  className="flex items-start gap-3 rounded-md border p-3 text-sm"
                >
                  <Badge
                    variant={al.tipo === "he" ? "destructive" : "secondary"}
                    className="mt-0.5"
                  >
                    {al.tipo === "pendencia"
                      ? "Pendência"
                      : al.tipo === "he"
                        ? "HE"
                        : "Folha"}
                  </Badge>
                  <div className="flex-1">
                    <div className="font-medium">{al.titulo}</div>
                    <div className="text-xs text-muted-foreground">{al.detalhe}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      origem: {al.origem}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base">Ranking de unidades (HE)</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link to="/controle-forca-trabalho">
                Ver todas <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {rankingTop.length === 0 ? (
              <EmptyState title="Sem dados de folha" description="Nenhuma competência com folhas processadas." />
            ) : (
              <DataTable
                rows={rankingTop}
                columns={rankingCols}
                getRowKey={(r) => r.unidade_id}
              />
            )}
            <div className="mt-2 text-xs text-muted-foreground">
              Origem: <code>useAnalytics.ranking</code>. HE/faltas são agregados por
              unidade — o mesmo valor aparece nos painéis de setor da unidade-mãe
              (limitação já documentada no Módulo 05).
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base">Últimas movimentações</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link to="/auditoria">
                Ver auditoria <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {(movQ.data ?? []).length === 0 ? (
              <EmptyState title="Sem movimentações recentes" />
            ) : (
              <DataTable
                rows={movQ.data ?? []}
                columns={movCols}
                getRowKey={(m) => String(m.id)}
              />
            )}
            <div className="mt-2 text-xs text-muted-foreground">
              Origem: <code>audit_log</code> (mesma fonte da tela /auditoria).
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mapa das unidades — bloqueado por dado ausente, não simulado. */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" /> Mapa das unidades
          </CardTitle>
        </CardHeader>
        <CardContent>
          {geoQ.data && geoQ.data.comGeo > 0 ? (
            <div className="text-sm text-muted-foreground">
              {geoQ.data.comGeo} de {geoQ.data.total} unidade(s) com coordenadas
              cadastradas. Integração de mapa não incluída neste módulo — dado
              disponível para uma futura implementação com Google Maps.
            </div>
          ) : (
            <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
              <strong className="text-foreground">Bloqueado:</strong> nenhuma
              unidade possui <code>latitude</code>/<code>longitude</code>{" "}
              preenchidas (
              {geoQ.data ? `0 de ${geoQ.data.total}` : "verificando…"}
              ). O mapa não é exibido para evitar simulação de posições. Preencha
              as coordenadas no cadastro da unidade para habilitar o mapa em uma
              próxima iteração.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}