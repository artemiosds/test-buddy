import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/shared/ConfirmDialog";
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
import { Search, Plus, Pencil, Trash2, Network, LayoutDashboard, Download } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { useCurrentUser } from "@/hooks/use-permissions";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/unidades/")({
  component: UnidadesPage,
});

type StatusEnt = Database["public"]["Enums"]["status_entidade"];

type Unidade = {
  id: string;
  nome: string;
  sigla: string | null;
  cnes: string | null;
  cnpj: string | null;
  tipo_unidade: string | null;
  nivel_complexidade: string | null;
  tipo_atendimento: string | null;
  municipio: string | null;
  distrito: string | null;
  telefone: string | null;
  email_institucional: string | null;
  responsavel_nome: string | null;
  observacoes: string | null;
  status: StatusEnt;
  secretaria_id: string;
  secretaria: { nome: string; sigla: string | null } | null;
};

type FormState = {
  id?: string;
  nome: string;
  sigla: string;
  cnes: string;
  cnpj: string;
  tipo_unidade: string;
  nivel_complexidade: string;
  tipo_atendimento: string;
  municipio: string;
  distrito: string;
  telefone: string;
  email_institucional: string;
  responsavel_nome: string;
  observacoes: string;
  status: StatusEnt;
  secretaria_id: string;
};

const EMPTY: FormState = {
  nome: "",
  sigla: "",
  cnes: "",
  cnpj: "",
  tipo_unidade: "",
  nivel_complexidade: "",
  tipo_atendimento: "",
  municipio: "",
  distrito: "",
  telefone: "",
  email_institucional: "",
  responsavel_nome: "",
  observacoes: "",
  status: "ativa",
  secretaria_id: "",
};

const STATUS_OPTS: StatusEnt[] = ["ativa", "inativa", "suspensa", "arquivada"];

