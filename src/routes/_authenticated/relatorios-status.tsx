import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileBarChart } from "lucide-react";
import { toast } from "sonner";
import { usePermissions, useCurrentUser } from "@/hooks/use-permissions";
import type { Database } from "@/integrations/supabase/types";
import { RelatoriosTabs } from "@/components/relatorios-tabs";

type StatusLinha = Database["public"]["Enums"]["status_linha_frequencia"];

export const Route = createFileRoute("/_authenticated/relatorios-status")({
  component: RelatorioStatusPage,
});

const MES_LABEL = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

type FreqStatus = Database["public"]["Enums"]["status_frequencia"];

type Row = {
  status_linha: StatusLinha;
  frequencias: {
    status: FreqStatus;
    competencia_unidades: {
      competencia_id: string;
      unidades: { id: string; nome: string; sigla: string | null } | null;
    } | null;
  } | null;
};

type StatusGeral = "Não iniciado" | "Em andamento" | "Enviado" | "Com pendência";

type Agg = {
  unidade_id: string;
  unidade_nome: string;
  total_ativos: number;
  rascunho: number;
  enviadas: number;
  aprovadas: number;
  rejeitadas: number;
  statusGeral: StatusGeral;
};

function statusRank(s: StatusGeral): number {
  return { "Com pendência": 0, "Não iniciado": 1, "Em andamento": 2, "Enviado": 3 }[s];
}

function statusBadgeVariant(s: StatusGeral): "outline" | "secondary" | "destructive" | "default" {
  if (s === "Com pendência") return "destructive";
  if (s === "Não iniciado") return "outline";
  if (s === "Em andamento") return "secondary";
  return "default";
}

