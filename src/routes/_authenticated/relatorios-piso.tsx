import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet, FileText, TrendingUp, Users, DollarSign, Award, PiggyBank, BadgePercent } from "lucide-react";
import { KpiCard } from "@/components/shared";
import { PermissionGate } from "@/components/permission-gate";
import { formatNumber } from "@/lib/formatters";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { resolverAssinaturasDocumento, drawAssinaturasBlock } from "@/lib/pdf-assinaturas";
import autoTable from "jspdf-autotable";
import { drawInstitutionalHeader, loadMunicipioInfo } from "@/lib/pdf-institucional";
import { toast } from "sonner";
import { usePermissions, useCurrentUser } from "@/hooks/use-permissions";
import { RelatoriosTabs } from "@/components/relatorios-tabs";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
} from "recharts";

export const Route = createFileRoute("/_authenticated/relatorios-piso")({
  component: RelatorioPisoPage,
});

const COLORS = ["hsl(var(--primary))", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

type Row = {
  id: string;
  nome: string | null;
  cpf: string | null;
  matricula: string | null;
  cargo: string | null;
  vinculo: string | null;
  competencia: string | null;
  unidade: string | null;
  setor: string | null;
  salario_base: number | null;
  piso_complementacao: number | null;
  valor_final: number | null;
  valor_liquido: number | null;
  adicional_noturno: number | null;
  insalubridade: number | null;
  gratificacao: number | null;
  hora_extra_50: number | null;
  hora_extra_100: number | null;
  ferias: number | null;
  ferias_1_3: number | null;
  auxilio_financeiro: number | null;
  inss: number | null;
  irrf: number | null;
};

function brl(n: number | null | undefined) {
  return (Number(n ?? 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function pct(part: number, total: number) {
  if (!total) return "—";
  return `${((part / total) * 100).toFixed(1)}%`;
}
function fmtCompetencia(c: string | null | undefined) {
  if (!c) return "—";
  // aceita "YYYY-MM" ou "YYYY-MM-01"
  const m = /^(\d{4})-(\d{2})/.exec(c);
  if (!m) return c;
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${meses[Number(m[2]) - 1]}/${m[1]}`;
}

function RelatorioPisoPage() {
  const { has, isLoading: permLoading } = usePermissions();
  const { data: me } = useCurrentUser();
  const isMaster = !!me?.is_master;
  const canView = isMaster || has("relatorio.visualizar") || has("piso.visualizar");
  const canExport = isMaster || has("relatorio.exportar") || has("piso.visualizar");

  const [competencia, setCompetencia] = useState<string>("__latest__");
  const [vinculo, setVinculo] = useState<string>("all");
  const [cargo, setCargo] = useState<string>("all");
  const [unidade, setUnidade] = useState<string>("all");
  const [busca, setBusca] = useState<string>("");

  // Base dataset (últimas 12 competências mais recentes, até 20k linhas)
  const { data: base, isLoading } = useQuery({
    queryKey: ["rel-piso-base"],
    enabled: canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("piso_enfermagem")
        .select(
          "id, nome, cpf, matricula, cargo, vinculo, competencia, unidade, setor, salario_base, piso_complementacao, valor_final, valor_liquido, adicional_noturno, insalubridade, gratificacao, hora_extra_50, hora_extra_100, ferias, ferias_1_3, auxilio_financeiro, inss, irrf",
        )
        .not("competencia", "is", null)
        .order("competencia", { ascending: false })
        .limit(20000);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const competencias = useMemo(() => {
    const set = new Set<string>();
    for (const r of base ?? []) if (r.competencia) set.add(r.competencia);
    return Array.from(set).sort().reverse();
  }, [base]);

  const competenciaAtual = competencia === "__latest__" ? (competencias[0] ?? null) : competencia;
  const competenciaAnterior = useMemo(() => {
    if (!competenciaAtual) return null;
    const idx = competencias.indexOf(competenciaAtual);
    return idx >= 0 ? competencias[idx + 1] ?? null : null;
  }, [competencias, competenciaAtual]);

  const vinculos = useMemo(() => {
    const s = new Set<string>();
    for (const r of base ?? []) if (r.vinculo) s.add(r.vinculo);
    return Array.from(s).sort();
  }, [base]);
  const cargos = useMemo(() => {
    const s = new Set<string>();
    for (const r of base ?? []) if (r.cargo) s.add(r.cargo);
    return Array.from(s).sort();
  }, [base]);
  const unidades = useMemo(() => {
    const s = new Set<string>();
    for (const r of base ?? []) if (r.unidade) s.add(r.unidade);
    return Array.from(s).sort();
  }, [base]);

  // aplica filtros (exceto competência) — usado para gráfico de evolução
  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (base ?? []).filter((r) => {
      if (vinculo !== "all" && r.vinculo !== vinculo) return false;
      if (cargo !== "all" && r.cargo !== cargo) return false;
      if (unidade !== "all" && r.unidade !== unidade) return false;
      if (q) {
        const hay = `${r.nome ?? ""} ${r.cpf ?? ""} ${r.matricula ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [base, vinculo, cargo, unidade, busca]);

  // linhas da competência ativa
  const atualRows = useMemo(
    () => filtered.filter((r) => r.competencia === competenciaAtual),
    [filtered, competenciaAtual],
  );
  const anteriorRows = useMemo(
    () => filtered.filter((r) => r.competencia === competenciaAnterior),
    [filtered, competenciaAnterior],
  );

  // KPIs
  function trendOf(a: number, b: number | null | undefined) {
    if (b == null || b === 0) return undefined;
    const delta = ((a - b) / b) * 100;
    const direction: "up" | "down" | "flat" = delta > 0.5 ? "up" : delta < -0.5 ? "down" : "flat";
    const sign = delta > 0 ? "+" : "";
    return { direction, label: `${sign}${delta.toFixed(1)}% vs anterior` };
  }

  const kpi = useMemo(() => {
    const sum = (rows: Row[], k: keyof Row) =>
      rows.reduce((a, r) => a + Number((r[k] as number | null) ?? 0), 0);
    const complAtual = sum(atualRows, "piso_complementacao");
    const complAnt = sum(anteriorRows, "piso_complementacao");
    const finalAtual = sum(atualRows, "valor_final");
    const finalAnt = sum(anteriorRows, "valor_final");
    const benAtual = atualRows.filter((r) => Number(r.piso_complementacao ?? 0) > 0).length;
    const benAnt = anteriorRows.filter((r) => Number(r.piso_complementacao ?? 0) > 0).length;
    return {
      profissionais: atualRows.length,
      profissionaisTrend: anteriorRows.length,
      valorFinal: finalAtual,
      valorFinalTrend: finalAnt,
      complementacao: complAtual,
      complementacaoTrend: complAnt,
      beneficiados: benAtual,
      beneficiadosTrend: benAnt,
      ticketMedio: benAtual ? complAtual / benAtual : 0,
      cobertura: atualRows.length ? (benAtual / atualRows.length) * 100 : 0,
    };
  }, [atualRows, anteriorRows]);

  // Evolução por competência (linha)
  const evolucao = useMemo(() => {
    const map = new Map<string, { competencia: string; complementacao: number; valor_final: number; beneficiados: number }>();
    for (const r of filtered) {
      const k = r.competencia ?? "";
      if (!k) continue;
      const cur = map.get(k) ?? { competencia: k, complementacao: 0, valor_final: 0, beneficiados: 0 };
      cur.complementacao += Number(r.piso_complementacao ?? 0);
      cur.valor_final += Number(r.valor_final ?? 0);
      if (Number(r.piso_complementacao ?? 0) > 0) cur.beneficiados += 1;
      map.set(k, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => a.competencia.localeCompare(b.competencia))
      .map((r) => ({ ...r, label: fmtCompetencia(r.competencia) }));
  }, [filtered]);

  // Complementação por cargo (barras)
  const porCargo = useMemo(() => {
    const map = new Map<string, { cargo: string; complementacao: number; beneficiados: number }>();
    for (const r of atualRows) {
      const k = r.cargo ?? "—";
      const cur = map.get(k) ?? { cargo: k, complementacao: 0, beneficiados: 0 };
      cur.complementacao += Number(r.piso_complementacao ?? 0);
      if (Number(r.piso_complementacao ?? 0) > 0) cur.beneficiados += 1;
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.complementacao - a.complementacao).slice(0, 10);
  }, [atualRows]);

  // Distribuição por vínculo (pizza)
  const porVinculo = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of atualRows) {
      const k = r.vinculo ?? "—";
      map.set(k, (map.get(k) ?? 0) + Number(r.valor_final ?? 0));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [atualRows]);

  // Top unidades (barras horizontais)
  const topUnidades = useMemo(() => {
    const map = new Map<string, { unidade: string; complementacao: number; profissionais: number }>();
    for (const r of atualRows) {
      const k = r.unidade ?? "—";
      const cur = map.get(k) ?? { unidade: k, complementacao: 0, profissionais: 0 };
      cur.complementacao += Number(r.piso_complementacao ?? 0);
      cur.profissionais += 1;
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.complementacao - a.complementacao).slice(0, 10);
  }, [atualRows]);

  // Top 10 profissionais beneficiados
  const topProfissionais = useMemo(() => {
    return [...atualRows]
      .filter((r) => Number(r.piso_complementacao ?? 0) > 0)
      .sort((a, b) => Number(b.piso_complementacao ?? 0) - Number(a.piso_complementacao ?? 0))
      .slice(0, 10);
  }, [atualRows]);

  // Composição salarial (stacked) na competência ativa por cargo
  const composicao = useMemo(() => {
    const map = new Map<string, {
      cargo: string; salario_base: number; adicional_noturno: number; insalubridade: number;
      gratificacao: number; horas_extras: number; ferias: number; complementacao: number;
    }>();
    for (const r of atualRows) {
      const k = r.cargo ?? "—";
      const cur = map.get(k) ?? { cargo: k, salario_base: 0, adicional_noturno: 0, insalubridade: 0, gratificacao: 0, horas_extras: 0, ferias: 0, complementacao: 0 };
      cur.salario_base += Number(r.salario_base ?? 0);
      cur.adicional_noturno += Number(r.adicional_noturno ?? 0);
      cur.insalubridade += Number(r.insalubridade ?? 0);
      cur.gratificacao += Number(r.gratificacao ?? 0);
      cur.horas_extras += Number(r.hora_extra_50 ?? 0) + Number(r.hora_extra_100 ?? 0);
      cur.ferias += Number(r.ferias ?? 0) + Number(r.ferias_1_3 ?? 0);
      cur.complementacao += Number(r.piso_complementacao ?? 0);
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => (b.salario_base + b.complementacao) - (a.salario_base + a.complementacao)).slice(0, 8);
  }, [atualRows]);

  // Tabela paginada
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const pageRows = useMemo(
    () => atualRows.slice((page - 1) * pageSize, page * pageSize),
    [atualRows, page],
  );
  const totalPages = Math.max(1, Math.ceil(atualRows.length / pageSize));

  // Exportações
  function tabularExport() {
    return atualRows.map((r) => ({
      Competência: fmtCompetencia(r.competencia),
      Nome: r.nome ?? "",
      CPF: r.cpf ?? "",
      Matrícula: r.matricula ?? "",
      Cargo: r.cargo ?? "",
      Vínculo: r.vinculo ?? "",
      Unidade: r.unidade ?? "",
      Setor: r.setor ?? "",
      "Salário base": Number(r.salario_base ?? 0),
      "Adicional noturno": Number(r.adicional_noturno ?? 0),
      Insalubridade: Number(r.insalubridade ?? 0),
      Gratificação: Number(r.gratificacao ?? 0),
      "HE 50%": Number(r.hora_extra_50 ?? 0),
      "HE 100%": Number(r.hora_extra_100 ?? 0),
      Férias: Number(r.ferias ?? 0),
      "1/3 Férias": Number(r.ferias_1_3 ?? 0),
      "Complementação Piso": Number(r.piso_complementacao ?? 0),
      "Valor Final": Number(r.valor_final ?? 0),
      "Valor Líquido": Number(r.valor_liquido ?? 0),
    }));
  }

  function exportarCSV() {
    const data = tabularExport();
    if (!data.length) return toast.error("Nada para exportar.");
    const header = Object.keys(data[0]);
    const csv = [header, ...data.map((d) => header.map((h) => (d as Record<string, unknown>)[h]))]
      .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `piso_enfermagem_${competenciaAtual ?? "todas"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado.");
  }

  function exportarXLSX() {
    const data = tabularExport();
    if (!data.length) return toast.error("Nada para exportar.");
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Piso Enfermagem");

    const resumo = [
      { Indicador: "Competência", Valor: fmtCompetencia(competenciaAtual) },
      { Indicador: "Profissionais", Valor: kpi.profissionais },
      { Indicador: "Beneficiados", Valor: kpi.beneficiados },
      { Indicador: "Cobertura (%)", Valor: kpi.cobertura.toFixed(2) },
      { Indicador: "Valor final total", Valor: kpi.valorFinal },
      { Indicador: "Complementação total", Valor: kpi.complementacao },
      { Indicador: "Ticket médio complementação", Valor: kpi.ticketMedio },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), "Resumo");

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(evolucao.map((r) => ({
        Competência: r.label,
        Complementação: r.complementacao,
        "Valor Final": r.valor_final,
        Beneficiados: r.beneficiados,
      }))),
      "Evolução",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(porCargo.map((r) => ({
        Cargo: r.cargo,
        Complementação: r.complementacao,
        Beneficiados: r.beneficiados,
      }))),
      "Por cargo",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(topUnidades.map((r) => ({
        Unidade: r.unidade,
        Complementação: r.complementacao,
        Profissionais: r.profissionais,
      }))),
      "Top unidades",
    );

    XLSX.writeFile(wb, `piso_enfermagem_${competenciaAtual ?? "todas"}.xlsx`);
    toast.success("Excel exportado.");
  }

  async function exportarPDF() {
    if (!atualRows.length) return toast.error("Nada para exportar.");
    const doc = new jsPDF({ orientation: "landscape" });
    const info = await loadMunicipioInfo();
    const startY = drawInstitutionalHeader(
      doc,
      info,
      `Relatório — Piso Nacional da Enfermagem — ${fmtCompetencia(competenciaAtual)}`,
    );

    autoTable(doc, {
      startY: startY + 4,
      head: [["Indicador", "Valor"]],
      body: [
        ["Profissionais", formatNumber(kpi.profissionais)],
        ["Beneficiados", `${formatNumber(kpi.beneficiados)} (${kpi.cobertura.toFixed(1)}%)`],
        ["Valor final total", brl(kpi.valorFinal)],
        ["Complementação total", brl(kpi.complementacao)],
        ["Ticket médio complementação", brl(kpi.ticketMedio)],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 64, 175] },
    });

    autoTable(doc, {
      head: [["Cargo", "Complementação", "Beneficiados"]],
      body: porCargo.map((r) => [r.cargo, brl(r.complementacao), formatNumber(r.beneficiados)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 64, 175] },
    });

    autoTable(doc, {
      head: [["Top Unidades", "Complementação", "Profissionais"]],
      body: topUnidades.map((r) => [r.unidade, brl(r.complementacao), formatNumber(r.profissionais)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 64, 175] },
    });

    autoTable(doc, {
      head: [["Top Profissionais Beneficiados", "Cargo", "Unidade", "Complementação"]],
      body: topProfissionais.map((r) => [
        r.nome ?? "—", r.cargo ?? "—", r.unidade ?? "—", brl(r.piso_complementacao),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 64, 175] },
    });

    const assin = await resolverAssinaturasDocumento("piso");
    if (assin.length > 0) {
      drawAssinaturasBlock(doc, assin, {
        startY: doc.internal.pageSize.getHeight() - 60,
      });
    }

    doc.save(`piso_enfermagem_${competenciaAtual ?? "todas"}.pdf`);
    toast.success("PDF gerado.");
  }

  if (permLoading) return <div className="p-6 text-muted-foreground">Carregando...</div>;
  if (!canView) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="mt-2 text-muted-foreground">Você não tem permissão para visualizar relatórios.</p>
      </div>
    );
  }

  return (
    <PermissionGate anyOf={["relatorio.visualizar", "piso.visualizar"]}>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <TrendingUp className="h-6 w-6 text-primary" /> Relatório — Piso Nacional da Enfermagem
            </h1>
            <p className="text-sm text-muted-foreground">
              Análise executiva com evolução mensal, distribuição por cargo/vínculo/unidade e composição salarial.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportarCSV} disabled={!canExport || !atualRows.length}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" onClick={exportarXLSX} disabled={!canExport || !atualRows.length}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
            </Button>
            <Button onClick={exportarPDF} disabled={!canExport || !atualRows.length}>
              <FileText className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>
        </div>

        <RelatoriosTabs />

        {/* Filtros */}
        <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Competência</label>
            <Select value={competencia} onValueChange={(v) => { setCompetencia(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__latest__">Mais recente</SelectItem>
                {competencias.map((c) => (
                  <SelectItem key={c} value={c}>{fmtCompetencia(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Vínculo</label>
            <Select value={vinculo} onValueChange={(v) => { setVinculo(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {vinculos.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Cargo</label>
            <Select value={cargo} onValueChange={(v) => { setCargo(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {cargos.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Unidade</label>
            <Select value={unidade} onValueChange={(v) => { setUnidade(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {unidades.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Buscar</label>
            <Input
              placeholder="Nome, CPF ou matrícula"
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard icon={<Users className="h-4 w-4" />} label="Profissionais" value={formatNumber(kpi.profissionais)}
            trend={trendOf(kpi.profissionais, kpi.profissionaisTrend)} />
          <KpiCard icon={<DollarSign className="h-4 w-4" />} label="Valor final total" value={brl(kpi.valorFinal)}
            trend={trendOf(kpi.valorFinal, kpi.valorFinalTrend)} />
          <KpiCard icon={<PiggyBank className="h-4 w-4" />} label="Complementação piso" value={brl(kpi.complementacao)}
            trend={trendOf(kpi.complementacao, kpi.complementacaoTrend)} />
          <KpiCard icon={<Award className="h-4 w-4" />} label="Beneficiados" value={formatNumber(kpi.beneficiados)}
            trend={trendOf(kpi.beneficiados, kpi.beneficiadosTrend)} />
          <KpiCard icon={<BadgePercent className="h-4 w-4" />} label="Cobertura" value={`${kpi.cobertura.toFixed(1)}%`} />
          <KpiCard icon={<DollarSign className="h-4 w-4" />} label="Ticket médio" value={brl(kpi.ticketMedio)} />
        </div>

        {/* Evolução mensal */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução mensal — Valor final × Complementação</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 320 }}>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando dados…</p>
            ) : evolucao.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados suficientes.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolucao}>
                  <defs>
                    <linearGradient id="pisoValFinal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="pisoCompl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => v.toLocaleString("pt-BR")} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => brl(Number(v))} />
                  <Legend />
                  <Area type="monotone" dataKey="valor_final" name="Valor final" stroke="hsl(var(--primary))" fill="url(#pisoValFinal)" />
                  <Area type="monotone" dataKey="complementacao" name="Complementação" stroke="#22c55e" fill="url(#pisoCompl)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Complementação por cargo */}
          <Card>
            <CardHeader><CardTitle>Complementação por cargo (Top 10)</CardTitle></CardHeader>
            <CardContent style={{ height: 320 }}>
              {porCargo.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porCargo} layout="vertical" margin={{ left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" tickFormatter={(v) => v.toLocaleString("pt-BR")} tick={{ fontSize: 11 }} />
                    <YAxis dataKey="cargo" type="category" tick={{ fontSize: 11 }} width={140} />
                    <Tooltip formatter={(v) => brl(Number(v))} />
                    <Bar dataKey="complementacao" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Distribuição por vínculo */}
          <Card>
            <CardHeader><CardTitle>Distribuição do valor final por vínculo</CardTitle></CardHeader>
            <CardContent style={{ height: 320 }}>
              {porVinculo.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={porVinculo} dataKey="value" nameKey="name" innerRadius={60} outerRadius={110} paddingAngle={2}>
                      {porVinculo.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => brl(Number(v))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Top unidades */}
          <Card>
            <CardHeader><CardTitle>Top unidades por complementação</CardTitle></CardHeader>
            <CardContent style={{ height: 320 }}>
              {topUnidades.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topUnidades} layout="vertical" margin={{ left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" tickFormatter={(v) => v.toLocaleString("pt-BR")} tick={{ fontSize: 11 }} />
                    <YAxis dataKey="unidade" type="category" tick={{ fontSize: 11 }} width={160} />
                    <Tooltip formatter={(v) => brl(Number(v))} />
                    <Bar dataKey="complementacao" fill="#22c55e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Beneficiados por competência (linha) */}
          <Card>
            <CardHeader><CardTitle>Beneficiados por competência</CardTitle></CardHeader>
            <CardContent style={{ height: 320 }}>
              {evolucao.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolucao}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="beneficiados" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Composição salarial */}
        <Card>
          <CardHeader><CardTitle>Composição salarial por cargo — {fmtCompetencia(competenciaAtual)}</CardTitle></CardHeader>
          <CardContent style={{ height: 360 }}>
            {composicao.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={composicao}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="cargo" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis tickFormatter={(v) => v.toLocaleString("pt-BR")} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => brl(Number(v))} />
                  <Legend />
                  <Bar dataKey="salario_base" stackId="a" name="Salário base" fill="hsl(var(--primary))" />
                  <Bar dataKey="adicional_noturno" stackId="a" name="Adic. noturno" fill="#8b5cf6" />
                  <Bar dataKey="insalubridade" stackId="a" name="Insalubridade" fill="#06b6d4" />
                  <Bar dataKey="gratificacao" stackId="a" name="Gratificação" fill="#f59e0b" />
                  <Bar dataKey="horas_extras" stackId="a" name="Horas extras" fill="#ef4444" />
                  <Bar dataKey="ferias" stackId="a" name="Férias" fill="#ec4899" />
                  <Bar dataKey="complementacao" stackId="a" name="Complementação" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top 10 profissionais beneficiados */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 profissionais beneficiados — {fmtCompetencia(competenciaAtual)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Profissional</th>
                    <th className="px-3 py-2">Cargo</th>
                    <th className="px-3 py-2">Vínculo</th>
                    <th className="px-3 py-2">Unidade</th>
                    <th className="px-3 py-2 text-right">Salário base</th>
                    <th className="px-3 py-2 text-right">Complementação</th>
                    <th className="px-3 py-2 text-right">% sobre base</th>
                    <th className="px-3 py-2 text-right">Valor final</th>
                  </tr>
                </thead>
                <tbody>
                  {topProfissionais.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2">{r.nome ?? "—"}</td>
                      <td className="px-3 py-2">{r.cargo ?? "—"}</td>
                      <td className="px-3 py-2">{r.vinculo ?? "—"}</td>
                      <td className="px-3 py-2">{r.unidade ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{brl(r.salario_base)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{brl(r.piso_complementacao)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {pct(Number(r.piso_complementacao ?? 0), Number(r.salario_base ?? 0))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{brl(r.valor_final)}</td>
                    </tr>
                  ))}
                  {topProfissionais.length === 0 && (
                    <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Nenhum beneficiado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Tabela detalhada */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhamento — {fmtCompetencia(competenciaAtual)} ({formatNumber(atualRows.length)} registros)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2">CPF</th>
                    <th className="px-3 py-2">Cargo</th>
                    <th className="px-3 py-2">Vínculo</th>
                    <th className="px-3 py-2">Unidade</th>
                    <th className="px-3 py-2 text-right">Base</th>
                    <th className="px-3 py-2 text-right">Complementação</th>
                    <th className="px-3 py-2 text-right">Final</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2">{r.nome ?? "—"}</td>
                      <td className="px-3 py-2 tabular-nums">{r.cpf ?? "—"}</td>
                      <td className="px-3 py-2">{r.cargo ?? "—"}</td>
                      <td className="px-3 py-2">{r.vinculo ?? "—"}</td>
                      <td className="px-3 py-2">{r.unidade ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{brl(r.salario_base)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{brl(r.piso_complementacao)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{brl(r.valor_final)}</td>
                    </tr>
                  ))}
                  {pageRows.length === 0 && (
                    <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Nenhum registro.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Página {page} de {totalPages}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  Próxima
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  );
}