/**
 * Gerador Corporativo de Relatórios Gerenciais.
 * Wizard: Conteúdo → Campos → Filtros → Ordenação → Prévia → Exportar.
 * NÃO altera regras de negócio, banco, APIs, permissões ou cálculos.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Sparkles, Check, ChevronLeft, ChevronRight, Loader2, Download,
  ArrowUpAZ, ArrowDownAZ, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { PermissionGate } from "@/components/permission-gate";
import { toast } from "sonner";

import { useGerencial } from "@/hooks/use-gerencial";
import { useProfissionaisLista } from "@/hooks/use-profissionais-lista";
import { CATALOG, PRESETS, defaultFields, findBlock } from "@/lib/relatorio-inteligente/catalog";
import type { BlockConfig, Row, SortSpec } from "@/lib/relatorio-inteligente/tipos";
import { applySort, projectFields, fmtCell } from "@/lib/relatorio-inteligente/render";
import { statsFor, numericFields } from "@/lib/relatorio-inteligente/agregacoes";
import {
  exportarPdfMulti, exportarExcelMulti, exportarCsvMulti,
  type BlocoExport,
} from "@/lib/relatorio-inteligente/export-multi";

export const Route = createFileRoute("/_authenticated/relatorio-inteligente")({
  component: RelatorioInteligentePage,
});

type Formato = "pdf" | "excel" | "csv";
type TipoRelatorio = keyof typeof PRESETS;

/* ============================================================= */

function RelatorioInteligentePage() {
  return (
    <PermissionGate permission="relatorio.visualizar">
      <div className="space-y-4 p-4">
        <PageHeader
          title="⭐ Gerador Corporativo de Relatórios Gerenciais"
          description="Monte o relatório exato que o gestor precisa — escolha blocos, campos, filtros e ordenação. Dados 100% reais, sem alterar folha, competência ou banco."
        />
        <Wizard />
      </div>
    </PermissionGate>
  );
}

/* ============================================================= */

function Wizard() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [tipo, setTipo] = useState<TipoRelatorio>("executivo");
  const [blocks, setBlocks] = useState<BlockConfig[]>(() =>
    PRESETS.executivo.map(defaultBlockCfg).filter(Boolean) as BlockConfig[],
  );
  const [textFilter, setTextFilter] = useState("");
  const [formato, setFormato] = useState<Formato>("pdf");
  const [gerando, setGerando] = useState(false);

  function escolherTipo(t: TipoRelatorio) {
    setTipo(t);
    setBlocks(PRESETS[t].map(defaultBlockCfg).filter(Boolean) as BlockConfig[]);
  }
  function toggleBloco(id: string) {
    setBlocks((prev) =>
      prev.some((b) => b.blockId === id)
        ? prev.filter((b) => b.blockId !== id)
        : [...prev, defaultBlockCfg(id) ?? { blockId: id, fields: [], sort: null }],
    );
  }
  function updateBlock(id: string, patch: Partial<BlockConfig>) {
    setBlocks((prev) => prev.map((b) => (b.blockId === id ? { ...b, ...patch } : b)));
  }

  return (
    <div className="space-y-4">
      <Stepper step={step} />
      <div className="rounded-lg border bg-card p-4">
        {step === 1 && <StepConteudo tipo={tipo} setTipo={escolherTipo} blocks={blocks} toggle={toggleBloco} />}
        {step === 2 && <StepCampos blocks={blocks} update={updateBlock} />}
        {step === 3 && <StepFiltros textFilter={textFilter} setTextFilter={setTextFilter} />}
        {step === 4 && <StepOrdenacao blocks={blocks} update={updateBlock} />}
        {step === 5 && <StepPrevia blocks={blocks} textFilter={textFilter} />}
        {step === 6 && (
          <StepExportar
            tipo={tipo} blocks={blocks} textFilter={textFilter}
            formato={formato} setFormato={setFormato}
            gerando={gerando} setGerando={setGerando}
          />
        )}
      </div>
      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 1}
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4 | 5) : s))}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
        {step < 6 ? (
          <Button disabled={step === 1 && blocks.length === 0}
            onClick={() => setStep((s) => (s + 1) as 2 | 3 | 4 | 5 | 6)}>
            Avançar <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function defaultBlockCfg(id: string): BlockConfig | null {
  const b = findBlock(id);
  if (!b) return null;
  return { blockId: id, fields: defaultFields(b), sort: null };
}

function Stepper({ step }: { step: number }) {
  const rotulos = ["Conteúdo", "Campos", "Filtros", "Ordenação", "Prévia", "Exportar"];
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {rotulos.map((r, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <li key={r} className={
            "flex items-center gap-2 rounded-full border px-3 py-1 " +
            (active ? "border-primary bg-primary/10 font-semibold text-primary"
              : done ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "text-muted-foreground")
          }>
            {done ? <Check className="h-3 w-3" /> : <span className="tabular-nums">{n}</span>}
            {r}
          </li>
        );
      })}
    </ol>
  );
}

