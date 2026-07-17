import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Building2, Users, Layers, AlertCircle, ArrowUp, ArrowDown } from "lucide-react";

import { useAnalytics } from "@/hooks/use-analytics";
import { useUnidadesLookup, useSetoresLookup, useCargosLookup } from "@/hooks/use-lookups";
import { PermissionGate } from "@/components/permission-gate";
import {
  EmptyState, KpiCard, PageHeader, DataTable, FilterBar,
  type DataTableColumn,
} from "@/components/shared";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/gestao-pessoas/lotacao")({
  head: () => ({
    meta: [
      { title: "Quadro de Lotação — Gestão de Pessoas" },
      { name: "description", content: "Quadro consolidado por Unidade, Setor, Cargo e Função." },
    ],
  }),
  component: () => (
    <PermissionGate
      permission="profissional.visualizar"
      fallback={<div className="p-6 text-sm text-muted-foreground">Sem permissão para visualizar este painel.</div>}
    >
      <QuadroLotacaoPage />
    </PermissionGate>
  ),
});

/**
 * Linha do Quadro de Lotação. As colunas opcionais (previsto/ideal/deficit/excesso)
 * já estão mapeadas para permitir evolução futura sem quebrar a assinatura da tabela.
 */
export type QuadroLotacaoRow = {
  key: string;
  unidadeId: string | null;
  setorId: string | null;
  cargoId: string | null;
  funcaoId: string | null;
  unidade: string;
  setor: string;
  cargo: string;
  funcao: string;
  total: number;
  ativos: number;
  afastados: number;
  ferias: number;
  licencas: number;
  // Reservado para evolução futura — não renderizado hoje.
  previsto?: number;
  ideal?: number;
  deficit?: number;
  excesso?: number;
};

type SortKey = "unidade" | "setor" | "cargo" | "funcao" | "total";

function QuadroLotacaoPage() {
  const [unidadeId, setUnidadeId] = useState<string>("__all__");
  const [setorId, setSetorId] = useState<string>("__all__");
  const [cargoId, setCargoId] = useState<string>("__all__");
  const [sortBy, setSortBy] = useState<SortKey>("unidade");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const unidades = useUnidadesLookup();
  const setores = useSetoresLookup({ unidadeId: unidadeId === "__all__" ? null : unidadeId });
  const cargos = useCargosLookup();

  const a = useAnalytics({});
  const alertas = a.alertas.data;
  const rowsAll: QuadroLotacaoRow[] = a.quadroLotacao.data ?? [];

  const rows = useMemo(() => {
    let r = rowsAll;
    if (unidadeId !== "__all__") r = r.filter((x) => x.unidadeId === unidadeId);
    if (setorId !== "__all__") r = r.filter((x) => x.setorId === setorId);
    if (cargoId !== "__all__") r = r.filter((x) => x.cargoId === cargoId);
    const dir = sortDir === "asc" ? 1 : -1;
    r = [...r].sort((x, y) => {
      if (sortBy === "total") return (x.total - y.total) * dir;
      return String(x[sortBy]).localeCompare(String(y[sortBy]), "pt-BR") * dir;
    });
    return r;
  }, [rowsAll, unidadeId, setorId, cargoId, sortBy, sortDir]);

  const totalProfLotados = rows.reduce((s, r) => s + r.total, 0);
  const unidadesComLotacao = new Set(rows.map((r) => r.unidadeId).filter(Boolean)).size;
  const setoresComLotacao = new Set(rows.map((r) => r.setorId).filter(Boolean)).size;

  const toggleSort = (k: SortKey) => {
    if (sortBy === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(k); setSortDir("asc"); }
  };
  const sortIcon = (k: SortKey) =>
    sortBy !== k ? null : sortDir === "asc" ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />;
  const sortableHeader = (k: SortKey, label: string) => (
    <button type="button" onClick={() => toggleSort(k)} className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
      {label}{sortIcon(k)}
    </button>
  );

  const columns: DataTableColumn<QuadroLotacaoRow>[] = [
    { key: "unidade", header: sortableHeader("unidade", "Unidade"), cell: (r) => <span className="font-medium">{r.unidade}</span> },
    { key: "setor", header: sortableHeader("setor", "Setor"), cell: (r) => r.setor },
    { key: "cargo", header: sortableHeader("cargo", "Cargo"), cell: (r) => r.cargo },
    { key: "funcao", header: sortableHeader("funcao", "Função"), cell: (r) => r.funcao },
    { key: "total", header: sortableHeader("total", "Qtd atual"), cell: (r) => <span className="block text-right tabular-nums font-medium">{r.total}</span>, className: "text-right" },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {r.ativos}A · {r.afastados}Af · {r.ferias}F · {r.licencas}L
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="Quadro de Lotação"
        description="Distribuição consolidada por Unidade, Setor, Cargo e Função."
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Profissionais lotados" value={totalProfLotados.toLocaleString("pt-BR")} loading={a.quadroLotacao.isLoading} icon={<Users className="h-4 w-4" />} />
        <KpiCard label="Unidades com lotação" value={unidadesComLotacao.toLocaleString("pt-BR")} loading={a.quadroLotacao.isLoading} icon={<Building2 className="h-4 w-4" />} />
        <KpiCard label="Setores com lotação" value={setoresComLotacao.toLocaleString("pt-BR")} loading={a.quadroLotacao.isLoading} icon={<Layers className="h-4 w-4" />} />
        <KpiCard label="Unidades sem gestor" value={(alertas?.unidadesSemGestor ?? 0).toLocaleString("pt-BR")} loading={a.alertas.isLoading} icon={<AlertCircle className="h-4 w-4" />} />
        <KpiCard label="Setores sem responsável" value={(alertas?.setoresSemResponsavel ?? 0).toLocaleString("pt-BR")} loading={a.alertas.isLoading} icon={<AlertCircle className="h-4 w-4" />} />
      </section>

      <FilterBar>
        <FilterBar.Field label="Unidade">
          <Select value={unidadeId} onValueChange={(v) => { setUnidadeId(v); setSetorId("__all__"); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas</SelectItem>
              {(unidades.data ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.sigla ? `${u.sigla} — ${u.nome}` : u.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="Setor">
          <Select value={setorId} onValueChange={setSetorId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {(setores.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="Cargo">
          <Select value={cargoId} onValueChange={setCargoId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {(cargos.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
      </FilterBar>

      {a.quadroLotacao.isLoading ? (
        <DataTable rows={[]} columns={columns} getRowKey={(r) => r.key} loading />
      ) : rows.length === 0 ? (
        <EmptyState title="Sem lotação" description="Nenhum profissional atende aos filtros selecionados." />
      ) : (
        <DataTable rows={rows} columns={columns} getRowKey={(r) => r.key} />
      )}

      <p className="text-xs text-muted-foreground">
        {rows.length.toLocaleString("pt-BR")} combinação(ões) exibida(s).
      </p>
    </div>
  );
}
