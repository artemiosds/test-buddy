import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PermissionGate } from "@/components/permission-gate";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/formatters";
import { listHistoricoImportacoes } from "@/lib/piso-enfermagem.functions";

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
  const { data, isLoading } = useQuery({
    queryKey: ["piso", "historico", 1],
    queryFn: () => listHistoricoImportacoes({ data: { page: 1, pageSize: 50 } }),
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
        <StatusBadge tone={r.status === "Concluído" ? "success" : r.status === "Com erros" ? "warning" : "muted"}>
          {r.status}
        </StatusBadge>
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