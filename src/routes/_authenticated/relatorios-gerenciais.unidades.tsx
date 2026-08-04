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
import {
  listUnidadesGerencial,
  listTiposUnidade,
  type UnidadePreset,
} from "@/lib/relatorios-gerenciais";
import { IntelligencePanel } from "@/components/relatorios-gerenciais/intelligence-panel";
import { BotaoRelatorioAbnt } from "@/components/relatorios-gerenciais/botao-relatorio-abnt";

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

  const tipos = useQuery({
    queryKey: ["rel-ger", "tipos-unidade"],
    queryFn: listTiposUnidade,
    staleTime: 5 * 60_000,
  });
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["rel-ger", "unidades", preset, tipo],
    queryFn: () => listUnidadesGerencial(preset, tipo || null),
    staleTime: 60_000,
  });

  const totais = useMemo(
    () => ({
      total: rows.length,
      profissionais: rows.reduce((a, r) => a + r.qtd_profissionais, 0),
      ativos: rows.reduce((a, r) => a + r.qtd_ativos, 0),
    }),
    [rows],
  );

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

  function relatorioAbnt() {
    const porTipo = new Map<string, number>();
    for (const r of rows) {
      const k = r.tipo_unidade || "Sem tipo";
      porTipo.set(k, (porTipo.get(k) ?? 0) + 1);
    }
    const lacunas = [
      { label: "Sem diretor/responsável", valor: rows.filter((r) => !r.responsavel_nome).length },
      { label: "Sem CNES", valor: rows.filter((r) => !r.cnes).length },
      { label: "Sem CNPJ", valor: rows.filter((r) => !r.cnpj).length },
      { label: "Sem telefone", valor: rows.filter((r) => !r.telefone).length },
      { label: "Sem e-mail", valor: rows.filter((r) => !r.email_institucional).length },
    ];
    return {
      arquivo: `relatorio-unidades-${preset}`,
      titulo: "Relatório Gerencial de Unidades de Saúde",
      subtitulo: `Visão: ${PRESETS.find((p) => p.value === preset)?.label ?? "Todas"}`,
      orientacao: "landscape" as const,
      filtros: [
        { label: "Visão", valor: PRESETS.find((p) => p.value === preset)?.label ?? "—" },
        { label: "Tipo de unidade", valor: tipo || "Todos" },
      ],
      kpis: [
        { label: "Unidades listadas", valor: totais.total },
        { label: "Profissionais lotados", valor: totais.profissionais },
        { label: "Profissionais ativos", valor: totais.ativos },
        { label: "Lacunas cadastrais", valor: lacunas.reduce((a, l) => a + l.valor, 0) },
      ],
      graficos: [
        {
          tipo: "rosca" as const,
          titulo: "2 Composição por tipo de unidade",
          dados: Array.from(porTipo, ([label, valor]) => ({ label, valor })),
          limite: 6,
        },
        {
          tipo: "barras" as const,
          titulo: "2.1 Lotação por unidade (10 maiores)",
          dados: rows.map((r) => ({ label: r.sigla || r.nome, valor: r.qtd_profissionais })),
          limite: 10,
        },
        { tipo: "barras" as const, titulo: "2.2 Lacunas cadastrais", dados: lacunas },
      ],
      colunas: [
        { header: "Unidade", value: (r: (typeof rows)[number]) => r.nome },
        { header: "Sigla", value: (r: (typeof rows)[number]) => r.sigla },
        { header: "Tipo", value: (r: (typeof rows)[number]) => r.tipo_unidade },
        { header: "CNES", value: (r: (typeof rows)[number]) => r.cnes },
        { header: "CNPJ", value: (r: (typeof rows)[number]) => r.cnpj },
        { header: "Diretor(a)", value: (r: (typeof rows)[number]) => r.responsavel_nome },
        { header: "Telefone", value: (r: (typeof rows)[number]) => r.telefone },
        { header: "Status", value: (r: (typeof rows)[number]) => r.status },
        {
          header: "Prof.",
          value: (r: (typeof rows)[number]) => r.qtd_profissionais,
          align: "right" as const,
        },
        {
          header: "Ativos",
          value: (r: (typeof rows)[number]) => r.qtd_ativos,
          align: "right" as const,
        },
      ],
      linhas: rows,
      notas: [
        "Lacunas cadastrais indicam campos obrigatórios ausentes para fins de habilitação e prestação de contas.",
      ],
      assinaturas: ["Coordenação de Atenção à Saúde", "Secretário(a) Municipal de Saúde"],
    };
  }

  return (
    <div className="space-y-4">
      <IntelligencePanel foco="unidades" titulo="Unidades" />
      <Tabs value={preset} onValueChange={(v) => setPreset(v as UnidadePreset)}>
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
        <FilterBar.Field label="Tipo de Unidade">
          <Select
            value={tipo || "__all__"}
            onValueChange={(v) => setTipo(v === "__all__" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os tipos</SelectItem>
              {(tipos.data ?? []).map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
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
            {isLoading && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState title="Nenhuma unidade encontrada" description="Ajuste os filtros." />
                </td>
              </tr>
            )}
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
