import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared";
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
import { Search, Plus, Pencil, Trash2, Network, LayoutDashboard } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { useCurrentUser } from "@/hooks/use-permissions";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/unidades")({
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
        .select("id, nome_completo, acesso_todas_unidades, perfil:perfis!inner(codigo), unidades:usuario_unidades(unidade_id)")
        .is("deleted_at", null)
        .eq("status", "ativo")
        .eq("perfil.codigo", "DIRETOR_UNIDADE")
        .order("nome_completo");
      if (uErr) throw uErr;

      type U = { id: string; nome_completo: string; acesso_todas_unidades: boolean; unidades: { unidade_id: string }[] };
      const usersFiltered = ((users ?? []) as unknown as U[]).filter((u) => {
        if (!form.id) return true;
        if (u.acesso_todas_unidades) return true;
        return u.unidades?.some((v) => v.unidade_id === form.id);
      });

      const merged = new Map<string, { nome_completo: string }>();
      for (const p of (profs ?? []) as { nome_completo: string }[]) merged.set(p.nome_completo, p);
      for (const u of usersFiltered) if (!merged.has(u.nome_completo)) merged.set(u.nome_completo, { nome_completo: u.nome_completo });
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Unidades</h1>
          <p className="text-sm text-muted-foreground">
            Cadastro de unidades de saúde vinculadas às secretarias.
          </p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}>
                <Plus className="mr-1 h-4 w-4" /> Nova Unidade
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
                    onValueChange={(v) => setForm({ ...form, tipo_unidade: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— não informado —</SelectItem>
                      {/* Mantém compatibilidade se a unidade já tem um tipo que foi inativado/removido */}
                      {form.tipo_unidade &&
                        !tiposUnidade.some((t) => t.nome === form.tipo_unidade) && (
                          <SelectItem value={form.tipo_unidade}>{form.tipo_unidade} (legado)</SelectItem>
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
                    onChange={(e) =>
                      setForm({ ...form, nivel_complexidade: e.target.value })
                    }
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
                    onChange={(e) =>
                      setForm({ ...form, email_institucional: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Responsável (Diretor de Unidade)</Label>
                  <Select
                    value={form.responsavel_nome || undefined}
                    onValueChange={(v) =>
                      setForm({ ...form, responsavel_nome: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={diretores.length ? "Selecione o responsável" : "Nenhum Diretor de Unidade vinculado"} />
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
                      Nenhum profissional com função "Diretor de Unidade" vinculado a esta unidade. Cadastre em Profissionais.
                    </p>
                  )}
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setForm({ ...form, status: v as StatusEnt })
                    }
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
                    onChange={(e) =>
                      setForm({ ...form, observacoes: e.target.value })
                    }
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
                ) : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    disabled={upsert.isPending}
                    onClick={() => upsert.mutate(form)}
                  >
                    {form.id ? "Salvar" : "Criar"}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, sigla ou CNES"
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
              <th className="px-4 py-2">Sigla</th>
              <th className="px-4 py-2">CNES</th>
              <th className="px-4 py-2">Secretaria</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhuma unidade cadastrada.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{u.nome}</td>
                  <td className="px-4 py-2 text-muted-foreground">{u.sigla ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{u.cnes ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {u.secretaria?.sigla ?? u.secretaria?.nome ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge domain="unidade" value={u.status} />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" asChild title="Painel da unidade">
                        <Link to="/unidades/$id" params={{ id: u.id }}>
                          <LayoutDashboard className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(u)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="outline"
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
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
