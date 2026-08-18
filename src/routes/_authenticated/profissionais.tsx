import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, type SubmitHandler, useWatch, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import {
  FOTO_BUCKET,
  montarCaminhoFoto,
  useFotoAssinada,
  validarFoto,
} from "@/lib/foto-profissional";
import { reprocessarRegistroConsolidado } from "@/lib/piso-consolidacao.functions";
import { OfflineButton } from "@/components/shared/OfflineButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/shared";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { statusOptions } from "@/lib/status";
import { formatCPF } from "@/lib/formatters";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATEGORIAS_PISO,
  CATEGORIA_LABEL,
  normalizarCategoriaPiso,
  type CategoriaPiso,
} from "@/lib/piso-categorias";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  History,
  Users,
  Building2,
  Briefcase,
  UserCheck,
  LayoutGrid,
  List as ListIcon,
  User as UserIcon,
  Camera,
  Loader2,
  MapPin,
  Download,
  FileText,
} from "lucide-react";

import { usePermissions, useCurrentUser } from "@/hooks/use-permissions";
import { ImportProfissionaisDialog } from "@/components/profissionais/import-dialog";
import { ImportSalariosPdfDialog } from "@/components/profissionais/import-salarios-ia-dialog";

import {
  PageHeader,
  KpiCard,
  FilterBar,
  MultiSelect,
  DataTable,
  type DataTableColumn,
} from "@/components/shared";
import { Pagination } from "@/components/shared/Pagination";
import type { Database } from "@/integrations/supabase/types";
import {
  useUnidadesLookup,
  useSetoresLookup,
  useCargosLookup,
  useFuncoesLookup,
  useVinculosLookup,
} from "@/hooks/use-lookups";
import { profissionalSchema, type ProfissionalFormValues } from "@/lib/schemas/profissional.schema";
import { saveProfissionalComplete } from "@/lib/profissionais.functions";
import { useProfessionalRealtime } from "@/lib/realtime/professional-realtime";

import * as XLSX from "xlsx";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/profissionais")({
  errorComponent: ErrorComponent,
  component: ProfissionaisPage,
});

type StatusProf = Database["public"]["Enums"]["status_profissional"];
type NaturezaVinculo = Database["public"]["Enums"]["natureza_vinculo"];
type SituacaoFuncional = Database["public"]["Enums"]["situacao_funcional"];

type Profissional = Database["public"]["Tables"]["profissionais"]["Row"] & {
  unidade: Database["public"]["Tables"]["unidades"]["Row"] | null;
  cargo: Database["public"]["Tables"]["cargos"]["Row"] | null;
  vinculo: Database["public"]["Tables"]["vinculos"]["Row"] | null;
};

const EMPTY_VALUES: ProfissionalFormValues = {
  id: "",

  nome_completo: "",
  nome_social: "",
  cpf: "",
  matricula: "",
  email: "",
  telefone: "",
  data_nascimento: "",
  sexo: "",
  data_admissao: "",
  carga_horaria_semanal: "",
  status: "ativo",
  observacoes: "",
  secretaria_id: "",
  unidade_id: "",
  setor_id: "",
  cargo_id: "",
  funcao_id: "",
  vinculo_id: "",
  cep: "",
  logradouro: "",
  numero: "",
  bairro: "",
  cidade: "",
  uf: "",
  banco: "",
  agencia: "",
  conta_corrente: "",
  proj: "",
  h_p: "",
  c_h: "",
  jorn: "",
  conselho_classe: "",
  conselho_numero: "",
  conselho_uf: "",
  conselho_validade: "",
  gestor_imediato_id: "",
  situacao_funcional: "",
  situacao_data_inicio: "",
  situacao_data_fim: "",
  foto_url: "",
  salario_base: "",
  salario_liquido: "",
  horas_extras: "",
  adicional_noturno: "",
  salario_bruto: "",
  gratificacao_incentivo: "",
  vencimento_liquido: "",
};

const SITUACAO_FUNCIONAL_LABEL: Record<string, string> = {
  ativo: "Ativo",
  ferias: "Férias",
  atestado: "Atestado",
  licenca: "Licença",
  licenca_premio: "Licença Prêmio",
  licenca_maternidade: "Licença Maternidade",
  licenca_saude: "Licença Saúde",
  licenca_luto: "Licença Luto",
  licenca_sem_vencimento: "Licença sem Vencimento",
  licenca_estudo: "Licença Estudo",
  vacancia: "Vacância",
  afastamento_inss: "Afastamento por INSS",
  falta_pad: "Falta informada ao RH (PAD)",
  cedido: "Cedido",
  afastado: "Afastado",
  desligado: "Desligado",
};

const SITUACOES_COM_PERIODO = new Set<string>([
  "ferias",
  "atestado",
  "licenca",
  "licenca_premio",
  "licenca_maternidade",
  "licenca_saude",
  "licenca_luto",
  "licenca_sem_vencimento",
  "licenca_estudo",
  "afastado",
  "afastamento_inss",
  "cedido",
]);

const exigePeriodo = (situacao?: string | null) =>
  !!situacao && SITUACOES_COM_PERIODO.has(situacao);

const UF_LIST = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

function getVinculoLabel(
  vinculo?: { nome: string | null; natureza: NaturezaVinculo | null } | null,
) {
  if (!vinculo) return "-";
  return vinculo.natureza === "efetivo" ? "Efetivo" : vinculo.nome || "-";
}

