import { BotaoRelatorioAbnt } from "@/components/relatorios-gerenciais/botao-relatorio-abnt";
import { relatorioPainelAbnt } from "@/lib/painel-abnt";
import { blocosPdfCompletos } from "@/lib/pdf-blocos-completos";
import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet } from "lucide-react";
import { KpiCard } from "@/components/shared";
import { formatNumber as fmt } from "@/lib/formatters";
import { toast } from "sonner";
import { loadPdfKit, loadXlsxKit } from "@/lib/lazy-exports";
import { usePermissions, useCurrentUser } from "@/hooks/use-permissions";
import { RelatoriosTabs } from "@/components/relatorios-tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { finalizarPdf } from "@/lib/pdf-pipeline";
import { getAggregatedFrequencies } from "@/lib/analytics-aggregations";
import { ConsolidacaoOficialPanel, linhasDaVisao, type VisaoOficial } from "@/components/relatorios/consolidacao-oficial-panel";
import { AlertasComparativoPanel } from "@/components/relatorios/alertas-comparativo-panel";
import { AnalisesAvancadasPanel } from "@/components/relatorios/analises-avancadas-panel";

export const Route = createFileRoute("/_authenticated/relatorios-executivo")({ errorComponent: ErrorComponent,
  component: RelatorioExecutivoPage,
});

const MES_LABEL = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];
const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "#22c55e",
  "#ef4444",
  "#f59e0b",
  "#8b5cf6",
];

function hoursBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 36e5;
}

