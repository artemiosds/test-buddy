import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Undo2, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { PermissionGate } from "@/components/permission-gate";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/formatters";
import {
  listHistoricoImportacoes,
  desfazerImportacao,
  getDashboardPiso,
} from "@/lib/piso-enfermagem.functions";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { KpiCard } from "@/components/shared/KpiCard";
import { competenciaAtual } from "@/lib/piso-heuristics";

export const Route = createFileRoute("/_authenticated/piso-enfermagem/")({
  component: () => (
    <PermissionGate permission="piso.visualizar" fallback={<div className="p-6 text-sm text-muted-foreground">Sem permissão para visualizar o Piso Nacional da Enfermagem.</div>}>
      <PisoIndex />
    </PermissionGate>
  ),
});

type Row = {
  id: string;
  modelo: string;
  nome_arquivo: string;
  tipo_arquivo: string;
  total_registros: number | null;
  registros_importados: number | null;
  registros_divergentes: number | null;
  registros_nao_encontrados: number | null;
  status: string;
  data_importacao: string;
};

function PisoIndex() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data, isLoading } = useQuery({
    queryKey: ["piso", "historico", 1],
    queryFn: () => listHistoricoImportacoes({ data: { page: 1, pageSize: 50 } }),
  });
  const dash = useQuery({
    queryKey: ["piso", "dashboard"],
    queryFn: () => getDashboardPiso({}),
  });
  const undoMut = useMutation({
    mutationFn: (id: string) => desfazerImportacao({ data: { id } }),
    onSuccess: () => {
      toast.success("Importação desfeita.");
      void qc.invalidateQueries({ queryKey: ["piso", "historico"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao desfazer"),
  });

  const cols: DataTableColumn<Row>[] = [
    { key: "data", header: "Data", cell: (r) => formatDateTime(r.data_importacao) },
    { key: "modelo", header: "Modelo", cell: (r) => r.modelo },
    { key: "arquivo", header: "Arquivo", cell: (r) => <span className="font-mono text-xs">{r.nome_arquivo}</span> },
    { key: "tipo", header: "Tipo", cell: (r) => r.tipo_arquivo },
    { key: "total", header: "Registros", cell: (r) => r.total_registros ?? 0 },
    { key: "ok", header: "Importados", cell: (r) => r.registros_importados ?? 0 },
    { key: "div", header: "Divergentes", cell: (r) => r.registros_divergentes ?? 0 },
    { key: "nl", header: "Não localizados", cell: (r) => r.registros_nao_encontrados ?? 0 },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <Badge variant={r.status === "Concluído" ? "default" : r.status === "Com erros" ? "secondary" : "outline"}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (r) =>
        r.status === "Desfeito" ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <PermissionGate permission="piso.importar">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const ok = await confirm({
                  title: "Desfazer importação?",
                  description: `Todos os ${r.total_registros ?? 0} registros importados de "${r.nome_arquivo}" serão removidos.`,
                  tone: "destructive",
                  confirmLabel: "Desfazer",
                });
                if (ok) undoMut.mutate(r.id);
              }}
            >
              <Undo2 className="mr-1 h-3 w-3" /> Desfazer
            </Button>
          </PermissionGate>
        ),
    },
  ];

  const rows = (data?.rows ?? []) as Row[];
  const mesAtual = competenciaAtual();
  const jaImportouMes = rows.some(
    (r) => (r.status !== "Desfeito") && r.status !== "Desfeito" && r.status && dash.data?.competenciaAtual === mesAtual,
  );
  const alertaMensal = !dash.isLoading && dash.data?.competenciaAtual !== mesAtual;

  const delta = (a: number, b: number) => (b === 0 ? null : ((a - b) / b) * 100);
  const totalDelta = dash.data ? delta(dash.data.totalAtual, dash.data.totalAnterior) : null;
  const regDelta = dash.data ? delta(dash.data.registrosAtual, dash.data.registrosAnterior) : null;
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const trend = (n: number | null) =>
    n == null
      ? undefined
      : {
          direction: n > 0 ? ("up" as const) : n < 0 ? ("down" as const) : ("flat" as const),
          label: `${n > 0 ? "+" : ""}${n.toFixed(1)}% vs mês anterior`,
        };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="Piso Nacional da Enfermagem"
        description="Importações da folha do piso (Efetivos, Contratados, Ministério ou Personalizado)."
        actions={
          <PermissionGate permission="piso.importar">
            <Button asChild>
              <Link to="/piso-enfermagem/importar">
                <Upload className="mr-2 h-4 w-4" /> Nova importação
              </Link>
            </Button>
          </PermissionGate>
        }
      />

      {alertaMensal && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
          <div>
            <div className="font-medium">Competência {mesAtual} ainda não foi importada.</div>
            <div className="text-xs text-muted-foreground">
              Última competência registrada: {dash.data?.competenciaAtual ?? "—"}. Importe a folha do mês para manter o painel atualizado.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <KpiCard
          label="Competência atual"
          value={dash.data?.competenciaAtual ?? "—"}
          description={dash.data?.competenciaAnterior ? `Anterior: ${dash.data.competenciaAnterior}` : undefined}
          loading={dash.isLoading}
        />
        <KpiCard
          label="Complementação total"
          value={fmtBRL(dash.data?.totalAtual ?? 0)}
          trend={trend(totalDelta)}
          icon={totalDelta != null && totalDelta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          loading={dash.isLoading}
        />
        <KpiCard
          label="Registros na competência"
          value={(dash.data?.registrosAtual ?? 0).toLocaleString("pt-BR")}
          trend={trend(regDelta)}
          loading={dash.isLoading}
        />
      </div>

      {(dash.data?.top5?.length ?? 0) > 0 && (
        <div className="rounded-md border p-4">
          <div className="mb-2 text-sm font-medium">Top 5 profissionais — maior complementação</div>
          <ol className="space-y-1 text-sm">
            {dash.data!.top5.map((t, i) => (
              <li key={t.nome + i} className="flex items-center justify-between border-b py-1 last:border-0">
                <span><span className="mr-2 text-muted-foreground">#{i + 1}</span>{t.nome}</span>
                <span className="font-semibold">{fmtBRL(t.valor)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <DataTable<Row>
        columns={cols}
        rows={rows}
        getRowKey={(r) => r.id}
        loading={isLoading}
        emptyTitle="Nenhuma importação registrada"
        emptyDescription="Use “Nova importação” para começar."
      />
    </div>
  );
}