import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";

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
    setMapeamento(autoMap(hs));
    setPasso(2);
  }

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

      <ol className="flex gap-2 text-xs">
        {[1, 2, 3].map((n) => (
          <li key={n} className={"rounded px-2 py-1 " + (passo >= (n as Passo) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            {n === 1 ? "1. Configuração" : n === 2 ? "2. Mapeamento" : "3. Prévia e envio"}
          </li>
        ))}
      </ol>

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
            <Input
              type="file"
              accept=".xlsx,.xls,.csv,.pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <p className="text-xs text-muted-foreground">Arquivos PDF serão suportados em versão futura.</p>
          </div>
        </div>
      )}

      {passo === 2 && (
        <div className="space-y-3 rounded-md border p-4">
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
                </tr>
              </thead>
              <tbody>
                {headers.map((h) => (
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
                  </tr>
                ))}
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