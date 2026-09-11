import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Building2, Users, Layers, AlertCircle, ArrowUp, ArrowDown } from "lucide-react";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { derivarSituacao, grupoSituacao } from "@/lib/situacao-funcional";
import { ehAfastado, ehAtivo } from "@/lib/kpis-forca-trabalho";
import { useAnalytics } from "@/hooks/use-analytics";
import { useUnidadesLookup, useSetoresLookup, useCargosLookup } from "@/hooks/use-lookups";
import { useCurrentUser } from "@/hooks/use-permissions";
import { PermissionGate } from "@/components/permission-gate";
import { BotaoRelatorioAbnt } from "@/components/relatorios-gerenciais/botao-relatorio-abnt";
import { relatorioPainelAbnt } from "@/lib/painel-abnt";

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
  const { data: userCtx } = useCurrentUser();
  const isMaster = !!userCtx?.is_master;
  const [unidadeId, setUnidadeId] = useState<string>("__all__");
  const [setorId, setSetorId] = useState<string>("__all__");
  const [cargoId, setCargoId] = useState<string>("__all__");
  const [sortBy, setSortBy] = useState<SortKey>("unidade");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const unidades = useUnidadesLookup();
  const setores = useSetoresLookup({ 
    unidadeId: unidadeId === "__all__" ? null : unidadeId,
    isMaster: isMaster && unidadeId === "__all__"
  });
  const cargos = useCargosLookup();

  const a = useAnalytics({
    unidadeId: unidadeId === "__all__" ? null : unidadeId,
    setorId: setorId === "__all__" ? null : setorId,
    cargoId: cargoId === "__all__" ? null : cargoId,
  }, { staleTime: 300_000 }); // Retornando para cache normal após validação
  
  const alertas = a.alertas.data;

  // Contagens reais de situação por unidade, seguindo a regra institucional
  // única (Ativos = exercício + férias + licença prêmio).
  const situacaoPorUnidadeQ = useQuery({
    queryKey: ["lotacao-situacao-por-unidade"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("unidade_id, status, situacao_funcional")
        .is("deleted_at", null)
        .limit(10000);
      if (error) throw error;
      const mapa = new Map<
        string,
        { ativos: number; afastados: number; ferias: number; licencas: number }
      >();
      for (const p of data ?? []) {
        const uid = p.unidade_id ?? "__sem__";
        const atual =
          mapa.get(uid) ?? { ativos: 0, afastados: 0, ferias: 0, licencas: 0 };
        const sit = derivarSituacao({
          id: "",
          status: p.status,
          situacao_funcional: p.situacao_funcional,
        });
        if (ehAtivo(sit)) atual.ativos += 1;
        if (ehAfastado(sit)) atual.afastados += 1;
        const g = grupoSituacao(sit);
        if (g === "ferias") atual.ferias += 1;
        else if (g === "licenca") atual.licencas += 1;
        mapa.set(uid, atual);
      }
      return mapa;
    },
  });

  const rowsAll: QuadroLotacaoRow[] = useMemo(() => {
    const raw = (a.frequencias ?? []) as any[];
    const situacao = situacaoPorUnidadeQ.data;

    return raw.map((r) => {
      const unidadeNome = r.competencia_unidade?.unidades?.sigla 
        ? `${r.competencia_unidade.unidades.sigla} — ${r.competencia_unidade.unidades.nome}` 
        : (r.competencia_unidade?.unidades?.nome ?? "Sem Unidade");
      const unidadeId = r.competencia_unidade?.unidade_id ?? null;
      const sit = (unidadeId ? situacao?.get(unidadeId) : undefined) ?? {
        ativos: 0,
        afastados: 0,
        ferias: 0,
        licencas: 0,
      };

      return {
        key: `${r.competencia_unidade?.unidade_id}-${r.id}`,
        unidadeId,
        setorId: null, // No schema atual de frequências, não há setor_id direto no pai
        cargoId: null,
        funcaoId: null,
        unidade: unidadeNome,
        setor: "Consolidado Unidade",
        cargo: "—",
        funcao: "—",
        total: Number(r.total_profissionais || 0),
        ativos: sit.ativos,
        afastados: sit.afastados,
        ferias: sit.ferias,
        licencas: sit.licencas,
      };
    });
  }, [a.frequencias, situacaoPorUnidadeQ.data]);

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
        actions={
          <BotaoRelatorioAbnt
            label="Imprimir PDF (ABNT)"
            variant="outline"
            disabled={a.loading}
            relatorio={() =>
              relatorioPainelAbnt({
                arquivo: "quadro-lotacao",
                titulo: "Quadro de Lotação",
                subtitulo: "Distribuição consolidada por Unidade, Setor, Cargo e Função",
                orientacao: "landscape",
                filtros: [
                  {
                    label: "Unidade",
                    valor:
                      unidadeId === "__all__"
                        ? "Todas"
                        : (unidades.data ?? []).find((u) => u.id === unidadeId)?.nome ?? "—",
                  },
                  {
                    label: "Setor",
                    valor:
                      setorId === "__all__"
                        ? "Todos"
                        : (setores.data ?? []).find((s) => s.id === setorId)?.nome ?? "—",
                  },
                  {
                    label: "Cargo",
                    valor:
                      cargoId === "__all__"
                        ? "Todos"
                        : (cargos.data ?? []).find((c) => c.id === cargoId)?.nome ?? "—",
                  },
                ],
                kpis: [
                  {
                    label: "Profissionais com lotação",
                    valor: totalProfLotados.toLocaleString("pt-BR"),
                  },
                  {
                    label: "Unidades com lotação",
                    valor: unidadesComLotacao.toLocaleString("pt-BR"),
                  },
                  {
                    label: "Setores com lotação",
                    valor: setoresComLotacao.toLocaleString("pt-BR"),
                  },
                  {
                    label: "Unidades sem gestor",
                    valor: (alertas?.unidadesSemGestor ?? 0).toLocaleString("pt-BR"),
                  },
                ],
                registros: rows.length,
                blocos: [
                  {
                    titulo: "Quadro de lotação",
                    head: [
                      "Unidade",
                      "Setor",
                      "Cargo",
                      "Função",
                      "Qtd atual",
                      "Ativos",
                      "Afastados",
                      "Férias",
                      "Licenças",
                    ],
                    body: rows.map((r) => [
                      r.unidade,
                      r.setor,
                      r.cargo,
                      r.funcao,
                      r.total,
                      r.ativos,
                      r.afastados,
                      r.ferias,
                      r.licencas,
                    ]),
                    keepTogether: false,
                  },
                ],
                notas: [
                  "Ativos = em exercício + férias + licença prêmio, conforme a regra institucional única.",
                  "Setor é agrupamento complementar: a lotação é regular com a unidade definida.",
                ],
              })
            }
          />
        }
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
