import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-permissions";
import {
  createPerfil,
  updatePerfil,
  duplicarPerfil,
  deletePerfil,
} from "@/lib/profiles-admin.functions";
import { Button } from "@/components/ui/button";
import { OfflineButton } from "@/components/shared/OfflineButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormDialog, useConfirm } from "@/components/shared";
import { toast } from "sonner";
import {
  AlertCircle,
  Copy,
  KeyRound,
  Pencil,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/configuracao/perfis")({ errorComponent: ErrorComponent,
  component: PerfisPage,
});

type PerfilRow = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  nivel_hierarquico: number;
  admin_2fa_required: boolean;
  is_sistema: boolean;
  status: "ativa" | "inativa" | "suspensa" | "arquivada";
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

type FormState = {
  codigo: string;
  nome: string;
  descricao: string;
  nivel_hierarquico: number;
  admin_2fa_required: boolean;
  copiar_de: string;
};

const EMPTY_FORM: FormState = {
  codigo: "",
  nome: "",
  descricao: "",
  nivel_hierarquico: 100,
  admin_2fa_required: false,
  copiar_de: "",
};

function PerfisPage() {
  const location = useLocation();
  if (location.pathname !== "/configuracao/perfis") {
    return <Outlet />;
  }
  return <PerfisList />;
}

