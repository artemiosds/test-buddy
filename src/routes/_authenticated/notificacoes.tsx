import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Bell, BellRing, Check, CheckCheck, Trash2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-permissions";
import type { Database } from "@/integrations/supabase/types";
import { EmptyState } from "@/components/shared";
import { useConfirm } from "@/components/shared/ConfirmDialog";

type Tipo = Database["public"]["Enums"]["tipo_notificacao"];
type Prioridade = Database["public"]["Enums"]["prioridade_notificacao"];

export const Route = createFileRoute("/_authenticated/notificacoes")({
  component: NotificacoesPage,
});

const TIPO_LABEL: Record<Tipo, string> = {
  info: "Info",
  sucesso: "Sucesso",
  alerta: "Alerta",
  erro: "Erro",
  pendencia: "Pendência",
  aprovacao: "Aprovação",
  sistema: "Sistema",
};

const TIPO_VARIANT: Record<Tipo, "default" | "secondary" | "outline" | "destructive"> = {
  info: "outline",
  sucesso: "secondary",
  alerta: "default",
  erro: "destructive",
  pendencia: "destructive",
  aprovacao: "secondary",
  sistema: "outline",
};

const PRIORIDADE_LABEL: Record<Prioridade, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

type Filtro = "todas" | "nao_lidas" | Tipo;

const FILTROS: { value: Filtro; label: string }[] = [
  { value: "nao_lidas", label: "Não lidas" },
  { value: "todas", label: "Todas" },
  { value: "pendencia", label: "Pendências" },
  { value: "aprovacao", label: "Aprovações" },
  { value: "alerta", label: "Alertas" },
  { value: "erro", label: "Erros" },
  { value: "sistema", label: "Sistema" },
];

function NotificacoesPage() {
  const qc = useQueryClient();
  const { data: userCtx } = useCurrentUser();
  const askConfirm = useConfirm();
  const [filtro, setFiltro] = useState<Filtro>("nao_lidas");

  const { data: notifs, isLoading } = useQuery({
    queryKey: ["notificacoes", userCtx?.id, filtro],
    queryFn: async () => {
      if (!userCtx?.id) return [];
      let q = supabase
        .from("notificacoes")
        .select("*")
        .eq("usuario_id", userCtx.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (filtro === "nao_lidas") q = q.eq("lida", false);
      else if (filtro !== "todas") q = q.eq("tipo", filtro);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userCtx?.id,
  });

  const marcarLida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notificacoes")
        .update({ lida: true, lida_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes"] }),
  });

  const marcarNaoLida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notificacoes")
        .update({ lida: false, lida_em: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes"] }),
  });

  const marcarTodasLidas = useMutation({
    mutationFn: async () => {
      if (!userCtx?.id) return;
      const { error } = await supabase
        .from("notificacoes")
        .update({ lida: true, lida_em: new Date().toISOString() })
        .eq("usuario_id", userCtx.id)
        .eq("lida", false);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Todas marcadas como lidas.");
      qc.invalidateQueries({ queryKey: ["notificacoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notificacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notificação excluída.");
      qc.invalidateQueries({ queryKey: ["notificacoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const naoLidas = notifs?.filter((n) => !n.lida).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BellRing className="h-6 w-6 text-primary" /> Notificações
          </h1>
          <p className="text-sm text-muted-foreground">
            {naoLidas > 0 ? `${naoLidas} não lida(s)` : "Você está em dia."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTROS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => marcarTodasLidas.mutate()}
            disabled={marcarTodasLidas.isPending || naoLidas === 0}
          >
            <CheckCheck className="mr-2 h-4 w-4" /> Marcar todas
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        {isLoading && <div className="p-8 text-center text-muted-foreground">Carregando...</div>}
        {!isLoading && !notifs?.length && (
          <div className="p-6">
            <EmptyState
              icon={<Bell className="h-8 w-8" />}
              title="Nenhuma notificação encontrada."
            />
          </div>
        )}
        <ul className="divide-y">
          {notifs?.map((n) => {
            const dt = new Date(n.created_at).toLocaleString("pt-BR");
            return (
              <li
                key={n.id}
                className={`flex items-start gap-3 p-4 ${!n.lida ? "bg-primary/5" : ""}`}
              >
                <div
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${!n.lida ? "bg-primary" : "bg-transparent"}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={TIPO_VARIANT[n.tipo as Tipo]}>
                      {TIPO_LABEL[n.tipo as Tipo]}
                    </Badge>
                    {n.prioridade !== "normal" && (
                      <Badge variant="outline">
                        Prioridade: {PRIORIDADE_LABEL[n.prioridade as Prioridade]}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{dt}</span>
                  </div>
                  <div className="mt-1 font-medium">{n.titulo}</div>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">
                    {n.mensagem}
                  </p>
                  {n.link && (
                    <Link
                      to={n.link}
                      className="mt-1 inline-block text-sm text-primary hover:underline"
                      onClick={() => !n.lida && marcarLida.mutate(n.id)}
                    >
                      Abrir →
                    </Link>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {n.lida ? (
                    <Button size="sm" variant="ghost" onClick={() => marcarNaoLida.mutate(n.id)}>
                      <Bell className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => marcarLida.mutate(n.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      void (async () => {
                        const ok = await askConfirm({
                          title: "Excluir esta notificação?",
                          tone: "destructive",
                          confirmLabel: "Excluir",
                        });
                        if (ok) excluir.mutate(n.id);
                      })();
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
