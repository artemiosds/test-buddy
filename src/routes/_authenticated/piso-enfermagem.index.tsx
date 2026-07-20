import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { PermissionGate } from "@/components/permission-gate";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/formatters";
import { listHistoricoImportacoes, desfazerImportacao } from "@/lib/piso-enfermagem.functions";
import { useConfirm } from "@/components/shared/ConfirmDialog";

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
                  tone: "danger",
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
      <DataTable<Row>
        columns={cols}
        rows={(data?.rows ?? []) as Row[]}
        getRowKey={(r) => r.id}
        loading={isLoading}
        emptyTitle="Nenhuma importação registrada"
        emptyDescription="Use “Nova importação” para começar."
      />
    </div>
  );
}