/* ============ Etapa 1 · Conteúdo ============ */

function StepConteudo({
  tipo, setTipo, blocks, toggle,
}: {
  tipo: TipoRelatorio; setTipo: (t: TipoRelatorio) => void;
  blocks: BlockConfig[]; toggle: (id: string) => void;
}) {
  const selecionados = new Set(blocks.map((b) => b.blockId));
  const grupos = useMemo(() => {
    const m = new Map<string, typeof CATALOG>();
    for (const b of CATALOG) {
      const arr = m.get(b.categoria) ?? [];
      arr.push(b);
      m.set(b.categoria, arr);
    }
    return Array.from(m.entries());
  }, []);

  const tipos: { value: TipoRelatorio; label: string }[] = [
    { value: "executivo", label: "Executivo" },
    { value: "tecnico", label: "Técnico" },
    { value: "administrativo", label: "Administrativo" },
    { value: "rh", label: "RH" },
    { value: "auditoria", label: "Auditoria" },
    { value: "personalizado", label: "Personalizado" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
          Etapa 1 · Conteúdo · <span className="rounded bg-muted px-2 py-0.5 text-[10px]">{blocks.length} bloco(s) selecionado(s)</span>
        </h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {tipos.map((t) => (
            <button key={t.value}
              onClick={() => setTipo(t.value)}
              className={"rounded-full border px-3 py-1 text-xs " +
                (tipo === t.value ? "border-primary bg-primary/10 font-semibold text-primary" : "hover:bg-muted")}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {grupos.map(([grupo, itens]) => (
        <div key={grupo}>
          <div className="mb-1 text-xs font-semibold text-muted-foreground">{grupo}</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {itens.map((b) => (
              <label key={b.id} className={
                "flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm hover:bg-muted/50 " +
                (selecionados.has(b.id) ? "border-primary bg-primary/5" : "")
              }>
                <Checkbox checked={selecionados.has(b.id)} onCheckedChange={() => toggle(b.id)} />
                <div>
                  <div className="font-medium">{b.label}</div>
                  {b.descricao && <div className="text-[10px] text-muted-foreground">{b.descricao}</div>}
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============ Etapa 2 · Campos ============ */

function StepCampos({
  blocks, update,
}: { blocks: BlockConfig[]; update: (id: string, patch: Partial<BlockConfig>) => void }) {
  if (!blocks.length) return <EmptyState title="Nenhum bloco selecionado" description="Volte à Etapa 1 e escolha ao menos um bloco." />;
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase text-muted-foreground">Etapa 2 · Campos exibidos por bloco</h2>
      {blocks.map((cfg) => {
        const b = findBlock(cfg.blockId);
        if (!b) return null;
        const selecionados = new Set(cfg.fields);
        return (
          <div key={cfg.blockId} className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">{b.label}</div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => update(cfg.blockId, { fields: b.fields.map((f) => f.id) })}>Todos</Button>
                <Button size="sm" variant="ghost" onClick={() => update(cfg.blockId, { fields: defaultFields(b) })}>Padrão</Button>
                <Button size="sm" variant="ghost" onClick={() => update(cfg.blockId, { fields: [] })}>Nenhum</Button>
              </div>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
              {b.fields.map((f) => (
                <label key={f.id} className="flex cursor-pointer items-center gap-2 rounded border px-2 py-1 text-xs hover:bg-muted/50">
                  <Checkbox
                    checked={selecionados.has(f.id)}
                    onCheckedChange={(c) => {
                      const next = new Set(selecionados);
                      if (c) next.add(f.id); else next.delete(f.id);
                      update(cfg.blockId, { fields: b.fields.map((x) => x.id).filter((id) => next.has(id)) });
                    }}
                  />
                  {f.label}
                  {f.tipo === "number" && <span className="ml-auto text-[9px] text-muted-foreground">num</span>}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============ Etapa 3 · Filtros ============ */

function StepFiltros({
  textFilter, setTextFilter,
}: { textFilter: string; setTextFilter: (v: string) => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase text-muted-foreground">Etapa 3 · Filtros</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Busca textual (todos os blocos)</Label>
          <Input placeholder="Filtra linhas cujo texto contenha…"
            value={textFilter} onChange={(e) => setTextFilter(e.target.value)} />
          <p className="text-[10px] text-muted-foreground">
            Filtros por unidade, cargo, período e demais campos continuam sendo aplicados
            pelas permissões e RLS já existentes na fonte de dados (`useGerencial`).
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============ Etapa 4 · Ordenação ============ */

function StepOrdenacao({
  blocks, update,
}: { blocks: BlockConfig[]; update: (id: string, patch: Partial<BlockConfig>) => void }) {
  if (!blocks.length) return <EmptyState title="Nenhum bloco selecionado" description="Volte à Etapa 1." />;
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase text-muted-foreground">Etapa 4 · Ordenação</h2>
      {blocks.map((cfg) => {
        const b = findBlock(cfg.blockId);
        if (!b) return null;
        const s: SortSpec = cfg.sort;
        return (
          <div key={cfg.blockId} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
            <span className="min-w-[220px] font-medium">{b.label}</span>
            <Select
              value={s?.fieldId ?? "__none__"}
              onValueChange={(v) =>
                update(cfg.blockId, {
                  sort: v === "__none__" ? null : { fieldId: v, dir: s?.dir ?? "desc" },
                })
              }
            >
              <SelectTrigger className="w-56"><SelectValue placeholder="Sem ordenação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem ordenação</SelectItem>
                {cfg.fields.map((id) => {
                  const f = b.fields.find((x) => x.id === id);
                  return f ? <SelectItem key={id} value={id}>{f.label}</SelectItem> : null;
                })}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" disabled={!s}
              onClick={() => s && update(cfg.blockId, { sort: { ...s, dir: s.dir === "asc" ? "desc" : "asc" } })}>
              {s?.dir === "asc" ? <><ArrowUpAZ className="mr-1 h-3.5 w-3.5" /> Crescente</> : <><ArrowDownAZ className="mr-1 h-3.5 w-3.5" /> Decrescente</>}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

/* ============ Etapa 5 · Prévia ============ */

function useBuiltBlocks(blocks: BlockConfig[], textFilter: string) {
  const ger = useGerencial();
  const prof = useProfissionaisLista();
  const built = useMemo(() => {
    if (!ger.data) return [];
    return blocks
      .map((cfg) => {
        const b = findBlock(cfg.blockId);
        if (!b) return null;
        let rows: Row[] = b.build({ aggregate: ger.data, profissionais: prof.data });
        if (textFilter.trim()) {
          const q = textFilter.toLowerCase();
          rows = rows.filter((r) =>
            Object.values(r).some((v) => v != null && String(v).toLowerCase().includes(q)),
          );
        }
        rows = applySort(rows, cfg.sort);
        const projected = projectFields(rows, cfg.fields);
        return { cfg, block: b, rows: projected, rawRows: rows };
      })
      .filter(Boolean) as Array<{ cfg: BlockConfig; block: NonNullable<ReturnType<typeof findBlock>>; rows: Row[]; rawRows: Row[] }>;
  }, [ger.data, prof.data, blocks, textFilter]);
  return { built, loading: ger.isLoading || prof.isLoading, error: ger.error };
}

function StepPrevia({ blocks, textFilter }: { blocks: BlockConfig[]; textFilter: string }) {
  const { built, loading, error } = useBuiltBlocks(blocks, textFilter);

  if (loading) return <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando dados…</div>;
  if (error) return <EmptyState title="Falha ao carregar" description={String((error as Error)?.message ?? "")} />;
  if (!built.length) return <EmptyState title="Nada para exibir" description="Selecione blocos na Etapa 1." />;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase text-muted-foreground">Etapa 5 · Prévia</h2>
      {built.map(({ cfg, block, rows, rawRows }) => (
        <div key={cfg.blockId} className="rounded-md border">
          <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
            <div className="text-sm font-semibold">{block.label}</div>
            <div className="text-[11px] text-muted-foreground">
              {rows.length.toLocaleString("pt-BR")} linha(s)
              {cfg.sort && ` · ordenado por ${block.fields.find((f) => f.id === cfg.sort!.fieldId)?.label} ${cfg.sort.dir}`}
            </div>
          </div>
          <BlockTable block={block} cfg={cfg} rows={rows.slice(0, 100)} />
          {rows.length > 100 && (
            <div className="border-t bg-muted/20 px-3 py-1 text-[11px] text-muted-foreground">
              Prévia limitada a 100 linhas · a exportação inclui todas as {rows.length.toLocaleString("pt-BR")}.
            </div>
          )}
          <StatsBar rows={rawRows} fields={cfg.fields} block={block} />
        </div>
      ))}
    </div>
  );
}

function BlockTable({
  block, cfg, rows,
}: { block: NonNullable<ReturnType<typeof findBlock>>; cfg: BlockConfig; rows: Row[] }) {
  if (!cfg.fields.length) return <div className="p-3 text-xs text-muted-foreground">Nenhum campo selecionado para este bloco.</div>;
  if (!rows.length) return <div className="p-3 text-xs text-muted-foreground">Sem dados.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/40">
            {cfg.fields.map((id) => {
              const f = block.fields.find((x) => x.id === id);
              return (
                <th key={id} className={"px-2 py-1.5 text-left font-semibold " + (f?.tipo === "number" ? "text-right" : "")}>
                  {f?.label ?? id}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {cfg.fields.map((id) => {
                const f = block.fields.find((x) => x.id === id);
                return (
                  <td key={id} className={"px-2 py-1 " + (f?.tipo === "number" ? "text-right tabular-nums" : "")}>
                    {fmtCell(r[id])}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatsBar({
  rows, fields, block,
}: { rows: Row[]; fields: string[]; block: NonNullable<ReturnType<typeof findBlock>> }) {
  const nums = numericFields(rows).filter((f) => fields.includes(f));
  if (!nums.length || !rows.length) return null;
  return (
    <div className="grid gap-2 border-t bg-muted/10 p-2 text-[11px] sm:grid-cols-2 lg:grid-cols-3">
      {nums.map((f) => {
        const s = statsFor(rows, f);
        const rot = block.fields.find((x) => x.id === f)?.label ?? f;
        return (
          <div key={f} className="rounded border bg-card px-2 py-1.5">
            <div className="mb-0.5 font-semibold">{rot}</div>
            <div className="grid grid-cols-3 gap-x-2 text-muted-foreground">
              <span>Soma <b className="text-foreground">{s.soma.toLocaleString("pt-BR")}</b></span>
              <span>Média <b className="text-foreground">{s.media.toLocaleString("pt-BR")}</b></span>
              <span>Mediana <b className="text-foreground">{s.mediana.toLocaleString("pt-BR")}</b></span>
              <span>Mín <b className="text-foreground">{s.minimo.toLocaleString("pt-BR")}</b></span>
              <span>Máx <b className="text-foreground">{s.maximo.toLocaleString("pt-BR")}</b></span>
              <span>Desvio <b className="text-foreground">{s.desvio.toLocaleString("pt-BR")}</b></span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============ Etapa 6 · Exportar ============ */

function StepExportar({
  tipo, blocks, textFilter, formato, setFormato, gerando, setGerando,
}: {
  tipo: TipoRelatorio; blocks: BlockConfig[]; textFilter: string;
  formato: Formato; setFormato: (f: Formato) => void;
  gerando: boolean; setGerando: (b: boolean) => void;
}) {
  const { built, loading, error } = useBuiltBlocks(blocks, textFilter);
  const ger = useGerencial();

  const parecer = useMemo(() => (ger.data ? ger.data.resumoExecutivo : []), [ger.data]);
  const alertas = useMemo(() => (ger.data ? ger.data.alertas : []), [ger.data]);

  if (loading) return <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Preparando exportação…</div>;
  if (error) return <EmptyState title="Falha" description={String((error as Error)?.message ?? "")} />;

  async function gerar() {
    if (!built.length) { toast.error("Nenhum bloco para exportar."); return; }
    setGerando(true);
    try {
      const blocosExp: BlocoExport[] = built.map(({ cfg, block, rows }) => ({
        titulo: block.label,
        descricao: block.descricao,
        colunas: cfg.fields.map((id) => {
          const f = block.fields.find((x) => x.id === id);
          return { header: f?.label ?? id, key: id };
        }),
        linhas: rows,
      }));
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `relatorio-${tipo}-${stamp}`;
      if (formato === "pdf") {
        await exportarPdfMulti({
          filename,
          titulo: `Relatório Gerencial — ${labelTipo(tipo)}`,
          subtitulo: `Gerado em ${new Date().toLocaleString("pt-BR")} · ${blocosExp.length} bloco(s)`,
          resumo: parecer,
          blocos: blocosExp,
        });
        toast.success("PDF institucional gerado.");
      } else if (formato === "excel") {
        exportarExcelMulti({ filename, blocos: blocosExp });
        toast.success("Excel multi-aba gerado.");
      } else {
        exportarCsvMulti({ filenamePrefix: filename, blocos: blocosExp });
        toast.success(`${blocosExp.length} arquivo(s) CSV gerado(s).`);
      }
    } catch (e) {
      toast.error("Falha ao gerar: " + String((e as Error)?.message ?? e));
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase text-muted-foreground">Etapa 6 · Exportar</h2>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-md border-l-4 border-primary/70 bg-primary/5 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Parecer Executivo (automático)
          </div>
          <ul className="space-y-1 text-sm">
            {parecer.map((p, i) => (<li key={i}>• {p}</li>))}
          </ul>
        </div>
        <div className="rounded-md border bg-card p-3">
          <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Alertas da Gestão</div>
          {alertas.length === 0 ? (
            <div className="text-sm text-emerald-700"><CheckCircle2 className="mr-1 inline h-4 w-4" /> Nenhum alerta detectado.</div>
          ) : (
            <ul className="space-y-1 text-sm">
              {alertas.slice(0, 8).map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  <AlertTriangle className={"h-3.5 w-3.5 " + (a.gravidade === "vermelho" ? "text-red-600" : "text-amber-600")} />
                  {a.titulo}
                  {a.quantidade != null && <span className="ml-auto rounded bg-muted px-2 text-xs">{a.quantidade}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-md border p-3">
        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Blocos incluídos ({built.length})</div>
        <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {built.map(({ block, rows }, i) => (
            <li key={block.id} className="flex items-center justify-between rounded border bg-muted/20 px-2 py-1 text-xs">
              <span>{i + 1}. {block.label}</span>
              <span className="tabular-nums text-muted-foreground">{rows.length.toLocaleString("pt-BR")} linha(s)</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-md border bg-card p-3">
        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Formato</div>
        <RadioGroup value={formato} onValueChange={(v) => setFormato(v as Formato)} className="grid gap-2 sm:grid-cols-3">
          {[
            { v: "pdf" as const, l: "PDF Institucional (multi-bloco com sumário)" },
            { v: "excel" as const, l: "Excel (uma aba por bloco)" },
            { v: "csv" as const, l: "CSV (um arquivo por bloco)" },
          ].map(({ v, l }) => (
            <label key={v} className={"cursor-pointer rounded-md border p-2 text-sm " + (formato === v ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value={v} id={`f-${v}`} />
                <label htmlFor={`f-${v}`} className="cursor-pointer">{l}</label>
              </div>
            </label>
          ))}
        </RadioGroup>
        <div className="mt-3 flex justify-end">
          <Button onClick={gerar} disabled={gerando || !built.length}>
            {gerando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
            Gerar Relatório
          </Button>
        </div>
      </div>
    </div>
  );
}

function labelTipo(t: TipoRelatorio) {
  return ({ executivo: "Executivo", tecnico: "Técnico", administrativo: "Administrativo", rh: "RH", auditoria: "Auditoria", personalizado: "Personalizado" } as Record<TipoRelatorio, string>)[t];
}