function RelatorioExecutivoPage() {
  const { has, isLoading: permLoading } = usePermissions();
  const { data: me } = useCurrentUser();
  const isMaster = !!me?.is_master;
  const canView = isMaster || has("relatorio.visualizar");
  const canExport = isMaster || has("relatorio.exportar");

  // Se não for master e não tiver permissão específica, bloqueia acesso a esta tela global
  if (!permLoading && !isMaster && !has("relatorio.visualizar_executivo")) {
     // Redirecionamento ou mensagem de erro
  }

  const [competenciaId, setCompetenciaId] = useState<string>("");

  const { data: competencias } = useQuery({
    queryKey: ["exec-competencias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competencias")
        .select("id, ano, mes, status")
        .is("deleted_at", null)
        .order("ano", { ascending: false })
        .order("mes", { ascending: false })
        .limit(24);
      if (error) throw error;
      return data ?? [];
    },
  });

  const compLabel = useMemo(() => {
    const c = competencias?.find((x) => x.id === competenciaId);
    return c ? `${MES_LABEL[c.mes - 1]}/${c.ano}` : "—";
  }, [competencias, competenciaId]);

  // Consolidado oficial (Efetivos + Contratados, somente aprovadas)
  const [visao, setVisao] = useState<VisaoOficial>("consolidado");
  const { data: summary, isLoading: loadingOficial } = useQuery({
    queryKey: ["exec-oficial", competenciaId],
    enabled: !!competenciaId && canView,
    queryFn: () => getAggregatedFrequencies({ competenciaId }),
  });
  const consolidado = useMemo(() => {
    if (!summary) return undefined;
    const map = new Map<string, { unidade: string; he50: number; he100: number; adn: number; plantoes: number; total: number; aprov: number }>();
    for (const l of linhasDaVisao(summary.oficial, visao)) {
      const cur = map.get(l.unidade_id) ?? { unidade: l.unidade_sigla ?? l.unidade_nome, he50: 0, he100: 0, adn: 0, plantoes: 0, total: 0, aprov: 0 };
      cur.he50 += l.he50; cur.he100 += l.he100; cur.adn += l.adn; cur.plantoes += l.plantoes;
      cur.total += 1; cur.aprov += 1;
      map.set(l.unidade_id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.he50 + b.he100 - (a.he50 + a.he100));
  }, [summary, visao]);

  // SLA de pendências
  const { data: pendSla } = useQuery({
    queryKey: ["exec-pendencias-sla"],
    enabled: canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pendencias")
        .select("id, status, prioridade, aberta_em, resolvida_em, prazo, categoria")
        .is("deleted_at", null)
        .order("aberta_em", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const rows = data ?? [];
      const now = new Date();
      let abertas = 0,
        resolvidas = 0,
        atrasadas = 0,
        noPrazo = 0;
      let somaHoras = 0,
        somaN = 0;
      const porCategoria = new Map<string, number>();
      for (const p of rows) {
        porCategoria.set(p.categoria, (porCategoria.get(p.categoria) ?? 0) + 1);
        if (p.status === "resolvida") {
          resolvidas++;
          if (p.resolvida_em) {
            somaHoras += hoursBetween(p.aberta_em, p.resolvida_em);
            somaN++;
          }
          if (p.prazo && p.resolvida_em && new Date(p.resolvida_em) > new Date(p.prazo))
            atrasadas++;
          else if (p.prazo) noPrazo++;
        } else if (p.status !== "cancelada") {
          abertas++;
          if (p.prazo && new Date(p.prazo) < now) atrasadas++;
        }
      }
      const tmr = somaN ? somaHoras / somaN : 0; // horas
      return {
        total: rows.length,
        abertas,
        resolvidas,
        atrasadas,
        noPrazo,
        tmr,
        porCategoria: Array.from(porCategoria.entries()).map(([k, v]) => ({ name: k, value: v })),
      };
    },
  });

  const kpis = useMemo(() => {
    const totLinhas = consolidado?.reduce((s, x) => s + x.total, 0) ?? 0;
    const totAprov = consolidado?.reduce((s, x) => s + x.aprov, 0) ?? 0;
    const totHE = consolidado?.reduce((s, x) => s + x.he50 + x.he100, 0) ?? 0;
    const taxa = totLinhas ? (totAprov / totLinhas) * 100 : 0;
    return { totLinhas, totAprov, totHE, taxa };
  }, [consolidado]);

  async function exportarXLSX() {
    if (!consolidado) return;
    const { XLSX } = await loadXlsxKit();
    const wb = XLSX.utils.book_new();
    const wsUn = XLSX.utils.json_to_sheet(
      consolidado.map((r) => ({
        Unidade: r.unidade,
        Linhas: r.total,
        Aprovadas: r.aprov,
        HE_50: r.he50,
        HE_100: r.he100,
        Ad_Noturno: r.adn,
        Plantões: r.plantoes,
      })),
    );
    XLSX.utils.book_append_sheet(wb, wsUn, "Por Unidade");
    if (pendSla) {
      const wsP = XLSX.utils.json_to_sheet([
        { Métrica: "Total", Valor: pendSla.total },
        { Métrica: "Abertas", Valor: pendSla.abertas },
        { Métrica: "Resolvidas", Valor: pendSla.resolvidas },
        { Métrica: "Atrasadas", Valor: pendSla.atrasadas },
        { Métrica: "TMR (horas)", Valor: Number(pendSla.tmr.toFixed(2)) },
      ]);
      XLSX.utils.book_append_sheet(wb, wsP, "Pendências SLA");
    }
    XLSX.writeFile(wb, `relatorio_executivo_${compLabel.replace("/", "-")}.xlsx`);
    toast.success("XLSX exportado");
  }

  async function exportarPDF() {
    if (!consolidado) return;
    const { jsPDF, autoTable, drawInstitutionalHeader, loadMunicipioInfo } = await loadPdfKit();
    const doc = new jsPDF();
    const mun = await loadMunicipioInfo();
    const startY = drawInstitutionalHeader(doc, mun, `Relatório Executivo — ${compLabel}`);
    let y = startY + 4;

    doc.setFontSize(10);
    doc.text(
      `Linhas: ${kpis.totLinhas}  |  Aprovadas: ${kpis.totAprov}  |  Taxa: ${kpis.taxa.toFixed(1)}%  |  HE total: ${fmt(kpis.totHE)}h`,
      14,
      y,
    );
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [["Unidade", "Linhas", "Aprovadas", "HE 50%", "HE 100%", "Ad. Not.", "Plantões"]],
      body: consolidado.map((r) => [
        r.unidade,
        r.total,
        r.aprov,
        fmt(r.he50),
        fmt(r.he100),
        fmt(r.adn),
        fmt(r.plantoes),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 58, 138] },
    });
    if (pendSla) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const y2 = (doc as any).lastAutoTable.finalY + 8;
      autoTable(doc, {
        startY: y2,
        head: [["Pendências", "Valor"]],
        body: [
          ["Total", String(pendSla.total)],
          ["Abertas", String(pendSla.abertas)],
          ["Resolvidas", String(pendSla.resolvidas)],
          ["Atrasadas", String(pendSla.atrasadas)],
          ["TMR (horas)", pendSla.tmr.toFixed(2)],
        ],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [30, 58, 138] },
      });
    }
    await finalizarPdf(doc, {
      filename: `relatorio_executivo_${compLabel.replace("/", "-")}.pdf`,
      tipo: "relatorio",
    });
    toast.success("PDF exportado");
  }

  if (permLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!canView)
    return (
      <div className="p-6 text-sm text-destructive">Sem permissão para visualizar relatórios.</div>
    );

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Relatório Executivo</h1>
          <p className="text-sm text-muted-foreground">
            SLA de pendências, produtividade e HE consolidada.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={competenciaId} onValueChange={setCompetenciaId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Selecione a competência" />
            </SelectTrigger>
            <SelectContent>
              {(competencias ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {MES_LABEL[c.mes - 1]}/{c.ano}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={exportarXLSX}
            disabled={!canExport || !consolidado}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" /> XLSX
          </Button>
          <BotaoRelatorioAbnt
            label="Imprimir PDF (ABNT)"
            variant="outline"
            disabled={loadingOficial || !summary?.oficial}
            relatorio={async () => relatorioPainelAbnt({
              arquivo: `dashboard-executivo-secretaria-${compLabel.replace("/", "-")}`,
              titulo: "Dashboard Executivo (Secretaria)",
              subtitulo: `Competência ${compLabel}`,
              orientacao: "landscape",
              filtros: [
                { label: "Visão", valor: visao === "consolidado" ? "Consolidado" : visao === "efetivos" ? "Efetivos" : "Contratados" },
                { label: "Fonte", valor: "Somente folhas aprovadas" },
              ],
              kpis: [
                { label: "Linhas", valor: String(kpis.totLinhas) },
                { label: "Aprovadas", valor: String(kpis.totAprov) },
                { label: "HE total (h)", valor: fmt(kpis.totHE) },
              ],
              blocos: await blocosPdfCompletos({ oficial: summary?.oficial, visao, competenciaId }),
              notas: ["Frequência oficial: somente folhas aprovadas, cada profissional contado uma vez por unidade. HE total = HE 50% + HE 100% (em horas)."],
            })}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={exportarPDF}
            disabled={!canExport || !consolidado}
          >
            <Download className="mr-2 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      <RelatoriosTabs />

      {competenciaId && (
        <>
          <ConsolidacaoOficialPanel
            oficial={summary?.oficial}
            loading={loadingOficial}
            visao={visao}
            onVisaoChange={setVisao}
            arquivoBase={`executivo-${competenciaId}`}
          />
          <AlertasComparativoPanel oficial={summary?.oficial} visao={visao} competenciaId={competenciaId} arquivoBase={`executivo-${competenciaId}`} />
          <AnalisesAvancadasPanel oficial={summary?.oficial} visao={visao} competenciaId={competenciaId} arquivoBase={`executivo-${competenciaId}`} />
        </>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Linhas" value={kpis.totLinhas} />
        <KpiCard label="Taxa de aprovação" value={`${kpis.taxa.toFixed(1)}%`} />
        <KpiCard label="HE total (h)" value={fmt(kpis.totHE)} />
        <KpiCard
          label="TMR pendências"
          value={pendSla ? `${pendSla.tmr.toFixed(1)}h` : "—"}
          loading={!pendSla}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">HE por unidade</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 320 }}>
            {!competenciaId ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Selecione uma competência.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={consolidado ?? []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="unidade" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="he50" stackId="he" name="HE 50%" fill={COLORS[0]} />
                  <Bar dataKey="he100" stackId="he" name="HE 100%" fill={COLORS[3]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pendências por categoria</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 320 }}>
            {!pendSla || pendSla.porCategoria.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sem pendências registradas.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pendSla.porCategoria}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={100}
                    label
                  >
                    {pendSla.porCategoria.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SLA — pendências</CardTitle>
        </CardHeader>
        <CardContent>
          {!pendSla ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <KpiCard label="Total" value={pendSla.total} />
              <KpiCard label="Abertas" value={pendSla.abertas} />
              <KpiCard label="Resolvidas" value={pendSla.resolvidas} />
              <KpiCard
                label="Atrasadas"
                value={pendSla.atrasadas}
                tone={pendSla.atrasadas ? "danger" : "default"}
              />
              <KpiCard label="No prazo" value={pendSla.noPrazo} tone="success" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
