import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared";
import { statusLabel } from "@/lib/status";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileBarChart, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { usePermissions, useCurrentUser } from "@/hooks/use-permissions";
import { RelatoriosTabs } from "@/components/relatorios-tabs";
import type { Database } from "@/integrations/supabase/types";

type TipoFolha = Database["public"]["Enums"]["tipo_frequencia"];
type StatusFreq = Database["public"]["Enums"]["status_frequencia"];

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: RelatoriosPage,
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

type FreqRow = {
  id: string;
  tipo: TipoFolha;
  status: StatusFreq;
  total_profissionais: number | null;
  total_dias_trabalhados: number | null;
  total_faltas: number | null;
  total_horas_extras: number | null;
  competencia_unidade: {
    id: string;
    unidade: { id: string; nome: string; sigla: string | null } | null;
    competencia: { id: string; ano: number; mes: number; status: string } | null;
  } | null;
};

function RelatoriosPage() {
  const { has, isLoading: permLoading } = usePermissions();
  const { data: userCtx } = useCurrentUser();
  const isMaster = !!userCtx?.is_master;
  const canView = isMaster || has("relatorio.visualizar");
  const canExport = isMaster || has("relatorio.exportar");

  const [competenciaId, setCompetenciaId] = useState<string>("all");
  const [unidadeId, setUnidadeId] = useState<string>("all");
  const [tipo, setTipo] = useState<TipoFolha | "all">("all");

  const { data: competencias } = useQuery({
    queryKey: ["rel-competencias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competencias")
        .select("id, ano, mes, status")
        .is("deleted_at", null)
        .order("ano", { ascending: false })
        .order("mes", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: canView,
  });

  const { data: unidades } = useQuery({
    queryKey: ["rel-unidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidades")
        .select("id, nome, sigla")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: canView,
  });

  const { data: linhas, isLoading } = useQuery<FreqRow[]>({
    queryKey: ["rel-frequencias", competenciaId, unidadeId, tipo],
    queryFn: async () => {
      let q = supabase
        .from("frequencias")
        .select(
          `id, tipo, status, total_profissionais, total_dias_trabalhados,
           total_faltas, total_horas_extras,
           competencia_unidade:competencia_unidades!inner(
             id,
             unidade:unidades!inner(id, nome, sigla),
             competencia:competencias!inner(id, ano, mes, status)
           )`,
        )
        .is("deleted_at", null);

      if (tipo !== "all") q = q.eq("tipo", tipo);
      if (competenciaId !== "all") q = q.eq("competencia_unidade.competencia_id", competenciaId);
      if (unidadeId !== "all") q = q.eq("competencia_unidade.unidade_id", unidadeId);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as FreqRow[];
    },
    enabled: canView,
  });

  const totais = useMemo(() => {
    const acc = {
      folhas: linhas?.length ?? 0,
      profissionais: 0,
      dias: 0,
      faltas: 0,
      horas_extras: 0,
      aprovadas: 0,
      pendentes: 0,
    };
    for (const l of linhas ?? []) {
      acc.profissionais += Number(l.total_profissionais ?? 0);
      acc.dias += Number(l.total_dias_trabalhados ?? 0);
      acc.faltas += Number(l.total_faltas ?? 0);
      acc.horas_extras += Number(l.total_horas_extras ?? 0);
      if (l.status === "aprovada" || l.status === "arquivada") acc.aprovadas++;
      else if (l.status === "enviada" || l.status === "em_analise" || l.status === "com_pendencias")
        acc.pendentes++;
    }
    return acc;
  }, [linhas]);

  function exportarCSV() {
    if (!linhas?.length) {
      toast.error("Nada para exportar.");
      return;
    }
    const header = [
      "Competência",
      "Unidade",
      "Sigla",
      "Tipo",
      "Status",
      "Profissionais",
      "Dias trabalhados",
      "Faltas",
      "Horas extras",
    ];
    const rows = linhas.map((l) => {
      const c = l.competencia_unidade?.competencia;
      const u = l.competencia_unidade?.unidade;
      return [
        c ? `${String(c.mes).padStart(2, "0")}/${c.ano}` : "",
        u?.nome ?? "",
        u?.sigla ?? "",
        l.tipo === "contratados" ? "Contratados" : "Efetivos",
        statusLabel("frequencia", l.status),
        l.total_profissionais ?? 0,
        l.total_dias_trabalhados ?? 0,
        l.total_faltas ?? 0,
        l.total_horas_extras ?? 0,
      ];
    });
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_frequencias_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado.");
  }

  function exportarXLSX() {
    if (!linhas?.length) {
      toast.error("Nada para exportar.");
      return;
    }
    const data = linhas.map((l) => {
      const c = l.competencia_unidade?.competencia;
      const u = l.competencia_unidade?.unidade;
      return {
        Competência: c ? `${String(c.mes).padStart(2, "0")}/${c.ano}` : "",
        Unidade: u?.nome ?? "",
        Sigla: u?.sigla ?? "",
        Tipo: l.tipo === "contratados" ? "Contratados" : "Efetivos",
        Status: statusLabel("frequencia", l.status),
        Profissionais: l.total_profissionais ?? 0,
        "Dias trabalhados": l.total_dias_trabalhados ?? 0,
        Faltas: l.total_faltas ?? 0,
        "Horas extras": l.total_horas_extras ?? 0,
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 12 },
      { wch: 32 },
      { wch: 10 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 10 },
      { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Frequências");
    XLSX.writeFile(wb, `relatorio_frequencias_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Planilha exportada.");
  }

  if (permLoading) return <div className="p-6 text-muted-foreground">Carregando...</div>;
  if (!canView) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="mt-2 text-muted-foreground">
          Você não tem permissão para visualizar relatórios.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <FileBarChart className="h-6 w-6 text-primary" /> Relatórios
          </h1>
          <p className="text-sm text-muted-foreground">
            Consolidado de frequências por competência, unidade e tipo de folha.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={exportarCSV}
            disabled={!canExport || !linhas?.length}
          >
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={exportarXLSX}
            disabled={!canExport || !linhas?.length}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (XLSX)
          </Button>
        </div>
      </div>

      <RelatoriosTabs />

      <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Competência
          </label>
          <Select value={competenciaId} onValueChange={setCompetenciaId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {competencias?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {MES_LABEL[c.mes - 1]}/{c.ano} — {c.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Unidade</label>
          <Select value={unidadeId} onValueChange={setUnidadeId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {unidades?.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.sigla ? `${u.sigla} — ` : ""}
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Tipo de folha
          </label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as TipoFolha | "all")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="contratados">Contratados</SelectItem>
              <SelectItem value="efetivos">Efetivos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-6">
        <Card label="Folhas" value={totais.folhas} />
        <Card label="Profissionais" value={totais.profissionais} />
        <Card label="Dias trab." value={totais.dias} />
        <Card label="Faltas" value={totais.faltas} />
        <Card label="Horas extras" value={totais.horas_extras} />
        <Card label="Aprovadas / Pendentes" value={`${totais.aprovadas} / ${totais.pendentes}`} />
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Competência</th>
              <th className="px-3 py-2">Unidade</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Prof.</th>
              <th className="px-3 py-2 text-right">Dias</th>
              <th className="px-3 py-2 text-right">Faltas</th>
              <th className="px-3 py-2 text-right">H. Extras</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            )}
            {!isLoading && !linhas?.length && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
            {linhas?.map((l) => {
              const c = l.competencia_unidade?.competencia;
              const u = l.competencia_unidade?.unidade;
              return (
                <tr key={l.id} className="border-t">
                  <td className="px-3 py-2">
                    {c ? `${String(c.mes).padStart(2, "0")}/${c.ano}` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {u?.sigla ? <span className="text-muted-foreground">{u.sigla} · </span> : null}
                    {u?.nome ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {l.tipo === "contratados" ? "Contratados" : "Efetivos"}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge domain="frequencia" value={l.status} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {l.total_profissionais ?? 0}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {l.total_dias_trabalhados ?? 0}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.total_faltas ?? 0}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.total_horas_extras ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