function UnidadesPage() {
  const qc = useQueryClient();
  const { has } = usePermissions();
  const { data: me } = useCurrentUser();
  const askConfirm = useConfirm();
  const navigate = useNavigate();
  const canCreate = me?.is_master || has("unidade.criar");
  const canEdit = me?.is_master || has("unidade.editar");
  const canDelete = me?.is_master || has("unidade.excluir");

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const { data: secretarias = [] } = useQuery({
    queryKey: ["secretarias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("secretarias")
        .select("id, nome, sigla")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tiposUnidade = [] } = useQuery({
    queryKey: ["tipos-unidade-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_unidade")
        .select("id, nome, status")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string; status: string }[];
    },
  });

  const { data: diretores = [] } = useQuery({
    queryKey: ["diretores-unidade", form.id ?? "novo"],
    queryFn: async () => {
      // 1) Profissionais cadastrados com função "Diretor de Unidade"
      let profQ = supabase
        .from("profissionais")
        .select("id, nome_completo, unidade_id, funcao:funcoes!inner(codigo)")
        .is("deleted_at", null)
        .eq("status", "ativo")
        .eq("funcao.codigo", "DIR-UN")
        .order("nome_completo");
      if (form.id) profQ = profQ.eq("unidade_id", form.id);
      const { data: profs, error: pErr } = await profQ;
      if (pErr) throw pErr;

      // 2) Usuários do sistema com perfil "Diretor de Unidade"
      const { data: users, error: uErr } = await supabase
        .from("usuarios")
        .select(
          "id, nome_completo, acesso_todas_unidades, perfil:perfis!inner(codigo), unidades:usuario_unidades(unidade_id)",
        )
        .is("deleted_at", null)
        .eq("status", "ativo")
        .eq("perfil.codigo", "DIRETOR_UNIDADE")
        .order("nome_completo");
      if (uErr) throw uErr;

      type U = {
        id: string;
        nome_completo: string;
        acesso_todas_unidades: boolean;
        unidades: { unidade_id: string }[];
      };
      const usersFiltered = ((users ?? []) as unknown as U[]).filter((u) => {
        if (!form.id) return true;
        if (u.acesso_todas_unidades) return true;
        return u.unidades?.some((v) => v.unidade_id === form.id);
      });

      const merged = new Map<string, { nome_completo: string }>();
      for (const p of (profs ?? []) as { nome_completo: string }[]) merged.set(p.nome_completo, p);
      for (const u of usersFiltered)
        if (!merged.has(u.nome_completo))
          merged.set(u.nome_completo, { nome_completo: u.nome_completo });
      return Array.from(merged.values());
    },
    enabled: open,
  });

  const { data: unidades = [], isLoading } = useQuery({
    queryKey: ["unidades"],
    queryFn: async (): Promise<Unidade[]> => {
      const { data, error } = await supabase
        .from("unidades")
        .select(
          "id, nome, sigla, cnes, cnpj, tipo_unidade, nivel_complexidade, tipo_atendimento, municipio, distrito, telefone, email_institucional, responsavel_nome, observacoes, status, secretaria_id, secretaria:secretarias(nome, sigla)",
        )
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data as unknown as Unidade[]) ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = {
        nome: f.nome.trim(),
        sigla: f.sigla.trim() || null,
        cnes: f.cnes.trim() || null,
        cnpj: f.cnpj.trim() || null,
        tipo_unidade: f.tipo_unidade.trim() || null,
        nivel_complexidade: f.nivel_complexidade.trim() || null,
        tipo_atendimento: f.tipo_atendimento.trim() || null,
        municipio: f.municipio.trim() || null,
        distrito: f.distrito.trim() || null,
        telefone: f.telefone.trim() || null,
        email_institucional: f.email_institucional.trim() || null,
        responsavel_nome: f.responsavel_nome.trim() || null,
        observacoes: f.observacoes.trim() || null,
        status: f.status,
        secretaria_id: f.secretaria_id,
      };
      if (!payload.nome) throw new Error("Nome é obrigatório");
      if (!payload.secretaria_id) throw new Error("Secretaria é obrigatória");

      if (f.id) {
        const { error } = await supabase.from("unidades").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("unidades").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unidades"] });
      setOpen(false);
      setForm(EMPTY);
      toast.success("Unidade salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("unidades")
        .update({ deleted_at: new Date().toISOString(), status: "arquivada" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unidades"] });
      toast.success("Unidade arquivada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = unidades.filter((u) => {
    const t = q.toLowerCase();
    return (
      !t ||
      u.nome?.toLowerCase().includes(t) ||
      u.sigla?.toLowerCase().includes(t) ||
      u.cnes?.toLowerCase().includes(t)
    );
  });

  function exportCsv() {
    const rows = [
      ["Nome", "Sigla", "CNES", "CNPJ", "Secretaria", "Município", "Status"],
      ...filtered.map((u) => [
        u.nome ?? "",
        u.sigla ?? "",
        u.cnes ?? "",
        u.cnpj ?? "",
        u.secretaria?.nome ?? "",
        u.municipio ?? "",
        u.status ?? "",
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `unidades_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openNew() {
    setForm({
      ...EMPTY,
      secretaria_id: secretarias[0]?.id ?? "",
    });
    setOpen(true);
  }

  function openEdit(u: Unidade) {
    setForm({
      id: u.id,
      nome: u.nome,
      sigla: u.sigla ?? "",
      cnes: u.cnes ?? "",
      cnpj: u.cnpj ?? "",
      tipo_unidade: u.tipo_unidade ?? "",
      nivel_complexidade: u.nivel_complexidade ?? "",
      tipo_atendimento: u.tipo_atendimento ?? "",
      municipio: u.municipio ?? "",
      distrito: u.distrito ?? "",
      telefone: u.telefone ?? "",
      email_institucional: u.email_institucional ?? "",
      responsavel_nome: u.responsavel_nome ?? "",
      observacoes: u.observacoes ?? "",
      status: u.status,
      secretaria_id: u.secretaria_id,
    });
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Header: título + busca + Nova Unidade na mesma linha */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800">Unidades</h1>
          <p className="text-sm text-slate-500">
            Cadastro de unidades de saúde vinculadas às secretarias.
          </p>
        </div>
        <div className="flex flex-1 items-center gap-3 lg:max-w-xl lg:justify-end">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por nome, sigla ou CNES"
              className="h-11 rounded-xl border-slate-200 bg-white pl-9 shadow-sm transition focus-visible:ring-2 focus-visible:ring-teal-500/30"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Button
            type="button"
            onClick={exportCsv}
            variant="outline"
            className="h-11 shrink-0 rounded-xl border-slate-200 bg-white px-4 font-medium text-slate-700 shadow-sm transition hover:-translate-y-px hover:border-slate-300 hover:bg-slate-50"
          >
            <Download className="mr-1.5 h-4 w-4" strokeWidth={2} /> Exportar
          </Button>
          {canCreate && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={openNew}
                  className="h-11 shrink-0 rounded-xl bg-slate-900 px-5 font-medium text-white shadow-sm shadow-slate-900/20 transition hover:-translate-y-px hover:bg-slate-800 hover:shadow-md hover:shadow-slate-900/25 focus-visible:ring-2 focus-visible:ring-slate-900/40"
                >
                  <Plus className="mr-1.5 h-4 w-4" strokeWidth={2.25} /> Nova Unidade
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{form.id ? "Editar Unidade" : "Nova Unidade"}</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label>Nome *</Label>
                    <Input
                      value={form.nome}
                      onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Sigla</Label>
                    <Input
                      value={form.sigla}
                      onChange={(e) => setForm({ ...form, sigla: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Secretaria *</Label>
                    <Select
                      value={form.secretaria_id}
                      onValueChange={(v) => setForm({ ...form, secretaria_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {secretarias.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>CNES</Label>
                    <Input
                      value={form.cnes}
                      onChange={(e) => setForm({ ...form, cnes: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>CNPJ</Label>
                    <Input
                      value={form.cnpj}
                      onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select
                      value={form.tipo_unidade || "__none__"}
                      onValueChange={(v) =>
                        setForm({ ...form, tipo_unidade: v === "__none__" ? "" : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— não informado —</SelectItem>
                        {/* Mantém compatibilidade se a unidade já tem um tipo que foi inativado/removido */}
                        {form.tipo_unidade &&
                          !tiposUnidade.some((t) => t.nome === form.tipo_unidade) && (
                            <SelectItem value={form.tipo_unidade}>
                              {form.tipo_unidade} (legado)
                            </SelectItem>
                          )}
                        {tiposUnidade
                          .filter((t) => t.status === "ativa" || t.nome === form.tipo_unidade)
                          .map((t) => (
                            <SelectItem key={t.id} value={t.nome}>
                              {t.nome}
                              {t.status !== "ativa" ? " (inativo)" : ""}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Nível de complexidade</Label>
                    <Input
                      placeholder="Primária, Secundária, Terciária"
                      value={form.nivel_complexidade}
                      onChange={(e) => setForm({ ...form, nivel_complexidade: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Tipo de atendimento</Label>
                    <Input
                      placeholder="Ambulatorial, Hospitalar, Urgência, Domiciliar"
                      value={form.tipo_atendimento}
                      onChange={(e) => setForm({ ...form, tipo_atendimento: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Município</Label>
                    <Input
                      placeholder="Ex.: Oriximiná"
                      value={form.municipio}
                      onChange={(e) => setForm({ ...form, municipio: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Distrito / região</Label>
                    <Input
                      placeholder="Ex.: Sede, Ribeirinha, Rural"
                      value={form.distrito}
                      onChange={(e) => setForm({ ...form, distrito: e.target.value })}
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
                    <Label>E-mail institucional</Label>
                    <Input
                      type="email"
                      value={form.email_institucional}
                      onChange={(e) => setForm({ ...form, email_institucional: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Responsável (Diretor de Unidade)</Label>
                    <Select
                      value={form.responsavel_nome || undefined}
                      onValueChange={(v) => setForm({ ...form, responsavel_nome: v })}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            diretores.length
                              ? "Selecione o responsável"
                              : "Nenhum Diretor de Unidade vinculado"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {diretores.map((d) => (
                          <SelectItem key={d.nome_completo} value={d.nome_completo}>
                            {d.nome_completo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.id && diretores.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Nenhum profissional com função "Diretor de Unidade" vinculado a esta
                        unidade. Cadastre em Profissionais.
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) => setForm({ ...form, status: v as StatusEnt })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Observações</Label>
                    <Textarea
                      rows={3}
                      value={form.observacoes}
                      onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter className="justify-between">
                  {form.id ? (
                    <Button variant="ghost" asChild>
                      <Link to="/setores" search={{ unidade: form.id }}>
                        <Network className="mr-1 h-4 w-4" /> Setores desta unidade
                      </Link>
                    </Button>
                  ) : (
                    <div />
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                    <Button disabled={upsert.isPending} onClick={() => upsert.mutate(form)}>
                      {form.id ? "Salvar" : "Criar"}
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Card principal envolvendo a lista */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
        {/* Cabeçalho de colunas (desktop) */}
        <div className="hidden border-b border-slate-100 bg-slate-50/60 px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 lg:grid lg:grid-cols-[minmax(0,2.2fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_120px] lg:gap-4">
          <span>Nome</span>
          <span>Sigla</span>
          <span>CNES</span>
          <span>Secretaria</span>
          <span>Status</span>
          <span className="text-right">Ações</span>
        </div>

        <div className="divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-10 text-center text-sm text-slate-500">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Nenhuma unidade cadastrada.
            </div>
          ) : (
            filtered.map((u) => (
              <div
                key={u.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate({ to: "/unidades/$id", params: { id: u.id } })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate({ to: "/unidades/$id", params: { id: u.id } });
                  }
                }}
                className="group grid cursor-pointer grid-cols-1 items-center gap-3 px-6 py-4 transition-colors duration-150 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none lg:grid-cols-[minmax(0,2.2fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_120px] lg:gap-4"
              >
                <div className="min-w-0">
                  <div className="truncate text-[14.5px] font-semibold text-slate-800 transition group-hover:text-slate-900">
                    {u.nome}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400 lg:hidden">
                    {u.sigla ?? "—"} · CNES {u.cnes ?? "—"}
                  </div>
                </div>
                <div className="hidden truncate text-sm text-slate-500 lg:block">
                  {u.sigla ?? "—"}
                </div>
                <div className="hidden truncate text-sm text-slate-500 lg:block">
                  {u.cnes ?? "—"}
                </div>
                <div className="hidden truncate text-sm text-slate-500 lg:block">
                  {u.secretaria?.sigla ?? u.secretaria?.nome ?? "—"}
                </div>
                <div className="flex lg:block">
                  <StatusPill status={u.status} />
                </div>
                <div
                  className="flex items-center justify-start gap-1 lg:justify-end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link
                    to="/unidades/$id"
                    params={{ id: u.id }}
                    title="Painel da unidade"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <LayoutDashboard className="h-4 w-4" strokeWidth={2} />
                  </Link>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      title="Editar"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-blue-600 transition hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Pencil className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      title="Arquivar"
                      onClick={() => {
                        void (async () => {
                          const ok = await askConfirm({
                            title: `Arquivar unidade "${u.nome}"?`,
                            description: "A unidade deixará de aparecer nas listagens ativas.",
                            tone: "destructive",
                            confirmLabel: "Arquivar",
                          });
                          if (ok) softDelete.mutate(u.id);
                        })();
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: StatusEnt }) {
  const map: Record<StatusEnt, { label: string; cls: string; dot: string }> = {
    ativa: {
      label: "Ativa",
      cls: "bg-emerald-100 text-emerald-800 ring-emerald-200",
      dot: "bg-emerald-500",
    },
    inativa: {
      label: "Inativa",
      cls: "bg-slate-100 text-slate-600 ring-slate-200",
      dot: "bg-slate-400",
    },
    suspensa: {
      label: "Suspensa",
      cls: "bg-amber-50 text-amber-700 ring-amber-100",
      dot: "bg-amber-500",
    },
    arquivada: {
      label: "Arquivada",
      cls: "bg-rose-50 text-rose-700 ring-rose-100",
      dot: "bg-rose-500",
    },
  };
  const s = map[status] ?? map.inativa;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${s.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
