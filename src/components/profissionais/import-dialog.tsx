import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, Download, FileSpreadsheet } from "lucide-react";

type Row = Record<string, unknown>;
type Parsed = {
  raw: Row;
  linha: number;
  nome_completo: string;
  cpf: string;
  matricula: string | null;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  sexo: string | null;
  data_admissao: string | null;
  carga_semanal_horas: number | null;
  status: string;
  observacoes: string | null;
  unidade_key: string | null;
  setor_key: string | null;
  cargo_key: string | null;
  funcao_key: string | null;
  vinculo_key: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  proj: number | null;
  h_p: number | null;
  c_h: number | null;
  jorn: number | null;
  erro?: string;
};

const HEADERS = [
  "nome_completo",
  "cpf",
  "matricula",
  "email",
  "telefone",
  "data_nascimento",
  "sexo",
  "data_admissao",
  "carga_semanal_horas",
  "status",
  "unidade",
  "setor",
  "cargo",
  "funcao",
  "vinculo",
  "banco",
  "agencia",
  "conta",
  "proj",
  "h_p",
  "c_h",
  "jorn",
  "observacoes",
];

const norm = (s: unknown) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const parseDate = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    // Data serial do Excel (base 1899-12-30, corrige bug do ano bissexto de 1900)
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  const s = String(v).trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (iso.test(s)) return s;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
};

const VALID_STATUS = ["ativo", "inativo", "afastado", "ferias", "licenca", "desligado"];

