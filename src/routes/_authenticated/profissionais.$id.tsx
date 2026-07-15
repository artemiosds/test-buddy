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
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/profissionais/$id")({
  component: HistoricoPage,
});

type TipoEvento = Database["public"]["Enums"]["tipo_evento_funcional"];

const EVENTO_LABEL: Record<TipoEvento, string> = {
  admissao: "Admissão",
  transferencia: "Transferência",
  promocao: "Promoção",
  mudanca_cargo: "Mudança de cargo",
  mudanca_funcao: "Mudança de função",
  mudanca_vinculo: "Mudança de vínculo",
  afastamento: "Afastamento",
  retorno: "Retorno",
  ferias: "Férias",
  licenca: "Licença",
  desligamento: "Desligamento",
  outro: "Outro",
};

type FormState = {
  tipo_evento: TipoEvento;
  data_inicio: string;
  data_fim: string;
  motivo: string;
  documento_referencia: string;
  observacoes: string;
};

const EMPTY: FormState = {
  tipo_evento: "outro",
  data_inicio: new Date().toISOString().slice(0, 10),
  data_fim: "",
  motivo: "",
  documento_referencia: "",
  observacoes: "",
};

function HistoricoPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { has } = usePermissions();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const canManage = has("historico.gerenciar");

  const { data: profissional } = useQuery({
    queryKey: ["profissional", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select(
          "id,nome_completo,cpf,matricula,status,unidade:unidades(nome,sigla),cargo:cargos(nome),vinculo:vinculos(nome)"
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: eventos, isLoading } = useQuery({
    queryKey: ["historico", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissional_historico_funcional")
        .select("*")
        .eq("profissional_id", id)
        .is("deleted_at", null)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (f: FormState) => {
      if (!f.data_inicio) throw new Error("Data de início é obrigatória");
      const { error } = await supabase
        .from("profissional_historico_funcional")
        .insert({
          profissional_id: id,
          tipo_evento: f.tipo_evento,
          data_inicio: f.data_inicio,
          data_fim: f.data_fim || null,
          motivo: f.motivo.trim() || null,
          documento_referencia: f.documento_referencia.trim() || null,
          observacoes: f.observacoes.trim() || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento registrado");
      setOpen(false);
      setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ["historico", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (eventoId: string) => {
      const { error } = await supabase
        .from("profissional_historico_funcional")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", eventoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento removido");
      qc.invalidateQueries({ queryKey: ["historico", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/profissionais">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>

      <div className="rounded-md border bg-card p-4">
        <h1 className="text-2xl font-semibold">
          {profissional?.nome_completo ?? "Profissional"}
        </h1>
        <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
          {profissional?.matricula && <span>Mat.: {profissional.matricula}</span>}
          {profissional?.cargo && <span>Cargo: {profissional.cargo.nome}</span>}
          {profissional?.vinculo && <span>Vínculo: {profissional.vinculo.nome}</span>}
          {profissional?.unidade && (
            <span>
              Unidade: {profissional.unidade.sigla ?? profissional.unidade.nome}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Histórico funcional</h2>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" /> Novo evento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar evento</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Tipo de evento *</Label>
                  <Select
                    value={form.tipo_evento}
                    onValueChange={(v: TipoEvento) =>
                      setForm({ ...form, tipo_evento: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(EVENTO_LABEL) as TipoEvento[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {EVENTO_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Data de início *</Label>
                    <Input
                      type="date"
                      value={form.data_inicio}
                      onChange={(e) =>
                        setForm({ ...form, data_inicio: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Data de fim</Label>
                    <Input
                      type="date"
                      value={form.data_fim}
                      onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Motivo</Label>
                  <Input
                    value={form.motivo}
                    onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Documento de referência</Label>
                  <Input
                    value={form.documento_referencia}
                    onChange={(e) =>
                      setForm({ ...form, documento_referencia: e.target.value })
                    }
                    placeholder="Portaria nº..."
                  />
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea
                    rows={2}
                    value={form.observacoes}
                    onChange={(e) =>
                      setForm({ ...form, observacoes: e.target.value })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => create.mutate(form)}
                  disabled={create.isPending}
                >
                  {create.isPending ? "Salvando..." : "Registrar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-md border bg-card">
        {isLoading ? (
          <div className="p-6 text-center text-muted-foreground">Carregando...</div>
        ) : !eventos?.length ? (
          <div className="p-6 text-center text-muted-foreground">
            Nenhum evento registrado.
          </div>
        ) : (
          <ol className="divide-y">
            {eventos.map((ev) => (
              <li key={ev.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {EVENTO_LABEL[ev.tipo_evento as TipoEvento]}
                      </Badge>
                      <span className="text-sm font-medium">
                        {new Date(ev.data_inicio).toLocaleDateString("pt-BR")}
                        {ev.data_fim
                          ? ` → ${new Date(ev.data_fim).toLocaleDateString("pt-BR")}`
                          : ""}
                      </span>
                    </div>
                    {ev.motivo && (
                      <p className="mt-1 text-sm">{ev.motivo}</p>
                    )}
                    {ev.documento_referencia && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ref.: {ev.documento_referencia}
                      </p>
                    )}
                    {ev.observacoes && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ev.observacoes}
                      </p>
                    )}
                  </div>
                  {canManage && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Remover este evento?")) remove.mutate(ev.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
