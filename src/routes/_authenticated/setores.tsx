import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
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
import { FormDialog } from "@/components/shared/FormDialog";
import { toast } from "sonner";
import { Plus, Pencil, PowerOff, Power, Network, LayoutDashboard } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser, usePermissions } from "@/hooks/use-permissions";

const searchSchema = z.object({
  unidade: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/setores")({
  validateSearch: (s) => searchSchema.parse(s),
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
  gestor: { id: string; nome_completo: string } | null;
};

function SetoresPage() {
  const qc = useQueryClient();
  const { data: userCtx, isLoading: userLoading } = useCurrentUser();
  const { has } = usePermissions();
  const canManage = !!userCtx?.is_master || has("unidade.editar");
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Setor | null>(null);
  const [form, setForm] = useState({ nome: "", sigla: "", gestor_id: "", observacoes: "" });

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

  const { data: setores = [], isLoading } = useQuery({
    queryKey: ["setores-admin", unidadeId],
    queryFn: async () => {
      if (!unidadeId) return [] as Setor[];
      const { data, error } = await supabase
        .from("setores")
        .select("id, unidade_id, nome, sigla, status, gestor_id, observacoes, gestor:profissionais!setores_gestor_id_fkey(id, nome_completo)")
        .eq("unidade_id", unidadeId)
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Setor[];
    },
    enabled: !!unidadeId,
  });

  const { data: uso = {} } = useQuery({
    queryKey: ["setores-uso", unidadeId],
    queryFn: async () => {
      if (!unidadeId) return {};
      const { data, error } = await supabase
        .from("profissionais")
        .select("setor_id")
        .is("deleted_at", null)
        .eq("unidade_id", unidadeId)
        .not("setor_id", "is", null);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data ?? []) {
        const k = (r as { setor_id: string | null }).setor_id;
        if (k) map[k] = (map[k] ?? 0) + 1;
      }
      return map;
    },
    enabled: !!unidadeId,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const nomeT = form.nome.trim();
      if (!nomeT) throw new Error("Informe o nome");
      if (!unidadeId) throw new Error("Selecione uma unidade");
      const payload = {
        nome: nomeT,
        sigla: form.sigla.trim() || null,
        gestor_id: form.gestor_id || null,
        observacoes: form.observacoes.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("setores").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("setores").insert({ ...payload, unidade_id: unidadeId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Setor atualizado" : "Setor criado");
      setOpen(false);
      setEditing(null);
      setForm({ nome: "", sigla: "", gestor_id: "", observacoes: "" });
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

  const abrirNovo = () => {
    setEditing(null);
    setForm({ nome: "", sigla: "", gestor_id: "", observacoes: "" });
    setOpen(true);
  };
  const abrirEdit = (s: Setor) => {
    setEditing(s);
    setForm({
      nome: s.nome,
      sigla: s.sigla ?? "",
      gestor_id: s.gestor_id ?? "",
      observacoes: s.observacoes ?? "",
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
            onValueChange={(v) => navigate({ search: { unidade: v } })}
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
                  <Label>Nome *</Label>
                  <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                </div>
                <div>
                  <Label>Sigla</Label>
                  <Input value={form.sigla} onChange={(e) => setForm({ ...form, sigla: e.target.value })} />
                </div>
                <div>
                  <Label>Gestor do setor</Label>
                  <Select
                    value={form.gestor_id || "__none__"}
                    onValueChange={(v) => setForm({ ...form, gestor_id: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um profissional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— não informado —</SelectItem>
                      {gestoresOpt.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome_completo}</SelectItem>
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
            <div className="p-6 text-sm text-muted-foreground">Nenhum setor cadastrado para esta unidade.</div>
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
                    <tr key={s.id} className="border-t">
                      <td className="p-3 font-medium">{s.nome}</td>
                      <td className="p-3 text-muted-foreground">{s.sigla ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">{s.gestor?.nome_completo ?? "—"}</td>
                      <td className="p-3">
                        {usoCount > 0 ? <Badge variant="secondary">{usoCount}</Badge> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-3">
                        <Badge variant={s.status === "ativa" ? "default" : "outline"}>{s.status}</Badge>
                      </td>
                      <td className="p-3 text-right">
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
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Setores em uso por profissionais não podem ser excluídos — apenas inativados.
      </p>
    </div>
  );
}
