import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { ArrowLeft, Upload, FileSpreadsheet, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shared";
import { usePermissions } from "@/hooks/use-permissions";
import { formatCPF } from "@/lib/formatters";
import {
  detectHeaderRow,
  extractCerRows,
  parseConta,
  fuzzyMatchUnidade,
  fuzzyMatchCargo,
  resolveDuplicate,
  cpfDigits,
  type CerRowRaw,
  type ContaParsed,
  type MatchResult,
  type DedupMode,
  type ExistingProfissional,
} from "@/lib/cer-import";

export const Route = createFileRoute("/_authenticated/profissionais/importar-cer")({
  component: ImportarCerPage,
});

type LinhaProcessada = {
  raw: CerRowRaw;
  conta: ContaParsed;
  unidadeMatch: MatchResult;
  cargoMatch: MatchResult;
  duplicadoDe: ExistingProfissional | null;
  status: "novo" | "duplicado" | "erro" | "revisar";
  motivos: string[];
};

function ImportarCerPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { has } = usePermissions();
  const canImport = has("profissional.criar");

  const [secretariaId, setSecretariaId] = useState("");
  const [fileName, setFileName] = useState("");
  const [headerIdx, setHeaderIdx] = useState<number>(-1);
  const [aoa, setAoa] = useState<unknown[][]>([]);
  const [rows, setRows] = useState<CerRowRaw[]>([]);
  const [dedupMode, setDedupMode] = useState<DedupMode>("merge-vazios");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: number; skip: number; fail: number; erros: string[] } | null>(null);

  const { data: secretarias } = useQuery({
    queryKey: ["cer-secretarias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("secretarias")
        .select("id,nome,sigla")
        .is("deleted_at", null)
        .eq("status", "ativa")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: unidades } = useQuery({
    queryKey: ["cer-unidades", secretariaId],
    enabled: !!secretariaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidades")
        .select("id,nome,sigla")
        .is("deleted_at", null)
        .eq("secretaria_id", secretariaId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: cargos } = useQuery({
    queryKey: ["cer-cargos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargos")
        .select("id,nome")
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const cpfs = useMemo(() => rows.map((r) => r.cpf).filter((c) => c.length === 11), [rows]);

  const { data: existentes } = useQuery({
    queryKey: ["cer-existentes", cpfs.sort().join(",")],
    enabled: cpfs.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("id,nome_completo,cpf,unidade_id,cargo_id,banco,agencia,conta_corrente")
        .in("cpf", cpfs)
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function handleFile(file: File) {
    setResult(null);
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
    setAoa(matrix);
    const idx = detectHeaderRow(matrix);
    setHeaderIdx(idx);
    if (idx < 0) {
      toast.warning("Cabeçalho não detectado nas primeiras 10 linhas — ajuste manualmente.");
      setRows([]);
      return;
    }
    setRows(extractCerRows(matrix, idx));
  }

  function handleHeaderChange(idx: number) {
    setHeaderIdx(idx);
    setRows(extractCerRows(aoa, idx));
  }

  const processadas: LinhaProcessada[] = useMemo(() => {
    const existMap = new Map<string, ExistingProfissional>();
    for (const e of existentes ?? []) {
      existMap.set(String((e as { cpf: string }).cpf), {
        id: e.id,
        nome_completo: e.nome_completo,
        banco: e.banco,
        agencia: e.agencia,
        conta_corrente: e.conta_corrente,
        unidade_id: e.unidade_id,
        cargo_id: e.cargo_id,
      });
    }
    const seenCpf = new Set<string>();
    return rows.map((r) => {
      const conta = parseConta(r.conta_raw);
      const uCands = (unidades ?? []).map((u) => ({ id: u.id, nome: u.nome, sigla: u.sigla }));
      const cCands = (cargos ?? []).map((c) => ({ id: c.id, nome: c.nome }));
      const unidadeMatch = fuzzyMatchUnidade(r.lotacao, uCands);
      const cargoMatch = fuzzyMatchCargo(r.cargo, cCands);
      const dup = r.cpf ? existMap.get(r.cpf) ?? null : null;
      const dupNaPlanilha = r.cpf && seenCpf.has(r.cpf);
      if (r.cpf) seenCpf.add(r.cpf);

      const motivos: string[] = [];
      let status: LinhaProcessada["status"] = "novo";
      if (!r.nome) {
        status = "erro";
        motivos.push("Sem nome");
      } else if (!r.cpf || r.cpf.length !== 11) {
        status = "erro";
        motivos.push("CPF ausente/inválido");
      } else if (dup) {
        status = "duplicado";
        motivos.push(`Já existe (${dup.nome_completo})`);
      } else if (dupNaPlanilha) {
        status = "duplicado";
        motivos.push("CPF repetido na planilha");
      }
      if (unidadeMatch.ambiguo) {
        status = status === "erro" ? status : "revisar";
        motivos.push("Unidade ambígua");
      } else if (r.lotacao && !unidadeMatch.id) {
        status = status === "erro" ? status : "revisar";
        motivos.push(`Unidade "${r.lotacao}" não encontrada`);
      }
      if (cargoMatch.ambiguo) {
        status = status === "erro" ? status : "revisar";
        motivos.push("Cargo ambíguo");
      } else if (r.cargo && !cargoMatch.id) {
        status = status === "erro" ? status : "revisar";
        motivos.push(`Cargo "${r.cargo}" não encontrado`);
      }
      if (conta.status === "revisar") motivos.push("Revisar bancário");
      if (conta.status === "parcial") motivos.push("Bancário parcial");

      return { raw: r, conta, unidadeMatch, cargoMatch, duplicadoDe: dup, status, motivos };
    });
  }, [rows, unidades, cargos, existentes]);

  const resumo = useMemo(() => {
    const r = { novo: 0, duplicado: 0, revisar: 0, erro: 0 };
    for (const p of processadas) r[p.status] += 1;
    return r;
  }, [processadas]);

  async function confirmar() {
    if (!secretariaId) return toast.error("Selecione a Secretaria de destino");
    if (!canImport) return toast.error("Sem permissão para importar");
    setImporting(true);
    let ok = 0;
    let skip = 0;
    let fail = 0;
    const erros: string[] = [];

    for (const p of processadas) {
      if (p.status === "erro" || p.status === "revisar") {
        skip += 1;
        continue;
      }
      const incoming = {
        nome_completo: p.raw.nome,
        cpf: p.raw.cpf,
        unidade_id: p.unidadeMatch.id,
        cargo_id: p.cargoMatch.id,
        banco: p.conta.banco,
        agencia: p.conta.agencia,
        conta_corrente: p.conta.conta,
      };
      try {
        if (p.status === "duplicado" && p.duplicadoDe) {
          const patch = resolveDuplicate(incoming, p.duplicadoDe, dedupMode);
          if (!patch) {
            skip += 1;
            continue;
          }
          const { error } = await supabase
            .from("profissionais")
            .update(patch as never)
            .eq("id", p.duplicadoDe.id);
          if (error) throw error;
          ok += 1;
        } else if (p.status === "novo") {
          const payload = {
            nome_completo: incoming.nome_completo,
            cpf: incoming.cpf,
            secretaria_id: secretariaId,
            unidade_id: incoming.unidade_id,
            cargo_id: incoming.cargo_id,
            banco: incoming.banco,
            agencia: incoming.agencia,
            conta_corrente: incoming.conta_corrente,
            data_admissao: p.raw.data_admissao,
            status: "ativo" as const,
          };
          const { error } = await supabase.from("profissionais").insert(payload as never);
          if (error) throw error;
          ok += 1;
        }
      } catch (e) {
        fail += 1;
        erros.push(`Linha ${p.raw.linha} (${p.raw.nome}): ${(e as Error).message}`);
      }
    }

    setImporting(false);
    setResult({ ok, skip, fail, erros: erros.slice(0, 30) });
    qc.invalidateQueries({ queryKey: ["profissionais"] });
    qc.invalidateQueries({ queryKey: ["cer-existentes"] });
    if (fail === 0) toast.success(`${ok} profissionais gravados, ${skip} pulados`);
    else toast.warning(`${ok} gravados, ${fail} com erro, ${skip} pulados`);
  }

  if (!canImport) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center">
          <ShieldAlert className="mx-auto mb-2 h-8 w-8 text-destructive" />
          <h2 className="text-lg font-semibold">Sem permissão</h2>
          <p className="text-sm text-muted-foreground">
            É necessária a permissão <code>profissional.criar</code> para importar profissionais.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="Importar profissionais — CER (Folha)"
        description="Aceita planilhas do CER (Centro Especializado em Reabilitação). Os valores de folha (BASE, BRUTO, ISS, etc.) são ignorados."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/profissionais">
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Link>
          </Button>
        }
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Label>1. Secretaria de destino *</Label>
            <Select value={secretariaId} onValueChange={setSecretariaId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {secretarias?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.sigla ? `${s.sigla} · ` : ""}{s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>2. Arquivo (.xlsx)</Label>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-primary-foreground"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
          <div>
            <Label>3. CPF duplicado</Label>
            <RadioGroup
              value={dedupMode}
              onValueChange={(v) => setDedupMode(v as DedupMode)}
              className="mt-2 space-y-1"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="merge-vazios" /> Atualizar apenas campos vazios
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="pular" /> Pular
              </label>
            </RadioGroup>
          </div>
        </div>

        {fileName && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            <span>{fileName}</span>
            <span className="text-muted-foreground">·</span>
            <span>
              Cabeçalho:{" "}
              <Select value={String(headerIdx)} onValueChange={(v) => handleHeaderChange(Number(v))}>
                <SelectTrigger className="inline-flex h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {aoa.slice(0, 10).map((r, i) => (
                    <SelectItem key={i} value={String(i)}>
                      Linha {i + 1} — {String((r ?? [])[1] ?? (r ?? [])[0] ?? "").slice(0, 30)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </span>
            <span className="text-muted-foreground">·</span>
            <span>{rows.length} linha(s) de dados</span>
          </div>
        )}
      </Card>

      {processadas.length > 0 && (
        <Card className="p-0">
          <div className="flex flex-wrap items-center gap-3 border-b p-3 text-sm">
            <strong>Prévia</strong>
            <Badge tone="ok">{resumo.novo} Novo</Badge>
            <Badge tone="warn">{resumo.duplicado} Duplicado</Badge>
            <Badge tone="warn">{resumo.revisar} Revisar</Badge>
            <Badge tone="danger">{resumo.erro} Erro</Badge>
            <div className="ml-auto">
              <Button
                onClick={confirmar}
                disabled={importing || (resumo.novo === 0 && resumo.duplicado === 0)}
              >
                {importing ? "Gravando..." : "Confirmar importação"}
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">Nome</th>
                  <th className="p-2 text-left">CPF</th>
                  <th className="p-2 text-left">Unidade (match)</th>
                  <th className="p-2 text-left">Cargo (match)</th>
                  <th className="p-2 text-left">Banco</th>
                  <th className="p-2 text-left">Agência</th>
                  <th className="p-2 text-left">Conta</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {processadas.map((p) => (
                  <tr key={p.raw.linha} className={
                    p.status === "erro" ? "bg-destructive/10" :
                    p.status === "revisar" ? "bg-amber-500/10" :
                    p.status === "duplicado" ? "bg-sky-500/10" : ""
                  }>
                    <td className="p-2">{p.raw.linha}</td>
                    <td className="p-2">{p.raw.nome}</td>
                    <td className="p-2 font-mono">{p.raw.cpf ? formatCPF(p.raw.cpf) : "—"}</td>
                    <td className="p-2">
                      {p.unidadeMatch.id ? p.unidadeMatch.nome
                        : p.unidadeMatch.ambiguo ? `Ambíguo: ${p.unidadeMatch.candidatos.map((c) => c.nome).join(" / ")}`
                        : p.raw.lotacao || "—"}
                    </td>
                    <td className="p-2">
                      {p.cargoMatch.id ? p.cargoMatch.nome
                        : p.cargoMatch.ambiguo ? `Ambíguo: ${p.cargoMatch.candidatos.map((c) => c.nome).join(" / ")}`
                        : p.raw.cargo || "—"}
                    </td>
                    <td className="p-2">{p.conta.banco ?? "—"}</td>
                    <td className="p-2 font-mono">{p.conta.agencia ?? "—"}</td>
                    <td className="p-2 font-mono">{p.conta.conta ?? "—"}</td>
                    <td className="p-2">
                      <div className="font-medium">{p.status.toUpperCase()}</div>
                      {p.motivos.length > 0 && (
                        <div className="text-[10px] text-muted-foreground">{p.motivos.join(" · ")}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {result && (
        <Card className="p-4 text-sm">
          <div className="mb-2 font-semibold">Resultado</div>
          <p>
            <strong className="text-emerald-600">{result.ok}</strong> gravados ·{" "}
            <strong>{result.skip}</strong> pulados ·{" "}
            <strong className={result.fail ? "text-destructive" : ""}>{result.fail}</strong> com erro
          </p>
          {result.erros.length > 0 && (
            <ul className="mt-2 max-h-40 overflow-auto rounded border p-2 text-xs text-destructive">
              {result.erros.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          <Button
            variant="link"
            className="mt-2 h-auto p-0"
            onClick={() => nav({ to: "/profissionais" })}
          >
            Voltar para a lista de profissionais
          </Button>
        </Card>
      )}
    </div>
  );
}

function Badge({ tone, children }: { tone: "ok" | "warn" | "danger"; children: React.ReactNode }) {
  const cls =
    tone === "ok" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
    : tone === "warn" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
    : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}