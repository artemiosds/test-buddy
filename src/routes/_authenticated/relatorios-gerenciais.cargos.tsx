import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { downloadCsv } from "@/lib/csv-export";
import { listCargosGerencial, type CargoPreset } from "@/lib/relatorios-gerenciais";
import { IntelligencePanel } from "@/components/relatorios-gerenciais/intelligence-panel";
import { BotaoRelatorioAbnt } from "@/components/relatorios-gerenciais/botao-relatorio-abnt";

export const Route = createFileRoute("/_authenticated/relatorios-gerenciais/cargos")({ errorComponent: ErrorComponent,
  component: CargosGerencial,
});

const PRESETS: { value: CargoPreset; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "com_profissionais", label: "Com profissionais" },
  { value: "sem_profissionais", label: "Sem profissionais" },
];

function CargosGerencial() {
  const [preset, setPreset] = useState<CargoPreset>("todos");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["rel-ger", "cargos", preset],
    queryFn: () => listCargosGerencial(preset),
    staleTime: 60_000,
  });

  const ordenados = useMemo(
    () =>
      [...rows].sort(
        (a, b) => b.qtd_profissionais - a.qtd_profissionais || a.nome.localeCompare(b.nome),
      ),
    [rows],
  );
  const totais = useMemo(
    () => ({
      total: rows.length,
      profissionais: rows.reduce((a, r) => a + r.qtd_profissionais, 0),
      ocupados: rows.filter((r) => r.qtd_profissionais > 0).length,
    }),
    [rows],
  );

  function exportCsv() {
    downloadCsv(`cargos-${preset}.csv`, ordenados, [
      { header: "Cargo", value: (r) => r.nome },
      { header: "Código", value: (r) => r.codigo ?? "" },
      { header: "CBO", value: (r) => r.cbo ?? "" },
      { header: "Nível", value: (r) => r.nivel ?? "" },
      { header: "Status", value: (r) => r.status },
      { header: "Profissionais", value: (r) => r.qtd_profissionais },
    ]);
  }

  function relatorioAbnt() {
    const porNivel = new Map<string, number>();
    for (const r of ordenados) {
      const k = r.nivel || "Sem nível";
      porNivel.set(k, (porNivel.get(k) ?? 0) + 1);
    }
    return {
      arquivo: `relatorio-cargos-${preset}`,
      titulo: "Relatório Gerencial de Cargos",
      subtitulo: `Visão: ${PRESETS.find((p) => p.value === preset)?.label ?? "Todos"}`,
      filtros: [{ label: "Visão", valor: PRESETS.find((p) => p.value === preset)?.label ?? "—" }],
      kpis: [
        { label: "Cargos listados", valor: totais.total },
        { label: "Cargos ocupados", valor: totais.ocupados },
        { label: "Cargos vazios", valor: totais.total - totais.ocupados },
        { label: "Profissionais", valor: totais.profissionais },
      ],
      graficos: [
        {
          tipo: "barras" as const,
          titulo: "2 Cargos com maior ocupação",
          dados: ordenados.map((r) => ({ label: r.nome, valor: r.qtd_profissionais })),
          limite: 10,
        },
        {
          tipo: "rosca" as const,
          titulo: "2.1 Distribuição por nível",
          dados: Array.from(porNivel, ([label, valor]) => ({ label, valor })),
          limite: 6,
        },
      ],
      colunas: [
        { header: "Cargo", value: (r: (typeof ordenados)[number]) => r.nome },
        { header: "Código", value: (r: (typeof ordenados)[number]) => r.codigo },
        { header: "CBO", value: (r: (typeof ordenados)[number]) => r.cbo },
        { header: "Nível", value: (r: (typeof ordenados)[number]) => r.nivel },
        { header: "Status", value: (r: (typeof ordenados)[number]) => r.status },
        {
          header: "Profissionais",
          value: (r: (typeof ordenados)[number]) => r.qtd_profissionais,
          align: "right" as const,
        },
      ],
      linhas: ordenados,
      notas: ["Cargos sem ocupação podem indicar vagas disponíveis no quadro autorizado."],
      assinaturas: ["Coordenação de Gestão de Pessoas", "Secretário(a) Municipal de Saúde"],
    };
  }

  return (
    <div className="space-y-4">
      <IntelligencePanel foco="cargos" titulo="Cargos" />
      <Tabs value={preset} onValueChange={(v) => setPreset(v as CargoPreset)}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          {PRESETS.map((p) => (
            <TabsTrigger key={p.value} value={p.value} className="text-xs">
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
          <Download className="mr-1 h-4 w-4" /> CSV
        </Button>
        <BotaoRelatorioAbnt relatorio={relatorioAbnt} disabled={!rows.length} />
      </div>


      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Cargos" value={totais.total} />
        <KpiCard label="Ocupados" value={totais.ocupados} tone="success" />
        <KpiCard label="Profissionais" value={totais.profissionais} />
      </div>

      <div className="overflow-auto rounded-md border bg-card">
        <table className="w-full table-auto text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-2">Cargo</th>
              <th className="p-2">Código</th>
              <th className="p-2">CBO</th>
              <th className="p-2">Nível</th>
              <th className="p-2">Status</th>
              <th className="p-2 text-right">Profissionais</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState title="Nenhum cargo encontrado" description="Ajuste os filtros." />
                </td>
              </tr>
            )}
            {ordenados.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 font-medium">{r.nome}</td>
                <td className="p-2 font-mono text-xs">{r.codigo ?? "—"}</td>
                <td className="p-2 font-mono text-xs">{r.cbo ?? "—"}</td>
                <td className="p-2 text-xs">{r.nivel ?? "—"}</td>
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
