import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload, Download, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { PermissionGate } from "@/components/permission-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterBar } from "@/components/shared/FilterBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { KpiCard } from "@/components/shared/KpiCard";
import {
  listPisoLinhas,
  listPisoCompetencias,
  getPisoCompetenciaResumo,
  getPisoDistribuicao,
} from "@/lib/piso-enfermagem.functions";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { downloadCsv, type CsvColumn } from "@/lib/csv-export";
import { competenciaAtual } from "@/lib/piso-heuristics";

export const Route = createFileRoute("/_authenticated/piso-enfermagem/")({
  component: () => (
    <PermissionGate
      permission="piso.visualizar"
      fallback={
        <div className="p-6 text-sm text-muted-foreground">
          Sem permissão para visualizar o Piso Nacional da Enfermagem.
        </div>
      }
    >
      <PisoIndex />
    </PermissionGate>
  ),
});

type Linha = {
  id: string;
  nome: string | null;
  cpf: string | null;
  matricula: string | null;
  cargo: string | null;
  vinculo: string | null;
  competencia: string | null;
  salario_base: number | null;
  piso_complementacao: number | null;
  valor_final: number | null;
  valor_liquido: number | null;
};

const VINCULO_OPCOES = ["Efetivos", "Contratados"] as const;
const CARGO_OPCOES = ["Enfermeiro", "Técnico", "Auxiliar"] as const;

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PisoIndex() {
  const [competencia, setCompetencia] = useState<string | null>(null);
  const [vinculo, setVinculo] = useState<string>("");
  const [cargo, setCargo] = useState<string>("");
  const [busca, setBusca] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Lista de competências (para o dropdown)
  const compQ = useQuery({
    queryKey: ["piso", "competencias"],
    queryFn: () => listPisoCompetencias({}),
  });

  // Se ainda não escolheu, adota a mais recente
  const competenciaAtiva = competencia ?? compQ.data?.competencias?.[0] ?? null;

  // Resumo (KPIs + top5 + comparação vs mês anterior)
  const resumoQ = useQuery({
    queryKey: ["piso", "resumo", competenciaAtiva],
    queryFn: () => getPisoCompetenciaResumo({ data: { competencia: competenciaAtiva } }),
    enabled: !compQ.isLoading,
  });

  const distQ = useQuery({
    queryKey: ["piso", "dist", competenciaAtiva],
    queryFn: () => getPisoDistribuicao({ data: { competencia: competenciaAtiva } }),
    enabled: !!competenciaAtiva,
  });

  // Linhas paginadas com filtros
  const linhasQ = useQuery({
    queryKey: ["piso", "linhas", competenciaAtiva, vinculo, cargo, busca, page],
    queryFn: () =>
      listPisoLinhas({
        data: {
          competencia: competenciaAtiva,
          vinculo: vinculo || null,
          cargo: cargo || null,
          busca: busca || null,
          page,
          pageSize,
        },
      }),
    enabled: !!competenciaAtiva,
  });

  const cols: DataTableColumn<Linha>[] = useMemo(
    () => [
      { key: "nome", header: "Nome", cell: (r) => r.nome ?? "—" },
      { key: "cpf", header: "CPF", cell: (r) => r.cpf ?? "—" },
      { key: "cargo", header: "Cargo", cell: (r) => r.cargo ?? "—" },
      { key: "vinculo", header: "Vínculo", cell: (r) => r.vinculo ?? "—" },
      {
        key: "salario_base",
        header: "Salário Base",
        cell: (r) => (r.salario_base != null ? fmtBRL(r.salario_base) : "—"),
      },
      {
        key: "piso_complementacao",
        header: "Complementação",
        cell: (r) =>
          r.piso_complementacao != null ? (
            <span className={r.piso_complementacao > 0 ? "font-semibold text-emerald-600" : ""}>
              {fmtBRL(r.piso_complementacao)}
            </span>
          ) : (
            "—"
          ),
      },
      {
        key: "valor_final",
        header: "Valor Final",
        cell: (r) => (r.valor_final != null ? fmtBRL(r.valor_final) : "—"),
      },
    ],
    [],
  );

  function handleExportar() {
    const rows = (linhasQ.data?.rows ?? []) as Linha[];
    const cols: CsvColumn<Linha>[] = [
      { header: "Nome", value: (r) => r.nome },
      { header: "CPF", value: (r) => r.cpf },
      { header: "Matrícula", value: (r) => r.matricula },
      { header: "Cargo", value: (r) => r.cargo },
      { header: "Vínculo", value: (r) => r.vinculo },
      { header: "Competência", value: (r) => r.competencia },
      { header: "Salário Base", value: (r) => r.salario_base ?? "" },
      { header: "Complementação", value: (r) => r.piso_complementacao ?? "" },
      { header: "Valor Líquido", value: (r) => r.valor_liquido ?? "" },
      { header: "Valor Final", value: (r) => r.valor_final ?? "" },
    ];
    const suf = competenciaAtiva ? "-" + competenciaAtiva.toLowerCase().replace(/\s+/g, "-") : "";
    downloadCsv(`piso-enfermagem${suf}`, rows, cols);
  }

  const carregando = compQ.isLoading || resumoQ.isLoading;
  const semDados = !carregando && (compQ.data?.competencias?.length ?? 0) === 0;

  const atualR = resumoQ.data?.atual;
  const antR = resumoQ.data?.anterior;
  const delta = (a: number, b: number) => (b === 0 ? null : ((a - b) / b) * 100);
  const kpiTrend = (n: number | null) =>
    n == null
      ? undefined
      : {
          direction:
            n > 0 ? ("up" as const) : n < 0 ? ("down" as const) : ("flat" as const),
          label: `${n > 0 ? "+" : ""}${n.toFixed(1)}% vs mês anterior`,
        };

  const mesCorrente = competenciaAtual();
  const alertaMensal =
    !carregando &&
    (compQ.data?.competencias?.length ?? 0) > 0 &&
    resumoQ.data?.competenciaAtual !== mesCorrente;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="Piso Nacional da Enfermagem"
        description="Profissionais beneficiados e complementação salarial por competência."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExportar} disabled={!linhasQ.data?.rows?.length}>
              <Download className="mr-2 h-4 w-4" /> Exportar Excel
            </Button>
            <PermissionGate permission="piso.importar">
              <Button asChild>
                <Link to="/piso-enfermagem/importar">
                  <Upload className="mr-2 h-4 w-4" /> Nova importação
                </Link>
              </Button>
            </PermissionGate>
          </div>
        }
      />

      {semDados ? (
        <EmptyState
          title="Nenhum dado importado ainda"
          description="Clique em Nova Importação para começar."
          action={
            <PermissionGate permission="piso.importar">
              <Button asChild>
                <Link to="/piso-enfermagem/importar">
                  <Upload className="mr-2 h-4 w-4" /> Nova importação
                </Link>
              </Button>
            </PermissionGate>
          }
        />
      ) : (
        <>
          {alertaMensal && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
              <div>
                <div className="font-medium">Competência {mesCorrente} ainda não foi importada.</div>
                <div className="text-xs text-muted-foreground">
                  Última competência registrada: {resumoQ.data?.competenciaAtual ?? "—"}.
                </div>
              </div>
            </div>
          )}

          {/* KPIs com comparação */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Profissionais"
              value={(atualR?.total ?? 0).toLocaleString("pt-BR")}
              trend={atualR && antR ? kpiTrend(delta(atualR.total, antR.total)) : undefined}
              loading={resumoQ.isLoading}
              description={resumoQ.data?.competenciaAtual ?? undefined}
            />
            <KpiCard
              label="Total pago"
              value={fmtBRL(atualR?.valorFinal ?? 0)}
              trend={atualR && antR ? kpiTrend(delta(atualR.valorFinal, antR.valorFinal)) : undefined}
              icon={
                atualR && antR && delta(atualR.valorFinal, antR.valorFinal)! >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )
              }
              loading={resumoQ.isLoading}
            />
            <KpiCard
              label="Complementação"
              value={fmtBRL(atualR?.complementacao ?? 0)}
              trend={
                atualR && antR
                  ? kpiTrend(delta(atualR.complementacao, antR.complementacao))
                  : undefined
              }
              loading={resumoQ.isLoading}
            />
            <KpiCard
              label="Beneficiados"
              value={(atualR?.beneficiados ?? 0).toLocaleString("pt-BR")}
              trend={
                atualR && antR ? kpiTrend(delta(atualR.beneficiados, antR.beneficiados)) : undefined
              }
              loading={resumoQ.isLoading}
              description="com complementação > 0"
            />
          </div>

          {/* Top 5 */}
          {(atualR?.top5?.length ?? 0) > 0 && (
            <div className="rounded-md border p-4">
              <div className="mb-2 text-sm font-medium">
                Top 5 profissionais — maior complementação
              </div>
              <ol className="space-y-1 text-sm">
                {atualR!.top5.map((t, i) => (
                  <li
                    key={t.nome + i}
                    className="flex items-center justify-between border-b py-1 last:border-0"
                  >
                    <span>
                      <span className="mr-2 text-muted-foreground">#{i + 1}</span>
                      {t.nome}
                    </span>
                    <span className="font-semibold">{fmtBRL(t.valor)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Distribuição por unidade / cargo */}
          {distQ.data && (distQ.data.porUnidade.length > 0 || distQ.data.porCargo.length > 0) && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border p-4">
                <div className="mb-2 text-sm font-medium">Distribuição por unidade</div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distQ.data.porUnidade}>
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="total" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-md border p-4">
                <div className="mb-2 text-sm font-medium">Distribuição por cargo</div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distQ.data.porCargo}
                        dataKey="total"
                        nameKey="label"
                        outerRadius={80}
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {distQ.data.porCargo.map((_, i) => (
                          <Cell key={i} fill={["#2563eb","#16a34a","#f59e0b","#dc2626","#7c3aed","#0891b2"][i % 6]} />
                        ))}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Não localizados na última importação (competência atual) */}
          {distQ.data && distQ.data.naoLocalizados.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Profissionais não localizados nesta competência ({distQ.data.naoLocalizados.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1">Nome</th>
                      <th className="px-2 py-1">CPF</th>
                      <th className="px-2 py-1">Matrícula</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distQ.data.naoLocalizados.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{r.nome ?? "—"}</td>
                        <td className="px-2 py-1 font-mono">{r.cpf ?? "—"}</td>
                        <td className="px-2 py-1 font-mono">{r.matricula ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Filtros */}
          <FilterBar>
            <FilterBar.Field label="Competência">
              <Select
                value={competenciaAtiva ?? ""}
                onValueChange={(v) => {
                  setCompetencia(v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {(compQ.data?.competencias ?? []).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterBar.Field>
            <FilterBar.Field label="Vínculo">
              <Select
                value={vinculo || "__all__"}
                onValueChange={(v) => {
                  setVinculo(v === "__all__" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {VINCULO_OPCOES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterBar.Field>
            <FilterBar.Field label="Cargo">
              <Select
                value={cargo || "__all__"}
                onValueChange={(v) => {
                  setCargo(v === "__all__" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {CARGO_OPCOES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterBar.Field>
            <FilterBar.Field label="Busca (nome ou CPF)">
              <Input
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPage(1);
                }}
                placeholder="Digite para filtrar…"
              />
            </FilterBar.Field>
          </FilterBar>

          <DataTable<Linha>
            columns={cols}
            rows={(linhasQ.data?.rows ?? []) as Linha[]}
            getRowKey={(r) => r.id}
            loading={linhasQ.isLoading}
            emptyTitle="Nenhum profissional encontrado"
            emptyDescription="Ajuste os filtros ou selecione outra competência."
          />
          <Pagination
            page={page}
            pageSize={pageSize}
            total={linhasQ.data?.count ?? 0}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}