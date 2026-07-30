import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { listProfissionais, type ProfViewFilters } from "@/lib/relatorios-gerenciais";
import {
  useUnidadesLookup,
  useSetoresLookup,
  useCargosLookup,
  useFuncoesLookup,
  useVinculosLookup,
} from "@/hooks/use-lookups";
import { IntelligencePanel } from "@/components/relatorios-gerenciais/intelligence-panel";

export const Route = createFileRoute("/_authenticated/relatorios-gerenciais/profissionais")({
  component: RelatoriosProfissionaisGerencial,
});

const PRESETS: { value: NonNullable<ProfViewFilters["preset"]>; label: string; group: string }[] = [
  { value: "todos", label: "Cadastro Geral", group: "Geral" },
  { value: "ativos", label: "Ativos", group: "Status" },
  { value: "afastados", label: "Afastados", group: "Status" },
  { value: "ferias", label: "Em Férias", group: "Status" },
  { value: "licenciados", label: "Licenciados", group: "Status" },
  { value: "inativos", label: "Inativos", group: "Status" },
  { value: "sem_unidade", label: "Sem Lotação (unidade)", group: "Pendências" },
  { value: "sem_setor", label: "Sem Setor", group: "Pendências" },
  { value: "sem_cargo", label: "Sem Cargo", group: "Pendências" },
  { value: "sem_funcao", label: "Sem Função", group: "Pendências" },
  { value: "sem_matricula", label: "Sem Matrícula", group: "Pendências" },
  { value: "sem_cpf", label: "Sem CPF", group: "Dados Incompletos" },
  { value: "sem_telefone", label: "Sem Telefone", group: "Dados Incompletos" },
  { value: "sem_email", label: "Sem E-mail", group: "Dados Incompletos" },
  { value: "sem_nascimento", label: "Sem Data Nasc.", group: "Dados Incompletos" },
  { value: "sem_carga_horaria", label: "Sem Carga Horária", group: "Dados Incompletos" },
];