function RelatorioStatusPage() {
  const { has, isLoading: permLoading } = usePermissions();
  const { data: me } = useCurrentUser();
  const isMaster = !!me?.is_master;
  const canView = isMaster || has("relatorio.visualizar");
  const canExport = isMaster || has("relatorio.exportar");

  const [competenciaId, setCompetenciaId] = useState<string>("");

  const { data: competencias } = useQuery({
    queryKey: ["rel-competencias-all-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competencias").select("id, ano, mes, status")
        .is("deleted_at", null)
        .order("ano", { ascending: false }).order("mes", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: canView,
  });

  const { data: unidadesAtivas } = useQuery({
    queryKey: ["unidades-ativas-count"],
    enabled: canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidades").select("id, nome, sigla").is("deleted_at", null);
      if (error) throw error;
      const counts = await Promise.all(
        (data ?? []).map(async (u) => {
          const { count } = await supabase
            .from("profissionais")
            .select("id", { count: "exact", head: true })
            .eq("unidade_id", u.id).eq("status", "ativo").is("deleted_at", null);
          return { id: u.id, nome: u.nome, sigla: u.sigla, ativos: count ?? 0 };
        }),
      );
      return counts;
    },
  });

  const { data: rows, isLoading } = useQuery<Row[]>({
    queryKey: ["rel-status", competenciaId],
    enabled: canView && !!competenciaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("frequencia_profissional")
        .select(`
          status_linha,
          frequencias!inner(
            status,
            competencia_unidades!inner(
              competencia_id,
              unidades!inner(id, nome, sigla)
            )
          )
        `)
        .is("deleted_at", null)
        .eq("frequencias.competencia_unidades.competencia_id", competenciaId)
        .limit(10000);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const aggregated = useMemo<Agg[]>(() => {
    const map = new Map<string, Agg>();
    for (const u of unidadesAtivas ?? []) {
      map.set(u.id, {
        unidade_id: u.id,
        unidade_nome: u.sigla ? `${u.sigla} — ${u.nome}` : u.nome,
        total_ativos: u.ativos, rascunho: 0, enviadas: 0, aprovadas: 0, rejeitadas: 0,
        statusGeral: "Não iniciado",
      });
    }
    for (const r of rows ?? []) {
      const u = r.frequencias?.competencia_unidades?.unidades;
      if (!u) continue;
      let a = map.get(u.id);
      if (!a) {
        a = {
          unidade_id: u.id,
          unidade_nome: u.sigla ? `${u.sigla} — ${u.nome}` : u.nome,
          total_ativos: 0, rascunho: 0, enviadas: 0, aprovadas: 0, rejeitadas: 0,
          statusGeral: "Não iniciado",
        };
        map.set(u.id, a);
      }
      const fs = r.frequencias?.status;
      if (r.status_linha === "aprovada") a.aprovadas++;
      else if (r.status_linha === "rejeitada") a.rejeitadas++;
      else if (fs === "rascunho") a.rascunho++;
      else a.enviadas++;
    }
    for (const a of map.values()) {
      const total = a.rascunho + a.enviadas + a.aprovadas + a.rejeitadas;
      if (a.rejeitadas > 0) a.statusGeral = "Com pendência";
      else if (total === 0) a.statusGeral = "Não iniciado";
      else if (a.rascunho === 0) a.statusGeral = "Enviado";
      else a.statusGeral = "Em andamento";
    }
    return Array.from(map.values()).sort((x, y) => {
      const r = statusRank(x.statusGeral) - statusRank(y.statusGeral);
      return r !== 0 ? r : x.unidade_nome.localeCompare(y.unidade_nome);
    });
  }, [rows, unidadesAtivas]);

  const compLabel = useMemo(() => {
    const c = competencias?.find((x) => x.id === competenciaId);
    return c ? `${MES_LABEL[c.mes - 1]}-${c.ano}` : "";
  }, [competencias, competenciaId]);

  function exportarCSV() {
    if (!aggregated.length) { toast.error("Nada para exportar."); return; }
    const header = ["Unidade","Profissionais Ativos","Rascunho","Enviadas","Aprovadas","Rejeitadas","Status Geral"];
    const lines = aggregated.map((a) => [
      a.unidade_nome, a.total_ativos, a.rascunho, a.enviadas, a.aprovadas, a.rejeitadas, a.statusGeral,
    ]);
    const csv = [header, ...lines]
      .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `status_unidades_${compLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportado.");
  }

  if (permLoading) return <div className="p-6 text-muted-foreground">Carregando...</div>;
  if (!canView) {
    return <div className="p-6"><h1 className="text-2xl font-bold">Relatórios</h1><p className="mt-2 text-muted-foreground">Sem permissão.</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <FileBarChart className="h-6 w-6 text-primary" /> Status por Unidade
          </h1>
          <p className="text-sm text-muted-foreground">
            Quem enviou, quem está pendente. Ordenado por prioridade de cobrança.
          </p>
        </div>
        <Button onClick={exportarCSV} disabled={!canExport || !aggregated.length}>
          <Download className="mr-2 h-4 w-4" /> CSV
        </Button>
      </div>

      <RelatoriosTabs />

      <div className="rounded-lg border bg-card p-4">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Competência *</label>
        <Select value={competenciaId} onValueChange={setCompetenciaId}>
          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            {competencias?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {MES_LABEL[c.mes - 1]}/{c.ano} — {c.status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!competenciaId ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          Selecione uma competência.
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Unidade</th>
                <th className="px-3 py-2 text-right">Prof. Ativos</th>
                <th className="px-3 py-2 text-right">Rascunho</th>
                <th className="px-3 py-2 text-right">Enviadas</th>
                <th className="px-3 py-2 text-right">Aprovadas</th>
                <th className="px-3 py-2 text-right">Rejeitadas</th>
                <th className="px-3 py-2">Status Geral</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Carregando...</td></tr>}
              {!isLoading && !aggregated.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Nenhuma unidade.</td></tr>}
              {aggregated.map((a) => (
                <tr key={a.unidade_id} className="border-t">
                  <td className="px-3 py-2">{a.unidade_nome}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.total_ativos}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.rascunho}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.enviadas}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.aprovadas}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.rejeitadas}</td>
                  <td className="px-3 py-2">
                    <Badge variant={statusBadgeVariant(a.statusGeral)}>{a.statusGeral}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
