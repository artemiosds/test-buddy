import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-permissions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertCircle, Pencil, Search, Settings2, Trash2, UserPlus } from "lucide-react";
import { createUsuario, updateUsuario, deleteUsuario, alterarPerfilStatusUsuario } from "@/lib/users-admin.functions";

export const Route = createFileRoute("/_authenticated/usuarios")({
  component: UsuariosPage,
});

type UsuarioRow = {
  id: string;
  nome_completo: string;
  email: string;
  status: string;
  perfil_id: string | null;
  acesso_todas_unidades: boolean;
  acesso_todas_secretarias: boolean;
  perfil: { nome: string; codigo: string } | null;
};

type Perfil = { id: string; codigo: string; nome: string };

const STATUS_OPTS = ["ativo", "pendente", "inativo", "bloqueado"] as const;

function UsuariosPage() {
  const location = useLocation();

  if (location.pathname !== "/usuarios") {
    return <Outlet />;
  }

  return <UsuariosList />;
}

function UsuariosList() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data: userCtx } = useCurrentUser();
  const isMaster = userCtx?.is_master === true;

  const { data: perfis = [] } = useQuery({
    queryKey: ["perfis"],
    queryFn: async (): Promise<Perfil[]> => {
      const { data, error } = await supabase
        .from("perfis")
        .select("id, codigo, nome")
        .is("deleted_at", null)
        .order("nivel_hierarquico");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ["unidades-select"],
    queryFn: async (): Promise<{ id: string; nome: string }[]> => {
      const { data, error } = await supabase
        .from("unidades")
        .select("id, nome")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async (): Promise<UsuarioRow[]> => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nome_completo, email, status, perfil_id, acesso_todas_unidades, acesso_todas_secretarias, perfil:perfis(nome, codigo)")
        .is("deleted_at", null)
        .order("nome_completo");
      if (error) throw error;
      return (data as unknown as UsuarioRow[]) ?? [];
    },
  });

  const alterarPerfilStatusFn = useServerFn(alterarPerfilStatusUsuario);
  const updateUser = useMutation({
    mutationFn: async (patch: {
      id: string;
      perfil_id?: string;
      status?: (typeof STATUS_OPTS)[number];
    }) => {
      await alterarPerfilStatusFn({
        data: {
          id: patch.id,
          perfil_id: patch.perfil_id,
          status: patch.status,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success("Usuário atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = users.filter((u) => {
    const t = q.toLowerCase();
    return (
      !t ||
      u.nome_completo?.toLowerCase().includes(t) ||
      u.email?.toLowerCase().includes(t)
    );
  });

  const createFn = useServerFn(createUsuario);
  const updateFn = useServerFn(updateUsuario);
  const deleteFn = useServerFn(deleteUsuario);
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<UsuarioRow | null>(null);
  const [editForm, setEditForm] = useState({ nome_completo: "", email: "", telefone: "", password: "" });
  const [editError, setEditError] = useState<string | null>(null);

  const editMut = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      setEditError(null);
      await updateFn({
        data: {
          id: editing.id,
          nome_completo: editForm.nome_completo || undefined,
          email: editForm.email || undefined,
          telefone: editForm.telefone,
          password: editForm.password || undefined,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success("Usuário atualizado");
      setEditing(null);
    },
    onError: (e: Error) => {
      setEditError(e.message);
      toast.error(e.message);
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await deleteFn({ data: { id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success("Usuário excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [form, setForm] = useState({
    nome_completo: "",
    email: "",
    telefone: "",
    perfil_id: "",
    password: "",
    unidade_ids: [] as string[],
    unidade_principal_id: "",
  });
  const [tempPass, setTempPass] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: async () => {
      setCreateError(null);
      return await createFn({
        data: {
          nome_completo: form.nome_completo,
          email: form.email,
          telefone: form.telefone || null,
          perfil_id: form.perfil_id,
          password: form.password || undefined,
          status: "ativo",
          unidade_ids: form.unidade_ids,
          unidade_principal_id: form.unidade_principal_id || null,
        },
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success("Usuário criado");
      if (!form.password) setTempPass(res.password);
      setForm({ nome_completo: "", email: "", telefone: "", perfil_id: "", password: "", unidade_ids: [], unidade_principal_id: "" });
      setOpenNew(false);
    },
    onError: (e: Error) => {
      const message = e.message || "Não foi possível criar o usuário.";
      setCreateError(message);
      toast.error(message);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Usuários e Permissões</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie perfis, status e permissões individuais.
          </p>
        </div>
        {isMaster && (
          <Dialog
            open={openNew}
            onOpenChange={(nextOpen) => {
              setOpenNew(nextOpen);
              if (nextOpen) setCreateError(null);
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" /> Novo usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo usuário</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                {createError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Usuário não foi criado</AlertTitle>
                    <AlertDescription>{createError}</AlertDescription>
                  </Alert>
                )}
                <div className="grid gap-1.5">
                  <Label>Nome completo</Label>
                  <Input
                    value={form.nome_completo}
                    onChange={(e) => setForm({ ...form, nome_completo: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Telefone (opcional)</Label>
                  <Input
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Perfil</Label>
                  <Select
                    value={form.perfil_id}
                    onValueChange={(v) => setForm({ ...form, perfil_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um perfil" />
                    </SelectTrigger>
                    <SelectContent>
                      {perfis.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Senha (opcional — gerada se vazia)</Label>
                  <Input
                    type="text"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="mín. 6 caracteres"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Unidades vinculadas (opcional)</Label>
                  <p className="text-xs text-muted-foreground">
                    Para Diretor de Unidade, marque a(s) unidade(s) que ele irá gerenciar.
                  </p>
                  <div className="max-h-40 overflow-auto rounded-md border p-2 space-y-1">
                    {unidades.length === 0 ? (
                      <div className="text-xs text-muted-foreground">Nenhuma unidade cadastrada.</div>
                    ) : (
                      unidades.map((u) => {
                        const checked = form.unidade_ids.includes(u.id);
                        return (
                          <label key={u.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...form.unidade_ids, u.id]
                                  : form.unidade_ids.filter((x) => x !== u.id);
                                setForm({
                                  ...form,
                                  unidade_ids: next,
                                  unidade_principal_id:
                                    form.unidade_principal_id && next.includes(form.unidade_principal_id)
                                      ? form.unidade_principal_id
                                      : next[0] ?? "",
                                });
                              }}
                            />
                            <span>{u.nome}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
                {form.unidade_ids.length > 1 && (
                  <div className="grid gap-1.5">
                    <Label>Unidade principal</Label>
                    <Select
                      value={form.unidade_principal_id}
                      onValueChange={(v) => setForm({ ...form, unidade_principal_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a unidade principal" />
                      </SelectTrigger>
                      <SelectContent>
                        {unidades
                          .filter((u) => form.unidade_ids.includes(u.id))
                          .map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenNew(false)}>
                  Cancelar
                </Button>
                <Button
                  disabled={
                    !form.nome_completo || !form.email || !form.perfil_id || createMut.isPending
                  }
                  onClick={() => {
                    setCreateError(null);
                    createMut.mutate();
                  }}
                >
                  {createMut.isPending ? "Criando..." : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!isMaster && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acesso administrativo restrito</AlertTitle>
          <AlertDescription>
            Somente usuário MASTER pode criar usuários, alterar perfil, alterar status ou conceder permissões individuais.
          </AlertDescription>
        </Alert>
      )}

      {tempPass && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          Usuário criado. Senha temporária: <code className="font-mono">{tempPass}</code>
          <Button
            size="sm"
            variant="ghost"
            className="ml-2"
            onClick={() => setTempPass(null)}
          >
            Ocultar
          </Button>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou e-mail"
          className="pl-8"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">E-mail</th>
              <th className="px-4 py-2">Perfil</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{u.nome_completo}</td>
                  <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {isMaster ? (
                        <Select
                          value={u.perfil_id ?? undefined}
                          onValueChange={(v) => {
                            const oldCod = u.perfil?.codigo;
                            const newCod = perfis.find((p) => p.id === v)?.codigo;
                            if (newCod === "MASTER" && oldCod !== "MASTER") {
                              if (!confirm(`Isso vai conceder a ${u.nome_completo} acesso irrestrito a TODAS as unidades e secretarias (nível Master). Confirma?`)) return;
                            } else if (oldCod === "MASTER" && newCod !== "MASTER") {
                              if (!confirm(`Isso vai REMOVER o acesso Master (total) de ${u.nome_completo}. Confirma?`)) return;
                            }
                            updateUser.mutate({ id: u.id, perfil_id: v });
                          }}
                        >
                          <SelectTrigger className="h-8 w-[180px]">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {perfis.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary">{u.perfil?.nome ?? "—"}</Badge>
                      )}
                      {u.acesso_todas_unidades && u.acesso_todas_secretarias && (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                          MASTER — acesso total
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {isMaster ? (
                      <Select
                        value={u.status}
                        onValueChange={(v) => updateUser.mutate({ id: u.id, status: v as (typeof STATUS_OPTS)[number] })}
                      >
                        <SelectTrigger className="h-8 w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTS.map((s) => (
                            <SelectItem key={s} value={s}>
                              <Badge variant="secondary" className={statusColor(s)}>
                                {s}
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className={statusColor(u.status)}>
                        {u.status}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {isMaster ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild size="sm" variant="outline">
                          <Link to="/usuarios/$id" params={{ id: u.id }}>
                            <Settings2 className="mr-1 h-3.5 w-3.5" /> Permissões
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditError(null);
                            setEditForm({
                              nome_completo: u.nome_completo ?? "",
                              email: u.email ?? "",
                              telefone: "",
                              password: "",
                            });
                            setEditing(u);
                          }}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-rose-600 hover:text-rose-700"
                          disabled={deleteMut.isPending}
                          onClick={() => {
                            if (confirm(`Excluir definitivamente o usuário ${u.nome_completo}? Esta ação remove o acesso ao sistema.`)) {
                              deleteMut.mutate(u.id);
                            }
                          }}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="outline">Somente Master</Badge>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            {editError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Não foi possível salvar</AlertTitle>
                <AlertDescription>{editError}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-1.5">
              <Label>Nome completo</Label>
              <Input
                value={editForm.nome_completo}
                onChange={(e) => setEditForm({ ...editForm, nome_completo: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Telefone</Label>
              <Input
                value={editForm.telefone}
                onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Nova senha (opcional)</Label>
              <Input
                type="text"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                placeholder="mín. 6 caracteres — deixe em branco para manter"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button disabled={editMut.isPending} onClick={() => editMut.mutate()}>
              {editMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
