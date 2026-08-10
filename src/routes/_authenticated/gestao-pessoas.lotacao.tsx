import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Building2, Users, Layers, AlertCircle, ArrowUp, ArrowDown } from "lucide-react";

import { useAnalytics } from "@/hooks/use-analytics";
import { useUnidadesLookup, useSetoresLookup, useCargosLookup } from "@/hooks/use-lookups";
import { PermissionGate } from "@/components/permission-gate";
import {
  EmptyState,
  KpiCard,
  PageHeader,
  DataTable,
  FilterBar,
  type DataTableColumn,
} from "@/components/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/gestao-pessoas/lotacao")({ errorComponent: ErrorComponent,
  head: () => ({
    meta: [
      { title: "Quadro de Lotação — Gestão da Saúde" },
      { name: "description", content: "Quadro consolidado por Unidade, Setor, Cargo e Função." },
    ],
  }),
  component: () => (
    <PermissionGate
      permission="profissional.visualizar"
      fallback={
        <div className="p-6 text-sm text-muted-foreground">
          Sem permissão para visualizar este painel.
        </div>
      }
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

  const a = useAnalytics({
    unidadeId: unidadeId === "__all__" ? null : unidadeId,
    setorId: setorId === "__all__" ? null : setorId,
    cargoId: cargoId === "__all__" ? null : cargoId,
  }, { staleTime: 300_000 }); // Retornando para cache normal após validação
  
  const alertas = a.alertas.data;

  const rowsAll: QuadroLotacaoRow[] = useMemo(() => {
    const raw = (a.frequencias ?? []) as any[];
    
    return raw.map((r) => {
      const unidadeNome = r.competencia_unidade?.unidades?.sigla 
        ? `${r.competencia_unidade.unidades.sigla} — ${r.competencia_unidade.unidades.nome}` 
        : (r.competencia_unidade?.unidades?.nome ?? "Sem Unidade");
      
      // REVERSÃO DE ESCOPO: Usar .total_profissionais estático como era antes
      // para manter o comportamento de "Quadro de Lotação" intocado.
      // O bug de KPI zerado em rascunho é aceito aqui conforme instrução.
      return {
        key: `${r.competencia_unidade?.unidade_id}-${r.id}`,
        unidadeId: r.competencia_unidade?.unidade_id,
        setorId: null, // No schema atual de frequências, não há setor_id direto no pai
        cargoId: null,
        funcaoId: null,
        unidade: unidadeNome,
        setor: "Consolidado Unidade",
        cargo: "—",
        funcao: "—",
        total: Number(r.total_profissionais || 0),
        ativos: 0, // FrequenciaRow não tem ativos/afastados etc no snapshot estático do pai
        afastados: 0,
        ferias: 0,
        licencas: 0,
      };
    });
  }, [a.frequencias]);

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

  const totalProfLotados = a.totalProfessionals.data ?? 0;
  const unidadesComLotacao = a.totalUnidades.data ?? 0;
  const setoresComLotacao = a.totalSetores.data ?? 0;

  const toggleSort = (k: SortKey) => {
    if (sortBy === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(k);
      setSortDir("asc");
    }
  };
  const sortIcon = (k: SortKey) =>
    sortBy !== k ? null : sortDir === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  const sortableHeader = (k: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
    >
      {label}
      {sortIcon(k)}
    </button>
  );

  const columns: DataTableColumn<QuadroLotacaoRow>[] = [
    {
      key: "unidade",
      header: sortableHeader("unidade", "Unidade"),
      cell: (r) => <span className="font-medium">{r.unidade}</span>,
    },
    { key: "setor", header: sortableHeader("setor", "Setor"), cell: (r) => r.setor },
    { key: "cargo", header: sortableHeader("cargo", "Cargo"), cell: (r) => r.cargo },
    { key: "funcao", header: sortableHeader("funcao", "Função"), cell: (r) => r.funcao },
    {
      key: "total",
      header: sortableHeader("total", "Qtd atual"),
      cell: (r) => <span className="block text-right tabular-nums font-medium">{r.total}</span>,
      className: "text-right",
    },
    {
      key: "status",
      header: "Status Detalhado",
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          <span title="Ativos" className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
            {r.ativos} Ativ
          </span>
          {r.afastados > 0 && (
            <span title="Afastados" className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
              {r.afastados} Afast
            </span>
          )}
          {r.ferias > 0 && (
            <span title="Férias" className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
              {r.ferias} Fér
            </span>
          )}
          {r.licencas > 0 && (
            <span title="Licenças" className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">
              {r.licencas} Lic
            </span>
          )}
        </div>
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
        <KpiCard
          label="Profissionais com lotação"
          value={totalProfLotados.toLocaleString("pt-BR")}
          loading={a.loading}
          icon={<Users className="h-4 w-4" />}
        />
        <KpiCard
          label="Unidades com lotação"
          value={unidadesComLotacao.toLocaleString("pt-BR")}
          loading={a.loading}
          icon={<Building2 className="h-4 w-4" />}
        />
        <KpiCard
          label="Setores com lotação"
          value={setoresComLotacao.toLocaleString("pt-BR")}
          loading={a.loading}
          icon={<Layers className="h-4 w-4" />}
        />
        <KpiCard
          label="Unidades sem gestor"
          value={(alertas?.unidadesSemGestor ?? 0).toLocaleString("pt-BR")}
          loading={a.alertas.isLoading}
          icon={<AlertCircle className="h-4 w-4" />}
        />
        <KpiCard
          label="Setores sem responsável"
          value={(alertas?.setoresSemResponsavel ?? 0).toLocaleString("pt-BR")}
          loading={a.alertas.isLoading}
          icon={<AlertCircle className="h-4 w-4" />}
        />
      </section>

      <FilterBar>
        <FilterBar.Field label="Unidade">
          <Select
            value={unidadeId}
            onValueChange={(v) => {
              setUnidadeId(v);
              setSetorId("__all__");
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas</SelectItem>
              {(unidades.data ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.sigla ? `${u.sigla} — ${u.nome}` : u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="Setor">
          <Select value={setorId} onValueChange={setSetorId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {(setores.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="Cargo">
          <Select value={cargoId} onValueChange={setCargoId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {(cargos.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
      </FilterBar>

      {a.loading ? (
        <DataTable rows={[]} columns={columns} getRowKey={(r) => r.key} loading />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Sem lotação"
          description="Nenhum profissional atende aos filtros selecionados."
        />
      ) : (
        <DataTable rows={rows} columns={columns} getRowKey={(r) => r.key} />
      )}

      <p className="text-xs text-muted-foreground">
        {rows.length.toLocaleString("pt-BR")} combinação(ões) exibida(s).
      </p>
    </div>
  );
}
