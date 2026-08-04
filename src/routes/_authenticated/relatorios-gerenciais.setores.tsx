import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterBar } from "@/components/shared/FilterBar";
import { KpiCard } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { downloadCsv } from "@/lib/csv-export";
import { listSetoresGerencial, type SetorPreset } from "@/lib/relatorios-gerenciais";
import { useUnidadesLookup } from "@/hooks/use-lookups";
import { IntelligencePanel } from "@/components/relatorios-gerenciais/intelligence-panel";
import { BotaoRelatorioAbnt } from "@/components/relatorios-gerenciais/botao-relatorio-abnt";

export const Route = createFileRoute("/_authenticated/relatorios-gerenciais/setores")({
  component: SetoresGerencial,
});

const PRESETS: { value: SetorPreset; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "sem_coordenador", label: "Sem Coordenador" },
  { value: "sem_profissionais", label: "Sem Profissionais" },
  { value: "um_servidor", label: "Apenas 1 servidor" },
];

function SetoresGerencial() {
  const [preset, setPreset] = useState<SetorPreset>("todos");
  const [unidadeId, setUnidadeId] = useState<string>("");
  const unidades = useUnidadesLookup();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["rel-ger", "setores", preset, unidadeId],
    queryFn: () => listSetoresGerencial(preset, unidadeId || null),
    staleTime: 60_000,
  });

  const totais = useMemo(
    () => ({
      total: rows.length,
      profissionais: rows.reduce((a, r) => a + r.qtd_profissionais, 0),
    }),
    [rows],
  );

  function exportCsv() {
    downloadCsv(`setores-${preset}.csv`, rows, [
      { header: "Setor", value: (r) => r.nome },
      { header: "Sigla", value: (r) => r.sigla ?? "" },
      { header: "Unidade", value: (r) => r.unidade_nome ?? "" },
      { header: "Status", value: (r) => r.status },
      { header: "Coordenador", value: (r) => r.responsavel_nome ?? "" },
      { header: "Profissionais", value: (r) => r.qtd_profissionais },
    ]);
  }

  function relatorioAbnt() {
    const porUnidade = new Map<string, number>();
    for (const r of rows) {
      const k = r.unidade_nome || "Sem unidade";
      porUnidade.set(k, (porUnidade.get(k) ?? 0) + 1);
    }
    return {
      arquivo: `relatorio-setores-${preset}`,
      titulo: "Relatório Gerencial de Setores",
      subtitulo: `Visão: ${PRESETS.find((p) => p.value === preset)?.label ?? "Todos"}`,
      orientacao: "landscape" as const,
      filtros: [
        { label: "Visão", valor: PRESETS.find((p) => p.value === preset)?.label ?? "—" },
        { label: "Unidade", valor: unidades.data?.find((u) => u.id === unidadeId)?.nome ?? "Todas" },
      ],
      kpis: [
        { label: "Setores listados", valor: rows.length },
        {
          label: "Profissionais alocados",
          valor: rows.reduce((a, r) => a + r.qtd_profissionais, 0),
        },
        { label: "Sem coordenador", valor: rows.filter((r) => !r.responsavel_nome).length },
        { label: "Sem profissionais", valor: rows.filter((r) => !r.qtd_profissionais).length },
      ],
      graficos: [
        {
          tipo: "barras" as const,
          titulo: "2 Setores por unidade (10 maiores)",
          dados: Array.from(porUnidade, ([label, valor]) => ({ label, valor })),
          limite: 10,
        },
        {
          tipo: "barras" as const,
          titulo: "2.1 Alocação por setor (10 maiores)",
          dados: rows.map((r) => ({ label: r.sigla || r.nome, valor: r.qtd_profissionais })),
          limite: 10,
        },
      ],
      colunas: [
        { header: "Setor", value: (r: (typeof rows)[number]) => r.nome },
        { header: "Sigla", value: (r: (typeof rows)[number]) => r.sigla },
        { header: "Unidade", value: (r: (typeof rows)[number]) => r.unidade_nome },
        { header: "Coordenador(a)", value: (r: (typeof rows)[number]) => r.responsavel_nome },
        { header: "Status", value: (r: (typeof rows)[number]) => r.status },
        {
          header: "Profissionais",
          value: (r: (typeof rows)[number]) => r.qtd_profissionais,
          align: "right" as const,
        },
      ],
      linhas: rows,
      notas: ["Setores sem coordenador designado exigem regularização formal por portaria."],
      assinaturas: ["Coordenação Administrativa", "Secretário(a) Municipal de Saúde"],
    };
  }

  return (
    <div className="space-y-4">
      <IntelligencePanel foco="setores" titulo="Setores" />
      <Tabs value={preset} onValueChange={(v) => setPreset(v as SetorPreset)}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          {PRESETS.map((p) => (
            <TabsTrigger key={p.value} value={p.value} className="text-xs">
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <FilterBar
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
            <BotaoRelatorioAbnt relatorio={relatorioAbnt} disabled={!rows.length} />
          </div>
        }
      >
        <FilterBar.Field label="Unidade">
          <Select
            value={unidadeId || "__all__"}
            onValueChange={(v) => setUnidadeId(v === "__all__" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as unidades</SelectItem>
              {(unidades.data ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
      </FilterBar>

      <div className="grid gap-3 sm:grid-cols-2">
        <KpiCard label="Setores" value={totais.total} />
        <KpiCard label="Profissionais alocados" value={totais.profissionais} />
      </div>

      <div className="overflow-auto rounded-md border bg-card">
        <table className="w-full table-auto text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-2">Setor</th>
              <th className="p-2">Unidade</th>
              <th className="p-2">Status</th>
              <th className="p-2">Coordenador</th>
              <th className="p-2 text-right">Profissionais</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState title="Nenhum setor encontrado" description="Ajuste os filtros." />
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 font-medium">
                  {r.nome}
                  {r.sigla ? (
                    <span className="ml-1 text-xs text-muted-foreground">({r.sigla})</span>
                  ) : null}
                </td>
                <td className="p-2 text-xs">{r.unidade_nome ?? "—"}</td>
                <td className="p-2 text-xs">{r.status}</td>
                <td className="p-2 text-xs">{r.responsavel_nome ?? "—"}</td>
                <td className="p-2 text-right tabular-nums">{r.qtd_profissionais}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
