import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  criarCompetencia,
  editarCompetencia,
  alterarStatusCompetencia,
} from "@/lib/competencias.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared";
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
import { Plus, Lock, Unlock, Archive, Settings } from "lucide-react";
import { usePermissions, useCurrentUser } from "@/hooks/use-permissions";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/competencias")({
  component: CompetenciasPage,
});

type StatusComp = Database["public"]["Enums"]["status_competencia"];

type Competencia = {
  id: string;
  ano: number;
  mes: number;
  data_inicio: string;
  data_fim: string;
  prazo_envio: string | null;
  prazo_analise: string | null;
  status: StatusComp;
  secretaria_id: string;
  descricao: string | null;
  observacoes: string | null;
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function lastDay(ano: number, mes: number) {
  return new Date(ano, mes, 0).getDate();
}

function CompetenciasPage() {
  const { has } = usePermissions();
  const { data: me } = useCurrentUser();
  const qc = useQueryClient();
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Competencia | null>(null);
  const [reabrirTarget, setReabrirTarget] = useState<Competencia | null>(null);
  const [motivoReabertura, setMotivoReabertura] = useState("");

  const { data: secretarias } = useQuery({
    queryKey: ["secretarias-ativas"],
    queryFn: async () => {
      const { data } = await supabase.from("secretarias").select("id, nome, sigla").eq("status", "ativa").order("nome");
      return data ?? [];
    },
  });

  const { data: competencias, isLoading } = useQuery({
    queryKey: ["competencias"],
    queryFn: async (): Promise<Competencia[]> => {
      const { data, error } = await supabase
        .from("competencias")
        .select("id, ano, mes, data_inicio, data_fim, prazo_envio, prazo_analise, status, secretaria_id, descricao, observacoes")
        .is("deleted_at", null)
        .order("ano", { ascending: false })
        .order("mes", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const criarFn = useServerFn(criarCompetencia);
  const editarFn = useServerFn(editarCompetencia);
  const statusFn = useServerFn(alterarStatusCompetencia);


  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Competencia>) => {
      if (editing) {
        await editarFn({
          data: {
            id: editing.id,
            descricao: payload.descricao ?? null,
            observacoes: payload.observacoes ?? null,
            prazo_envio: payload.prazo_envio ?? null,
            prazo_analise: payload.prazo_analise ?? null,
          },
        });
      } else {
        await criarFn({
          data: {
            ano: payload.ano!,
            mes: payload.mes!,
            data_inicio: payload.data_inicio!,
            data_fim: payload.data_fim!,
            prazo_envio: payload.prazo_envio || null,
            prazo_analise: payload.prazo_analise || null,
            secretaria_id: payload.secretaria_id!,
            descricao: payload.descricao || null,
            observacoes: payload.observacoes || null,
          },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competencias"] });
      qc.invalidateQueries({ queryKey: ["competencia-ativa"] });
      setOpenForm(false);
      setEditing(null);
      toast.success("Competência salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, motivo }: { id: string; status: StatusComp; motivo?: string }) => {
      await statusFn({ data: { id, status, motivo } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competencias"] });
      qc.invalidateQueries({ queryKey: ["competencia-ativa"] });
      setReabrirTarget(null);
      setMotivoReabertura("");
      toast.success("Status atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canCriar = has("competencia.criar");
  const canEditar = has("competencia.editar");
  const canEncerrar = has("competencia.encerrar");
  const canReabrir = has("competencia.reabrir");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Competências</h1>
          <p className="text-sm text-muted-foreground">Gerencie os períodos mensais de frequência.</p>
        </div>
        {canCriar && (
          <Dialog open={openForm} onOpenChange={(o) => { setOpenForm(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Nova competência</Button>
            </DialogTrigger>
            <CompetenciaForm
              editing={editing}
              secretarias={secretarias ?? []}
              onSubmit={(v) => saveMutation.mutate(v)}
              saving={saveMutation.isPending}
            />
          </Dialog>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : !competencias?.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma competência cadastrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr className="text-left">
                <th className="p-3">Competência</th>
                <th className="p-3">Período</th>
                <th className="p-3">Prazos</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {competencias.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="p-3 font-medium">{MESES[c.mes - 1]}/{c.ano}</td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(c.data_inicio).toLocaleDateString("pt-BR")} — {new Date(c.data_fim).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {c.prazo_envio && <div>Envio: {new Date(c.prazo_envio).toLocaleDateString("pt-BR")}</div>}
                    {c.prazo_analise && <div>Análise: {new Date(c.prazo_analise).toLocaleDateString("pt-BR")}</div>}
                  </td>
                  <td className="p-3">
                    <StatusBadge domain="competencia" value={c.status} />
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/competencias/$id" params={{ id: c.id }}>
                          <Settings className="h-4 w-4" />
                        </Link>
                      </Button>
                      {canEditar && c.status === "aberta" && (
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setOpenForm(true); }}>
                          Editar
                        </Button>
                      )}
                      {canEncerrar && c.status === "aberta" && (
                        <Button size="sm" variant="ghost" onClick={() => statusMutation.mutate({ id: c.id, status: "encerrada" })}>
                          <Lock className="mr-1 h-4 w-4" />Encerrar
                        </Button>
                      )}
                      {canReabrir && c.status === "encerrada" && (
                        <Button size="sm" variant="ghost" onClick={() => { setReabrirTarget(c); setMotivoReabertura(""); }}>
                          <Unlock className="mr-1 h-4 w-4" />Reabrir
                        </Button>
                      )}
                      {canEncerrar && c.status === "encerrada" && (
                        <Button size="sm" variant="ghost" onClick={() => statusMutation.mutate({ id: c.id, status: "arquivada" })}>
                          <Archive className="mr-1 h-4 w-4" />Arquivar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={!!reabrirTarget} onOpenChange={(o) => { if (!o) { setReabrirTarget(null); setMotivoReabertura(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Reabrir competência {reabrirTarget ? `${MESES[reabrirTarget.mes - 1]}/${reabrirTarget.ano}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo da reabertura <span className="text-destructive">*</span></Label>
            <Textarea
              rows={4}
              value={motivoReabertura}
              onChange={(e) => setMotivoReabertura(e.target.value)}
              placeholder="Descreva o motivo da reabertura (obrigatório, ficará no registro de auditoria)."
            />
          </div>
          <DialogFooter>
            <Button
              disabled={!motivoReabertura.trim() || statusMutation.isPending}
              onClick={() => reabrirTarget && statusMutation.mutate({ id: reabrirTarget.id, status: "aberta", motivo: motivoReabertura.trim() })}
            >
              Confirmar reabertura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CompetenciaForm({
  editing,
  secretarias,
  onSubmit,
  saving,
}: {
  editing: Competencia | null;
  secretarias: Array<{ id: string; nome: string; sigla: string | null }>;
  onSubmit: (v: Partial<Competencia>) => void;
  saving: boolean;
}) {
  const now = new Date();
  const [ano, setAno] = useState(editing?.ano ?? now.getFullYear());
  const [mes, setMes] = useState(editing?.mes ?? now.getMonth() + 1);
  const [secretariaId, setSecretariaId] = useState(editing?.secretaria_id ?? "");
  const [prazoEnvio, setPrazoEnvio] = useState(editing?.prazo_envio ?? "");
  const [prazoAnalise, setPrazoAnalise] = useState(editing?.prazo_analise ?? "");
  const [descricao, setDescricao] = useState(editing?.descricao ?? "");
  const [observacoes, setObservacoes] = useState(editing?.observacoes ?? "");

  const dataInicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const dataFim = `${ano}-${String(mes).padStart(2, "0")}-${String(lastDay(ano, mes)).padStart(2, "0")}`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretariaId) {
      toast.error("Selecione a secretaria");
      return;
    }
    onSubmit({
      ano, mes,
      data_inicio: dataInicio,
      data_fim: dataFim,
      prazo_envio: prazoEnvio || null,
      prazo_analise: prazoAnalise || null,
      secretaria_id: secretariaId,
      descricao,
      observacoes,
    });
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{editing ? "Editar competência" : "Nova competência"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Mês</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))} disabled={!!editing}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ano</Label>
            <Input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} disabled={!!editing} />
          </div>
          <div>
            <Label>Secretaria</Label>
            <Select value={secretariaId} onValueChange={setSecretariaId} disabled={!!editing}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {secretarias.map((s) => <SelectItem key={s.id} value={s.id}>{s.sigla || s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Prazo de envio</Label>
            <Input type="date" value={prazoEnvio ?? ""} onChange={(e) => setPrazoEnvio(e.target.value)} />
          </div>
          <div>
            <Label>Prazo de análise</Label>
            <Input type="date" value={prazoAnalise ?? ""} onChange={(e) => setPrazoAnalise(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Descrição</Label>
          <Input value={descricao ?? ""} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        <div>
          <Label>Observações</Label>
          <Textarea value={observacoes ?? ""} onChange={(e) => setObservacoes(e.target.value)} rows={3} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