function RelatoriosProfissionaisGerencial() {
  const [preset, setPreset] = useState<NonNullable<ProfViewFilters["preset"]>>("todos");
  const [q, setQ] = useState("");
  const [unidadeId, setUnidadeId] = useState<string>("");
  const [setorId, setSetorId] = useState<string>("");
  const [cargoId, setCargoId] = useState<string>("");
  const [funcaoId, setFuncaoId] = useState<string>("");
  const [vinculoId, setVinculoId] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const filters: ProfViewFilters = useMemo(
    () => ({
      preset,
      q: q || null,
      unidadeId: unidadeId || null,
      setorId: setorId || null,
      cargoId: cargoId || null,
      funcaoId: funcaoId || null,
      vinculoId: vinculoId || null,
    }),
    [preset, q, unidadeId, setorId, cargoId, funcaoId, vinculoId],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["rel-ger-profs", filters, page],
    queryFn: () => listProfissionais(filters, page, pageSize),
    staleTime: 60_000,
  });

  const unidades = useUnidadesLookup();
  const setores = useSetoresLookup({ unidadeId: unidadeId || null });
  const cargos = useCargosLookup();
  const funcoes = useFuncoesLookup();
  const vinculos = useVinculosLookup();

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;

  function exportCsv() {
    downloadCsv(`profissionais-${preset}.csv`, rows, [
      { header: "Nome", value: (r) => r.nome_completo },
      { header: "CPF", value: (r) => r.cpf ?? "" },
      { header: "Matrícula", value: (r) => r.matricula ?? "" },
      { header: "Unidade", value: (r) => r.unidade_nome ?? "" },
      { header: "Setor", value: (r) => r.setor_nome ?? "" },
      { header: "Cargo", value: (r) => r.cargo_nome ?? "" },
      { header: "Função", value: (r) => r.funcao_nome ?? "" },
      { header: "Vínculo", value: (r) => r.vinculo_nome ?? "" },
      { header: "Status", value: (r) => r.status ?? "" },
      { header: "Telefone", value: (r) => r.telefone ?? "" },
      { header: "E-mail", value: (r) => r.email ?? "" },
    ]);
  }

  const groups = Array.from(new Set(PRESETS.map((p) => p.group)));

  return (
    <div className="space-y-4">
      <IntelligencePanel foco="profissionais" titulo="Profissionais" />
      <Tabs
        value={preset}
        onValueChange={(v) => {
          setPreset(v as typeof preset);
          setPage(1);
        }}
      >
        <TabsList className="flex h-auto flex-wrap gap-1">
          {PRESETS.map((p) => (
            <TabsTrigger key={p.value} value={p.value} className="text-xs">
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {groups.length > 1 && (
          <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Grupos: {groups.join(" · ")}
          </div>
        )}

        <TabsContent value={preset} className="mt-4 space-y-4">
          <FilterBar
            actions={
              <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
                <Download className="mr-1 h-4 w-4" /> CSV
              </Button>
            }
          >
            <FilterBar.Field label="Buscar (nome, CPF, matrícula)">
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Digite..."
              />
            </FilterBar.Field>
            <FilterBar.Field label="Unidade">
              <Select
                value={unidadeId || "__all__"}
                onValueChange={(v) => {
                  setUnidadeId(v === "__all__" ? "" : v);
                  setSetorId("");
                  setPage(1);
                }}
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
            <FilterBar.Field label="Setor">
              <Select
                value={setorId || "__all__"}
                onValueChange={(v) => {
                  setSetorId(v === "__all__" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os setores</SelectItem>
                  {(setores.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterBar.Field>
            <FilterBar.Field label="Cargo">
              <Select
                value={cargoId || "__all__"}
                onValueChange={(v) => {
                  setCargoId(v === "__all__" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os cargos</SelectItem>
                  {(cargos.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterBar.Field>
            <FilterBar.Field label="Função">
              <Select
                value={funcaoId || "__all__"}
                onValueChange={(v) => {
                  setFuncaoId(v === "__all__" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas as funções</SelectItem>
                  {(funcoes.data ?? []).map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterBar.Field>
            <FilterBar.Field label="Vínculo">
              <Select
                value={vinculoId || "__all__"}
                onValueChange={(v) => {
                  setVinculoId(v === "__all__" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os vínculos</SelectItem>
                  {(vinculos.data ?? []).map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterBar.Field>
          </FilterBar>

          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard label="Registros encontrados" value={total} />
            <KpiCard
              label="Página"
              value={`${page} de ${Math.max(1, Math.ceil(total / pageSize))}`}
            />
            <KpiCard
              label="Filtro atual"
              value={PRESETS.find((p) => p.value === preset)?.label ?? "—"}
            />
          </div>

          <div className="overflow-auto rounded-md border bg-card">
            <table className="w-full table-auto text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="p-2">Nome</th>
                  <th className="p-2">CPF</th>
                  <th className="p-2">Matrícula</th>
                  <th className="p-2">Unidade</th>
                  <th className="p-2">Setor</th>
                  <th className="p-2">Cargo</th>
                  <th className="p-2">Função</th>
                  <th className="p-2">Vínculo</th>
                  <th className="p-2">Status</th>
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
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState
                        title="Nenhum profissional encontrado"
                        description="Ajuste os filtros ou selecione outra visão."
                      />
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2 font-medium">{r.nome_completo}</td>
                    <td className="p-2 font-mono text-xs">{r.cpf ?? "—"}</td>
                    <td className="p-2 font-mono text-xs">{r.matricula ?? "—"}</td>
                    <td className="p-2">{r.unidade_nome ?? "—"}</td>
                    <td className="p-2">{r.setor_nome ?? "—"}</td>
                    <td className="p-2">{r.cargo_nome ?? "—"}</td>
                    <td className="p-2">{r.funcao_nome ?? "—"}</td>
                    <td className="p-2">{r.vinculo_nome ?? "—"}</td>
                    <td className="p-2 text-xs">{r.status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Mostrando {rows.length} de {total}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page * pageSize >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
