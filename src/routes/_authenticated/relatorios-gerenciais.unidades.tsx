import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterBar } from "@/components/shared/FilterBar";
import { KpiCard } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { downloadCsv } from "@/lib/csv-export";
import { listUnidadesGerencial, listTiposUnidade, type UnidadePreset } from "@/lib/relatorios-gerenciais";
import { IntelligencePanel } from "@/components/relatorios-gerenciais/intelligence-panel";

export const Route = createFileRoute("/_authenticated/relatorios-gerenciais/unidades")({
  component: UnidadesGerencial,
});

const PRESETS: { value: UnidadePreset; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "ativas", label: "Ativas" },
  { value: "inativas", label: "Inativas" },
  { value: "sem_diretor", label: "Sem Diretor" },
  { value: "sem_telefone", label: "Sem Telefone" },
  { value: "sem_cnes", label: "Sem CNES" },
  { value: "sem_cnpj", label: "Sem CNPJ" },
  { value: "sem_email", label: "Sem E-mail" },
  { value: "sem_tipo", label: "Sem Tipo" },
];

function UnidadesGerencial() {
  const [preset, setPreset] = useState<UnidadePreset>("todas");
  const [tipo, setTipo] = useState<string>("");

  const tipos = useQuery({ queryKey: ["rel-ger", "tipos-unidade"], queryFn: listTiposUnidade, staleTime: 5 * 60_000 });
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["rel-ger", "unidades", preset, tipo],
    queryFn: () => listUnidadesGerencial(preset, tipo || null),
    staleTime: 60_000,
  });

  const totais = useMemo(() => ({
    total: rows.length,
    profissionais: rows.reduce((a, r) => a + r.qtd_profissionais, 0),
    ativos: rows.reduce((a, r) => a + r.qtd_ativos, 0),
  }), [rows]);

  function exportCsv() {
    downloadCsv(`unidades-${preset}.csv`, rows, [
      { header: "Unidade", value: (r) => r.nome },
      { header: "Sigla", value: (r) => r.sigla ?? "" },
      { header: "Tipo", value: (r) => r.tipo_unidade ?? "" },
      { header: "Status", value: (r) => r.status },
      { header: "CNES", value: (r) => r.cnes ?? "" },
      { header: "CNPJ", value: (r) => r.cnpj ?? "" },
      { header: "Telefone", value: (r) => r.telefone ?? "" },
      { header: "E-mail", value: (r) => r.email_institucional ?? "" },
      { header: "Diretor/Responsável", value: (r) => r.responsavel_nome ?? "" },
      { header: "Distrito", value: (r) => r.distrito ?? "" },
      { header: "Município", value: (r) => r.municipio ?? "" },
      { header: "Profissionais", value: (r) => r.qtd_profissionais },
      { header: "Ativos", value: (r) => r.qtd_ativos },
    ]);
  }

  return (
    <div className="space-y-4">
      <Tabs value={preset} onValueChange={(v) => setPreset(v as UnidadePreset)}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          {PRESETS.map((p) => (
            <TabsTrigger key={p.value} value={p.value} className="text-xs">{p.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <FilterBar
        actions={<Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="mr-1 h-4 w-4" /> CSV</Button>}
      >
        <FilterBar.Field label="Tipo de Unidade">
          <Select value={tipo || "__all__"} onValueChange={(v) => setTipo(v === "__all__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os tipos</SelectItem>
              {(tipos.data ?? []).map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
      </FilterBar>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Unidades" value={totais.total} />
        <KpiCard label="Profissionais lotados" value={totais.profissionais} />
        <KpiCard label="Ativos" value={totais.ativos} tone="success" />
      </div>

      <div className="overflow-auto rounded-md border bg-card">
        <table className="w-full table-auto text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-2">Unidade</th>
              <th className="p-2">Tipo</th>
              <th className="p-2">Status</th>
              <th className="p-2">CNES</th>
              <th className="p-2">Telefone</th>
              <th className="p-2">Responsável</th>
              <th className="p-2 text-right">Profissionais</th>
              <th className="p-2 text-right">Ativos</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (<tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>)}
            {!isLoading && rows.length === 0 && (<tr><td colSpan={8}><EmptyState title="Nenhuma unidade encontrada" description="Ajuste os filtros." /></td></tr>)}
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">
                  <div className="font-medium">{r.nome}</div>
                  {r.sigla && <div className="text-xs text-muted-foreground">{r.sigla}</div>}
                </td>
                <td className="p-2">{r.tipo_unidade ?? "—"}</td>
                <td className="p-2 text-xs">{r.status}</td>
                <td className="p-2 font-mono text-xs">{r.cnes ?? "—"}</td>
                <td className="p-2 text-xs">{r.telefone ?? "—"}</td>
                <td className="p-2 text-xs">{r.responsavel_nome ?? "—"}</td>
                <td className="p-2 text-right tabular-nums">{r.qtd_profissionais}</td>
                <td className="p-2 text-right tabular-nums">{r.qtd_ativos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}