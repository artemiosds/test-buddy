import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/profissionais")({
  component: ProfissionaisPage,
});

type StatusProf = Database["public"]["Enums"]["status_profissional"];
type NaturezaVinculo = Database["public"]["Enums"]["natureza_vinculo"];

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
};

const STATUS_LABEL: Record<StatusProf, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  afastado: "Afastado",
  ferias: "Férias",
  licenca: "Licença",
  desligado: "Desligado",
};

const STATUS_VARIANT: Record<StatusProf, "default" | "secondary" | "outline" | "destructive"> = {
  ativo: "default",
  inativo: "secondary",
  afastado: "secondary",
  ferias: "secondary",
  licenca: "outline",
  desligado: "destructive",
};

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
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  // Filtros de listagem
  const [fUnidade, setFUnidade] = useState<string>("todos");
  const [fVinculo, setFVinculo] = useState<string>("todos");
  const [fStatus, setFStatus] = useState<string>("todos");
  const [fCargo, setFCargo] = useState<string>("todos");
  const [fFuncao, setFFuncao] = useState<string>("todos");
  const [fSetor, setFSetor] = useState<string>("todos");

  const canCreate = hasPermission("profissional.criar");
  const canEdit = hasPermission("profissional.editar");
  const canDelete = hasPermission("profissional.excluir");

  const { data: profissionais, isLoading } = useQuery({
    queryKey: ["profissionais", search, fUnidade, fVinculo, fStatus, fCargo, fFuncao, fSetor],
    queryFn: async () => {
      let q = supabase
        .from("profissionais")
        .select(
          "id,nome_completo,nome_social,cpf,matricula,email,telefone,data_nascimento,sexo,data_admissao,carga_horaria_semanal,status,observacoes,secretaria_id,unidade_id,setor_id,cargo_id,funcao_id,vinculo_id,banco,agencia,conta_corrente,proj,h_p,c_h,jorn,unidade:unidades(nome,sigla),cargo:cargos(nome),vinculo:vinculos(nome,natureza)",
        )
        .is("deleted_at", null)
        .order("nome_completo");
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`nome_completo.ilike.${s},cpf.ilike.${s},matricula.ilike.${s}`);
      }
      if (fUnidade !== "todos") q = q.eq("unidade_id", fUnidade);
      if (fVinculo !== "todos") q = q.eq("vinculo_id", fVinculo);
      if (fStatus !== "todos") q = q.eq("status", fStatus as StatusProf);
      if (fCargo !== "todos") q = q.eq("cargo_id", fCargo);
      if (fFuncao !== "todos") q = q.eq("funcao_id", fFuncao);
      if (fSetor !== "todos") q = q.eq("setor_id", fSetor);
      const { data, error } = await q.limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Profissional[];
    },
  });

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

  // Opções para os filtros de listagem (sempre carregadas)
  const { data: unidadesFiltro } = useQuery({
    queryKey: ["unidades-filtro"],
    queryFn: async () => {
      const { data } = await supabase
        .from("unidades")
        .select("id,nome,sigla")
        .is("deleted_at", null)
        .order("nome");
      return data ?? [];
    },
  });
  const { data: cargosFiltro } = useQuery({
    queryKey: ["cargos-filtro"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cargos")
        .select("id,nome")
        .is("deleted_at", null)
        .eq("status", "ativa")
        .order("nome");
      return data ?? [];
    },
  });
  const { data: funcoesFiltro } = useQuery({
    queryKey: ["funcoes-filtro"],
    queryFn: async () => {
      const { data } = await supabase
        .from("funcoes")
        .select("id,nome")
        .is("deleted_at", null)
        .eq("status", "ativa")
        .order("nome");
      return data ?? [];
    },
  });
  const { data: vinculosFiltro } = useQuery({
    queryKey: ["vinculos-filtro"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vinculos")
        .select("id,nome,natureza")
        .is("deleted_at", null)
        .eq("status", "ativa")
        .order("nome");
      return (data ?? []) as VinculoOption[];
    },
  });
  const { data: setoresFiltro } = useQuery({
    queryKey: ["setores-filtro", fUnidade],
    enabled: fUnidade !== "todos",
    queryFn: async () => {
      const { data } = await supabase
        .from("setores")
        .select("id,nome")
        .eq("unidade_id", fUnidade)
        .is("deleted_at", null)
        .order("nome");
      return (data ?? []) as VinculoOption[];
    },
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

  const upsert = useMutation({
    mutationFn: async (f: FormState) => {
      const cpfDigits = f.cpf.replace(/\D/g, "");
      if (cpfDigits.length !== 11) throw new Error("CPF deve ter 11 dígitos");
      if (!f.nome_completo.trim()) throw new Error("Nome é obrigatório");
      if (!f.secretaria_id) throw new Error("Secretaria é obrigatória");

      const payload = {
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
        banco: f.banco.trim() || null,
        agencia: f.agencia.trim() || null,
        conta_corrente: f.conta_corrente.trim() || null,
        proj: f.proj ? Number(f.proj) : null,
        h_p: f.h_p ? Number(f.h_p) : null,
        c_h: f.c_h ? Number(f.c_h) : null,
        jorn: f.jorn ? Number(f.jorn) : null,
      };
      if (f.id) {
        const { error } = await supabase.from("profissionais").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("profissionais").insert(payload);
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
    });
    setOpen(true);
  };

  const formatCPF = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
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
      header: "Status",
      cell: (p) => <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>,
    },
    {
      key: "acoes",
      header: "Ações",
      headerClassName: "text-right",
      className: "text-right",
      cell: (p) => (
        <div className="inline-flex gap-1">
          <Button size="icon" variant="ghost" asChild title="Histórico funcional">
            <Link to="/profissionais/$id" params={{ id: p.id }}>
              <History className="h-4 w-4" />
            </Link>
          </Button>
          {canEdit && (
            <Button size="icon" variant="ghost" onClick={() => openEdit(p)} title="Editar">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canDelete && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                if (confirm(`Arquivar ${p.nome_completo}?`)) archive.mutate(p.id);
              }}
              title="Arquivar"
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
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
                        onChange={(e) =>
                          setForm({ ...form, cpf: e.target.value.replace(/\D/g, "") })
                        }
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <Label>Matrícula</Label>
                      <Input
                        value={form.matricula}
                        onChange={(e) => setForm({ ...form, matricula: e.target.value })}
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
                        onChange={(e) =>
                          setForm({ ...form, carga_horaria_semanal: e.target.value })
                        }
                      />
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
                          {(Object.keys(STATUS_LABEL) as StatusProf[]).map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {(() => {
                      const nat = vinculos?.find((v) => v.id === form.vinculo_id)?.natureza;
                      const isEfetivo = nat === "efetivo" || nat === "comissionado";
                      const isContratado = !!nat && !isEfetivo;
                      const canEditAgili = hasPermission("profissional.editar_dados_agili");
                      if (isContratado) {
                        return (
                          <>
                            <div className="md:col-span-2 border-t pt-3 mt-1">
                              <h3 className="text-sm font-semibold text-muted-foreground">
                                Dados bancários (folha de pagamento — Contratados)
                              </h3>
                            </div>
                            <div>
                              <Label>Banco</Label>
                              <Input
                                value={form.banco}
                                onChange={(e) => setForm({ ...form, banco: e.target.value })}
                                placeholder="Ex.: BANPARÁ"
                              />
                            </div>
                            <div>
                              <Label>Agência</Label>
                              <Input
                                value={form.agencia}
                                onChange={(e) => setForm({ ...form, agencia: e.target.value })}
                                placeholder="Ex.: 0077"
                              />
                            </div>
                            <div>
                              <Label>Conta corrente</Label>
                              <Input
                                value={form.conta_corrente}
                                onChange={(e) =>
                                  setForm({ ...form, conta_corrente: e.target.value })
                                }
                                placeholder="Ex.: 640272-0"
                              />
                            </div>
                          </>
                        );
                      }
                      if (!isEfetivo) return null;
                      return (
                        <>
                          <div className="md:col-span-2 border-t pt-3 mt-1">
                            <h3 className="text-sm font-semibold text-muted-foreground">
                              Configuração de vínculo (Efetivos — modelo AGILIBlue)
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              Exibidos como somente leitura na folha de Efetivos.
                              {!canEditAgili &&
                                " Somente Master/Gestor podem preencher estes campos."}
                            </p>
                          </div>
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
                        </>
                      );
                    })()}
                    <div className="md:col-span-2">
                      <Label>Observações</Label>
                      <Textarea
                        value={form.observacoes}
                        onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                        rows={2}
                      />
                    </div>
                  </div>
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome, CPF ou matrícula..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <FilterBar>
        <div>
          <Label className="text-xs text-muted-foreground">Unidade</Label>
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
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Vínculo</Label>
          <Select value={fVinculo} onValueChange={setFVinculo}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {vinculosFiltro?.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {getVinculoLabel(v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {(Object.keys(STATUS_LABEL) as StatusProf[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Cargo</Label>
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
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Função</Label>
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
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Setor</Label>
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
        </div>
      </FilterBar>

      <DataTable<Profissional>
        columns={columns}
        rows={profissionais ?? []}
        getRowKey={(p) => p.id}
        loading={isLoading}
        emptyTitle="Nenhum profissional encontrado"
        emptyDescription="Ajuste os filtros ou cadastre um novo profissional."
      />
    </div>
  );
}
