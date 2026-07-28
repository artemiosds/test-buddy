import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, FileSpreadsheet, FileText, Printer, Users } from "lucide-react";
import { toast } from "sonner";
import { usePermissions, useCurrentUser } from "@/hooks/use-permissions";
import { RelatoriosTabs } from "@/components/relatorios-tabs";
import { FilterBar } from "@/components/shared/FilterBar";
import {
  useCargosLookup,
  useFuncoesLookup,
  useSetoresLookup,
  useUnidadesLookup,
  useVinculosLookup,
} from "@/hooks/use-lookups";
import {
  exportarExcel,
  exportarPdfInstitucional,
  type ExportColumn,
} from "@/lib/relatorios-gerenciais-export";

export const Route = createFileRoute("/_authenticated/relatorios-cadastro")({
  component: RelatorioCadastroPage,
});

// ---------------------------------------------------------------- tipos

type Row = {
  id: string;
  nome_completo: string;
  nome_social: string | null;
  matricula: string | null;
  cpf: string | null;
  rg: string | null;
  pis_pasep: string | null;
  cns: string | null;
  sexo: string | null;
  data_nascimento: string | null;
  telefone: string | null;
  email: string | null;
  endereco_completo: string | null;
  data_admissao: string | null;
  data_desligamento: string | null;
  carga_horaria_semanal: number | null;
  jornada: string | null;
  status: string;
  situacao_funcional: string | null;
  conselho_classe: string | null;
  conselho_numero: string | null;
  conselho_uf: string | null;
  banco: string | null;
  agencia: string | null;
  conta_corrente: string | null;
  observacoes: string | null;
  cargo_id: string | null;
  funcao_id: string | null;
  unidade_id: string | null;
  setor_id: string | null;
  vinculo_id: string | null;
  cargos: { nome: string } | null;
  funcoes: { nome: string } | null;
  unidades: { nome: string; sigla: string | null } | null;
  setores: { nome: string } | null;
  vinculos: { nome: string } | null;
};


type CampoDef = {
  id: string;
  label: string;
  value: (r: Row) => string | number | null | undefined;
  default?: boolean;
  width?: number;
};

function dataBR(v: string | null | undefined): string {
  if (!v) return "";
  const [a, m, d] = v.slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : v;
}

const CAMPOS: CampoDef[] = [
  { id: "nome_completo", label: "Nome", value: (r) => r.nome_completo, default: true, width: 34 },
  { id: "nome_social", label: "Nome social", value: (r) => r.nome_social },
  { id: "matricula", label: "Matrícula", value: (r) => r.matricula, default: true, width: 14 },
  { id: "cpf", label: "CPF", value: (r) => r.cpf, default: true, width: 16 },
  { id: "rg", label: "RG", value: (r) => r.rg },
  { id: "pis_pasep", label: "PIS/PASEP", value: (r) => r.pis_pasep },
  { id: "cns", label: "CNS", value: (r) => r.cns },
  { id: "sexo", label: "Sexo", value: (r) => r.sexo },
  { id: "data_nascimento", label: "Nascimento", value: (r) => dataBR(r.data_nascimento) },
  { id: "telefone", label: "Telefone", value: (r) => r.telefone },
  { id: "email", label: "E-mail", value: (r) => r.email },
  { id: "endereco_completo", label: "Endereço", value: (r) => r.endereco_completo, width: 40 },
  { id: "cargo", label: "Cargo", value: (r) => r.cargos?.nome ?? "", default: true, width: 26 },
  { id: "funcao", label: "Função", value: (r) => r.funcoes?.nome ?? "", default: true, width: 26 },
  {
    id: "unidade",
    label: "Unidade",
    value: (r) => (r.unidades ? (r.unidades.sigla ?? r.unidades.nome) : ""),
    default: true,
    width: 24,
  },
  { id: "setor", label: "Setor", value: (r) => r.setores?.nome ?? "" },
  { id: "vinculo", label: "Vínculo", value: (r) => r.vinculos?.nome ?? "", default: true },
  { id: "data_admissao", label: "Admissão", value: (r) => dataBR(r.data_admissao) },
  { id: "data_desligamento", label: "Desligamento", value: (r) => dataBR(r.data_desligamento) },
  { id: "carga_horaria_semanal", label: "CH semanal", value: (r) => r.carga_horaria_semanal },
  { id: "jornada", label: "Jornada", value: (r) => r.jornada },
  { id: "status", label: "Status", value: (r) => r.status, default: true },
  { id: "situacao_funcional", label: "Situação funcional", value: (r) => r.situacao_funcional },
  { id: "conselho_classe", label: "Conselho", value: (r) => r.conselho_classe },
  { id: "conselho_numero", label: "Nº conselho", value: (r) => r.conselho_numero },
  { id: "conselho_uf", label: "UF conselho", value: (r) => r.conselho_uf },
  { id: "banco", label: "Banco", value: (r) => r.banco },
  { id: "agencia", label: "Agência", value: (r) => r.agencia },
  { id: "conta_corrente", label: "Conta", value: (r) => r.conta_corrente },
  { id: "observacoes", label: "Observações", value: (r) => r.observacoes, width: 40 },
];

