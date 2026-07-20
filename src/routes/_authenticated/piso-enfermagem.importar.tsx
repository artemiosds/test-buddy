import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { UploadCloud, Lightbulb, CheckCircle2 } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { PermissionGate } from "@/components/permission-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import {
  autoMap,
  CAMPOS_SISTEMA,
  type PisoDestino,
} from "@/lib/piso-mapping";
import {
  detectarModelo,
  detectarCompetencia,
  headerConfidence,
  computeQuality,
  fingerprint,
  type ConfidenceTone,
} from "@/lib/piso-heuristics";
import {
  resolveRows,
  statsFrom,
  type Mapeamento,
  type RawRow,
  type ResolvedRow,
} from "@/lib/piso-import";
import {
  commitImportPiso,
  matchProfissionaisImport,
  listMapeamentos,
  saveMapeamento,
} from "@/lib/piso-enfermagem.functions";
import { bestFuzzy } from "@/lib/piso-fuzzy";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/piso-enfermagem/importar")({
  component: () => (
    <PermissionGate
      permission="piso.importar"
      fallback={
        <div className="p-6 text-sm text-muted-foreground">
          Sem permissão para importar folhas do Piso Nacional da Enfermagem.
        </div>
      }
    >
      <ImportarPage />
    </PermissionGate>
  ),
});

type Modelo = "Efetivos" | "Contratados" | "Ministério" | "Personalizado";
type Passo = 1 | 2 | 3;

const FP_KEY = "piso:last-fingerprint";

const TONE_CLASSES: Record<ConfidenceTone, string> = {
  high: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  low: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  none: "bg-muted text-muted-foreground border-border",
};

