import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";

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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { Search, Plus, Pencil, Trash2, Network, LayoutDashboard, Download } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { useCurrentUser } from "@/hooks/use-permissions";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatCNPJ, formatCNES, formatPhone } from "@/utils/formatters";

export const Route = createFileRoute("/_authenticated/unidades/")({ errorComponent: ErrorComponent,
  component: UnidadesPage,
});

type StatusEnt = Database["public"]["Enums"]["status_entidade"];

const unidadeSchema = z.object({
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres").max(255),
  sigla: z.string().max(20).nullable().optional(),
  cnes: z.string().regex(/^\d{7}$/, "CNES deve ter exatamente 7 dígitos numéricos").nullable().optional().or(z.literal("")),
  cnpj: z.string().regex(/^\d{14}$/, "CNPJ deve ter 14 dígitos").nullable().optional().or(z.literal("")),
  tipo_unidade: z.string().nullable().optional(),
  nivel_complexidade: z.string().nullable().optional(),
  tipo_atendimento: z.string().nullable().optional(),
  municipio: z.string().nullable().optional(),
  distrito: z.string().nullable().optional(),
  telefone: z.string().nullable().optional(),
  email_institucional: z.string().email("E-mail inválido").nullable().optional().or(z.literal("")),
  responsavel_nome: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  status: z.enum(["ativa", "inativa", "suspensa", "arquivada"]),
  secretaria_id: z.string().uuid("Secretaria é obrigatória"),
});