function PerfisList() {
  const qc = useQueryClient();
  const { data: userCtx } = useCurrentUser();
  const isMaster = userCtx?.is_master === true;
  const askConfirm = useConfirm();

  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<PerfilRow | null>(null);
  const [duplicating, setDuplicating] = useState<PerfilRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [dupForm, setDupForm] = useState({ novo_codigo: "", novo_nome: "" });

  const { data: perfis = [], isLoading } = useQuery({
    queryKey: ["perfis-admin"],
    queryFn: async (): Promise<PerfilRow[]> => {
      const { data, error } = await supabase
        .from("perfis")
        .select(
          "id, codigo, nome, descricao, nivel_hierarquico, admin_2fa_required, is_sistema, status, created_at, updated_at, created_by, updated_by",
        )
        .is("deleted_at", null)
        .order("nivel_hierarquico");
      if (error) throw error;
      return (data ?? []) as PerfilRow[];
    },
  });

  const { data: usersCount = {} } = useQuery({
    queryKey: ["perfis-users-count"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("perfil_id")
        .is("deleted_at", null);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data ?? []) {
        const k = (r as { perfil_id: string | null }).perfil_id;
        if (k) map[k] = (map[k] ?? 0) + 1;
      }
      return map;
    },
  });

  const { data: permsCount = {} } = useQuery({
    queryKey: ["perfis-perms-count"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("perfil_permissoes")
        .select("perfil_id, concedida");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of (data ?? []) as { perfil_id: string; concedida: boolean }[]) {
        if (r.concedida) map[r.perfil_id] = (map[r.perfil_id] ?? 0) + 1;
      }
      return map;
    },
  });

  const createFn = useServerFn(createPerfil);
  const updateFn = useServerFn(updatePerfil);
  const dupFn = useServerFn(duplicarPerfil);
  const delFn = useServerFn(deletePerfil);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["perfis-admin"] });
    qc.invalidateQueries({ queryKey: ["perfis"] });
    qc.invalidateQueries({ queryKey: ["perfis-perms-count"] });
  };

  const createM = useMutation({
    mutationFn: async () => {
      await createFn({
        data: {
          codigo: form.codigo.trim().toUpperCase(),
          nome: form.nome.trim(),
          descricao: form.descricao.trim() || null,
          nivel_hierarquico: form.nivel_hierarquico,
          admin_2fa_required: form.admin_2fa_required,
          copiar_de: form.copiar_de || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Perfil criado.");
      setOpenCreate(false);
      setForm(EMPTY_FORM);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateM = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      await updateFn({
        data: {
          id: editing.id,
          codigo: editing.is_sistema ? undefined : form.codigo.trim().toUpperCase(),
          nome: form.nome.trim(),
          descricao: form.descricao.trim() || null,
          nivel_hierarquico: form.nivel_hierarquico,
          admin_2fa_required: form.admin_2fa_required,
        },
      });
    },
    onSuccess: () => {
      toast.success("Perfil atualizado.");
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dupM = useMutation({
    mutationFn: async () => {
      if (!duplicating) return;
      await dupFn({
        data: {
          id: duplicating.id,
          novo_codigo: dupForm.novo_codigo.trim().toUpperCase(),
          novo_nome: dupForm.novo_nome.trim(),
        },
      });
    },
    onSuccess: () => {
      toast.success("Perfil duplicado.");
      setDuplicating(null);
      setDupForm({ novo_codigo: "", novo_nome: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStatusM = useMutation({
    mutationFn: async (p: PerfilRow) => {
      await updateFn({
        data: { id: p.id, status: p.status === "ativa" ? "inativa" : "ativa" },
      });
    },
    onSuccess: () => {
      toast.success("Status atualizado.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: async (id: string) => {
      await delFn({ data: { id } });
    },
    onSuccess: () => {
      toast.success("Perfil excluído.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEdit(p: PerfilRow) {
    setForm({
      codigo: p.codigo,
      nome: p.nome,
      descricao: p.descricao ?? "",
      nivel_hierarquico: p.nivel_hierarquico,
      admin_2fa_required: p.admin_2fa_required,
      copiar_de: "",
    });
    setEditing(p);
  }

  function openDuplicate(p: PerfilRow) {
    setDupForm({
      novo_codigo: `${p.codigo}_COPIA`,
      novo_nome: `${p.nome} (cópia)`,
    });
    setDuplicating(p);
  }

  const askDelete = async (p: PerfilRow) => {
    const users = usersCount[p.id] ?? 0;
    const ok = await askConfirm({
      title: `Excluir o perfil "${p.nome}"?`,
      description:
        users > 0
          ? `Este perfil tem ${users} usuário(s) vinculado(s). A exclusão será bloqueada até que sejam migrados para outro perfil.`
          : "Esta ação faz uma exclusão lógica. O perfil deixará de aparecer nas telas administrativas.",
      confirmLabel: "Excluir",
      tone: "destructive",
    });
    if (ok) deleteM.mutate(p.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Perfis e Permissões</h1>
          <p className="text-sm text-muted-foreground">
            Gestão dos perfis padrão do sistema. As substituições individuais por usuário
            continuam disponíveis em Administração &rarr; Usuários e têm prioridade sobre a
            matriz de perfil.
          </p>
        </div>
        <Button
          onClick={() => {
            setForm(EMPTY_FORM);
            setOpenCreate(true);
          }}
          disabled={!isMaster}
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" /> Novo perfil
        </Button>
      </div>

      {!isMaster && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Somente MASTER pode gerenciar perfis</AlertTitle>
          <AlertDescription>
            Você pode visualizar a lista, mas não pode criar, editar, duplicar ou excluir
            perfis nem alterar a matriz de permissões.
          </AlertDescription>
        </Alert>
      )}

      <div className="overflow-hidden rounded-md border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Perfil</th>
              <th className="px-3 py-2 text-left">Código</th>
              <th className="px-3 py-2 text-left">Nível</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">2FA</th>
              <th className="px-3 py-2 text-left">Usuários</th>
              <th className="px-3 py-2 text-left">Permissões</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {!isLoading &&
              perfis.map((p) => {
                const isMasterRow = p.codigo === "MASTER";
                const users = usersCount[p.id] ?? 0;
                const perms = permsCount[p.id] ?? 0;
                return (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Link
                          to="/configuracao/perfis/$id"
                          params={{ id: p.id }}
                          className="font-medium text-primary hover:underline"
                        >
                          {p.nome}
                        </Link>
                        {p.is_sistema && (
                          <Badge variant="secondary" className="text-[10px]">
                            Sistema
                          </Badge>
                        )}
                      </div>
                      {p.descricao && (
                        <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {p.descricao}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{p.codigo}</td>
                    <td className="px-3 py-2">{p.nivel_hierarquico}</td>
                    <td className="px-3 py-2">
                      <Badge variant={p.status === "ativa" ? "default" : "secondary"}>
                        {p.status}
                      </Badge>

                    </td>
                    <td className="px-3 py-2">
                      {p.admin_2fa_required ? (
                        <Badge variant="default" className="gap-1">
                          <KeyRound className="h-3 w-3" /> obrigatório
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">opcional</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 text-sm">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {users}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      {isMasterRow ? (
                        <span className="text-xs text-muted-foreground">acesso total</span>
                      ) : (
                        perms
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          asChild
                          aria-label="Editar matriz"
                          title="Editar matriz de permissões"
                        >
                          <Link to="/configuracao/perfis/$id" params={{ id: p.id }}>
                            <Sparkles className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!isMaster}
                          aria-label="Editar perfil"
                          title="Editar perfil"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!isMaster}
                          aria-label="Duplicar perfil"
                          title="Duplicar perfil"
                          onClick={() => openDuplicate(p)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!isMaster || isMasterRow}
                          aria-label={p.status === "ativa" ? "Desativar" : "Ativar"}
                          title={p.status === "ativa" ? "Desativar" : "Ativar"}
                          onClick={() => toggleStatusM.mutate(p)}
                        >
                          <ShieldAlert className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!isMaster || p.is_sistema}
                          aria-label="Excluir perfil"
                          title={
                            p.is_sistema
                              ? "Perfis de sistema não podem ser excluídos"
                              : "Excluir perfil"
                          }
                          onClick={() => askDelete(p)}
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
      </div>

      {/* Criar */}
      <PerfilForm
        open={openCreate}
        onOpenChange={setOpenCreate}
        title="Novo perfil"
        form={form}
        setForm={setForm}
        perfis={perfis}
        allowCodigo
        onSubmit={() => createM.mutate()}
        loading={createM.isPending}
      />

      {/* Editar */}
      <PerfilForm
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
        title={editing ? `Editar perfil: ${editing.nome}` : ""}
        form={form}
        setForm={setForm}
        perfis={perfis}
        allowCodigo={editing ? !editing.is_sistema : true}
        onSubmit={() => updateM.mutate()}
        loading={updateM.isPending}
        hideCopyFrom
      />

      {/* Duplicar */}
      <FormDialog
        open={duplicating !== null}
        onOpenChange={(v) => !v && setDuplicating(null)}
        title={duplicating ? `Duplicar perfil: ${duplicating.nome}` : ""}
        description="Um novo perfil será criado com todas as permissões concedidas atualmente."
        onSubmit={() => dupM.mutate()}
        submitLabel="Duplicar"
        loading={dupM.isPending}
        submitDisabled={!dupForm.novo_codigo || !dupForm.novo_nome}
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="dup_codigo">Código novo</Label>
            <Input
              id="dup_codigo"
              value={dupForm.novo_codigo}
              onChange={(e) =>
                setDupForm((s) => ({ ...s, novo_codigo: e.target.value.toUpperCase() }))
              }
              placeholder="AUDITOR"
            />
          </div>
          <div>
            <Label htmlFor="dup_nome">Nome novo</Label>
            <Input
              id="dup_nome"
              value={dupForm.novo_nome}
              onChange={(e) => setDupForm((s) => ({ ...s, novo_nome: e.target.value }))}
            />
          </div>
        </div>
      </FormDialog>
    </div>
  );
}

function PerfilForm({
  open,
  onOpenChange,
  title,
  form,
  setForm,
  perfis,
  allowCodigo,
  onSubmit,
  loading,
  hideCopyFrom,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  form: FormState;
  setForm: (fn: (s: FormState) => FormState) => void;
  perfis: PerfilRow[];
  allowCodigo: boolean;
  onSubmit: () => void;
  loading: boolean;
  hideCopyFrom?: boolean;
}) {
  const disabled = useMemo(
    () => !form.codigo.trim() || !form.nome.trim(),
    [form.codigo, form.nome],
  );

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Perfis de sistema (MASTER, GESTOR, DIRETOR DE UNIDADE, ADMINISTRATIVO, CONSULTA) têm o código protegido."
      onSubmit={onSubmit}
      submitLabel="Salvar"
      loading={loading}
      submitDisabled={disabled}
      size="lg"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <Label htmlFor="p_codigo">Código</Label>
          <Input
            id="p_codigo"
            value={form.codigo}
            onChange={(e) =>
              setForm((s) => ({ ...s, codigo: e.target.value.toUpperCase() }))
            }
            placeholder="AUDITOR"
            disabled={!allowCodigo}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            MAIÚSCULO, apenas A-Z 0-9 e _. Não é possível alterar depois em perfis de sistema.
          </p>
        </div>
        <div className="sm:col-span-1">
          <Label htmlFor="p_nome">Nome</Label>
          <Input
            id="p_nome"
            value={form.nome}
            onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))}
            placeholder="Auditor Interno"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="p_desc">Descrição</Label>
          <Textarea
            id="p_desc"
            value={form.descricao}
            onChange={(e) => setForm((s) => ({ ...s, descricao: e.target.value }))}
            rows={2}
          />
        </div>
        <div>
          <Label htmlFor="p_nivel">Nível hierárquico</Label>
          <Input
            id="p_nivel"
            type="number"
            min={1}
            max={999}
            value={form.nivel_hierarquico}
            onChange={(e) =>
              setForm((s) => ({
                ...s,
                nivel_hierarquico: Number(e.target.value) || 100,
              }))
            }
          />
          <p className="mt-1 text-xs text-muted-foreground">
            10 = mais alto (MASTER). Utilizado apenas para ordenação nas listas.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label className="mb-1 block">2FA obrigatório</Label>
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <Switch
                checked={form.admin_2fa_required}
                onCheckedChange={(v) =>
                  setForm((s) => ({ ...s, admin_2fa_required: v }))
                }
              />
              <span className="text-sm text-muted-foreground">
                Exige código MFA no login.
              </span>
            </div>
          </div>
        </div>
        {!hideCopyFrom && (
          <div className="sm:col-span-2">
            <Label>Copiar permissões de…</Label>
            <Select
              value={form.copiar_de || "__none"}
              onValueChange={(v) =>
                setForm((s) => ({ ...s, copiar_de: v === "__none" ? "" : v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Começar em branco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Começar em branco</SelectItem>
                {perfis.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome} ({p.codigo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Opcional. Cria o perfil já com todas as permissões concedidas do perfil base.
            </p>
          </div>
        )}
      </div>
    </FormDialog>
  );
}
