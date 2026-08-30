import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { fallback } from "@/lib/search-validator";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { FormDialog } from "@/components/shared/FormDialog";
import { toast } from "sonner";
import { Plus, Pencil, PowerOff, Power, Network, LayoutDashboard, Trash2, AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser, usePermissions } from "@/hooks/use-permissions";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { TIPOS_SETOR, setorFormSchema } from "@/lib/setores.validation";
import { formatCNPJ, formatCNES } from "@/utils/formatters";

const searchSchema = z.object({
  unidade: fallback(z.string(), "").default(""),
  page: fallback(z.number().int(), 1).default(1),
});

export const Route = createFileRoute("/_authenticated/setores")({ errorComponent: ErrorComponent,
  validateSearch: searchSchema,
  component: SetoresPage,
});

type Setor = {
  id: string;
  unidade_id: string;
  nome: string;
  sigla: string | null;
  status: "ativa" | "inativa" | "suspensa" | "arquivada";
  gestor_id: string | null;
  observacoes: string | null;
  cnes: string | null;
  tipo: string | null;
  cnpj: string | null;
  endereco: string | null;
  gestor: { id: string; nome_completo: string } | null;
};

const emptyForm = {
  nome: "",
  sigla: "",
  gestor_id: "",
  observacoes: "",
  cnes: "",
  tipo: "",
  cnpj: "",
  endereco: "",
};

const PAGE_SIZE = 15;

function SetoresPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: userCtx, isLoading: userLoading } = useCurrentUser();
  const { has } = usePermissions();
  const canManage = !!userCtx?.is_master || has("unidade.editar");
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Setor | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});

  const { data: unidades = [] } = useQuery({
    queryKey: ["unidades-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidades")
        .select("id, nome, sigla")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const unidadeId = search.unidade ?? "";

  // Profissionais ativos da unidade — candidatos a gestor do setor.
  const { data: gestoresOpt = [] } = useQuery({
    queryKey: ["setores-gestores-opt", unidadeId],
    queryFn: async () => {
      if (!unidadeId) return [];
      const { data, error } = await supabase
        .from("profissionais")
        .select("id, nome_completo")
        .eq("unidade_id", unidadeId)
        .eq("status", "ativo")
        .is("deleted_at", null)
        .order("nome_completo");
      if (error) throw error;
      return (data ?? []) as { id: string; nome_completo: string }[];
    },
    enabled: !!unidadeId,
  });

  const { data: setoresData, isLoading } = useQuery({
    queryKey: ["setores-admin", unidadeId, search.page],
    queryFn: async () => {
      if (!unidadeId) return { data: [] as Setor[], count: 0 };
      const from = (search.page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from("setores")
        .select(
          "id, unidade_id, nome, sigla, status, gestor_id, observacoes, cnes, tipo, cnpj, endereco, gestor:profissionais!setores_gestor_id_fkey(id, nome_completo)",
          { count: "exact" }
        )
        .eq("unidade_id", unidadeId)
        .is("deleted_at", null)
        .order("nome")
        .range(from, to);

      if (error) throw error;
      return {
        data: (data ?? []) as unknown as Setor[],
        count: count ?? 0,
      };
    },
    enabled: !!unidadeId,
  });

  const setores = setoresData?.data ?? [];
  const totalCount = setoresData?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const { data: uso = {} } = useQuery({
    queryKey: ["setores-uso", unidadeId],
    queryFn: async () => {
      if (!unidadeId) return {};
      const { data, error } = await supabase
        .rpc("get_setores_uso", { p_unidade_id: unidadeId });
      
      if (error) throw error;
      
      const map: Record<string, number> = {};
      (data as { setor_id: string; total: number }[] ?? []).forEach((r) => {
        map[r.setor_id] = r.total;
      });
      return map;
    },
    enabled: !!unidadeId,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      setErrors({});
      const validation = setorFormSchema.safeParse(form);
      
      if (!validation.success) {
        const fieldErrors = validation.error.flatten().fieldErrors;
        setErrors(fieldErrors);
        throw new Error("Verifique os campos obrigatórios");
      }

      if (!unidadeId) throw new Error("Selecione uma unidade");
      
      const payload = {
        nome: form.nome.trim(),
        sigla: form.sigla.trim() || null,
        gestor_id: form.gestor_id || null,
        observacoes: form.observacoes.trim() || null,
        cnes: form.cnes.replace(/\D/g, "") || null,
        tipo: form.tipo.trim() || null,
        cnpj: form.cnpj.replace(/\D/g, "") || null,
        endereco: form.endereco.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("setores").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("setores")
          .insert({ ...payload, unidade_id: unidadeId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Setor atualizado" : "Setor criado");
      setOpen(false);
      setEditing(null);
      setForm({ ...emptyForm });
      setErrors({});
      qc.invalidateQueries({ queryKey: ["setores-admin"] });
      qc.invalidateQueries({ queryKey: ["setores-select"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async (s: Setor) => {
      const novo = s.status === "ativa" ? "inativa" : "ativa";
      const { error } = await supabase.from("setores").update({ status: novo }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["setores-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirm = useConfirm();
  const deleteMut = useMutation({
    mutationFn: async (s: Setor) => {
      const usoCount = uso[s.id] ?? 0;
      if (usoCount > 0) {
        throw new Error(
          `Não é possível excluir: existem ${usoCount} profissional(is) vinculado(s). Reatribua-os antes.`,
        );
      }
      const { error } = await supabase
        .from("setores")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Setor excluído");
      qc.invalidateQueries({ queryKey: ["setores-admin"] });
      qc.invalidateQueries({ queryKey: ["setores-select"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const askDelete = async (s: Setor) => {
    const ok = await confirm({
      title: `Excluir setor "${s.nome}"?`,
      description:
        "Esta ação remove o setor do sistema (exclusão lógica). Setores com profissionais vinculados não podem ser excluídos — inative-os.",
      confirmLabel: "Excluir",
      tone: "destructive",
    });
    if (ok) deleteMut.mutate(s);
  };

  const abrirNovo = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setErrors({});
    setOpen(true);
  };
  const abrirEdit = (s: Setor) => {
    setEditing(s);
    setErrors({});
    setForm({
      nome: s.nome,
      sigla: s.sigla ?? "",
      gestor_id: s.gestor_id ?? "",
      observacoes: s.observacoes ?? "",
      cnes: s.cnes ?? "",
      tipo: s.tipo ?? "",
      cnpj: s.cnpj ?? "",
      endereco: s.endereco ?? "",
    });
    setOpen(true);
  };

  if (userLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  if (!canManage) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apenas Master ou Gestor podem gerenciar setores.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Network className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Setores</h1>
          <p className="text-sm text-muted-foreground">
            Setores são organizados por unidade. Selecione a unidade para gerenciar.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[280px]">
          <Label>Unidade</Label>
          <Select
            value={unidadeId || undefined}
            onValueChange={(v) => navigate({ search: { unidade: v, page: 1 } })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma unidade" />
            </SelectTrigger>
            <SelectContent>
              {unidades.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.sigla ? `${u.sigla} — ${u.nome}` : u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {unidadeId && (
          <>
            <Button onClick={abrirNovo}>
              <Plus className="mr-1 h-4 w-4" /> Novo setor
            </Button>
            <FormDialog
              open={open}
              onOpenChange={setOpen}
              title={editing ? "Editar setor" : "Novo setor"}
              onSubmit={() => saveMut.mutate()}
              loading={saveMut.isPending}
            >
              <div className="grid gap-3">
                <div>
                  <Label className={errors.nome ? "text-destructive" : ""}>Nome *</Label>
                  <Input
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    className={errors.nome ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {errors.nome && (
                    <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {errors.nome[0]}
                    </p>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className={errors.sigla ? "text-destructive" : ""}>Sigla</Label>
                    <Input
                      value={form.sigla}
                      onChange={(e) => setForm({ ...form, sigla: e.target.value })}
                      className={errors.sigla ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {errors.sigla && (
                      <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.sigla[0]}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className={errors.tipo ? "text-destructive" : ""}>Tipo *</Label>
                    <Select
                      value={form.tipo}
                      onValueChange={(val) => setForm({ ...form, tipo: val })}
                    >
                      <SelectTrigger className={errors.tipo ? "border-destructive focus:ring-destructive" : ""}>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_SETOR.map((tipo) => (
                          <SelectItem key={tipo} value={tipo}>
                            {tipo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.tipo && (
                      <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.tipo[0]}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className={errors.cnes ? "text-destructive" : ""}>CNES</Label>
                    <Input
                      inputMode="numeric"
                      placeholder="7 dígitos"
                      value={form.cnes}
                      onChange={(e) =>
                        setForm({ ...form, cnes: formatCNES(e.target.value) })
                      }
                      className={errors.cnes ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {errors.cnes && (
                      <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.cnes[0]}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className={errors.cnpj ? "text-destructive" : ""}>CNPJ</Label>
                    <Input
                      inputMode="numeric"
                      placeholder="00.000.000/0000-00"
                      value={form.cnpj}
                      onChange={(e) =>
                        setForm({ ...form, cnpj: formatCNPJ(e.target.value) })
                      }
                      className={errors.cnpj ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {errors.cnpj && (
                      <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.cnpj[0]}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Endereço</Label>
                  <Input
                    placeholder="Rua, nº, bairro, cidade"
                    value={form.endereco}
                    onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Gestor do setor</Label>
                  <Select
                    value={form.gestor_id || "__none__"}
                    onValueChange={(v) =>
                      setForm({ ...form, gestor_id: v === "__none__" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um profissional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— não informado —</SelectItem>
                      {gestoresOpt.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome_completo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Apenas profissionais ativos vinculados à unidade aparecem aqui.
                  </p>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea
                    rows={3}
                    value={form.observacoes}
                    onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  />
                </div>
              </div>
            </FormDialog>
          </>
        )}
      </div>

      {!unidadeId ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Selecione uma unidade para listar os setores.
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
          ) : setores.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              Nenhum setor cadastrado para esta unidade.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Sigla</th>
                  <th className="p-3">Gestor</th>
                  <th className="p-3">Em uso</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {setores.map((s) => {
                  const usoCount = uso[s.id] ?? 0;
                  return (
                    <tr
                      key={s.id}
                      className="border-t cursor-pointer transition hover:bg-accent/40"
                      onClick={() => nav({ to: "/setores/$id", params: { id: s.id } })}
                    >
                      <td className="p-3 font-medium">{s.nome}</td>
                      <td className="p-3 text-muted-foreground">{s.sigla ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">
                        {s.gestor?.nome_completo ?? "—"}
                      </td>
                      <td className="p-3">
                        {usoCount > 0 ? (
                          <Badge variant="secondary">{usoCount}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant={s.status === "ativa" ? "default" : "outline"}>
                          {s.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" asChild title="Painel do setor">
                            <Link to="/setores/$id" params={{ id: s.id }}>
                              <LayoutDashboard className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => abrirEdit(s)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleMut.mutate(s)}
                            title={s.status === "ativa" ? "Inativar" : "Ativar"}
                          >
                            {s.status === "ativa" ? (
                              <PowerOff className="h-4 w-4 text-destructive" />
                            ) : (
                              <Power className="h-4 w-4 text-primary" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => askDelete(s)}
                            disabled={usoCount > 0}
                            title={
                              usoCount > 0
                                ? "Não é possível excluir: há profissionais vinculados"
                                : "Excluir setor"
                            }
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {totalPages > 1 && (
            <div className="border-t p-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Mostrando {setores.length} de {totalCount} setores
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() =>
                        search.page > 1 &&
                        navigate({ search: { ...search, page: search.page - 1 } })
                      }
                      className={
                        search.page === 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                    // Lógica simples para não mostrar todas as páginas se forem muitas
                    if (
                      totalPages > 7 &&
                      p > 1 &&
                      p < totalPages &&
                      Math.abs(p - search.page) > 1
                    ) {
                      if (Math.abs(p - search.page) === 2) {
                        return (
                          <PaginationItem key={p}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        );
                      }
                      return null;
                    }

                    return (
                      <PaginationItem key={p}>
                        <PaginationLink
                          isActive={search.page === p}
                          onClick={() => navigate({ search: { ...search, page: p } })}
                          className="cursor-pointer"
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        search.page < totalPages &&
                        navigate({ search: { ...search, page: search.page + 1 } })
                      }
                      className={
                        search.page === totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Setores em uso por profissionais não podem ser excluídos — apenas inativados.
      </p>
    </div>
  );
}
