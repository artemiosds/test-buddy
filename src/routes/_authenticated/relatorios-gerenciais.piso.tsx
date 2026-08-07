import { ErrorComponent } from "@/components/shared/ErrorComponent";
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
import { BotaoRelatorioAbnt } from "@/components/relatorios-gerenciais/botao-relatorio-abnt";

export const Route = createFileRoute("/_authenticated/relatorios-gerenciais/piso")({ errorComponent: ErrorComponent,
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

  function relatorioAbnt() {
    return {
      arquivo: `relatorio-piso-comparativo-${compA}-vs-${compB}`,
      titulo: "Relatório Comparativo — Piso Nacional da Enfermagem",
      subtitulo: `Competência ${compA} versus ${compB}`,
      orientacao: "landscape" as const,
      filtros: [
        { label: "Competência A (referência)", valor: compA },
        { label: "Competência B (comparada)", valor: compB },
      ],
      kpis: [
        { label: `Total ${compA}`, valor: brl(resumoA.data?.somaFinal ?? totais.somaA) },
        { label: `Total ${compB}`, valor: brl(resumoB.data?.somaFinal ?? totais.somaB) },
        { label: "Variação", valor: brl(totais.diff) },
        { label: "Aumentos / Reduções", valor: `${totais.aumentos} / ${totais.reducoes}` },
      ],
      graficos: [
        {
          tipo: "barras" as const,
          titulo: "2 Maiores variações individuais (R$)",
          dados: [...rows]
            .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
            .map((r) => ({ label: r.nome ?? r.cpf, valor: Math.abs(r.diff) })),
          limite: 10,
        },
      ],
      colunas: [
        { header: "CPF", value: (r: (typeof rows)[number]) => r.cpf },
        { header: "Nome", value: (r: (typeof rows)[number]) => r.nome },
        { header: "Unidade", value: (r: (typeof rows)[number]) => r.unidade },
        {
          header: `${compA} (R$)`,
          value: (r: (typeof rows)[number]) => r.valorA,
          formato: "moeda" as const,
          align: "right" as const,
        },
        {
          header: `${compB} (R$)`,
          value: (r: (typeof rows)[number]) => r.valorB,
          formato: "moeda" as const,
          align: "right" as const,
        },
        {
          header: "Diferença",
          value: (r: (typeof rows)[number]) => r.diff,
          formato: "moeda" as const,
          align: "right" as const,
        },
        {
          header: "Var. %",
          value: (r: (typeof rows)[number]) => r.diffPct,
          formato: "percentual" as const,
          align: "right" as const,
        },
      ],
      linhas: rows,
      notas: [
        "Valores correspondentes ao complemento do Piso Nacional da Enfermagem apurado por competência.",
        "Variações relevantes devem ser justificadas documentalmente para fins de prestação de contas.",
      ],
      assinaturas: ["Setor de Folha de Pagamento", "Secretário(a) Municipal de Saúde"],
    };
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
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
            <BotaoRelatorioAbnt relatorio={relatorioAbnt} disabled={!rows.length} />
          </div>
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

  function relatorioAbnt() {
    const porStatus = new Map<string, number>();
    for (const r of rows) porStatus.set(r.status_match, (porStatus.get(r.status_match) ?? 0) + 1);
    return {
      arquivo: `relatorio-piso-divergencias-${comp}-${tipo}`,
      titulo: "Relatório de Divergências — Piso da Enfermagem",
      subtitulo: `Competência ${comp} · Filtro: ${tipo.replace("_", " ")}`,
      orientacao: "landscape" as const,
      filtros: [
        { label: "Competência", valor: comp },
        { label: "Tipo", valor: tipo.replace("_", " ") },
      ],
      kpis: [
        { label: "Registros analisados", valor: rows.length },
        { label: "Total apurado", valor: brl(resumo.data?.somaFinal ?? 0) },
        {
          label: "Não encontrados",
          valor: rows.filter((r) => r.status_match === "nao_encontrado").length,
        },
        { label: "Divergentes", valor: rows.filter((r) => r.status_match === "divergente").length },
      ],
      graficos: [
        {
          tipo: "rosca" as const,
          titulo: "2 Composição por situação de cruzamento",
          dados: Array.from(porStatus, ([label, valor]) => ({ label, valor })),
          limite: 6,
        },
      ],
      colunas: [
        { header: "CPF", value: (r: (typeof rows)[number]) => r.cpf },
        { header: "Nome", value: (r: (typeof rows)[number]) => r.nome },
        { header: "Matrícula", value: (r: (typeof rows)[number]) => r.matricula },
        { header: "Unidade", value: (r: (typeof rows)[number]) => r.unidade },
        { header: "Cargo", value: (r: (typeof rows)[number]) => r.cargo },
        { header: "Situação", value: (r: (typeof rows)[number]) => r.status_match },
        {
          header: "Valor final",
          value: (r: (typeof rows)[number]) => r.valor_final,
          formato: "moeda" as const,
          align: "right" as const,
        },
      ],
      linhas: rows,
      notas: [
        "Registros não encontrados indicam ausência de correspondência no cadastro funcional (nome, CPF, lotação ou cargo).",
        "Cada divergência deve ser tratada antes do fechamento da competência.",
      ],
      assinaturas: ["Setor de Folha de Pagamento", "Controle Interno"],
    };
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
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
            <BotaoRelatorioAbnt relatorio={relatorioAbnt} disabled={!rows.length} />
          </div>
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

  function relatorioAbnt() {
    return {
      arquivo: "relatorio-piso-historico-importacoes",
      titulo: "Relatório de Histórico de Importações — Piso da Enfermagem",
      subtitulo: "Trilha de processamento das folhas importadas",
      orientacao: "landscape" as const,
      kpis: [
        { label: "Importações registradas", valor: data.length },
        {
          label: "Registros importados",
          valor: data.reduce((a, r) => a + (r.registros_importados ?? 0), 0),
        },
        {
          label: "Divergentes",
          valor: data.reduce((a, r) => a + (r.registros_divergentes ?? 0), 0),
        },
        {
          label: "Não encontrados",
          valor: data.reduce((a, r) => a + (r.registros_nao_encontrados ?? 0), 0),
        },
      ],
      graficos: [
        {
          tipo: "barras" as const,
          titulo: "2 Volume importado por competência",
          dados: Array.from(
            data.reduce((m, r) => {
              const k = r.competencia ?? "Sem competência";
              return m.set(k, (m.get(k) ?? 0) + (r.registros_importados ?? 0));
            }, new Map<string, number>()),
            ([label, valor]) => ({ label, valor }),
          ),
          limite: 10,
        },
      ],
      colunas: [
        {
          header: "Data",
          value: (r: (typeof data)[number]) => new Date(r.data_importacao).toLocaleString("pt-BR"),
        },
        { header: "Arquivo", value: (r: (typeof data)[number]) => r.nome_arquivo },
        { header: "Competência", value: (r: (typeof data)[number]) => r.competencia },
        { header: "Modelo", value: (r: (typeof data)[number]) => r.modelo },
        { header: "Status", value: (r: (typeof data)[number]) => r.status },
        {
          header: "Total",
          value: (r: (typeof data)[number]) => r.total_registros,
          align: "right" as const,
        },
        {
          header: "Import.",
          value: (r: (typeof data)[number]) => r.registros_importados,
          align: "right" as const,
        },
        {
          header: "Diverg.",
          value: (r: (typeof data)[number]) => r.registros_divergentes,
          align: "right" as const,
        },
        {
          header: "N/ encontr.",
          value: (r: (typeof data)[number]) => r.registros_nao_encontrados,
          align: "right" as const,
        },
      ],
      linhas: data,
      notas: ["Histórico mantido para fins de auditoria e rastreabilidade das folhas processadas."],
      assinaturas: ["Setor de Folha de Pagamento", "Controle Interno"],
    };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!data.length}>
          <Download className="mr-1 h-4 w-4" /> CSV
        </Button>
        <BotaoRelatorioAbnt relatorio={relatorioAbnt} disabled={!data.length} />
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