type UnidadeFormValues = z.infer<typeof unidadeSchema>;

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
  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<UnidadeFormValues>({
    resolver: zodResolver(unidadeSchema),
    defaultValues: {
      nome: "",
      sigla: "",
      cnes: "",
      cnpj: "",
      tipo_unidade: "",
      nivel_complexidade: "",
      tipo_atendimento: "",
      municipio: "Oriximiná",
      distrito: "",
      telefone: "",
      email_institucional: "",
      responsavel_nome: "",
      observacoes: "",
      status: "ativa",
      secretaria_id: "",
    },
  });

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

  // Otimização: Busca de Diretores limitada e apenas quando o modal abre
  const { data: diretores = [] } = useQuery({
    queryKey: ["diretores-unidade-minimo", editingId ?? "novo"],
    queryFn: async () => {
      // 1) Profissionais com função "Diretor de Unidade" (limitando campos)
      let profQ = supabase
        .from("profissionais")
        .select("nome_completo, funcao:funcoes!inner(codigo)")
        .is("deleted_at", null)
        .eq("status", "ativo")
        .eq("funcao.codigo", "DIR-UN")
        .order("nome_completo");
      
      if (editingId) profQ = profQ.eq("unidade_id", editingId);
      
      const { data: profs, error: pErr } = await profQ;
      if (pErr) throw pErr;

      // 2) Usuários com perfil "Diretor de Unidade"
      const { data: users, error: uErr } = await supabase
        .from("usuarios")
        .select("nome_completo, perfil:perfis!inner(codigo)")
        .is("deleted_at", null)
        .eq("status", "ativo")
        .eq("perfil.codigo", "DIRETOR_UNIDADE")
        .order("nome_completo");
      if (uErr) throw uErr;

      const merged = new Set<string>();
      (profs ?? []).forEach(p => merged.add(p.nome_completo));
      (users ?? []).forEach(u => merged.add(u.nome_completo));
      
      return Array.from(merged).map(nome => ({ nome_completo: nome }));
    },
    enabled: open,
    staleTime: 1000 * 60 * 5, // Cache de 5 minutos
  });

  const PAGE_SIZE = 20;

  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["unidades", q],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from("unidades")
        .select(
          "id, nome, sigla, cnes, cnpj, tipo_unidade, nivel_complexidade, tipo_atendimento, municipio, distrito, telefone, email_institucional, responsavel_nome, observacoes, status, secretaria_id, secretaria:secretarias(nome, sigla)",
          { count: "exact" }
        )
        .is("deleted_at", null)
        .order("nome")
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (q.trim()) {
        const searchTerm = q.trim();
        query = query.or(`nome.ilike.%${searchTerm}%,sigla.ilike.%${searchTerm}%,cnes.ilike.%${searchTerm}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: (data as unknown as Unidade[]) ?? [], count };
    },
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.flatMap(p => p.data).length;
      if (lastPage.count && currentCount < lastPage.count) {
        return currentCount;
      }
      return undefined;
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const unidades = useMemo(() => infiniteData?.pages.flatMap((page) => page.data) ?? [], [infiniteData]);


  const upsert = useMutation({
    mutationFn: async (values: UnidadeFormValues) => {
      const cleanData = {
        ...values,
        cnpj: values.cnpj?.replace(/\D/g, "") || null,
        telefone: values.telefone?.replace(/\D/g, "") || null,
        cnes: values.cnes?.replace(/\D/g, "") || null,
        email_institucional: values.email_institucional || null,
        sigla: values.sigla || null,
      };

      if (editingId) {
        const { error } = await supabase.from("unidades").update(cleanData).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("unidades").insert(cleanData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unidades"] });
      setOpen(false);
      setEditingId(null);
      form.reset();
      toast.success("Unidade salva com sucesso");
    },
    onError: (e: Error) => toast.error(`Erro ao salvar: ${e.message}`),
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

  const filtered = unidades;


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
    setEditingId(null);
    form.reset({
      nome: "",
      sigla: "",
      cnes: "",
      cnpj: "",
      tipo_unidade: "",
      nivel_complexidade: "",
      tipo_atendimento: "",
      municipio: "Oriximiná",
      distrito: "",
      telefone: "",
      email_institucional: "",
      responsavel_nome: "",
      observacoes: "",
      status: "ativa",
      secretaria_id: secretarias[0]?.id ?? "",
    });
    setOpen(true);
  }

  function openEdit(u: Unidade) {
    setEditingId(u.id);
    form.reset({
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
              className="h-11 rounded-xl border-border bg-card pl-9 shadow-sm transition focus-visible:ring-2 focus-visible:ring-ring/30"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Button
            type="button"
            onClick={exportCsv}
            variant="outline"
            className="h-11 shrink-0 rounded-xl border-border bg-card px-4 font-medium text-foreground shadow-sm transition hover:-translate-y-px hover:border-border hover:bg-muted"
          >
            <Download className="mr-1.5 h-4 w-4" strokeWidth={2} /> Exportar
          </Button>
          {canCreate && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={openNew}
                  className="h-11 shrink-0 rounded-xl bg-primary px-5 font-medium text-primary-foreground shadow-sm shadow-primary/20 transition hover:-translate-y-px hover:bg-primary/90 hover:shadow-md hover:shadow-primary/25 focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <Plus className="mr-1.5 h-4 w-4" strokeWidth={2.25} /> Nova Unidade
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Editar Unidade" : "Nova Unidade"}</DialogTitle>
                </DialogHeader>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((v) => upsert.mutate(v))} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="nome"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Nome *</FormLabel>
                            <FormControl>
                              <Input placeholder="Nome completo da unidade" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="sigla"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sigla</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: UBS, HMSD..." {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="secretaria_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Secretaria *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione a secretaria" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {secretarias.map((s) => (
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

                      <FormField
                        control={form.control}
                        name="cnes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CNES</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="0000000" 
                                {...field} 
                                value={field.value || ""} 
                                onChange={(e) => {
                                  field.onChange(formatCNES(e.target.value));
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="cnpj"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CNPJ</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="00.000.000/0000-00" 
                                {...field} 
                                value={field.value || ""}
                                onChange={(e) => {
                                  field.onChange(formatCNPJ(e.target.value));
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="tipo_unidade"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo</FormLabel>
                            <Select 
                              onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)} 
                              value={field.value || "__none__"}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o tipo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="__none__">— não informado —</SelectItem>
                                {field.value && !tiposUnidade.some(t => t.nome === field.value) && (
                                  <SelectItem value={field.value}>{field.value} (legado)</SelectItem>
                                )}
                                {tiposUnidade.filter(t => t.status === "ativa" || t.nome === field.value).map((t) => (
                                  <SelectItem key={t.id} value={t.nome}>
                                    {t.nome}{t.status !== "ativa" ? " (inativo)" : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="nivel_complexidade"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nível de complexidade</FormLabel>
                            <FormControl>
                              <Input placeholder="Primária, Secundária..." {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="municipio"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Município</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="telefone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="(00) 00000-0000" 
                                {...field} 
                                value={field.value || ""}
                                onChange={(e) => {
                                  field.onChange(formatPhone(e.target.value));
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email_institucional"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>E-mail institucional</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="email@municipio.gov.br" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="responsavel_nome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Responsável (Diretor)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={diretores.length ? "Selecione o responsável" : "Nenhum Diretor encontrado"} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {diretores.map((d) => (
                                  <SelectItem key={d.nome_completo} value={d.nome_completo}>
                                    {d.nome_completo}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {STATUS_OPTS.map((s) => (
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="observacoes"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Observações</FormLabel>
                            <FormControl>
                              <Textarea rows={3} {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <DialogFooter className="pt-4">
                      <div className="flex w-full items-center justify-between">
                        {editingId ? (
                          <Button variant="ghost" type="button" asChild>
                            <Link to="/setores" search={{ unidade: editingId, page: 1 }}>
                              <Network className="mr-1 h-4 w-4" /> Setores
                            </Link>
                          </Button>
                        ) : <div />}
                        <div className="flex gap-2">
                          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                            Cancelar
                          </Button>
                          <Button type="submit" disabled={upsert.isPending}>
                            {editingId ? "Salvar" : "Criar"}
                          </Button>
                        </div>
                      </div>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>

            </Dialog>
          )}
        </div>
      </div>

      {/* Card principal envolvendo a lista */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
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
        
        {hasNextPage && (
          <div className="flex justify-center p-6 border-t border-slate-100 bg-slate-50/30">
            <Button 
              variant="outline" 
              onClick={() => fetchNextPage()} 
              disabled={isFetchingNextPage}
              className="rounded-xl"
            >
              {isFetchingNextPage ? "Carregando mais..." : "Ver mais unidades"}
            </Button>
          </div>
        )}
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
