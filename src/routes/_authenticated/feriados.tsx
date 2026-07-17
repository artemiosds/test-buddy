import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FormDialog } from "@/components/shared/FormDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CalendarDays } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-permissions";

export const Route = createFileRoute("/_authenticated/feriados")({
  component: FeriadosPage,
});

type TipoCal = "feriado_nacional" | "feriado_estadual" | "feriado_municipal" | "ponto_facultativo" | "recesso" | "data_comemorativa";
type Abr = "municipal" | "estadual" | "nacional";

type Feriado = {
  id: string;
  data: string;
  descricao: string;
  tipo: TipoCal;
  abrangencia: Abr;
  eh_recorrente: boolean;
};

const TIPO_LABEL: Record<TipoCal, string> = {
  feriado_nacional: "Feriado Nacional",
  feriado_estadual: "Feriado Estadual",
  feriado_municipal: "Feriado Municipal",
  ponto_facultativo: "Ponto Facultativo",
  recesso: "Recesso",
  data_comemorativa: "Data Comemorativa",
};

function FeriadosPage() {
  const qc = useQueryClient();
  const { data: userCtx, isLoading: userLoading } = useCurrentUser();
  const isMaster = !!userCtx?.is_master;
  const askConfirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Feriado | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [form, setForm] = useState({
    data: "",
    descricao: "",
    tipo: "feriado_municipal" as TipoCal,
    abrangencia: "municipal" as Abr,
    eh_recorrente: false,
  });

  const { data: feriados = [], isLoading } = useQuery({
    queryKey: ["feriados", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendario_institucional")
        .select("id, data, descricao, tipo, abrangencia, eh_recorrente")
        .is("deleted_at", null)
        .gte("data", `${year}-01-01`)
        .lte("data", `${year}-12-31`)
        .order("data", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Feriado[];
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.data) throw new Error("Informe a data");
      if (!form.descricao.trim()) throw new Error("Informe a descrição");
      const payload = {
        data: form.data,
        descricao: form.descricao.trim(),
        tipo: form.tipo,
        abrangencia: form.abrangencia,
        eh_recorrente: form.eh_recorrente,
      };
      if (editing) {
        const { error } = await supabase
          .from("calendario_institucional")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("calendario_institucional").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Feriado atualizado" : "Feriado cadastrado");
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["feriados"] });
      qc.invalidateQueries({ queryKey: ["feriados-mes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("calendario_institucional")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Feriado removido");
      qc.invalidateQueries({ queryKey: ["feriados"] });
      qc.invalidateQueries({ queryKey: ["feriados-mes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const abrirNovo = () => {
    setEditing(null);
    setForm({
      data: "",
      descricao: "",
      tipo: "feriado_municipal",
      abrangencia: "municipal",
      eh_recorrente: false,
    });
    setOpen(true);
  };

  const abrirEdit = (f: Feriado) => {
    setEditing(f);
    setForm({
      data: f.data,
      descricao: f.descricao,
      tipo: f.tipo,
      abrangencia: f.abrangencia,
      eh_recorrente: f.eh_recorrente,
    });
    setOpen(true);
  };

  if (userLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  if (!isMaster) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apenas usuários Master podem gerenciar o calendário de feriados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Calendário de Feriados</h1>
            <p className="text-sm text-muted-foreground">
              Feriados usados no cálculo de dias úteis por competência.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Ano</Label>
          <Input
            type="number"
            className="w-24"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
          />
          <Button onClick={abrirNovo}>
            <Plus className="mr-1 h-4 w-4" />Novo feriado
          </Button>
          <FormDialog
            open={open}
            onOpenChange={setOpen}
            title={editing ? "Editar feriado" : "Novo feriado"}
            onSubmit={() => saveMut.mutate()}
            loading={saveMut.isPending}
          >
              <div className="grid gap-3">
                <div>
                  <Label>Data *</Label>
                  <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
                </div>
                <div>
                  <Label>Descrição *</Label>
                  <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as TipoCal })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(TIPO_LABEL) as TipoCal[]).map((k) => (
                          <SelectItem key={k} value={k}>{TIPO_LABEL[k]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Abrangência</Label>
                    <Select value={form.abrangencia} onValueChange={(v) => setForm({ ...form, abrangencia: v as Abr })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="municipal">Municipal</SelectItem>
                        <SelectItem value="estadual">Estadual</SelectItem>
                        <SelectItem value="nacional">Nacional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.eh_recorrente}
                    onChange={(e) => setForm({ ...form, eh_recorrente: e.target.checked })}
                  />
                  Recorrente (ocorre todos os anos na mesma data)
                </label>
              </div>
          </FormDialog>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
        ) : feriados.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhum feriado cadastrado em {year}.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Descrição</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Abrangência</th>
                <th className="p-3">Recorrente</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {feriados.map((f) => (
                <tr key={f.id} className="border-t">
                  <td className="p-3 whitespace-nowrap">
                    {new Date(f.data + "T00:00:00").toLocaleDateString("pt-BR")}
                  </td>
                  <td className="p-3 font-medium">{f.descricao}</td>
                  <td className="p-3">{TIPO_LABEL[f.tipo]}</td>
                  <td className="p-3 capitalize">{f.abrangencia}</td>
                  <td className="p-3">
                    {f.eh_recorrente ? <Badge variant="secondary">Sim</Badge> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => abrirEdit(f)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          void (async () => {
                            const ok = await askConfirm({
                              title: `Remover "${f.descricao}"?`,
                              tone: "destructive",
                              confirmLabel: "Remover",
                            });
                            if (ok) delMut.mutate(f.id);
                          })();
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
