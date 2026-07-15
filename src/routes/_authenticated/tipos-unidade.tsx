import { createFileRoute } from "@tanstack/react-router";
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
import { toast } from "sonner";
import { Plus, Pencil, PowerOff, Power, Tag } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-permissions";

export const Route = createFileRoute("/_authenticated/tipos-unidade")({
  component: TiposUnidadePage,
});

type TipoUnidade = {
  id: string;
  nome: string;
  descricao: string | null;
  status: "ativa" | "inativa" | "suspensa" | "arquivada";
};

function TiposUnidadePage() {
  const qc = useQueryClient();
  const { data: userCtx, isLoading: userLoading } = useCurrentUser();
  const isMaster = !!userCtx?.is_master;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TipoUnidade | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");

  const { data: tipos = [], isLoading } = useQuery({
    queryKey: ["tipos-unidade"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_unidade")
        .select("id, nome, descricao, status")
        .is("deleted_at", null)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TipoUnidade[];
    },
  });

  const { data: usoMap = {} } = useQuery({
    queryKey: ["tipos-unidade-uso"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidades")
        .select("tipo_unidade")
        .is("deleted_at", null);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data ?? []) {
        const t = (r.tipo_unidade ?? "").trim();
        if (t) map[t] = (map[t] ?? 0) + 1;
      }
      return map;
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const nomeT = nome.trim();
      if (!nomeT) throw new Error("Informe o nome do tipo");
      if (editing) {
        const { error } = await supabase
          .from("tipos_unidade")
          .update({ nome: nomeT, descricao: descricao.trim() || null })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tipos_unidade")
          .insert({ nome: nomeT, descricao: descricao.trim() || null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Tipo atualizado" : "Tipo criado");
      setOpen(false);
      setEditing(null);
      setNome("");
      setDescricao("");
      qc.invalidateQueries({ queryKey: ["tipos-unidade"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async (t: TipoUnidade) => {
      const novo = t.status === "ativa" ? "inativa" : "ativa";
      const { error } = await supabase
        .from("tipos_unidade")
        .update({ status: novo })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["tipos-unidade"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const abrirNovo = () => {
    setEditing(null);
    setNome("");
    setDescricao("");
    setOpen(true);
  };

  const abrirEdit = (t: TipoUnidade) => {
    setEditing(t);
    setNome(t.nome);
    setDescricao(t.descricao ?? "");
    setOpen(true);
  };

  if (userLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  if (!isMaster) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apenas usuários Master podem gerenciar tipos de unidade.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Tag className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Tipos de Unidade</h1>
            <p className="text-sm text-muted-foreground">
              Configure os tipos utilizados no cadastro de unidades de saúde.
            </p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={abrirNovo}>
              <Plus className="mr-1 h-4 w-4" />Novo tipo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar tipo" : "Novo tipo"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: UBS, Hospital, CAPS" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
        ) : tipos.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhum tipo cadastrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-3">Nome</th>
                <th className="p-3">Descrição</th>
                <th className="p-3">Em uso</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tipos.map((t) => {
                const usoCount = usoMap[t.nome] ?? 0;
                return (
                  <tr key={t.id} className="border-t">
                    <td className="p-3 font-medium">{t.nome}</td>
                    <td className="p-3 text-muted-foreground">{t.descricao ?? "—"}</td>
                    <td className="p-3">
                      {usoCount > 0 ? (
                        <Badge variant="secondary">{usoCount} unidade(s)</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <Badge variant={t.status === "ativa" ? "default" : "outline"}>
                        {t.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => abrirEdit(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleMut.mutate(t)}
                          title={t.status === "ativa" ? "Inativar" : "Ativar"}
                        >
                          {t.status === "ativa" ? (
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

      <p className="text-xs text-muted-foreground">
        Tipos em uso por unidades não podem ser excluídos — apenas inativados. Tipos inativos deixam de aparecer no
        cadastro de novas unidades, mas as unidades já cadastradas continuam funcionando normalmente.
      </p>
    </div>
  );
}
