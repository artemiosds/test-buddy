import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";
import { usePermissions, useCurrentUser } from "@/hooks/use-permissions";
import { ImportProfissionaisDialog } from "@/components/profissionais/import-dialog";
import {
  PageHeader,
  KpiCard,
  FilterBar,
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

export const Route = createFileRoute("/_authenticated/profissionais")({
  component: ProfissionaisPage,
});

type StatusProf = Database["public"]["Enums"]["status_profissional"];
type NaturezaVinculo = Database["public"]["Enums"]["natureza_vinculo"];
type SituacaoFuncional = Database["public"]["Enums"]["situacao_funcional"];

type Profissional = {
  id: string;
  nome_completo: string;
  nome_social: string | null;
  cpf: string;
  matricula: string | null;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  sexo: string | null;
  data_admissao: string | null;
  carga_horaria_semanal: number | null;
  status: StatusProf;
  observacoes: string | null;
  secretaria_id: string;
  unidade_id: string | null;
  setor_id: string | null;
  cargo_id: string | null;
  funcao_id: string | null;
  vinculo_id: string | null;
  unidade: { nome: string; sigla: string | null } | null;
  cargo: { nome: string } | null;
  vinculo: { nome: string; natureza: NaturezaVinculo | null } | null;
};

type VinculoOption = {
  id: string;
  nome: string;
  natureza: NaturezaVinculo | null;
};

type FormState = {
  id?: string;
  nome_completo: string;
  nome_social: string;
  cpf: string;
  matricula: string;
  email: string;
  telefone: string;
  data_nascimento: string;
  sexo: string;
  data_admissao: string;
  carga_horaria_semanal: string;
  status: StatusProf;
  observacoes: string;
  secretaria_id: string;
  unidade_id: string;
  setor_id: string;
  cargo_id: string;
  funcao_id: string;
  vinculo_id: string;
  banco: string;
  agencia: string;
  conta_corrente: string;
  proj: string;
  h_p: string;
  c_h: string;
  jorn: string;
  conselho_classe: string;
  conselho_numero: string;
  conselho_uf: string;
  conselho_validade: string;
  gestor_imediato_id: string;
  situacao_funcional: string;
  foto_url: string;
  /** Endereço por extenso — front-end apenas (não há coluna no banco ainda). */
  endereco_completo: string;
};

const EMPTY: FormState = {
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
  foto_url: "",
  endereco_completo: "",
};

const SITUACAO_FUNCIONAL_LABEL: Record<string, string> = {
  ativo: "Ativo",
  licenca: "Licença",
  ferias: "Férias",
  cedido: "Cedido",
  afastado: "Afastado",
  desligado: "Desligado",
};

const UF_LIST = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

function getVinculoLabel(
  vinculo?: { nome: string | null; natureza: NaturezaVinculo | null } | null,
) {
  if (!vinculo) return "-";
  return vinculo.natureza === "efetivo" ? "Efetivo" : vinculo.nome || "-";
}

function ProfissionaisPage() {
  const qc = useQueryClient();
  const { has: hasPermission } = usePermissions();
  const { data: me } = useCurrentUser();
  const askConfirm = useConfirm();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  // Filtros de listagem
  const [fUnidade, setFUnidade] = useState<string>("todos");
  const [fVinculo, setFVinculo] = useState<string>("todos");
  const [fStatus, setFStatus] = useState<string>("todos");
  const [fCargo, setFCargo] = useState<string>("todos");
  const [fFuncao, setFFuncao] = useState<string>("todos");
  const [fSetor, setFSetor] = useState<string>("todos");
  const [fNome, setFNome] = useState<string>("");
  const [fCpf, setFCpf] = useState<string>("");
  const [fMatricula, setFMatricula] = useState<string>("");
  const [fGestor, setFGestor] = useState<"todos" | "sim" | "nao">("todos");

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

  const {
    data: profissionaisPage,
    isLoading,
    isFetching,
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
      sortBy,
      fGestor !== "todos" ? (gestorIds?.length ?? 0) : 0,
      page,
      pageSize,
    ],
    placeholderData: keepPreviousData,
    enabled: fGestor === "todos" || !!gestorIds,
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let q = supabase
        .from("profissionais")
        .select(
          "id,nome_completo,nome_social,cpf,matricula,email,telefone,data_nascimento,sexo,data_admissao,carga_horaria_semanal,status,observacoes,secretaria_id,unidade_id,setor_id,cargo_id,funcao_id,vinculo_id,banco,agencia,conta_corrente,proj,h_p,c_h,jorn,conselho_classe,conselho_numero,conselho_uf,conselho_validade,gestor_imediato_id,situacao_funcional,foto_url,endereco_completo,unidade:unidades(nome,sigla),cargo:cargos(nome),vinculo:vinculos(nome,natureza)",
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
      if (fUnidade !== "todos") q = q.eq("unidade_id", fUnidade);
      if (fVinculo !== "todos") q = q.eq("vinculo_id", fVinculo);
      if (fStatus !== "todos") q = q.eq("status", fStatus as StatusProf);
      if (fCargo !== "todos") q = q.eq("cargo_id", fCargo);
      if (fFuncao !== "todos") q = q.eq("funcao_id", fFuncao);
      if (fSetor !== "todos") q = q.eq("setor_id", fSetor);
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
    queryKey: ["unidades-select", form.secretaria_id],
    queryFn: async () => {
      let q = supabase
        .from("unidades")
        .select("id,nome,sigla,secretaria_id")
        .is("deleted_at", null)
        .eq("status", "ativa")
        .order("nome");
      if (form.secretaria_id) q = q.eq("secretaria_id", form.secretaria_id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  // Opções para os filtros de listagem — hooks compartilhados (use-lookups)
  const { data: unidadesFiltro } = useUnidadesLookup();
  const { data: cargosFiltro } = useCargosLookup();
  const { data: funcoesFiltro } = useFuncoesLookup();
  const { data: vinculosFiltro } = useVinculosLookup();
  const { data: setoresFiltro } = useSetoresLookup({
    unidadeId: fUnidade !== "todos" ? fUnidade : null,
  });

  // Reseta filtro de setor quando unidade muda
  const changeUnidadeFiltro = (v: string) => {
    setFUnidade(v);
    setFSetor("todos");
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
    queryKey: ["setores-select", form.unidade_id],
    queryFn: async () => {
      if (!form.unidade_id) return [];
      const { data, error } = await supabase
        .from("setores")
        .select("id,nome,unidade_id")
        .is("deleted_at", null)
        .eq("unidade_id", form.unidade_id)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!form.unidade_id,
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
    mutationFn: async (f: FormState) => {
      const cpfDigits = f.cpf.replace(/\D/g, "");
      if (cpfDigits.length !== 11) throw new Error("CPF deve ter 11 dígitos");
      if (!f.nome_completo.trim()) throw new Error("Nome é obrigatório");
      if (!f.secretaria_id) throw new Error("Secretaria é obrigatória");

      const canSeeBanco = hasPermission("profissional.dados_bancarios");
      const payload: Record<string, unknown> = {
        nome_completo: f.nome_completo.trim(),
        nome_social: f.nome_social.trim() || null,
        cpf: cpfDigits,
        matricula: f.matricula.trim() || null,
        email: f.email.trim() || null,
        telefone: f.telefone.trim() || null,
        data_nascimento: f.data_nascimento || null,
        sexo: f.sexo || null,
        data_admissao: f.data_admissao || null,
        carga_horaria_semanal: f.carga_horaria_semanal ? Number(f.carga_horaria_semanal) : null,
        status: f.status,
        observacoes: f.observacoes.trim() || null,
        secretaria_id: f.secretaria_id,
        unidade_id: f.unidade_id || null,
        setor_id: f.setor_id || null,
        cargo_id: f.cargo_id || null,
        funcao_id: f.funcao_id || null,
        vinculo_id: f.vinculo_id || null,
        proj: f.proj ? Number(f.proj) : null,
        h_p: f.h_p ? Number(f.h_p) : null,
        c_h: f.c_h ? Number(f.c_h) : null,
        jorn: f.jorn ? Number(f.jorn) : null,
        conselho_classe: f.conselho_classe.trim() || null,
        conselho_numero: f.conselho_numero.trim() || null,
        conselho_uf: f.conselho_uf || null,
        conselho_validade: f.conselho_validade || null,
        gestor_imediato_id: f.gestor_imediato_id || null,
        situacao_funcional: (f.situacao_funcional || null) as SituacaoFuncional | null,
        foto_url: f.foto_url.trim() || null,
        endereco_completo: f.endereco_completo.trim() || null,
      };
      // Só grava dados bancários quando o usuário tem a permissão específica.
      // Sem a permissão os campos nem foram renderizados; omitir do payload evita
      // que um update remova valores válidos já salvos por outro usuário.
      if (canSeeBanco) {
        payload.banco = f.banco.trim() || null;
        payload.agencia = f.agencia.trim() || null;
        payload.conta_corrente = f.conta_corrente.trim() || null;
      }
      if (f.id) {
        if (f.gestor_imediato_id && f.gestor_imediato_id === f.id) {
          throw new Error("Profissional não pode ser gestor imediato de si mesmo.");
        }
        const { error } = await supabase
          .from("profissionais")
          .update(payload as never)
          .eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("profissionais").insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "Profissional atualizado" : "Profissional criado");
      setOpen(false);
      setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ["profissionais"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("profissionais")
        .update({ deleted_at: new Date().toISOString(), deleted_by: me?.id ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profissional arquivado");
      qc.invalidateQueries({ queryKey: ["profissionais"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setForm({ ...EMPTY, secretaria_id: me?.secretaria_id ?? "" });
    setOpen(true);
  };

  const openEdit = (p: Profissional) => {
    setForm({
      id: p.id,
      nome_completo: p.nome_completo,
      nome_social: p.nome_social ?? "",
      cpf: p.cpf,
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
      banco: (p as unknown as { banco?: string | null }).banco ?? "",
      agencia: (p as unknown as { agencia?: string | null }).agencia ?? "",
      conta_corrente: (p as unknown as { conta_corrente?: string | null }).conta_corrente ?? "",
      proj: (p as unknown as { proj?: number | null }).proj?.toString() ?? "",
      h_p: (p as unknown as { h_p?: number | null }).h_p?.toString() ?? "",
      c_h: (p as unknown as { c_h?: number | null }).c_h?.toString() ?? "",
      jorn: (p as unknown as { jorn?: number | null }).jorn?.toString() ?? "",
      conselho_classe: (p as unknown as { conselho_classe?: string | null }).conselho_classe ?? "",
      conselho_numero: (p as unknown as { conselho_numero?: string | null }).conselho_numero ?? "",
      conselho_uf: (p as unknown as { conselho_uf?: string | null }).conselho_uf ?? "",
      conselho_validade:
        (p as unknown as { conselho_validade?: string | null }).conselho_validade ?? "",
      gestor_imediato_id:
        (p as unknown as { gestor_imediato_id?: string | null }).gestor_imediato_id ?? "",
      situacao_funcional:
        (p as unknown as { situacao_funcional?: string | null }).situacao_funcional ?? "",
      foto_url: (p as unknown as { foto_url?: string | null }).foto_url ?? "",
      endereco_completo:
        (p as unknown as { endereco_completo?: string | null }).endereco_completo ?? "",
    });
    setOpen(true);
  };

  // KPIs agregados no servidor (count exact) — independentes do limit(500) da
  // listagem. Segue o padrão do useAnalytics (HEAD + count=exact), aplicando os
  // filtros ativos da página. Cada KPI é uma query separada para revalidação
  // independente.
  const applyProfFilters = <
    T extends {
      eq: (col: string, val: string) => T;
      or: (expr: string) => T;
    },
  >(
    q: T,
  ): T => {
    let out = q;
    if (search.trim()) {
      const s = `%${search.trim()}%`;
      out = out.or(`nome_completo.ilike.${s},cpf.ilike.${s},matricula.ilike.${s}`);
    }
    if (fUnidade !== "todos") out = out.eq("unidade_id", fUnidade);
    if (fVinculo !== "todos") out = out.eq("vinculo_id", fVinculo);
    if (fCargo !== "todos") out = out.eq("cargo_id", fCargo);
    if (fFuncao !== "todos") out = out.eq("funcao_id", fFuncao);
    if (fSetor !== "todos") out = out.eq("setor_id", fSetor);
    return out;
  };

  const kpiFiltersKey = [search, fUnidade, fVinculo, fCargo, fFuncao, fSetor];

  const kpiTotal = useQuery({
    queryKey: ["profissionais-kpi", "total", ...kpiFiltersKey, fStatus],
    queryFn: async () => {
      let q = supabase
        .from("profissionais")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null);
      q = applyProfFilters(q);
      if (fStatus !== "todos") q = q.eq("status", fStatus as StatusProf);
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
    queryKey: ["profissionais-kpi", "efetivos", ...kpiFiltersKey, fStatus],
    queryFn: async () => {
      let q = supabase
        .from("profissionais")
        .select("id, vinculos!inner(natureza)", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("vinculos.natureza", "efetivo");
      q = applyProfFilters(q);
      if (fStatus !== "todos") q = q.eq("status", fStatus as StatusProf);
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
          <Button size="icon" variant="ghost" asChild title="Histórico funcional" aria-label="Histórico funcional">
            <Link to="/profissionais/$id" params={{ id: p.id }}>
              <History className="h-4 w-4" />
            </Link>
          </Button>
          {canEdit && (
            <Button size="icon" variant="ghost" onClick={() => openEdit(p)} title="Editar" aria-label="Editar profissional">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canDelete && (
            <Button
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
            >
              <Trash2 className="h-4 w-4" />
            </Button>
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
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openNew}>
                    <Plus className="mr-2 h-4 w-4" /> Novo profissional
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {form.id ? "Editar profissional" : "Novo profissional"}
                    </DialogTitle>
                  </DialogHeader>
                  <ProfissionalFormBody
                    form={form}
                    setForm={setForm}
                    secretarias={secretarias}
                    unidades={unidades}
                    setores={setores}
                    cargos={cargos}
                    funcoes={funcoes}
                    vinculos={vinculos}
                    gestoresOpt={gestoresOpt}
                    canEditAgili={hasPermission("profissional.editar_dados_agili")}
                    canSeeBanco={hasPermission("profissional.dados_bancarios")}
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={() => upsert.mutate(form)} disabled={upsert.isPending}>
                      {upsert.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                  </DialogFooter>
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

      <FilterBar>
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
          <Select value={fUnidade} onValueChange={changeUnidadeFiltro}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {unidadesFiltro?.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.sigla ? `${u.sigla} — ` : ""}
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="Vínculo">
          <Select value={fVinculo} onValueChange={setFVinculo}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {vinculosFiltro?.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="Status">
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {statusOptions("profissional").map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="Cargo">
          <Select value={fCargo} onValueChange={setFCargo}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {cargosFiltro?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="Função">
          <Select value={fFuncao} onValueChange={setFFuncao}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {funcoesFiltro?.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="Setor">
          <Select value={fSetor} onValueChange={setFSetor} disabled={fUnidade === "todos"}>
            <SelectTrigger>
              <SelectValue placeholder={fUnidade === "todos" ? "Selecione uma unidade" : "Todos"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {setoresFiltro?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
  form,
  setForm,
  secretarias,
  unidades,
  setores,
  cargos,
  funcoes,
  vinculos,
  gestoresOpt,
  canEditAgili,
  canSeeBanco,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  secretarias: LookupItem[] | undefined;
  unidades: LookupItem[] | undefined;
  setores: LookupItem[] | undefined;
  cargos: LookupItem[] | undefined;
  funcoes: LookupItem[] | undefined;
  vinculos: VinculoLookup[] | undefined;
  gestoresOpt: GestorOpt[] | undefined;
  canEditAgili: boolean;
  canSeeBanco: boolean;
}) {
  const nat = vinculos?.find((v) => v.id === form.vinculo_id)?.natureza;
  const isEfetivo = nat === "efetivo" || nat === "comissionado";
  const isContratado = !!nat && !isEfetivo;
  const displayName = form.nome_social?.trim() || form.nome_completo?.trim() || "";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  async function handleFotoFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem válido");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máximo 5MB)");
      return;
    }
    setUploadingFoto(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const owner = form.id || `novo-${Date.now()}`;
      const path = `profissionais/${owner}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setForm({ ...form, foto_url: data.publicUrl });
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
              {form.foto_url ? <AvatarImage src={form.foto_url} alt={displayName} /> : null}
              <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                {displayName ? initials(displayName) : <UserIcon className="h-8 w-8" />}
              </AvatarFallback>
            </Avatar>
            {uploadingFoto ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : null}
          </div>
          <div className="flex-1 space-y-2">
            <Label className="text-xs text-muted-foreground">Foto do profissional</Label>
            <div className="flex gap-2">
              <Input
                value={form.foto_url}
                onChange={(e) => setForm({ ...form, foto_url: e.target.value })}
                placeholder="https://…/foto.jpg (ou envie um arquivo →)"
                disabled={uploadingFoto}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
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
              <Label>Nome completo *</Label>
              <Input
                value={form.nome_completo}
                onChange={(e) => setForm({ ...form, nome_completo: e.target.value })}
              />
            </div>
            <div>
              <Label>Nome social</Label>
              <Input
                value={form.nome_social}
                onChange={(e) => setForm({ ...form, nome_social: e.target.value })}
              />
            </div>
            <div>
              <Label>CPF *</Label>
              <Input
                value={formatCPF(form.cpf)}
                onChange={(e) => setForm({ ...form, cpf: e.target.value.replace(/\D/g, "") })}
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <Label>Data de nascimento</Label>
              <Input
                type="date"
                value={form.data_nascimento}
                onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })}
              />
            </div>
            <div>
              <Label>Sexo</Label>
              <Select
                value={form.sexo || undefined}
                onValueChange={(v) => setForm({ ...form, sexo: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                  <SelectItem value="O">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Endereço residencial</h3>
          <Label>Endereço completo (por extenso)</Label>
          <Textarea
            value={form.endereco_completo}
            onChange={(e) => setForm({ ...form, endereco_completo: e.target.value })}
            rows={4}
            placeholder="Rua, número, complemento, bairro, cidade, UF, CEP e pontos de referência."
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Campo livre — ainda não é gravado no banco (ver relatório).
          </p>
        </div>
      </TabsContent>

      {/* ---------------- Tab 2: Vínculo & Lotação ---------------- */}
      <TabsContent value="vinculo" className="mt-4 space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Label>Matrícula</Label>
            <Input
              value={form.matricula}
              onChange={(e) => setForm({ ...form, matricula: e.target.value })}
            />
          </div>
          <div>
            <Label>Secretaria *</Label>
            <Select
              value={form.secretaria_id || undefined}
              onValueChange={(v) =>
                setForm({ ...form, secretaria_id: v, unidade_id: "", setor_id: "" })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
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
          </div>
          <div>
            <Label>Unidade</Label>
            <Select
              value={form.unidade_id || undefined}
              onValueChange={(v) => setForm({ ...form, unidade_id: v, setor_id: "" })}
              disabled={!form.secretaria_id}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {unidades?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.sigla ? `${u.sigla} - ` : ""}
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Setor</Label>
            <Select
              value={form.setor_id || undefined}
              onValueChange={(v) => setForm({ ...form, setor_id: v })}
              disabled={!form.unidade_id}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {setores?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cargo</Label>
            <Select
              value={form.cargo_id || undefined}
              onValueChange={(v) => setForm({ ...form, cargo_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {cargos?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Função</Label>
            <Select
              value={form.funcao_id || undefined}
              onValueChange={(v) => setForm({ ...form, funcao_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {funcoes?.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Vínculo</Label>
            <Select
              value={form.vinculo_id || undefined}
              onValueChange={(v) => setForm({ ...form, vinculo_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {vinculos?.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {getVinculoLabel(v)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v: StatusProf) => setForm({ ...form, status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions("profissional").map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Situação funcional</Label>
            <Select
              value={form.situacao_funcional || undefined}
              onValueChange={(v) => setForm({ ...form, situacao_funcional: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SITUACAO_FUNCIONAL_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Gestor imediato</Label>
            <Select
              value={form.gestor_imediato_id || undefined}
              onValueChange={(v) => setForm({ ...form, gestor_imediato_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {gestoresOpt
                  ?.filter((g) => g.id !== form.id)
                  .map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.matricula ? `${g.matricula} - ` : ""}
                      {g.nome_completo}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data de admissão</Label>
            <Input
              type="date"
              value={form.data_admissao}
              onChange={(e) => setForm({ ...form, data_admissao: e.target.value })}
            />
          </div>
          <div>
            <Label>Carga horária semanal</Label>
            <Input
              type="number"
              min={0}
              max={44}
              value={form.carga_horaria_semanal}
              onChange={(e) => setForm({ ...form, carga_horaria_semanal: e.target.value })}
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
                <Label>Projeto (Proj)</Label>
                <Input
                  type="number"
                  step="1"
                  value={form.proj}
                  onChange={(e) => setForm({ ...form, proj: e.target.value })}
                  placeholder="Ex.: 1"
                  readOnly={!canEditAgili}
                  disabled={!canEditAgili}
                />
              </div>
              <div>
                <Label>Horas previstas (H.P)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  value={form.h_p}
                  onChange={(e) => setForm({ ...form, h_p: e.target.value })}
                  placeholder="Ex.: 160"
                  readOnly={!canEditAgili}
                  disabled={!canEditAgili}
                />
              </div>
              <div>
                <Label>Carga horária mensal (C.H)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  value={form.c_h}
                  onChange={(e) => setForm({ ...form, c_h: e.target.value })}
                  placeholder="Ex.: 160"
                  readOnly={!canEditAgili}
                  disabled={!canEditAgili}
                />
              </div>
              <div>
                <Label>Jornada (Jorn)</Label>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  value={form.jorn}
                  onChange={(e) => setForm({ ...form, jorn: e.target.value })}
                  placeholder="Ex.: 30"
                  readOnly={!canEditAgili}
                  disabled={!canEditAgili}
                />
              </div>
            </div>
          </Card>
        ) : null}

        {/* Dados bancários (Contratados) */}
        {isContratado && canSeeBanco ? (
          <Card className="bg-muted/40 p-4">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
              Dados bancários (folha de pagamento — Contratados)
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <Label>Banco</Label>
                <Input
                  value={form.banco}
                  onChange={(e) => setForm({ ...form, banco: e.target.value })}
                  placeholder="Ex.: BANPARÁ"
                  readOnly={!canEditAgili}
                  disabled={!canEditAgili}
                />
              </div>
              <div>
                <Label>Agência</Label>
                <Input
                  value={form.agencia}
                  onChange={(e) => setForm({ ...form, agencia: e.target.value })}
                  placeholder="Ex.: 0077"
                  readOnly={!canEditAgili}
                  disabled={!canEditAgili}
                />
              </div>
              <div>
                <Label>Conta corrente</Label>
                <Input
                  value={form.conta_corrente}
                  onChange={(e) => setForm({ ...form, conta_corrente: e.target.value })}
                  placeholder="Ex.: 640272-0"
                  readOnly={!canEditAgili}
                  disabled={!canEditAgili}
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
            <Label>Conselho de classe</Label>
            <Input
              value={form.conselho_classe}
              onChange={(e) => setForm({ ...form, conselho_classe: e.target.value })}
              placeholder="Ex.: COREN, CRM, CRO"
            />
          </div>
          <div>
            <Label>Número do conselho</Label>
            <Input
              value={form.conselho_numero}
              onChange={(e) => setForm({ ...form, conselho_numero: e.target.value })}
              placeholder="Ex.: 123456"
            />
          </div>
          <div>
            <Label>UF do conselho</Label>
            <Select
              value={form.conselho_uf || undefined}
              onValueChange={(v) => setForm({ ...form, conselho_uf: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent>
                {UF_LIST.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    {uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Validade do conselho</Label>
            <Input
              type="date"
              value={form.conselho_validade}
              onChange={(e) => setForm({ ...form, conselho_validade: e.target.value })}
            />
          </div>
          <div className="md:col-span-3">
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              rows={3}
            />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