export function ImportProfissionaisDialog() {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [secretariaId, setSecretariaId] = useState("");
  const [rows, setRows] = useState<Parsed[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: number; fail: number; erros: string[] } | null>(null);

  const { data: secretarias } = useQuery({
    queryKey: ["import-secretarias"],
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
    enabled: open,
  });

  const { data: lookups } = useQuery({
    queryKey: ["import-lookups", secretariaId],
    queryFn: async () => {
      const [un, se, ca, fu, vi] = await Promise.all([
        supabase
          .from("unidades")
          .select("id,nome,sigla,secretaria_id")
          .is("deleted_at", null)
          .eq("secretaria_id", secretariaId),
        supabase.from("setores").select("id,nome,unidade_id").is("deleted_at", null),
        supabase.from("cargos").select("id,nome,codigo").is("deleted_at", null),
        supabase.from("funcoes").select("id,nome,codigo").is("deleted_at", null),
        supabase.from("vinculos").select("id,nome,codigo,natureza").is("deleted_at", null),
      ]);
      return {
        unidades: un.data ?? [],
        setores: se.data ?? [],
        cargos: ca.data ?? [],
        funcoes: fu.data ?? [],
        vinculos: vi.data ?? [],
      };
    },
    enabled: open && !!secretariaId,
  });

  const preview = useMemo(() => rows.slice(0, 10), [rows]);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      HEADERS,
      [
        "JOÃO DA SILVA",
        "12345678901",
        "MAT-001",
        "joao@exemplo.gov.br",
        "(93) 90000-0000",
        "12/04/1985",
        "M",
        "2020-03-01",
        40,
        "ativo",
        "UBS-CENTRO",
        "Enfermagem",
        "Enfermeiro",
        "ENF",
        "Efetivo",
        "BANPARÁ",
        "0077",
        "640.272-0",
        1,
        160,
        160,
        30,
        "",
      ],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "profissionais");
    XLSX.writeFile(wb, "modelo-profissionais.xlsx");
  };

  const handleFile = async (file: File) => {
    setResult(null);
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Row>(ws, { defval: "", raw: true });

    const parsed: Parsed[] = json.map((r, i) => {
      const get = (k: string) => {
        const key = Object.keys(r).find((h) => norm(h) === norm(k));
        return key ? r[key] : "";
      };
      const numOrNull = (v: unknown): number | null => {
        if (v == null || v === "") return null;
        const n = Number(String(v).replace(",", "."));
        return Number.isFinite(n) ? n : null;
      };
      const cpf = String(get("cpf") ?? "").replace(/\D/g, "");
      const nome = String(get("nome_completo") ?? get("nome") ?? "").trim();
      const status = norm(get("status") || "ativo");
      const ch = Number(get("carga_semanal_horas") || get("carga_horaria") || 0);
      const row: Parsed = {
        raw: r,
        linha: i + 2,
        nome_completo: nome,
        cpf,
        matricula: String(get("matricula") ?? "").trim() || null,
        email: String(get("email") ?? "").trim() || null,
        telefone: String(get("telefone") ?? "").trim() || null,
        data_nascimento: parseDate(get("data_nascimento")),
        sexo:
          String(get("sexo") ?? "")
            .trim()
            .toUpperCase()
            .slice(0, 1) || null,
        data_admissao: parseDate(get("data_admissao")),
        carga_semanal_horas: Number.isFinite(ch) && ch > 0 ? ch : null,
        status: VALID_STATUS.includes(status) ? status : "ativo",
        observacoes: String(get("observacoes") ?? "").trim() || null,
        unidade_key: String(get("unidade") ?? "").trim() || null,
        setor_key: String(get("setor") ?? "").trim() || null,
        cargo_key: String(get("cargo") ?? "").trim() || null,
        funcao_key: String(get("funcao") ?? get("função") ?? "").trim() || null,
        vinculo_key: String(get("vinculo") ?? get("vínculo") ?? "").trim() || null,
        banco: String(get("banco") ?? "").trim() || null,
        agencia: String(get("agencia") ?? get("agência") ?? "").trim() || null,
        conta: String(get("conta") ?? get("conta_corrente") ?? "").trim() || null,
        proj: numOrNull(get("proj")),
        h_p: numOrNull(get("h_p") ?? get("h.p") ?? get("hp")),
        c_h: numOrNull(get("c_h") ?? get("c.h") ?? get("ch")),
        jorn: numOrNull(get("jorn") ?? get("jornada")),
      };
      if (!row.nome_completo) row.erro = "Nome vazio";
      else if (row.cpf.length !== 11) row.erro = "CPF inválido";
      return row;
    });
    setRows(parsed);
  };

  const resolve = (
    list: Array<{
      id: string;
      nome: string;
      sigla?: string | null;
      codigo?: string | null;
      natureza?: string | null;
    }>,
    key: string | null,
  ) => {
    if (!key) return null;
    const k = norm(key);
    const found = list.find(
      (x) => norm(x.nome) === k || norm(x.sigla) === k || norm(x.codigo) === k,
    );
    return found?.id ?? null;
  };

  const runImport = async () => {
    if (!secretariaId) return toast.error("Selecione a Secretaria de destino");
    if (!rows.length) return toast.error("Nenhuma linha para importar");
    if (!lookups) return toast.error("Aguarde o carregamento das referências");
    setImporting(true);
    let ok = 0;
    let fail = 0;
    const erros: string[] = [];

    for (const r of rows) {
      if (r.erro) {
        fail++;
        erros.push(`Linha ${r.linha}: ${r.erro}`);
        continue;
      }
      const unidade_id = resolve(lookups.unidades, r.unidade_key);
      const setores_da_unidade = unidade_id
        ? lookups.setores.filter((s) => s.unidade_id === unidade_id)
        : [];
      const setor_id = resolve(setores_da_unidade, r.setor_key);
      const cargo_id = resolve(lookups.cargos, r.cargo_key);
      const funcao_id = resolve(lookups.funcoes, r.funcao_key);
      const vinculo_id = resolve(lookups.vinculos, r.vinculo_key);
      const vinculoNat = vinculo_id
        ? (lookups.vinculos.find((v) => v.id === vinculo_id)?.natureza ?? null)
        : null;
      const isEfetivo = vinculoNat === "efetivo" || vinculoNat === "comissionado";
      const hasAgili = r.proj != null || r.h_p != null || r.c_h != null || r.jorn != null;
      if (hasAgili && !isEfetivo) {
        erros.push(
          `Linha ${r.linha} (${r.nome_completo}): Proj/H.P/C.H/Jorn ignorados — vínculo não é efetivo`,
        );
      }

      if (r.unidade_key && !unidade_id) {
        fail++;
        erros.push(`Linha ${r.linha}: unidade "${r.unidade_key}" não encontrada`);
        continue;
      }

      const payload = {
        nome_completo: r.nome_completo,
        cpf: r.cpf,
        matricula: r.matricula,
        email: r.email,
        telefone: r.telefone,
        data_nascimento: r.data_nascimento,
        sexo: r.sexo,
        data_admissao: r.data_admissao,
        carga_horaria_semanal: r.carga_semanal_horas,
        status: r.status as never,
        observacoes: r.observacoes,
        secretaria_id: secretariaId,
        unidade_id,
        setor_id,
        cargo_id,
        funcao_id,
        vinculo_id,
        banco: r.banco,
        agencia: r.agencia,
        conta_corrente: r.conta,
        proj: isEfetivo ? r.proj : null,
        h_p: isEfetivo ? r.h_p : null,
        c_h: isEfetivo ? r.c_h : null,
        jorn: isEfetivo ? r.jorn : null,
      };

      // upsert por CPF via lookup manual (o índice único de cpf é parcial:
      // WHERE deleted_at IS NULL — PostgREST não aceita como conflict target).
      const { data: existing, error: findErr } = await supabase
        .from("profissionais")
        .select("id")
        .eq("cpf", r.cpf)
        .is("deleted_at", null)
        .maybeSingle();

      let opErr: { message: string } | null = findErr;
      if (!opErr) {
        if (existing?.id) {
          const { error: upErr } = await supabase
            .from("profissionais")
            .update(payload)
            .eq("id", existing.id);
          opErr = upErr;
        } else {
          const { error: insErr } = await supabase.from("profissionais").insert(payload);
          opErr = insErr;
        }
      }
      if (opErr) {
        fail++;
        erros.push(`Linha ${r.linha} (${r.nome_completo}): ${opErr.message}`);
      } else {
        ok++;
      }
    }
    setImporting(false);
    setResult({ ok, fail, erros: erros.slice(0, 50) });
    if (ok > 0) qc.invalidateQueries({ queryKey: ["profissionais"] });
    if (fail === 0) toast.success(`${ok} profissionais importados`);
    else toast.warning(`${ok} importados, ${fail} com erro`);
  };

  const reset = () => {
    setRows([]);
    setFileName("");
    setResult(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          reset();
          setSecretariaId("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" /> Importar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar profissionais (CSV/XLSX)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium">Como funciona</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Baixe o modelo e preencha (colunas nomeadas por cabeçalho).</li>
              <li>Selecione a Secretaria de destino e envie o arquivo.</li>
              <li>
                Unidade, Setor, Cargo, Função e Vínculo são resolvidos por{" "}
                <strong>nome, sigla ou código</strong>.
              </li>
              <li>
                CPFs existentes são <strong>atualizados</strong> (upsert por CPF).
              </li>
            </ol>
            <Button
              type="button"
              variant="link"
              className="mt-1 h-auto p-0"
              onClick={downloadTemplate}
            >
              <Download className="mr-1 h-4 w-4" /> Baixar modelo .xlsx
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label>Secretaria de Destino *</Label>
              <Select value={secretariaId} onValueChange={setSecretariaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a Secretaria" />
                </SelectTrigger>
                <SelectContent>
                  {secretarias?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.sigla ? `${s.sigla} - ` : ""}
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {me?.secretaria_id && !secretariaId && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1 h-auto p-0 text-xs"
                  onClick={() => setSecretariaId(me.secretaria_id!)}
                >
                  Usar minha secretaria
                </Button>
              )}
            </div>
            <div>
              <Label>Arquivo (.csv, .xlsx)</Label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-primary-foreground"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          </div>

          {fileName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              {fileName} — {rows.length} linha(s) lida(s)
            </div>
          )}

          {preview.length > 0 && (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Nome</th>
                    <th className="p-2 text-left">CPF</th>
                    <th className="p-2 text-left">Unidade</th>
                    <th className="p-2 text-left">Cargo</th>
                    <th className="p-2 text-left">Função</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r) => (
                    <tr key={r.linha} className={r.erro ? "bg-destructive/10" : ""}>
                      <td className="p-2">{r.linha}</td>
                      <td className="p-2">{r.nome_completo || "—"}</td>
                      <td className="p-2">{r.cpf || "—"}</td>
                      <td className="p-2">{r.unidade_key || "—"}</td>
                      <td className="p-2">{r.cargo_key || "—"}</td>
                      <td className="p-2">{r.funcao_key || "—"}</td>
                      <td className="p-2">{r.erro ?? r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > preview.length && (
                <div className="border-t p-2 text-center text-xs text-muted-foreground">
                  ... e mais {rows.length - preview.length} linha(s)
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="rounded-md border p-3 text-sm">
              <p>
                <strong>{result.ok}</strong> importados ·{" "}
                <strong className={result.fail ? "text-destructive" : ""}>{result.fail}</strong> com
                erro
              </p>
              {result.erros.length > 0 && (
                <ul className="mt-2 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs text-destructive">
                  {result.erros.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
          <Button onClick={runImport} disabled={importing || !rows.length || !secretariaId}>
            {importing ? "Importando..." : `Importar ${rows.length || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