function ImportarPage() {
  const navigate = useNavigate();
  const [passo, setPasso] = useState<Passo>(1);
  const [modelo, setModelo] = useState<Modelo>("Efetivos");
  const [vinculo, setVinculo] = useState<"Efetivos" | "Contratados" | "Ambos">("Ambos");
  const [competencia, setCompetencia] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [mapeamento, setMapeamento] = useState<Mapeamento>({});
  const [resolved, setResolved] = useState<ResolvedRow[]>([]);
  const [preview5, setPreview5] = useState<RawRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const dropRef = useRef<HTMLDivElement | null>(null);

  const tipoArquivo: "PDF" | "Excel" | "CSV" = useMemo(() => {
    if (!file) return "Excel";
    const n = file.name.toLowerCase();
    if (n.endsWith(".pdf")) return "PDF";
    if (n.endsWith(".csv")) return "CSV";
    return "Excel";
  }, [file]);

  async function handleFile(f: File) {
    if (f.size > 50 * 1024 * 1024) {
      toast.error("Arquivo maior que 50MB.");
      return;
    }
    setFile(f);
    const lower = f.name.toLowerCase();
    if (lower.endsWith(".pdf")) {
      toast.warning("PDF ainda não é processado nesta versão. Use Excel/CSV.");
      return;
    }
    // Detecção inteligente pelo nome do arquivo
    const mDet = detectarModelo(f.name);
    if (mDet) setModelo(mDet);
    const cDet = detectarCompetencia(f.name);
    if (cDet) setCompetencia(cDet);

    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    if (json.length === 0) {
      toast.error("Arquivo sem linhas.");
      return;
    }
    const hs = Object.keys(json[0]);
    setHeaders(hs);
    setRawRows(json);
    setPreview5(json.slice(0, 5));
    const map = autoMap(hs);
    setMapeamento(map);

    // Modo rápido: mesmo formato do último arquivo importado?
    try {
      const fp = fingerprint(hs);
      const last = window.localStorage.getItem(FP_KEY);
      if (last && last === fp) {
        const pular = window.confirm(
          "Este arquivo tem o mesmo formato do anterior. Pular mapeamento e ir direto para revisão?",
        );
        if (pular) {
          // Segue para passo 2 mesmo assim para exibir qualidade e permitir revisar rapidamente.
          setPasso(2);
          setTimeout(() => matchMut.mutate(), 0);
          return;
        }
      }
      window.localStorage.setItem(FP_KEY, fp);
    } catch {
      // localStorage indisponível — ignora
    }
    setPasso(2);
  }

  // Drag & drop handlers
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const onOver = (e: DragEvent) => { e.preventDefault(); setDragOver(true); };
    const onLeave = () => setDragOver(false);
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) void handleFile(f);
    };
    el.addEventListener("dragover", onOver);
    el.addEventListener("dragleave", onLeave);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragover", onOver);
      el.removeEventListener("dragleave", onLeave);
      el.removeEventListener("drop", onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo]);

  const matchMut = useMutation({
    mutationFn: async () => {
      const cpfCol = Object.entries(mapeamento).find(([, d]) => d === "cpf")?.[0];
      const matCol = Object.entries(mapeamento).find(([, d]) => d === "matricula")?.[0];
      const nomeCol = Object.entries(mapeamento).find(([, d]) => d === "nome")?.[0];
      const cpfs = cpfCol ? rawRows.map((r) => String(r[cpfCol] ?? "").replace(/\D+/g, "")).filter(Boolean) : [];
      const mats = matCol ? rawRows.map((r) => String(r[matCol] ?? "").trim()).filter(Boolean) : [];
      const nomes = nomeCol ? rawRows.map((r) => String(r[nomeCol] ?? "").trim()).filter(Boolean) : [];
      const maps = await matchProfissionaisImport({ data: { cpfs, matriculas: mats, nomes } });
      const rows = resolveRows(rawRows, mapeamento, { byCpf: maps.byCpf, byMatricula: maps.byMatricula });
      // Fase 2: complementa com fuzzy por nome quando não localizado por CPF/matrícula
      const candidatos = maps.candidatos ?? [];
      const enriched = rows.map((r) => {
        if (r.status_match !== "nao_localizado" || !r.nome) return r;
        const hit = bestFuzzy(r.nome, candidatos, 0.85);
        return hit ? { ...r, profissional_id: hit.id, status_match: "nome" as const } : r;
      });
      setResolved(enriched);
      setPasso(3);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao consultar profissionais"),
  });

  const commitMut = useMutation({
    mutationFn: async () => {
      const res = await commitImportPiso({
        data: {
          modelo,
          nome_arquivo: file?.name ?? "sem-nome",
          tipo_arquivo: tipoArquivo,
          competencia: competencia || null,
          mapeamento: mapeamento as Record<string, string | null>,
          linhas: resolved,
        },
      });
      toast.success(`Importação concluída: ${res.stats.importados}/${res.stats.total}`);
      navigate({ to: "/piso-enfermagem" });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao gravar importação"),
  });

  const stats = useMemo(() => statsFrom(resolved), [resolved]);
  const quality = useMemo(() => computeQuality(rawRows, mapeamento), [rawRows, mapeamento]);

  const savedQ = useQuery({
    queryKey: ["piso", "mapeamentos", modelo],
    queryFn: () => listMapeamentos({ data: { modelo } }),
  });

  const saveMap = useMutation({
    mutationFn: async (nome: string) => {
      await saveMapeamento({
        data: { nome, modelo, mapeamento: mapeamento as Record<string, string | null> },
      });
      toast.success("Modelo salvo.");
      void savedQ.refetch();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao salvar modelo"),
  });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="Importar folha do Piso"
        description="Envie a folha em Excel ou CSV, revise o mapeamento e confirme."
      />

      <ProgressSteps passo={passo} />
      <ContextualTip passo={passo} />

      {passo === 1 && (
        <div className="grid gap-4 rounded-md border p-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Modelo</Label>
            <Select value={modelo} onValueChange={(v) => setModelo(v as Modelo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Efetivos">Efetivos (FOPAG)</SelectItem>
                <SelectItem value="Contratados">Contratados</SelectItem>
                <SelectItem value="Ministério">Ministério da Saúde</SelectItem>
                <SelectItem value="Personalizado">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo de vínculo a importar</Label>
            <Select value={vinculo} onValueChange={(v) => setVinculo(v as typeof vinculo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Efetivos">Efetivos</SelectItem>
                <SelectItem value="Contratados">Contratados</SelectItem>
                <SelectItem value="Ambos">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Competência (opcional)</Label>
            <Input placeholder="ex: Janeiro 2026" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Arquivo (Excel, CSV ou PDF — até 50MB)</Label>
            <div
              ref={dropRef}
              className={
                "flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center transition " +
                (dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/20")
              }
            >
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm">Arraste o arquivo aqui ou clique para selecionar</p>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv,.pdf"
                className="max-w-xs"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Arquivos PDF serão suportados em versão futura.</p>
          </div>
        </div>
      )}

      {passo === 2 && (
        <div className="space-y-3 rounded-md border p-4">
          {preview5.length > 0 && (
            <details className="rounded-md border bg-muted/30 p-2 text-xs">
              <summary className="cursor-pointer font-medium">Pré-visualização (5 primeiras linhas)</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-background text-left">
                    <tr>{headers.map((h) => <th key={h} className="px-2 py-1 font-mono">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview5.map((r, i) => (
                      <tr key={i} className="border-t">
                        {headers.map((h) => <td key={h} className="px-2 py-1">{String(r[h] ?? "—")}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          <QualityCard q={quality} />

          <div className="flex flex-wrap items-end gap-2">
            <p className="mr-auto text-sm text-muted-foreground">
              Sistema sugere o mapeamento pelo nome da coluna. Ajuste conforme necessário.
            </p>
            <div className="min-w-56 space-y-1">
              <Label className="text-xs">Modelos salvos</Label>
              <Select
                onValueChange={(id) => {
                  const item = savedQ.data?.rows.find((r) => r.id === id);
                  if (item) setMapeamento(item.mapeamento as Mapeamento);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Carregar modelo…" /></SelectTrigger>
                <SelectContent>
                  {(savedQ.data?.rows ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                const nome = window.prompt("Nome do modelo:");
                if (nome && nome.trim()) saveMap.mutate(nome.trim());
              }}
            >
              Salvar modelo
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2">Coluna do arquivo</th>
                  <th className="px-3 py-2">Campo no sistema</th>
                  <th className="px-3 py-2">Confiança</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((h) => {
                  const conf = headerConfidence(h);
                  const dest = mapeamento[h];
                  const showConf = dest && conf.destino === dest ? conf : { ...conf, destino: dest, score: dest ? 0.5 : 0, tone: (dest ? "low" : "none") as ConfidenceTone };
                  return (
                    <tr key={h} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">{h}</td>
                      <td className="px-3 py-2">
                        <Select
                          value={(mapeamento[h] ?? "") as string}
                          onValueChange={(v) => setMapeamento({ ...mapeamento, [h]: (v || null) as PisoDestino | null })}
                        >
                          <SelectTrigger className="w-64"><SelectValue placeholder="— Ignorar —" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">— Ignorar —</SelectItem>
                            {CAMPOS_SISTEMA.map((c) => (
                              <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        {dest ? (
                          <span className={"inline-flex items-center rounded-full border px-2 py-0.5 text-xs " + TONE_CLASSES[showConf.tone]}>
                            {Math.round(showConf.score * 100)}%
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPasso(1)}>Voltar</Button>
            <Button onClick={() => matchMut.mutate()} disabled={matchMut.isPending}>
              {matchMut.isPending ? "Localizando profissionais…" : "Continuar"}
            </Button>
          </div>
        </div>
      )}

      {passo === 3 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Importados" value={stats.importados} tone="success" />
            <StatCard label="Divergentes" value={stats.divergentes} tone="warning" />
            <StatCard label="Não localizados" value={stats.nao_localizados} tone="danger" />
          </div>
          <PreviewTable rows={resolved.slice(0, 100)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPasso(2)}>Voltar</Button>
            <Button onClick={() => commitMut.mutate()} disabled={commitMut.isPending}>
              {commitMut.isPending ? "Gravando…" : "Confirmar importação"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" | "danger" }) {
  const color =
    tone === "success" ? "text-emerald-600" :
    tone === "warning" ? "text-amber-600" :
    tone === "danger" ? "text-red-600" : "text-foreground";
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={"text-2xl font-semibold " + color}>{value}</div>
    </div>
  );
}

function ProgressSteps({ passo }: { passo: Passo }) {
  const items: { n: Passo; label: string }[] = [
    { n: 1, label: "Configuração" },
    { n: 2, label: "Mapeamento" },
    { n: 3, label: "Prévia e envio" },
  ];
  return (
    <ol className="flex items-center gap-2 text-xs">
      {items.map((it, i) => {
        const done = passo > it.n;
        const active = passo === it.n;
        return (
          <li key={it.n} className="flex items-center gap-2">
            <span
              className={
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 " +
                (done
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted text-muted-foreground")
              }
            >
              {done ? <CheckCircle2 className="h-3 w-3" /> : <span className="font-semibold">{it.n}</span>}
              {it.label}
            </span>
            {i < items.length - 1 && <span className="h-px w-6 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

function ContextualTip({ passo }: { passo: Passo }) {
  const tips: Record<Passo, string> = {
    1: "Dica: renomeie o arquivo incluindo o mês/ano (ex.: efetivos-2026-07.xlsx) para detecção automática.",
    2: "Dica: salve este mapeamento com um nome descritivo para reutilizar nas próximas importações.",
    3: "Dica: revise os divergentes e não localizados antes de confirmar — o desfazer é rastreável, mas evite retrabalho.",
  };
  return (
    <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-2 text-xs">
      <Lightbulb className="mt-0.5 h-4 w-4 text-primary" />
      <span>{tips[passo]}</span>
    </div>
  );
}

function QualityCard({ q }: { q: ReturnType<typeof computeQuality> }) {
  if (q.total === 0) return null;
  const dot = (tone: ConfidenceTone) =>
    tone === "high" ? "🟢" : tone === "medium" ? "🟡" : tone === "low" ? "🔴" : "⚪";
  const toneFor = (pct: number): ConfidenceTone => (pct >= 0.9 ? "high" : pct >= 0.7 ? "medium" : "low");
  const items = [
    { label: "CPFs válidos", pct: q.cpfPct, n: q.cpfValidos },
    { label: "Nomes preenchidos", pct: q.nomePct, n: q.nomePreenchido },
    { label: "Matrículas preenchidas", pct: q.matriculaPct, n: q.matriculaPreenchida },
  ];
  return (
    <div className="grid gap-2 rounded-md border bg-muted/20 p-3 md:grid-cols-3">
      {items.map((it) => {
        const tone = toneFor(it.pct);
        return (
          <div key={it.label} className="flex items-center justify-between rounded border bg-background px-3 py-2 text-sm">
            <span className="text-muted-foreground">{dot(tone)} {it.label}</span>
            <span className="font-semibold">
              {Math.round(it.pct * 100)}% <span className="text-xs text-muted-foreground">({it.n}/{q.total})</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PreviewTable({ rows }: { rows: ResolvedRow[] }) {
  const cols: DataTableColumn<ResolvedRow>[] = [
    {
      key: "match",
      header: "Match",
      cell: (r) => (
        <Badge
          variant={
            r.status_match === "cpf" ? "default" :
            r.status_match === "matricula" ? "secondary" :
            r.status_match === "nome" ? "outline" : "destructive"
          }
        >
          {r.status_match === "nao_localizado" ? "Não localizado" : r.status_match.toUpperCase()}
        </Badge>
      ),
    },
    { key: "cpf", header: "CPF", cell: (r) => r.cpf ?? "—" },
    { key: "nome", header: "Nome", cell: (r) => r.nome ?? "—" },
    { key: "matricula", header: "Matrícula", cell: (r) => r.matricula ?? "—" },
    { key: "salario_base", header: "Salário Base", cell: (r) => r.salario_base?.toFixed(2) ?? "—" },
    { key: "piso", header: "Piso", cell: (r) => r.piso_complementacao?.toFixed(2) ?? "—" },
    { key: "liquido", header: "Líquido", cell: (r) => r.valor_liquido?.toFixed(2) ?? "—" },
  ];
  return (
    <DataTable<ResolvedRow>
      columns={cols}
      rows={rows}
      getRowKey={(_r, i) => String(i)}
      emptyTitle="Sem linhas para prévia"
    />
  );
}