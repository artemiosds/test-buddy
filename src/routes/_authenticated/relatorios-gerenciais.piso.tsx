import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, Download, GitCompare, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FilterBar } from "@/components/shared/FilterBar";
import { KpiCard } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { downloadCsv } from "@/lib/csv-export";
import {
  listPisoCompetencias,
  getPisoResumo,
  comparePisoCompetencias,
  listPisoDivergencias,
  listPisoHistorico,
} from "@/lib/relatorios-gerenciais";
import { IntelligencePanel } from "@/components/relatorios-gerenciais/intelligence-panel";

export const Route = createFileRoute("/_authenticated/relatorios-gerenciais/piso")({
  component: PisoGerencial,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PisoGerencial() {
  const competencias = useQuery({
    queryKey: ["rel-ger", "piso-comps"],
    queryFn: listPisoCompetencias,
    staleTime: 60_000,
  });
  const list = competencias.data ?? [];
  const [tab, setTab] = useState<"comparativo" | "divergencias" | "historico">("comparativo");

  return (
    <div className="space-y-4">
      <IntelligencePanel foco="piso" titulo="Piso da Enfermagem" />
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="comparativo">
            <GitCompare className="mr-1 h-4 w-4" /> Comparativo
          </TabsTrigger>
          <TabsTrigger value="divergencias">
            <AlertTriangle className="mr-1 h-4 w-4" /> Divergências
          </TabsTrigger>
          <TabsTrigger value="historico">
            <History className="mr-1 h-4 w-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comparativo" className="mt-4">
          <Comparativo comps={list} />
        </TabsContent>
        <TabsContent value="divergencias" className="mt-4">
          <Divergencias comps={list} />
        </TabsContent>
        <TabsContent value="historico" className="mt-4">
          <Historico />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Comparativo({ comps }: { comps: string[] }) {
  const [compA, setA] = useState<string>(comps[1] ?? "");
  const [compB, setB] = useState<string>(comps[0] ?? "");
  // Sync defaults when comps arrive.
  useMemo(() => {
    if (!compA && comps[1]) setA(comps[1]);
    if (!compB && comps[0]) setB(comps[0]);
  }, [comps.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const resumoA = useQuery({
    queryKey: ["piso-resumo", compA],
    queryFn: () => getPisoResumo(compA),
    enabled: !!compA,
  });
  const resumoB = useQuery({
    queryKey: ["piso-resumo", compB],
    queryFn: () => getPisoResumo(compB),
    enabled: !!compB,
  });
  const compare = useQuery({
    queryKey: ["piso-compare", compA, compB],
    queryFn: () => comparePisoCompetencias(compA, compB),
    enabled: !!compA && !!compB && compA !== compB,
    staleTime: 60_000,
  });

  const rows = compare.data ?? [];
  const totais = useMemo(() => {
    const somaA = rows.reduce((a, r) => a + r.valorA, 0);
    const somaB = rows.reduce((a, r) => a + r.valorB, 0);
    return {
      somaA,
      somaB,
      diff: somaB - somaA,
      aumentos: rows.filter((r) => r.diff > 0).length,
      reducoes: rows.filter((r) => r.diff < 0).length,
    };
  }, [rows]);

  function exportCsv() {
    downloadCsv(`piso-comparativo-${compA}-vs-${compB}.csv`, rows, [
      { header: "CPF", value: (r) => r.cpf },
      { header: "Nome", value: (r) => r.nome ?? "" },
      { header: "Unidade", value: (r) => r.unidade ?? "" },
      { header: "Cargo", value: (r) => r.cargo ?? "" },
      { header: `${compA} (R$)`, value: (r) => r.valorA.toFixed(2) },
      { header: `${compB} (R$)`, value: (r) => r.valorB.toFixed(2) },
      { header: "Diferença (R$)", value: (r) => r.diff.toFixed(2) },
      { header: "Variação (%)", value: (r) => (r.diffPct == null ? "" : r.diffPct.toFixed(2)) },
    ]);
  }

  if (comps.length < 2)
    return (
      <EmptyState
        title="Poucas competências"
        description="É preciso ao menos duas competências importadas de Piso para comparar."
      />
    );

  return (
    <div className="space-y-4">
      <FilterBar
        actions={
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
            <Download className="mr-1 h-4 w-4" /> CSV
          </Button>
        }
      >
        <FilterBar.Field label="Competência A (referência)">
          <Select value={compA} onValueChange={setA}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {comps.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="Competência B (comparada)">
          <Select value={compB} onValueChange={setB}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {comps.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
      </FilterBar>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={`Total ${compA || "A"}`}
          value={brl(resumoA.data?.somaFinal ?? totais.somaA)}
        />
        <KpiCard
          label={`Total ${compB || "B"}`}
          value={brl(resumoB.data?.somaFinal ?? totais.somaB)}
        />
        <KpiCard
          label="Variação (R$)"
          value={brl(totais.diff)}
          tone={totais.diff >= 0 ? "success" : "danger"}
        />
        <KpiCard
          label="↑ aumentos / ↓ reduções"
          value={`${totais.aumentos} / ${totais.reducoes}`}
        />
      </div>

      <div className="overflow-auto rounded-md border bg-card">
        <table className="w-full table-auto text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-2">CPF</th>
              <th className="p-2">Nome</th>
              <th className="p-2">Unidade</th>
              <th className="p-2 text-right">{compA}</th>
              <th className="p-2 text-right">{compB}</th>
              <th className="p-2 text-right">Diff (R$)</th>
              <th className="p-2 text-right">Var. %</th>
            </tr>
          </thead>
          <tbody>
            {compare.isLoading && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {!compare.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    title="Sem dados para comparar"
                    description="Selecione duas competências diferentes."
                  />
                </td>
              </tr>
            )}
            {rows.slice(0, 500).map((r) => (
              <tr key={r.cpf} className="border-t">
                <td className="p-2 font-mono text-xs">{r.cpf}</td>
                <td className="p-2">{r.nome ?? "—"}</td>
                <td className="p-2 text-xs">{r.unidade ?? "—"}</td>
                <td className="p-2 text-right tabular-nums">{brl(r.valorA)}</td>
                <td className="p-2 text-right tabular-nums">{brl(r.valorB)}</td>
                <td
                  className={
                    "p-2 text-right tabular-nums " +
                    (r.diff > 0 ? "text-emerald-700" : r.diff < 0 ? "text-red-700" : "")
                  }
                >
                  {brl(r.diff)}
                </td>
                <td className="p-2 text-right tabular-nums text-xs">
                  {r.diffPct == null ? "—" : r.diffPct.toFixed(1) + "%"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 500 && (
          <div className="border-t bg-muted/30 p-2 text-xs text-muted-foreground">
            Mostrando 500 de {rows.length} registros. Exporte o CSV para o dataset completo.
          </div>
        )}
      </div>
    </div>
  );
}

function Divergencias({ comps }: { comps: string[] }) {
  const [comp, setComp] = useState<string>(comps[0] ?? "");
  const [tipo, setTipo] = useState<"todos" | "divergentes" | "nao_encontrados">("todos");
  useMemo(() => {
    if (!comp && comps[0]) setComp(comps[0]);
  }, [comps.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const resumo = useQuery({
    queryKey: ["piso-resumo", comp],
    queryFn: () => getPisoResumo(comp),
    enabled: !!comp,
  });
  const div = useQuery({
    queryKey: ["piso-div", comp, tipo],
    queryFn: () => listPisoDivergencias(comp, tipo),
    enabled: !!comp,
  });
  const rows = div.data ?? [];

  function exportCsv() {
    downloadCsv(`piso-divergencias-${comp}-${tipo}.csv`, rows, [
      { header: "CPF", value: (r) => r.cpf ?? "" },
      { header: "Nome", value: (r) => r.nome ?? "" },
      { header: "Matrícula", value: (r) => r.matricula ?? "" },
      { header: "Unidade", value: (r) => r.unidade ?? "" },
      { header: "Cargo", value: (r) => r.cargo ?? "" },
      { header: "Status Match", value: (r) => r.status_match },
      { header: "Valor Final", value: (r) => r.valor_final ?? "" },
    ]);
  }

  if (!comps.length)
    return (
      <EmptyState
        title="Sem importações"
        description="Importe uma folha de Piso antes de analisar divergências."
      />
    );

  return (
    <div className="space-y-4">
      <FilterBar
        actions={
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
            <Download className="mr-1 h-4 w-4" /> CSV
          </Button>
        }
      >
        <FilterBar.Field label="Competência">
          <Select value={comp} onValueChange={setComp}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {comps.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="Tipo">
          <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas divergências</SelectItem>
              <SelectItem value="divergentes">Somente divergentes</SelectItem>
              <SelectItem value="nao_encontrados">Não encontrados</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar.Field>
      </FilterBar>

      <div className="grid gap-3 sm:grid-cols-4">
        <KpiCard label="Registros" value={resumo.data?.totalRegistros ?? "—"} />
        <KpiCard label="Match" value={resumo.data?.totalMatch ?? "—"} tone="success" />
        <KpiCard label="Divergentes" value={resumo.data?.totalDivergentes ?? "—"} tone="warning" />
        <KpiCard
          label="Não encontrados"
          value={resumo.data?.totalNaoEncontrados ?? "—"}
          tone="danger"
        />
      </div>

      <div className="overflow-auto rounded-md border bg-card">
        <table className="w-full table-auto text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-2">CPF</th>
              <th className="p-2">Nome</th>
              <th className="p-2">Matrícula</th>
              <th className="p-2">Unidade</th>
              <th className="p-2">Cargo</th>
              <th className="p-2">Status</th>
              <th className="p-2 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {div.isLoading && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {!div.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    title="Nenhuma divergência"
                    description="Todos os registros desta competência foram conciliados."
                  />
                </td>
              </tr>
            )}
            {rows.slice(0, 500).map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 font-mono text-xs">{r.cpf ?? "—"}</td>
                <td className="p-2">{r.nome ?? "—"}</td>
                <td className="p-2 font-mono text-xs">{r.matricula ?? "—"}</td>
                <td className="p-2 text-xs">{r.unidade ?? "—"}</td>
                <td className="p-2 text-xs">{r.cargo ?? "—"}</td>
                <td className="p-2 text-xs">
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] uppercase text-amber-700">
                    {r.status_match}
                  </span>
                </td>
                <td className="p-2 text-right tabular-nums">
                  {r.valor_final != null ? brl(Number(r.valor_final)) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Historico() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["piso-historico"],
    queryFn: () => listPisoHistorico(100),
    staleTime: 60_000,
  });

  function exportCsv() {
    downloadCsv("piso-historico-importacoes.csv", data, [
      { header: "Data", value: (r) => new Date(r.data_importacao).toLocaleString("pt-BR") },
      { header: "Arquivo", value: (r) => r.nome_arquivo },
      { header: "Competência", value: (r) => r.competencia ?? "" },
      { header: "Modelo", value: (r) => r.modelo },
      { header: "Status", value: (r) => r.status },
      { header: "Total", value: (r) => r.total_registros },
      { header: "Importados", value: (r) => r.registros_importados },
      { header: "Divergentes", value: (r) => r.registros_divergentes },
      { header: "Não encontrados", value: (r) => r.registros_nao_encontrados },
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!data.length}>
          <Download className="mr-1 h-4 w-4" /> CSV
        </Button>
      </div>
      <div className="overflow-auto rounded-md border bg-card">
        <table className="w-full table-auto text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-2">Data</th>
              <th className="p-2">Arquivo</th>
              <th className="p-2">Competência</th>
              <th className="p-2">Modelo</th>
              <th className="p-2">Status</th>
              <th className="p-2 text-right">Total</th>
              <th className="p-2 text-right">Importados</th>
              <th className="p-2 text-right">Divergentes</th>
              <th className="p-2 text-right">Não encontrados</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="p-4 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {!isLoading && data.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <EmptyState
                    title="Sem histórico"
                    description="Nenhuma importação de Piso registrada até o momento."
                  />
                </td>
              </tr>
            )}
            {data.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 text-xs">
                  {new Date(r.data_importacao).toLocaleString("pt-BR")}
                </td>
                <td className="p-2 text-xs">{r.nome_arquivo}</td>
                <td className="p-2 text-xs">{r.competencia ?? "—"}</td>
                <td className="p-2 text-xs">{r.modelo}</td>
                <td className="p-2 text-xs">{r.status}</td>
                <td className="p-2 text-right tabular-nums">{r.total_registros}</td>
                <td className="p-2 text-right tabular-nums text-emerald-700">
                  {r.registros_importados}
                </td>
                <td className="p-2 text-right tabular-nums text-amber-700">
                  {r.registros_divergentes}
                </td>
                <td className="p-2 text-right tabular-nums text-red-700">
                  {r.registros_nao_encontrados}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
