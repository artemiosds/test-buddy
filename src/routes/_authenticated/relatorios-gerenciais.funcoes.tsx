import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { downloadCsv } from "@/lib/csv-export";
import { listFuncoesGerencial, type FuncaoPreset } from "@/lib/relatorios-gerenciais";

export const Route = createFileRoute("/_authenticated/relatorios-gerenciais/funcoes")({
  component: FuncoesGerencial,
});

const PRESETS: { value: FuncaoPreset; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "com_profissionais", label: "Com profissionais" },
  { value: "sem_profissionais", label: "Sem profissionais" },
];

function FuncoesGerencial() {
  const [preset, setPreset] = useState<FuncaoPreset>("todas");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["rel-ger", "funcoes", preset],
    queryFn: () => listFuncoesGerencial(preset),
    staleTime: 60_000,
  });

  const ordenadas = useMemo(() => [...rows].sort((a, b) => b.qtd_profissionais - a.qtd_profissionais || a.nome.localeCompare(b.nome)), [rows]);
  const totais = useMemo(() => ({
    total: rows.length,
    ocupadas: rows.filter((r) => r.qtd_profissionais > 0).length,
    profissionais: rows.reduce((a, r) => a + r.qtd_profissionais, 0),
  }), [rows]);

  function exportCsv() {
    downloadCsv(`funcoes-${preset}.csv`, ordenadas, [
      { header: "Função", value: (r) => r.nome },
      { header: "Código", value: (r) => r.codigo ?? "" },
      { header: "Gratificação (%)", value: (r) => r.gratificacao_percentual ?? "" },
      { header: "Status", value: (r) => r.status },
      { header: "Profissionais", value: (r) => r.qtd_profissionais },
    ]);
  }

  return (
    <div className="space-y-4">
      <Tabs value={preset} onValueChange={(v) => setPreset(v as FuncaoPreset)}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          {PRESETS.map((p) => (<TabsTrigger key={p.value} value={p.value} className="text-xs">{p.label}</TabsTrigger>))}
        </TabsList>
      </Tabs>

      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="mr-1 h-4 w-4" /> CSV</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Funções" value={totais.total} />
        <KpiCard label="Ocupadas" value={totais.ocupadas} tone="success" />
        <KpiCard label="Profissionais" value={totais.profissionais} />
      </div>

      <div className="overflow-auto rounded-md border bg-card">
        <table className="w-full table-auto text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-2">Função</th>
              <th className="p-2">Código</th>
              <th className="p-2 text-right">Gratificação %</th>
              <th className="p-2">Status</th>
              <th className="p-2 text-right">Profissionais</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (<tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>)}
            {!isLoading && rows.length === 0 && (<tr><td colSpan={5}><EmptyState title="Nenhuma função encontrada" description="Ajuste os filtros." /></td></tr>)}
            {ordenadas.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 font-medium">{r.nome}</td>
                <td className="p-2 font-mono text-xs">{r.codigo ?? "—"}</td>
                <td className="p-2 text-right tabular-nums">{r.gratificacao_percentual ?? "—"}</td>
                <td className="p-2 text-xs">{r.status}</td>
                <td className="p-2 text-right tabular-nums">{r.qtd_profissionais}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}