function ProfissionaisPage() {
  const qc = useQueryClient();
  useProfessionalRealtime();
  const { has: hasPermission } = usePermissions();
  const { data: me } = useCurrentUser();
  const askConfirm = useConfirm();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [openImportSalarios, setOpenImportSalarios] = useState(false);


  const formMethods = useForm<any>({
    resolver: zodResolver(profissionalSchema),
    defaultValues: EMPTY_VALUES,
  });

  const { reset } = formMethods;

  // Filtros de listagem (múltipla escolha)
  const [fUnidade, setFUnidade] = useState<string[]>([]);
  const [fVinculo, setFVinculo] = useState<string[]>([]);
  const [fStatus, setFStatus] = useState<string[]>([]);
  const [fCargo, setFCargo] = useState<string[]>([]);
  const [fFuncao, setFFuncao] = useState<string[]>([]);
  const [fSetor, setFSetor] = useState<string[]>([]);
  const [fNome, setFNome] = useState<string>("");
  const [fCpf, setFCpf] = useState<string>("");
  const [fMatricula, setFMatricula] = useState<string>("");
  const [fGestor, setFGestor] = useState<"todos" | "sim" | "nao">("todos");
  const [fCategorias, setFCategorias] = useState<CategoriaPiso[]>([]);

  const filtrosAtivos =
    (fNome.trim() ? 1 : 0) +
    (fCpf.trim() ? 1 : 0) +
    (fMatricula.trim() ? 1 : 0) +
    fUnidade.length +
    fVinculo.length +
    fStatus.length +
    fCargo.length +
    fFuncao.length +
    fSetor.length +
    fCategorias.length +
    (fGestor !== "todos" ? 1 : 0);

  const limparFiltros = () => {
    setFNome("");
    setFCpf("");
    setFMatricula("");
    setFUnidade([]);
    setFVinculo([]);
    setFStatus([]);
    setFCargo([]);
    setFFuncao([]);
    setFSetor([]);
    setFCategorias([]);
    setFGestor("todos");
  };

  // Ordenação e visualização
  type SortKey =
    | "nome_asc"
    | "nome_desc"
    | "matricula_asc"
    | "matricula_desc"
    | "unidade_asc"
    | "admissao_desc"
    | "admissao_asc";
  const [sortBy, setSortBy] = useState<SortKey>("nome_asc");
  const [viewMode, setViewMode] = useState<"tabela" | "cards">("tabela");

  // Debounce da busca global (300ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Paginação server-side
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  // Volta para a primeira página sempre que qualquer filtro mudar
  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    fUnidade,
    fVinculo,
    fStatus,
    fCargo,
    fFuncao,
    fSetor,
    fNome,
    fCpf,
    fMatricula,
    fGestor,
    fCategorias,
    sortBy,
    pageSize,
  ]);

  const canCreate = hasPermission("profissional.criar");
  const canEdit = hasPermission("profissional.editar");
  const canDelete = hasPermission("profissional.excluir");

  // Ids de profissionais que aparecem como gestor imediato de alguém.
  // Usado apenas quando o filtro "Gestor" está ativo (Sim/Não).
  const { data: gestorIds } = useQuery({
    queryKey: ["profissionais", "gestor-ids"],
    enabled: fGestor !== "todos",
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("gestor_imediato_id")
        .is("deleted_at", null)
        .not("gestor_imediato_id", "is", null)
        .limit(5000);
      if (error) throw error;
      const set = new Set<string>();
      for (const r of (data ?? []) as Array<{ gestor_imediato_id: string | null }>) {
        if (r.gestor_imediato_id) set.add(r.gestor_imediato_id);
      }
      return Array.from(set);
    },
  });

  // Cargos/funções que correspondem às categorias selecionadas (Enfermeiro,
  // Técnico e Auxiliar de Enfermagem). Multiselect: união das categorias.
  const { data: cargosLookup } = useCargosLookup();
  const { data: funcoesLookup } = useFuncoesLookup();
  const categoriaIds = useMemo(() => {
    if (fCategorias.length === 0) return null;
    const sel = new Set(fCategorias);
    const match = (nome: string | null | undefined) => {
      const c = normalizarCategoriaPiso(nome);
      return !!c && sel.has(c);
    };
    return {
      cargos: (cargosLookup ?? []).filter((c) => match(c.nome)).map((c) => c.id),
      funcoes: (funcoesLookup ?? []).filter((f) => match(f.nome)).map((f) => f.id),
    };
  }, [fCategorias, cargosLookup, funcoesLookup]);

  const {
    data: profissionaisPage,
    isLoading,
    isFetching,
    error: profissionaisPageError,
  } = useQuery({
    queryKey: [
      "profissionais",
      debouncedSearch,
      fUnidade,
      fVinculo,
      fStatus,
      fCargo,
      fFuncao,
      fSetor,
      fNome,
      fCpf,
      fMatricula,
      fGestor,
      fCategorias.join(","),
      categoriaIds ? `${categoriaIds.cargos.length}-${categoriaIds.funcoes.length}` : "",
      sortBy,
      fGestor !== "todos" ? (gestorIds?.length ?? 0) : 0,
      page,
      pageSize,
      me?.unidades, // Adicionado para reagir a mudanças no contexto de unidades
    ],
    placeholderData: keepPreviousData,
    enabled:
      (fGestor === "todos" || !!gestorIds) &&
      (fCategorias.length === 0 || (!!cargosLookup && !!funcoesLookup)),
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let q = supabase
        .from("profissionais")
        .select(
          `
          *,
          unidade:unidade_id(nome, sigla),
          cargo:cargo_id(nome),
          vinculo:vinculo_id(nome, natureza)
          `,
          { count: "exact" },
        )
        .is("deleted_at", null);
      // Ordenação
      switch (sortBy) {
        case "nome_desc":
          q = q.order("nome_completo", { ascending: false });
          break;
        case "matricula_asc":
          q = q.order("matricula", { ascending: true, nullsFirst: false });
          break;
        case "matricula_desc":
          q = q.order("matricula", { ascending: false, nullsFirst: false });
          break;
        case "unidade_asc":
          q = q.order("nome", { referencedTable: "unidades", ascending: true });
          break;
        case "admissao_desc":
          q = q.order("data_admissao", { ascending: false, nullsFirst: false });
          break;
        case "admissao_asc":
          q = q.order("data_admissao", { ascending: true, nullsFirst: false });
          break;
        case "nome_asc":
        default:
          q = q.order("nome_completo", { ascending: true });
      }
      if (debouncedSearch) {
        const s = `%${debouncedSearch}%`;
        q = q.or(`nome_completo.ilike.${s},cpf.ilike.${s},matricula.ilike.${s}`);
      }
      if (fNome.trim()) q = q.ilike("nome_completo", `%${fNome.trim()}%`);
      if (fCpf.trim()) q = q.ilike("cpf", `%${fCpf.replace(/\D/g, "")}%`);
      if (fMatricula.trim()) q = q.ilike("matricula", `%${fMatricula.trim()}%`);
      if (fUnidade.length) q = q.in("unidade_id", fUnidade);
      if (fVinculo.length) q = q.in("vinculo_id", fVinculo);
      if (fStatus.length) q = q.in("status", fStatus as StatusProf[]);
      if (fCargo.length) q = q.in("cargo_id", fCargo);
      if (fFuncao.length) q = q.in("funcao_id", fFuncao);
      if (fSetor.length) q = q.in("setor_id", fSetor);
      if (categoriaIds) {
        const ors: string[] = [];
        if (categoriaIds.cargos.length) ors.push(`cargo_id.in.(${categoriaIds.cargos.join(",")})`);
        if (categoriaIds.funcoes.length)
          ors.push(`funcao_id.in.(${categoriaIds.funcoes.join(",")})`);
        if (ors.length === 0) return { rows: [], count: 0 };
        q = q.or(ors.join(","));
      }
      if (fGestor === "sim") {
        const ids = gestorIds ?? [];
        if (ids.length === 0) return { rows: [], count: 0 };
        q = q.in("id", ids);
      } else if (fGestor === "nao") {
        const ids = gestorIds ?? [];
        if (ids.length > 0) {
          q = q.not("id", "in", `(${ids.join(",")})`);
        }
      }
      const { data, count, error } = await q.range(from, to);
      if (error) throw error;
      return {
        rows: (data ?? []) as unknown as Profissional[],
        count: count ?? 0,
      };
    },
  });
  const profissionais = profissionaisPage?.rows;
  const profissionaisTotal = profissionaisPage?.count ?? 0;
  const profissionaisExibidos = profissionais?.length ?? 0;

  const { data: secretarias } = useQuery({
    queryKey: ["secretarias-select"],
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
    queryKey: ["unidades-select", formMethods.watch("secretaria_id")],
    queryFn: async () => {
      let q = supabase
        .from("unidades")
        .select("id,nome,sigla,secretaria_id")
        .is("deleted_at", null)
        .eq("status", "ativa")
        .order("nome");
      if (formMethods.watch("secretaria_id")) q = q.eq("secretaria_id", formMethods.watch("secretaria_id"));
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  // Opções para os filtros de listagem — hooks compartilhados (use-lookups)
  const { data: unidadesFiltro } = useUnidadesLookup({ 
    unidadesPermitidas: me?.acesso_todas_unidades ? undefined : me?.unidades 
  });
  const cargosFiltro = cargosLookup;
  const funcoesFiltro = funcoesLookup;
  const { data: vinculosFiltro } = useVinculosLookup();
  const { data: setoresTodos } = useSetoresLookup();
  // Setores disponíveis: restritos às unidades selecionadas (se houver).
  const setoresFiltro = useMemo(() => {
    const all = setoresTodos ?? [];
    if (fUnidade.length === 0) return all;
    const set = new Set(fUnidade);
    return all.filter((s) => !!s.unidade_id && set.has(s.unidade_id));
  }, [setoresTodos, fUnidade]);

  // Ao mudar as unidades, remove setores que não pertencem mais à seleção.
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      let q = supabase
        .from("profissionais")
        .select(`
          *,
          unidade:unidade_id(nome, sigla),
          cargo:cargo_id(nome),
          vinculo:vinculo_id(nome, natureza),
          setor:setor_id(nome),
          funcao:funcao_id(nome)
        `)
        .is("deleted_at", null);

      if (debouncedSearch) {
        const s = `%${debouncedSearch}%`;
        q = q.or(`nome_completo.ilike.${s},cpf.ilike.${s},matricula.ilike.${s}`);
      }
      if (fNome.trim()) q = q.ilike("nome_completo", `%${fNome.trim()}%`);
      if (fCpf.trim()) q = q.ilike("cpf", `%${fCpf.replace(/\D/g, "")}%`);
      if (fMatricula.trim()) q = q.ilike("matricula", `%${fMatricula.trim()}%`);
      if (fUnidade.length) q = q.in("unidade_id", fUnidade);
      if (fVinculo.length) q = q.in("vinculo_id", fVinculo);
      if (fStatus.length) q = q.in("status", fStatus as StatusProf[]);
      if (fCargo.length) q = q.in("cargo_id", fCargo);
      if (fFuncao.length) q = q.in("funcao_id", fFuncao);
      if (fSetor.length) q = q.in("setor_id", fSetor);
      
      if (categoriaIds) {
        const ors: string[] = [];
        if (categoriaIds.cargos.length) ors.push(`cargo_id.in.(${categoriaIds.cargos.join(",")})`);
        if (categoriaIds.funcoes.length) ors.push(`funcao_id.in.(${categoriaIds.funcoes.join(",")})`);
        if (ors.length > 0) q = q.or(ors.join(","));
      }

      if (fGestor === "sim" && gestorIds?.length) {
        q = q.in("id", gestorIds);
      } else if (fGestor === "nao" && gestorIds?.length) {
        q = q.not("id", "in", `(${gestorIds.join(",")})`);
      }

      const { data, error } = await q
        .order("nome_completo", { ascending: true })
        .limit(5000);

      if (error) throw error;
      if (!data || data.length === 0) {
        toast.info("Nenhum profissional encontrado para exportação.");
        return;
      }

      const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "";
        try {
          return format(new Date(dateStr), "dd/MM/yyyy");
        } catch {
          return dateStr;
        }
      };

      const exportData = data.map(r => ({
        nome_completo: r.nome_completo || "",
        cpf: r.cpf || "",
        matricula: r.matricula || "",
        email: r.email || "",
        telefone: r.telefone || "",
        data_nascimento: formatDate(r.data_nascimento),
        sexo: r.sexo || "",
        data_admissao: formatDate(r.data_admissao),
        carga_semanal_horas: r.carga_horaria_semanal || "",
        status: r.status || "",
        unidade: r.unidade?.nome || "",
        setor: r.setor?.nome || "",
        cargo: r.cargo?.nome || "",
        funcao: r.funcao?.nome || "",
        vinculo: getVinculoLabel(r.vinculo),
        banco: (r as any).banco || "",
        agencia: (r as any).agencia || "",
        conta: (r as any).conta_corrente || "",
        proj: (r as any).proj || "",
        h_p: (r as any).h_p || "",
        c_h: (r as any).c_h || "",
        jorn: (r as any).jorn || "",
        observacoes: r.observacoes || ""
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Profissionais");

      const fileName = `profissionais_oriximina_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
      toast.success(`${data.length} profissionais exportados com sucesso.`);
    } catch (error: any) {
      console.error("Erro ao exportar:", error);
      toast.error("Erro ao gerar arquivo de exportação: " + (error.message || "Falha na requisição"));
    } finally {
      setIsExporting(false);
    }
  };
  const changeUnidadeFiltro = (v: string[]) => {
    setFUnidade(v);
    setFSetor((prev) => {
      if (prev.length === 0 || v.length === 0) return prev;
      const set = new Set(v);
      const validos = new Set(
        (setoresTodos ?? [])
          .filter((s) => !!s.unidade_id && set.has(s.unidade_id))
          .map((s) => s.id),
      );
      return prev.filter((id) => validos.has(id));
    });
  };

  const { data: cargos } = useQuery({
    queryKey: ["cargos-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargos")
        .select("id,nome")
        .is("deleted_at", null)
        .eq("status", "ativa")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const { data: funcoes } = useQuery({
    queryKey: ["funcoes-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcoes")
        .select("id,nome")
        .is("deleted_at", null)
        .eq("status", "ativa")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const { data: vinculos } = useQuery({
    queryKey: ["vinculos-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vinculos")
        .select("id,nome,natureza")
        .is("deleted_at", null)
        .eq("status", "ativa")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const { data: setores } = useQuery({
    queryKey: ["setores-select", formMethods.watch("unidade_id")],
    queryFn: async () => {
      if (!formMethods.watch("unidade_id")) return [];
      const { data, error } = await supabase
        .from("setores")
        .select("id,nome,unidade_id")
        .is("deleted_at", null)
        .eq("unidade_id", formMethods.watch("unidade_id")!)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!formMethods.watch("unidade_id"),
  });

  const { data: gestoresOpt } = useQuery({
    queryKey: ["profissionais-gestor-opt"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("id,nome_completo,matricula")
        .is("deleted_at", null)
        .eq("status", "ativo")
        .order("nome_completo")
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (values: ProfissionalFormValues) => {
      console.log("Enviando payload para RPC:", values);
      try {
        const result = await saveProfissionalComplete({ data: values });
        return result;
      } catch (error) {
        console.error("Falha ao salvar:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success(formMethods.getValues("id") ? "Profissional atualizado" : "Profissional criado");
      setOpen(false);
      reset(EMPTY_VALUES);
      qc.invalidateQueries({ queryKey: ["profissionais"] });
    },
    onError: (e: any) => {
      const message = e?.message || "Erro desconhecido ao salvar";
      toast.error(message);
    },
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (
        supabase.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ error: { message: string } | null }>
      )("arquivar_profissional", { _id: id });
      if (error) throw error;
    },

    onSuccess: () => {
      toast.success("Profissional arquivado");
      qc.invalidateQueries({ queryKey: ["profissionais"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    reset({ ...EMPTY_VALUES, secretaria_id: me?.secretaria_id ?? "" });
    setOpen(true);
  };

  const openEdit = (p: Profissional) => {
    reset({
      id: p.id,
      nome_completo: p.nome_completo,
      nome_social: p.nome_social ?? "",
      cpf: p.cpf ?? "",
      matricula: p.matricula ?? "",
      email: p.email ?? "",
      telefone: p.telefone ?? "",
      data_nascimento: p.data_nascimento ?? "",
      sexo: p.sexo ?? "",
      data_admissao: p.data_admissao ?? "",
      carga_horaria_semanal: p.carga_horaria_semanal?.toString() ?? "",
      status: p.status,
      observacoes: p.observacoes ?? "",
      secretaria_id: p.secretaria_id,
      unidade_id: p.unidade_id ?? "",
      setor_id: p.setor_id ?? "",
      cargo_id: p.cargo_id ?? "",
      funcao_id: p.funcao_id ?? "",
      vinculo_id: p.vinculo_id ?? "",
      banco: (p as any).banco ?? "",
      agencia: (p as any).agencia ?? "",
      conta_corrente: (p as any).conta_corrente ?? "",
      proj: (p as any).proj?.toString() ?? "",
      h_p: (p as any).h_p?.toString() ?? "",
      c_h: (p as any).c_h?.toString() ?? "",
      jorn: (p as any).jorn?.toString() ?? "",
      conselho_classe: (p as any).conselho_classe ?? "",
      conselho_numero: (p as any).conselho_numero ?? "",
      conselho_uf: (p as any).conselho_uf ?? "",
      conselho_validade: (p as any).conselho_validade ?? "",
      gestor_imediato_id: (p as any).gestor_imediato_id ?? "",
      situacao_funcional: (p as any).situacao_funcional ?? "",
      situacao_data_inicio: (p as any).situacao_data_inicio ?? "",
      situacao_data_fim: (p as any).situacao_data_fim ?? "",
      foto_url: p.foto_url ?? "",
      cep: (p as any).cep ?? "",
      logradouro: (p as any).logradouro ?? "",
      numero: (p as any).numero ?? "",
      bairro: (p as any).bairro ?? "",
      cidade: (p as any).cidade ?? "",
      uf: (p as any).uf ?? "",
      salario_base: (p as any).salario_base?.toString() ?? "",
      salario_liquido: (p as any).salario_liquido?.toString() ?? "",
      horas_extras: (p as any).horas_extras?.toString() ?? "",
      adicional_noturno: (p as any).adicional_noturno?.toString() ?? "",
      salario_bruto: (p as any).salario_bruto?.toString() ?? "",
      gratificacao_incentivo: (p as any).gratificacao_incentivo?.toString() ?? "",
      vencimento_liquido: (p as any).vencimento_liquido?.toString() ?? "",
    });

    setOpen(true);
  };

  // KPIs agregados no servidor (count exact) — independentes do limit(500) da
  // listagem. Segue o padrão do useAnalytics (HEAD + count=exact), aplicando os
  // filtros ativos da página. Cada KPI é uma query separada para revalidação
  // independente.
  const applyProfFilters = <
    T extends {
      in: (col: string, vals: readonly string[]) => T;
      or: (expr: string) => T;
      not: (col: string, op: string, val: string) => T;
    },
  >(
    q: T,
  ): T => {
    let out = q;
    if (search.trim()) {
      const s = `%${search.trim()}%`;
      out = out.or(`nome_completo.ilike.${s},cpf.ilike.${s},matricula.ilike.${s}`);
    }
    if (fUnidade.length) out = out.in("unidade_id", fUnidade);
    if (fVinculo.length) out = out.in("vinculo_id", fVinculo);
    if (fCargo.length) out = out.in("cargo_id", fCargo);
    if (fFuncao.length) out = out.in("funcao_id", fFuncao);
    if (fSetor.length) out = out.in("setor_id", fSetor);

    if (categoriaIds) {
      const ors: string[] = [];
      if (categoriaIds.cargos.length) ors.push(`cargo_id.in.(${categoriaIds.cargos.join(",")})`);
      if (categoriaIds.funcoes.length)
        ors.push(`funcao_id.in.(${categoriaIds.funcoes.join(",")})`);
      if (ors.length > 0) {
        out = out.or(ors.join(","));
      }
    }

    if (fGestor === "sim") {
      const ids = gestorIds ?? [];
      if (ids.length > 0) out = out.in("id", ids);
    } else if (fGestor === "nao") {
      const ids = gestorIds ?? [];
      if (ids.length > 0) out = out.not("id", "in", `(${ids.join(",")})`);
    }

    return out;
  };

  const kpiFiltersKey = [
    search,
    fUnidade.join(","),
    fVinculo.join(","),
    fCargo.join(","),
    fFuncao.join(","),
    fSetor.join(","),
    fCategorias.join(","),
    fGestor,
  ];

  const kpiTotal = useQuery({
    queryKey: ["profissionais-kpi", "total", ...kpiFiltersKey, fStatus.join(",")],
    queryFn: async () => {
      let q = supabase
        .from("profissionais")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null);
      q = applyProfFilters(q);
      if (fStatus.length) q = q.in("status", fStatus as StatusProf[]);

      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });

  const kpiAtivos = useQuery({
    queryKey: ["profissionais-kpi", "ativos", ...kpiFiltersKey],
    queryFn: async () => {
      let q = supabase
        .from("profissionais")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("status", "ativo");
      q = applyProfFilters(q);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });

  const kpiEfetivos = useQuery({
    queryKey: ["profissionais-kpi", "efetivos", ...kpiFiltersKey, fStatus.join(",")],
    queryFn: async () => {
      let q = supabase
        .from("profissionais")
        .select("id, vinculos!inner(natureza)", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("vinculos.natureza", "efetivo");
      q = applyProfFilters(q);
      if (fStatus.length) q = q.in("status", fStatus as StatusProf[]);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });

  const kpiUnidadesAtivas = useQuery({
    queryKey: ["profissionais-kpi", "unidades-ativas"],
    staleTime: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("unidades")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("status", "ativa");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const columns: DataTableColumn<Profissional>[] = [
    {
      key: "nome",
      header: "Nome",
      cell: (p) => (
        <div>
          <div className="font-medium">{p.nome_completo}</div>
          {p.nome_social && <div className="text-xs text-muted-foreground">{p.nome_social}</div>}
        </div>
      ),
    },
    {
      key: "cpf",
      header: "CPF",
      cell: (p) => <span className="font-mono text-xs">{formatCPF(p.cpf)}</span>,
    },
    { key: "matricula", header: "Matrícula", cell: (p) => p.matricula ?? "-" },
    { key: "cargo", header: "Cargo", cell: (p) => p.cargo?.nome ?? "-" },
    { key: "vinculo", header: "Vínculo", cell: (p) => getVinculoLabel(p.vinculo) },
    {
      key: "unidade",
      header: "Unidade",
      cell: (p) => (p.unidade ? (p.unidade.sigla ?? p.unidade.nome) : "-"),
    },
    {
      key: "status",
      header: "Situação",
      cell: (p) => {
        // Prioriza a "Situação funcional" (Férias / Licença / Afastado / Cedido /
        // Desligado / Inativo) definida no cadastro; cai para o status geral.
        const situ =
          (p as unknown as { situacao_funcional?: string | null }).situacao_funcional || p.status;
        return <StatusBadge domain="profissional" value={situ} />;
      },
    },
    {
      key: "acoes",
      header: "Ações",
      headerClassName: "text-right",
      className: "text-right",
      cell: (p) => (
        <div className="inline-flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            asChild
            title="Histórico funcional"
            aria-label="Histórico funcional"
          >
            <Link to="/profissionais/$id" params={{ id: p.id }}>
              <History className="h-4 w-4" />
            </Link>
          </Button>
          {canEdit && (
            <OfflineButton
              size="icon"
              variant="ghost"
              onClick={() => openEdit(p)}
              title="Editar"
              aria-label="Editar profissional"
              requireOnline
            >
              <Pencil className="h-4 w-4" />
            </OfflineButton>
          )}
          {canDelete && (
            <OfflineButton
              size="icon"
              variant="ghost"
              onClick={() => {
                void (async () => {
                  const ok = await askConfirm({
                    title: `Arquivar ${p.nome_completo}?`,
                    description: "O profissional deixará de aparecer nas listagens ativas.",
                    confirmLabel: "Arquivar",
                    tone: "destructive",
                  });
                  if (ok) archive.mutate(p.id);
                })();
              }}
              title="Arquivar"
              aria-label="Arquivar profissional"
              requireOnline
            >
              <Trash2 className="h-4 w-4" />
            </OfflineButton>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">

      <PageHeader
        title="Profissionais"
        description="Cadastro dos profissionais da rede municipal de saúde."
        actions={
          canCreate ? (
            <>
                <ImportProfissionaisDialog />
                {hasPermission("profissional.dados_salariais") && (
                  <>
                    <Button variant="outline" onClick={() => setOpenImportSalarios(true)}>
                      <FileText className="mr-2 h-4 w-4" />
                      Importar Salários PDF
                    </Button>
                    <ImportSalariosPdfDialog open={openImportSalarios} onOpenChange={setOpenImportSalarios} />
                  </>
                )}
                <Button variant="outline" onClick={handleExport} disabled={isExporting}>

                 {isExporting ? (
                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                 ) : (
                   <Download className="mr-2 h-4 w-4" />
                 )}
                 Exportar
               </Button>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openNew}>
                    <Plus className="mr-2 h-4 w-4" /> Novo profissional
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {formMethods.getValues("id") ? "Editar profissional" : "Novo profissional"}
                    </DialogTitle>
                  </DialogHeader>
                  <Form {...formMethods}>
                    <form
                      onSubmit={formMethods.handleSubmit((values: any) => upsert.mutate(values))}
                      className="space-y-4"
                    >
                      <ProfissionalFormBody
                        secretarias={secretarias}
                        unidades={unidades}
                        setores={setores}
                        cargos={cargos}
                        funcoes={funcoes}
                        vinculos={vinculos}
                        gestoresOpt={gestoresOpt}
                        canEditAgili={hasPermission("profissional.editar_dados_agili")}
                        canSeeBanco={hasPermission("profissional.dados_bancarios")}
                        canSeeSalario={hasPermission("profissional.dados_salariais") || me?.is_master === true}

                      />
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={upsert.isPending}>
                          {upsert.isPending ? "Salvando..." : "Salvar"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Total (após filtros)"
          value={kpiTotal.data ?? 0}
          hint="Contagem real no servidor"
          loading={kpiTotal.isLoading}
          icon={<Users className="h-4 w-4" />}
        />
        <KpiCard
          label="Ativos"
          value={kpiAtivos.data ?? 0}
          hint="Status = ativo (ignora filtro de status)"
          loading={kpiAtivos.isLoading}
          icon={<UserCheck className="h-4 w-4" />}
        />
        <KpiCard
          label="Efetivos"
          value={kpiEfetivos.data ?? 0}
          hint="Vínculo de natureza efetiva"
          loading={kpiEfetivos.isLoading}
          icon={<Briefcase className="h-4 w-4" />}
        />
        <KpiCard
          label="Unidades no sistema"
          value={kpiUnidadesAtivas.data ?? 0}
          hint="Não muda com os filtros da página"
          loading={kpiUnidadesAtivas.isLoading}
          icon={<Building2 className="h-4 w-4" />}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Pesquisar por nome, CPF ou matrícula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nome_asc">Nome (A-Z)</SelectItem>
              <SelectItem value="nome_desc">Nome (Z-A)</SelectItem>
              <SelectItem value="matricula_asc">Matrícula (crescente)</SelectItem>
              <SelectItem value="matricula_desc">Matrícula (decrescente)</SelectItem>
              <SelectItem value="unidade_asc">Unidade (A-Z)</SelectItem>
              <SelectItem value="admissao_desc">Admissão (mais recente)</SelectItem>
              <SelectItem value="admissao_asc">Admissão (mais antiga)</SelectItem>
            </SelectContent>
          </Select>
          <div className="inline-flex rounded-md border p-0.5">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "tabela" ? "secondary" : "ghost"}
              onClick={() => setViewMode("tabela")}
              title="Modo tabela"
              aria-pressed={viewMode === "tabela"}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "cards" ? "secondary" : "ghost"}
              onClick={() => setViewMode("cards")}
              title="Modo cards"
              aria-pressed={viewMode === "cards"}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <FilterBar
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={limparFiltros}
            disabled={filtrosAtivos === 0}
          >
            Limpar filtros{filtrosAtivos > 0 ? ` (${filtrosAtivos})` : ""}
          </Button>
        }
      >
        <FilterBar.Field label="Nome">
          <Input value={fNome} onChange={(e) => setFNome(e.target.value)} placeholder="Contém..." />
        </FilterBar.Field>
        <FilterBar.Field label="CPF">
          <Input
            value={fCpf}
            onChange={(e) => setFCpf(e.target.value)}
            placeholder="Somente dígitos"
          />
        </FilterBar.Field>
        <FilterBar.Field label="Matrícula">
          <Input
            value={fMatricula}
            onChange={(e) => setFMatricula(e.target.value)}
            placeholder="Contém..."
          />
        </FilterBar.Field>
        <FilterBar.Field label="Unidade">
          <MultiSelect
            value={fUnidade}
            onChange={changeUnidadeFiltro}
            placeholder="Todas"
            searchPlaceholder="Buscar unidade..."
            options={(unidadesFiltro ?? []).map((u) => ({
              value: u.id,
              label: `${u.sigla ? `${u.sigla} — ` : ""}${u.nome}`,
              hint: u.sigla,
            }))}
          />
        </FilterBar.Field>
        <FilterBar.Field label="Vínculo">
          <MultiSelect
            value={fVinculo}
            onChange={setFVinculo}
            placeholder="Todos"
            searchPlaceholder="Buscar vínculo..."
            options={(vinculosFiltro ?? []).map((v) => ({ value: v.id, label: v.nome }))}
          />
        </FilterBar.Field>
        <FilterBar.Field label="Status">
          <MultiSelect
            value={fStatus}
            onChange={setFStatus}
            placeholder="Todos"
            searchPlaceholder="Buscar status..."
            options={statusOptions("profissional").map((s) => ({
              value: s.value,
              label: s.label,
            }))}
          />
        </FilterBar.Field>
        <FilterBar.Field label="Cargo">
          <MultiSelect
            value={fCargo}
            onChange={setFCargo}
            placeholder="Todos"
            searchPlaceholder="Buscar cargo..."
            options={(cargosFiltro ?? []).map((c) => ({ value: c.id, label: c.nome }))}
          />
        </FilterBar.Field>
        <FilterBar.Field label="Função">
          <MultiSelect
            value={fFuncao}
            onChange={setFFuncao}
            placeholder="Todas"
            searchPlaceholder="Buscar função..."
            options={(funcoesFiltro ?? []).map((f) => ({ value: f.id, label: f.nome }))}
          />
        </FilterBar.Field>
        <FilterBar.Field label="Categoria">
          <MultiSelect
            value={fCategorias}
            onChange={(v) => setFCategorias(v as CategoriaPiso[])}
            placeholder="Todas"
            searchPlaceholder="Buscar categoria..."
            options={CATEGORIAS_PISO.map((c) => ({ value: c, label: CATEGORIA_LABEL[c] }))}
          />
        </FilterBar.Field>
        <FilterBar.Field label="Setor">
          <MultiSelect
            value={fSetor}
            onChange={setFSetor}
            placeholder={fUnidade.length === 0 ? "Todos" : "Todos da(s) unidade(s)"}
            searchPlaceholder="Buscar setor..."
            emptyText="Nenhum setor para a seleção"
            options={setoresFiltro.map((s) => ({ value: s.id, label: s.nome }))}
          />
        </FilterBar.Field>

        <FilterBar.Field label="Gestor">
          <Select value={fGestor} onValueChange={(v) => setFGestor(v as typeof fGestor)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="sim">Sim</SelectItem>
              <SelectItem value="nao">Não</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar.Field>
      </FilterBar>

      <div className="text-sm text-muted-foreground">
        Exibindo{" "}
        <span className="font-medium text-foreground">
          {profissionaisExibidos.toLocaleString("pt-BR")}
        </span>{" "}
        de{" "}
        <span className="font-medium text-foreground">
          {profissionaisTotal.toLocaleString("pt-BR")}
        </span>{" "}
        profissionais
      </div>

      {viewMode === "tabela" ? (
        <DataTable<Profissional>
          columns={columns}
          rows={profissionais ?? []}
          getRowKey={(p) => p.id}
          loading={isLoading}
          emptyTitle="Nenhum profissional encontrado"
          emptyDescription="Ajuste os filtros ou cadastre um novo profissional."
        />
      ) : (
        <ProfissionalCards rows={profissionais ?? []} loading={isLoading} />
      )}
      <Pagination
        page={page}
        pageSize={pageSize}
        total={profissionaisTotal}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        disabled={isFetching}
      />
    </div>
  );
}

function initials(nome: string) {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (a + b).toUpperCase();
}

function ProfissionalCards({ rows, loading }: { rows: Profissional[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-md border bg-muted/30" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
        Nenhum profissional encontrado.
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((p) => (
        <Link
          key={p.id}
          to="/profissionais/$id"
          params={{ id: p.id }}
          className="group flex items-start gap-3 rounded-md border p-3 transition-colors hover:bg-accent"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {initials(p.nome_completo)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-medium">{p.nome_completo}</div>
                <div className="truncate text-xs text-muted-foreground">{p.cargo?.nome ?? "—"}</div>
              </div>
              <StatusBadge domain="profissional" value={p.status} />
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {p.unidade ? (p.unidade.sigla ?? p.unidade.nome) : "Sem unidade"}
              {p.matricula ? ` · mat. ${p.matricula}` : ""}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProfissionalFormBody — formulário de criação/edição em abas
// ---------------------------------------------------------------------------
type LookupItem = { id: string; nome: string; sigla?: string | null };
type VinculoLookup = { id: string; nome: string; natureza: NaturezaVinculo | null };
type GestorOpt = { id: string; nome_completo: string; matricula: string | null };

function ProfissionalFormBody({
  secretarias,
  unidades,
  setores,
  cargos,
  funcoes,
  vinculos,
  gestoresOpt,
  canEditAgili,
  canSeeBanco,
  canSeeSalario,
}: {
  secretarias: LookupItem[] | undefined;
  unidades: LookupItem[] | undefined;
  setores: LookupItem[] | undefined;
  cargos: LookupItem[] | undefined;
  funcoes: LookupItem[] | undefined;
  vinculos: VinculoLookup[] | undefined;
  gestoresOpt: GestorOpt[] | undefined;
  canEditAgili: boolean;
  canSeeBanco: boolean;
  canSeeSalario: boolean;
}) {
  const { control, setValue, getValues, watch } = useFormContext<ProfissionalFormValues>();
  const { data: me } = useCurrentUser();
  const vinculoId = watch("vinculo_id");
  const nat = vinculos?.find((v) => v.id === vinculoId)?.natureza;
  const isEfetivo = nat === "efetivo" || nat === "comissionado";
  const isContratado = !!nat && !isEfetivo;
  const nomeSocial = watch("nome_social");
  const nomeCompleto = watch("nome_social");
  const displayName = nomeSocial?.trim() || nomeCompleto?.trim() || "";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fotoUrl = watch("foto_url");
  const fotoPreview = useFotoAssinada(fotoUrl || "");

  async function handleFotoFile(file: File) {
    const check = validarFoto(file);
    if (!check.ok) {
      toast.error(check.erro);
      return;
    }
    setUploadingFoto(true);
    try {
      const id = getValues("id");
      const path = montarCaminhoFoto(id, check.mime);
      const { error: upErr } = await supabase.storage
        .from(FOTO_BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: check.mime });
      if (upErr) throw upErr;
      setValue("foto_url", path);
      toast.success("Foto atualizada");
    } catch (err) {
      console.error("[upload avatar]", err);
      toast.error("Erro ao fazer upload da imagem, tente novamente");
    } finally {
      setUploadingFoto(false);
    }
  }

  return (
    <Tabs defaultValue="pessoais" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="pessoais">📑 Dados Pessoais &amp; Endereço</TabsTrigger>
        <TabsTrigger value="vinculo">🏢 Vínculo &amp; Lotação</TabsTrigger>
        <TabsTrigger value="profissional">🩺 Profissionais &amp; Conselhos</TabsTrigger>
      </TabsList>

      {/* ---------------- Tab 1: Dados Pessoais & Endereço ---------------- */}
      <TabsContent value="pessoais" className="mt-4 space-y-6">
        {/* Avatar + upload */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-5">
          <div className="relative">
            <Avatar className="h-24 w-24 border-2 border-primary/20 shadow-sm">
              {fotoPreview ? <AvatarImage src={fotoPreview} alt={displayName} /> : null}
              <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                {displayName ? initials(displayName) : <UserIcon className="h-8 w-8" />}
              </AvatarFallback>
            </Avatar>
            {uploadingFoto ? (
              <div
                className="absolute inset-0 flex items-center justify-center rounded-full text-primary-foreground"
                style={{ background: "var(--overlay-scrim)" }}
              >
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : null}
          </div>
          <div className="flex-1 space-y-2">
            <Label className="text-xs text-muted-foreground">Foto do profissional</Label>
            <div className="flex gap-2">
              <FormField
                control={control}
                name="foto_url"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input
                        placeholder="Envie um arquivo → (ou cole uma URL https://…)"
                        disabled={uploadingFoto}
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFotoFile(f);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFoto}
                title="Enviar nova foto"
                aria-label="Enviar nova foto"
              >
                {uploadingFoto ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Dados básicos */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Dados básicos</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-3">
              <FormField
                control={control}
                name="nome_completo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo *</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div>
              <FormField
                control={control}
                name="nome_social"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome social</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div>
              <FormField
                control={control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={formatCPF(field.value || "")}
                        onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))}
                        placeholder="000.000.000-00"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div>
              <FormField
                control={control}
                name="data_nascimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de nascimento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div>
              <FormField
                control={control}
                name="sexo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sexo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="M">Masculino</SelectItem>
                        <SelectItem value="F">Feminino</SelectItem>
                        <SelectItem value="O">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div>
              <FormField
                control={control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div>
              <FormField
                control={control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Endereço residencial</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="md:col-span-1">
              <FormField
                control={control}
                name="cep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="00000-000" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="md:col-span-2">
              <FormField
                control={control}
                name="logradouro"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logradouro</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="Rua, Av..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="md:col-span-1">
              <FormField
                control={control}
                name="numero"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="123" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="md:col-span-2">
              <FormField
                control={control}
                name="bairro"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="Bairro..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="md:col-span-1">
              <FormField
                control={control}
                name="cidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="Cidade..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="md:col-span-1">
              <FormField
                control={control}
                name="uf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UF</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UF_LIST.map((uf) => (
                          <SelectItem key={uf} value={uf}>
                            {uf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>
      </TabsContent>

      {/* ---------------- Tab 2: Vínculo & Lotação ---------------- */}
      <TabsContent value="vinculo" className="mt-4 space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <FormField
              control={control}
              name="matricula"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Matrícula</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div>
            <FormField
              control={control}
              name="secretaria_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Secretaria *</FormLabel>
                  <Select
                    onValueChange={(v) => {
                      field.onChange(v);
                      setValue("unidade_id", "");
                      setValue("setor_id", "");
                    }}
                    value={field.value || undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {secretarias?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.sigla ? `${s.sigla} - ` : ""}
                          {s.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div>
            <FormField
              control={control}
              name="unidade_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidade</FormLabel>
                  <Select
                    onValueChange={(v) => {
                      field.onChange(v);
                      setValue("setor_id", "");
                    }}
                    value={field.value || undefined}
                    disabled={!watch("secretaria_id")}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {unidades?.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.sigla ? `${u.sigla} - ` : ""}
                          {u.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div>
            <FormField
              control={control}
              name="setor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Setor</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined} disabled={!watch("unidade_id")}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {setores?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div>
            <FormField
              control={control}
              name="cargo_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cargo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cargos?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div>
            <FormField
              control={control}
              name="funcao_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Função</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {funcoes?.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div>
            <FormField
              control={control}
              name="vinculo_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vínculo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vinculos?.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {getVinculoLabel(v)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div>
            <FormField
              control={control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "ativo"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {statusOptions("profissional").map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div>
            <FormField
              control={control}
              name="situacao_funcional"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Situação funcional</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(SITUACAO_FUNCIONAL_LABEL).map(([v, l]) => (
                        <SelectItem key={v} value={v}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {(exigePeriodo(watch("situacao_funcional")) || exigePeriodo(watch("status"))) && (
            <>
              <div>
                <FormField
                  control={control}
                  name="situacao_data_inicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Início de{" "}
                        {SITUACAO_FUNCIONAL_LABEL[watch("situacao_funcional") || watch("status")] ??
                          "afastamento"}{" "}
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div>
                <FormField
                  control={control}
                  name="situacao_data_fim"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Fim / previsão de retorno <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="date" min={watch("situacao_data_inicio") || undefined} {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </>
          )}
          <div>
            <FormField
              control={control}
              name="gestor_imediato_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gestor imediato</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {gestoresOpt
                        ?.filter((g) => g.id !== getValues("id"))
                        .map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.matricula ? `${g.matricula} - ` : ""}
                            {g.nome_completo}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div>
            <FormField
              control={control}
              name="data_admissao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de admissão</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div>
            <FormField
              control={control}
              name="carga_horaria_semanal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Carga horária semanal</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* AGILIBlue (Efetivo) */}
        {isEfetivo ? (
          <Card className="border-primary/30 bg-primary/5 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold">
                Configuração de vínculo (Efetivos — modelo AGILIBlue)
              </h3>
              <p className="text-xs text-muted-foreground">
                Exibidos como somente leitura na folha de Efetivos.
                {!canEditAgili && " Somente Master/Gestor podem preencher estes campos."}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <FormField
                  control={control}
                  name="proj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Projeto (Proj)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="1"
                          {...field}
                          value={field.value || ""}
                          placeholder="Ex.: 1"
                          readOnly={!canEditAgili}
                          disabled={!canEditAgili}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div>
                <FormField
                  control={control}
                  name="h_p"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horas previstas (H.P)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.5"
                          {...field}
                          value={field.value || ""}
                          placeholder="Ex.: 160"
                          readOnly={!canEditAgili}
                          disabled={!canEditAgili}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div>
                <FormField
                  control={control}
                  name="c_h"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Carga horária mensal (C.H)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.5"
                          {...field}
                          value={field.value || ""}
                          placeholder="Ex.: 160"
                          readOnly={!canEditAgili}
                          disabled={!canEditAgili}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div>
                <FormField
                  control={control}
                  name="jorn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jornada (Jorn)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="1"
                          {...field}
                          value={field.value || ""}
                          placeholder="Ex.: 30"
                          readOnly={!canEditAgili}
                          disabled={!canEditAgili}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </Card>
        ) : null}

        {/* Dados bancários (Contratados e Comissionados) */}
        {(isContratado || nat === "comissionado") && canSeeBanco ? (
          <Card className="bg-muted/40 p-4">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
              Dados bancários (folha de pagamento — Contratados/Comissionados)
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <FormField
                  control={control}
                  name="banco"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Banco</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder="Ex.: BANPARÁ"
                          readOnly={!canEditAgili}
                          disabled={!canEditAgili}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div>
                <FormField
                  control={control}
                  name="agencia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agência</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder="Ex.: 0077"
                          readOnly={!canEditAgili}
                          disabled={!canEditAgili}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div>
                <FormField
                  control={control}
                  name="conta_corrente"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conta corrente</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder="Ex.: 640272-0"
                          readOnly={!canEditAgili}
                          disabled={!canEditAgili}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </Card>
        ) : null}

        {/* Dados salariais */}
        {((isContratado || nat === "comissionado" || isEfetivo) && canSeeSalario) ? (
          <Card className="bg-muted/40 p-4">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
              Dados salariais
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
              <div>
                <FormField
                  control={control}
                  name="salario_base"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Salário Base</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          {...field}
                          value={field.value || ""}
                          placeholder="0,00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div>
                <FormField
                  control={control}
                  name="salario_bruto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Salário Bruto</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          {...field}
                          value={field.value || ""}
                          placeholder="0,00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div>
                <FormField
                  control={control}
                  name="salario_liquido"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Salário Líquido</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          {...field}
                          value={field.value || ""}
                          placeholder="0,00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div>
                <FormField
                  control={control}
                  name="horas_extras"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horas Extras</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          {...field}
                          value={field.value || ""}
                          placeholder="0,00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div>
                <FormField
                  control={control}
                  name="adicional_noturno"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adicional Noturno</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          {...field}
                          value={field.value || ""}
                          placeholder="0,00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div>
                <FormField
                  control={control}
                  name="gratificacao_incentivo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gratificação Incentivo</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          {...field}
                          value={field.value || ""}
                          placeholder="0,00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div>
                <FormField
                  control={control}
                  name="vencimento_liquido"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vencimento Líquido</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          {...field}
                          value={field.value || ""}
                          placeholder="0,00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </Card>
        ) : null}
      </TabsContent>

      {/* ---------------- Tab 3: Profissionais & Conselhos ---------------- */}
      <TabsContent value="profissional" className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <FormField
              control={control}
              name="conselho_classe"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conselho de classe</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="Ex.: COREN, CRM, CRO" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div>
            <FormField
              control={control}
              name="conselho_numero"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número do conselho</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="Ex.: 123456" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div>
            <FormField
              control={control}
              name="conselho_uf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>UF do conselho</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {UF_LIST.map((uf) => (
                        <SelectItem key={uf} value={uf}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div>
            <FormField
              control={control}
              name="conselho_validade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Validade do conselho</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="md:col-span-3">
            <FormField
              control={control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value || ""} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