const SELECT_COLS =
  "id,nome_completo,nome_social,matricula,cpf,rg,pis_pasep,cns,sexo," +
  "data_nascimento,telefone,email,endereco_completo,data_admissao," +
  "data_desligamento,carga_horaria_semanal,jornada,status,situacao_funcional," +
  "conselho_classe,conselho_numero,conselho_uf,banco,agencia,conta_corrente," +
  "observacoes,cargo_id,funcao_id,unidade_id,setor_id,vinculo_id";


// ------------------------------------------------------- multiselect UI

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Array<{ id: string; nome: string }>;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal">
          <span className="truncate">
            {selected.length === 0 ? `Todos` : `${selected.length} selecionado(s)`}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-80 w-72 overflow-auto p-2">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-xs font-semibold uppercase text-muted-foreground">{label}</span>
          {selected.length > 0 && (
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => onChange([])}
              type="button"
            >
              Limpar
            </button>
          )}
        </div>
        {options.length === 0 && (
          <p className="px-1 py-2 text-sm text-muted-foreground">Nenhum item.</p>
        )}
        {options.map((o) => (
          <label
            key={o.id}
            className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-muted"
          >
            <Checkbox checked={selected.includes(o.id)} onCheckedChange={() => toggle(o.id)} />
            <span className="truncate">{o.nome}</span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ------------------------------------------------------------- página

function RelatorioCadastroPage() {
  const { has, isLoading: permLoading } = usePermissions();
  const { data: me } = useCurrentUser();
  const isMaster = !!me?.is_master;
  const canView = isMaster || has("relatorio.visualizar");
  const canExport = isMaster || has("relatorio.exportar");

  const { data: cargos } = useCargosLookup();
  const { data: funcoes } = useFuncoesLookup();
  const { data: unidades } = useUnidadesLookup();
  const { data: vinculos } = useVinculosLookup();
  const { data: setores } = useSetoresLookup();

  const [selCargos, setSelCargos] = useState<string[]>([]);
  const [selFuncoes, setSelFuncoes] = useState<string[]>([]);
  const [selUnidades, setSelUnidades] = useState<string[]>([]);
  const [selVinculos, setSelVinculos] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("ativo");
  const [modo, setModo] = useState<"ou" | "e">("ou");
  const [campos, setCampos] = useState<string[]>(
    CAMPOS.filter((c) => c.default).map((c) => c.id),
  );
  const [gerando, setGerando] = useState(false);

  const colunas = useMemo<ExportColumn<Row>[]>(
    () =>
      campos
        .map((id) => CAMPOS.find((c) => c.id === id))
        .filter((c): c is CampoDef => !!c)
        .map((c) => ({ header: c.label, value: c.value, width: c.width })),
    [campos],
  );

  const {
    data: rows,
    isLoading,
    error: queryError,
  } = useQuery<Row[]>({
    queryKey: ["rel-cadastro", selUnidades.join(","), selVinculos.join(","), status],
    enabled: canView,
    queryFn: async () => {
      const pageSize = 1000;
      const acc: Row[] = [];
      for (let from = 0; ; from += pageSize) {
        let q = supabase
          .from("profissionais")
          .select(SELECT_COLS)
          .is("deleted_at", null)
          .order("nome_completo")
          .range(from, from + pageSize - 1);
        if (status !== "todos") q = q.eq("status", status as never);
        if (selUnidades.length) q = q.in("unidade_id", selUnidades);
        if (selVinculos.length) q = q.in("vinculo_id", selVinculos);
        const { data, error } = await q;
        if (error) throw error;
        const chunk = (data ?? []) as unknown as Row[];
        acc.push(...chunk);
        if (chunk.length < pageSize) break;
        if (acc.length >= 20000) break;
      }
      return acc;
    },
  });

  const lista = useMemo<Row[]>(() => {
    const cargoMap = new Map((cargos ?? []).map((c) => [c.id, c.nome]));
    const funcaoMap = new Map((funcoes ?? []).map((f) => [f.id, f.nome]));
    const unidadeMap = new Map((unidades ?? []).map((u) => [u.id, u]));
    const setorMap = new Map<string, string>((setores ?? []).map((s: { id: string; nome: string }) => [s.id, s.nome]));
    const vinculoMap = new Map((vinculos ?? []).map((v) => [v.id, v.nome]));

    return (rows ?? [])
      .filter((r) => {
        const okCargo = !selCargos.length || (r.cargo_id ? selCargos.includes(r.cargo_id) : false);
        const okFuncao =
          !selFuncoes.length || (r.funcao_id ? selFuncoes.includes(r.funcao_id) : false);
        if (selCargos.length && selFuncoes.length) {
          return modo === "ou" ? okCargo || okFuncao : okCargo && okFuncao;
        }
        return okCargo && okFuncao;
      })
      .map((r) => {
        const u = r.unidade_id ? unidadeMap.get(r.unidade_id) : undefined;
        return {
          ...r,
          cargos: r.cargo_id ? { nome: cargoMap.get(r.cargo_id) ?? "" } : null,
          funcoes: r.funcao_id ? { nome: funcaoMap.get(r.funcao_id) ?? "" } : null,
          unidades: u ? { nome: u.nome, sigla: u.sigla ?? null } : null,
          setores: r.setor_id ? { nome: setorMap.get(r.setor_id) ?? "" } : null,
          vinculos: r.vinculo_id ? { nome: vinculoMap.get(r.vinculo_id) ?? "" } : null,
        };
      });
  }, [rows, selCargos, selFuncoes, modo, cargos, funcoes, unidades, setores, vinculos]);


  const subtitulo = useMemo(() => {
    const partes: string[] = [];
    if (selCargos.length)
      partes.push(
        `Cargos: ${selCargos.map((id) => cargos?.find((c) => c.id === id)?.nome ?? "").join(", ")}`,
      );
    if (selFuncoes.length)
      partes.push(
        `Funções: ${selFuncoes.map((id) => funcoes?.find((f) => f.id === id)?.nome ?? "").join(", ")}`,
      );
    if (selUnidades.length)
      partes.push(
        `Unidades: ${selUnidades.map((id) => unidades?.find((u) => u.id === id)?.nome ?? "").join(", ")}`,
      );
    partes.push(`Status: ${status === "todos" ? "todos" : status}`);
    return partes.join(" | ");
  }, [selCargos, selFuncoes, selUnidades, status, cargos, funcoes, unidades]);

  function validar(): boolean {
    if (!canExport) {
      toast.error("Sem permissão para exportar.");
      return false;
    }
    if (!colunas.length) {
      toast.error("Selecione ao menos um campo.");
      return false;
    }
    if (!lista.length) {
      toast.error("Nada para exportar com esses filtros.");
      return false;
    }
    return true;
  }

  async function gerarPdf() {
    if (!validar()) return;
    setGerando(true);
    try {
      await exportarPdfInstitucional<Row>({
        filename: `RELATORIO-CADASTRO-${new Date().toISOString().slice(0, 10)}.pdf`,
        titulo: "RELATÓRIO DE CADASTRO DE PROFISSIONAIS",
        subtitulo,
        colunas,
        linhas: lista,
        resumo: [`Total de profissionais: ${lista.length}`],
      });
      toast.success("PDF gerado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar PDF.");
    } finally {
      setGerando(false);
    }
  }

  function gerarExcel() {
    if (!validar()) return;
    exportarExcel<Row>({
      filename: `RELATORIO-CADASTRO-${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheet: "Profissionais",
      colunas,
      linhas: lista,
    });
    toast.success("Planilha gerada.");
  }

  if (permLoading) return <div className="p-6 text-muted-foreground">Carregando...</div>;
  if (!canView) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="mt-2 text-muted-foreground">Sem permissão.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Users className="h-6 w-6 text-primary" /> Cadastro por Categoria
          </h1>
          <p className="text-sm text-muted-foreground">
            Selecione cargos e funções (múltipla escolha), escolha os campos do cadastro e imprima
            em PDF institucional ou planilha.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={gerarExcel} disabled={!canExport || !lista.length}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Planilha
          </Button>
          <Button onClick={gerarPdf} disabled={!canExport || !lista.length || gerando}>
            <FileText className="mr-2 h-4 w-4" /> {gerando ? "Gerando..." : "PDF"}
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
        </div>
      </div>

      <RelatoriosTabs />

      <div className="rounded-lg border bg-card p-4">
        <FilterBar>
          <FilterBar.Field label="Cargos (múltipla escolha)">
            <MultiSelect
              label="Cargos"
              options={cargos ?? []}
              selected={selCargos}
              onChange={setSelCargos}
            />
          </FilterBar.Field>
          <FilterBar.Field label="Funções (múltipla escolha)">
            <MultiSelect
              label="Funções"
              options={funcoes ?? []}
              selected={selFuncoes}
              onChange={setSelFuncoes}
            />
          </FilterBar.Field>
          <FilterBar.Field label="Unidades">
            <MultiSelect
              label="Unidades"
              options={(unidades ?? []).map((u) => ({
                id: u.id,
                nome: u.sigla ? `${u.sigla} — ${u.nome}` : u.nome,
              }))}
              selected={selUnidades}
              onChange={setSelUnidades}
            />
          </FilterBar.Field>
          <FilterBar.Field label="Vínculos">
            <MultiSelect
              label="Vínculos"
              options={vinculos ?? []}
              selected={selVinculos}
              onChange={setSelVinculos}
            />
          </FilterBar.Field>
          <FilterBar.Field label="Status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="afastado">Afastados</SelectItem>
                <SelectItem value="desligado">Desligados</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
          </FilterBar.Field>
          <FilterBar.Field label="Cargo + Função">
            <Select value={modo} onValueChange={(v) => setModo(v as "ou" | "e")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ou">Cargo OU Função</SelectItem>
                <SelectItem value="e">Cargo E Função</SelectItem>
              </SelectContent>
            </Select>
          </FilterBar.Field>
        </FilterBar>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Campos do cadastro a incluir ({campos.length})
          </h2>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCampos(CAMPOS.map((c) => c.id))}
            >
              Todos
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCampos(CAMPOS.filter((c) => c.default).map((c) => c.id))}
            >
              Padrão
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCampos([])}>
              Nenhum
            </Button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {CAMPOS.map((c) => (
            <label
              key={c.id}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted"
            >
              <Checkbox
                checked={campos.includes(c.id)}
                onCheckedChange={() =>
                  setCampos((prev) =>
                    prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id],
                  )
                }
              />
              <span className="truncate">{c.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="overflow-auto rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-3 py-2 text-sm">
          <Badge variant="secondary">{lista.length} profissionais</Badge>
          <span className="text-muted-foreground">Pré-visualização (50 primeiros)</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              {colunas.map((c) => (
                <th key={c.header} className="whitespace-nowrap px-3 py-2">
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td
                  colSpan={Math.max(1, colunas.length)}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  Carregando...
                </td>
              </tr>
            )}
            {!isLoading && queryError && (
              <tr>
                <td
                  colSpan={Math.max(1, colunas.length)}
                  className="px-3 py-8 text-center text-destructive"
                >
                  Erro ao buscar dados:{" "}
                  {queryError instanceof Error ? queryError.message : String(queryError)}
                </td>
              </tr>
            )}
            {!isLoading && !queryError && !lista.length && (
              <tr>
                <td
                  colSpan={Math.max(1, colunas.length)}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  Nenhum profissional para os filtros selecionados.

                </td>
              </tr>
            )}
            {lista.slice(0, 50).map((r) => (
              <tr key={r.id} className="border-t">
                {colunas.map((c) => (
                  <td key={c.header} className="px-3 py-1.5">
                    {c.value(r) ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
