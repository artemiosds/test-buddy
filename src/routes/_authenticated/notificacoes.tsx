import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Mail,
  Trash2,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-permissions";
import type { Database } from "@/integrations/supabase/types";
import { EmptyState } from "@/components/shared";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { FilterBar } from "@/components/shared/FilterBar";
import { downloadXlsx } from "@/lib/xlsx-export";
import { BotaoRelatorioAbnt } from "@/components/relatorios-gerenciais/botao-relatorio-abnt";
import { relatorioPainelAbnt } from "@/lib/painel-abnt";

type Tipo = Database["public"]["Enums"]["tipo_notificacao"];
type Prioridade = Database["public"]["Enums"]["prioridade_notificacao"];

export const Route = createFileRoute("/_authenticated/notificacoes")({
  errorComponent: ErrorComponent,
  component: NotificacoesPage,
});

const PAGE_SIZE = 50;

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

const PERIODOS = [
  { value: "todos", label: "Todo o período" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

type NotifRow = {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: Tipo;
  prioridade: Prioridade;
  link: string | null;
  lida: boolean;
  enviada: boolean;
  created_at: string;
};

/**
 * Abre o link salvo na notificação separando caminho e parâmetros
 * (ex.: "/pendencias?id=123" → { to: "/pendencias", search: { id: "123" } }).
 */
function abrirLink(navigate: ReturnType<typeof useNavigate>, link: string) {
  try {
    const url = new URL(link, window.location.origin);
    const search: Record<string, string> = {};
    url.searchParams.forEach((v, k) => (search[k] = v));
    void navigate({
      to: url.pathname as never,
      search: (Object.keys(search).length ? search : undefined) as never,
      hash: url.hash ? url.hash.replace("#", "") : undefined,
    });
  } catch {
    window.location.assign(link);
  }
}

function NotificacoesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: userCtx } = useCurrentUser();
  const askConfirm = useConfirm();
  const [filtro, setFiltro] = useState<Filtro>("nao_lidas");
  const [prioridade, setPrioridade] = useState<"todas" | Prioridade>("todas");
  const [periodo, setPeriodo] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [page, setPage] = useState(0);
  const [selecionados, setSelecionados] = useState<string[]>([]);

  useEffect(() => {
    setPage(0);
    setSelecionados([]);
  }, [filtro, prioridade, periodo, busca]);

  const queryKey = ["notificacoes", userCtx?.id, filtro, prioridade, periodo, busca, page];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!userCtx?.id) return { rows: [] as NotifRow[], total: 0 };
      let q = supabase
        .from("notificacoes")
        .select("id, titulo, mensagem, tipo, prioridade, link, lida, enviada, created_at", {
          count: "exact",
        })
        .eq("usuario_id", userCtx.id)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (filtro === "nao_lidas") q = q.eq("lida", false);
      else if (filtro !== "todas") q = q.eq("tipo", filtro);
      if (prioridade !== "todas") q = q.eq("prioridade", prioridade);
      if (periodo !== "todos") {
        const desde = new Date();
        desde.setDate(desde.getDate() - Number(periodo));
        q = q.gte("created_at", desde.toISOString());
      }
      const termo = busca.trim();
      if (termo) q = q.or(`titulo.ilike.%${termo}%,mensagem.ilike.%${termo}%`);

      const { data: rows, count, error } = await q;
      if (error) throw error;
      return { rows: (rows ?? []) as NotifRow[], total: count ?? 0 };
    },
    enabled: !!userCtx?.id,
  });

  const notifs = data?.rows ?? [];
  const total = data?.total ?? 0;

  // Contador global de não lidas (independente dos filtros da tela).
  const { data: naoLidasTotal = 0 } = useQuery({
    queryKey: ["notificacoes-nao-lidas-total", userCtx?.id],
    enabled: !!userCtx?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notificacoes")
        .select("id", { count: "exact", head: true })
        .eq("usuario_id", userCtx!.id)
        .eq("lida", false);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Atualização em tempo real da própria lista (mesmo canal do sino).
  useEffect(() => {
    if (!userCtx?.id) return;
    const canal = supabase
      .channel(`notif-lista-${userCtx.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notificacoes",
          filter: `usuario_id=eq.${userCtx.id}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["notificacoes"] });
          void qc.invalidateQueries({ queryKey: ["notificacoes-nao-lidas-total"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [userCtx?.id, qc]);

  function invalidar() {
    void qc.invalidateQueries({ queryKey: ["notificacoes"] });
    void qc.invalidateQueries({ queryKey: ["notificacoes-nao-lidas-total"] });
    void qc.invalidateQueries({ queryKey: ["notificacoes-unread"] });
  }

  const marcarLida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notificacoes")
        .update({ lida: true, lida_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  const marcarNaoLida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notificacoes")
        .update({ lida: false, lida_em: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
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
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const marcarSelecionadas = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("notificacoes")
        .update({ lida: true, lida_em: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(`${ids.length} notificação(ões) marcada(s) como lida(s).`);
      setSelecionados([]);
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("notificacoes").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(ids.length > 1 ? `${ids.length} notificações excluídas.` : "Notificação excluída.");
      setSelecionados([]);
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtrosDescritivos = useMemo(
    () => [
      { label: "Situação/Tipo", valor: FILTROS.find((f) => f.value === filtro)?.label ?? "Todas" },
      {
        label: "Prioridade",
        valor: prioridade === "todas" ? "Todas" : PRIORIDADE_LABEL[prioridade],
      },
      { label: "Período", valor: PERIODOS.find((p) => p.value === periodo)?.label ?? "Todo o período" },
      { label: "Busca", valor: busca.trim() || "—" },
    ],
    [filtro, prioridade, periodo, busca],
  );

  function exportarExcel() {
    if (!notifs.length) {
      toast.error("Nada para exportar com os filtros atuais.");
      return;
    }
    downloadXlsx(
      "notificacoes",
      notifs,
      [
        {
          header: "Data/Hora",
          value: (n) => new Date(n.created_at).toLocaleString("pt-BR"),
          largura: 20,
        },
        { header: "Tipo", value: (n) => TIPO_LABEL[n.tipo], largura: 14 },
        { header: "Prioridade", value: (n) => PRIORIDADE_LABEL[n.prioridade], largura: 14 },
        { header: "Título", value: (n) => n.titulo, largura: 45 },
        { header: "Mensagem", value: (n) => n.mensagem, largura: 70 },
        { header: "Lida", value: (n) => (n.lida ? "Sim" : "Não"), largura: 10 },
        { header: "E-mail", value: (n) => (n.enviada ? "Enviado" : "—"), largura: 12 },
      ],
      { sheetName: "Notificações", titulo: "Notificações do usuário" },
    );
  }

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const todosSelecionados = notifs.length > 0 && selecionados.length === notifs.length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BellRing className="h-6 w-6 text-primary" /> Notificações
          </h1>
          <p className="text-sm text-muted-foreground">
            {naoLidasTotal > 0 ? `${naoLidasTotal} não lida(s)` : "Você está em dia."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportarExcel} disabled={!notifs.length}>
            <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
          </Button>
          <BotaoRelatorioAbnt
            size="sm"
            variant="outline"
            disabled={!notifs.length}
            relatorio={() =>
              relatorioPainelAbnt({
                arquivo: "notificacoes",
                titulo: "Notificações do Usuário",
                subtitulo: "Avisos internos do sistema",
                orientacao: "landscape",
                filtros: filtrosDescritivos,
                kpis: [
                  { label: "Registros nesta página", valor: notifs.length },
                  { label: "Total no filtro", valor: total },
                  { label: "Não lidas (geral)", valor: naoLidasTotal },
                ],
                blocos: [
                  {
                    titulo: "Relação de notificações",
                    head: ["Data/Hora", "Tipo", "Prioridade", "Título", "Mensagem", "Lida", "E-mail"],
                    align: ["left", "left", "left", "left", "left", "center", "center"],
                    larguras: [30, 20, 20, 55, 90, 15, 18],
                    body: notifs.map((n) => [
                      new Date(n.created_at).toLocaleString("pt-BR"),
                      TIPO_LABEL[n.tipo],
                      PRIORIDADE_LABEL[n.prioridade],
                      n.titulo,
                      n.mensagem,
                      n.lida ? "Sim" : "Não",
                      n.enviada ? "Enviado" : "—",
                    ]),
                  },
                ],
                registros: notifs.length,
              })
            }
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => marcarTodasLidas.mutate()}
            disabled={marcarTodasLidas.isPending || naoLidasTotal === 0}
          >
            <CheckCheck className="mr-1 h-4 w-4" /> Marcar todas
          </Button>
        </div>
      </div>

      <FilterBar>
        <FilterBar.Field label="Situação / Tipo">
          <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
            <SelectTrigger>
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
        </FilterBar.Field>
        <FilterBar.Field label="Prioridade">
          <Select
            value={prioridade}
            onValueChange={(v) => setPrioridade(v as "todas" | Prioridade)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {(Object.keys(PRIORIDADE_LABEL) as Prioridade[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORIDADE_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="Período">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODOS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="Buscar">
          <Input
            placeholder="Título ou mensagem..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </FilterBar.Field>
      </FilterBar>

      {selecionados.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3">
          <span className="text-sm font-medium">{selecionados.length} selecionada(s)</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => marcarSelecionadas.mutate(selecionados)}
            disabled={marcarSelecionadas.isPending}
          >
            <Check className="mr-1 h-4 w-4" /> Marcar como lidas
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void (async () => {
                const ok = await askConfirm({
                  title: `Excluir ${selecionados.length} notificação(ões)?`,
                  tone: "destructive",
                  confirmLabel: "Excluir",
                });
                if (ok) excluir.mutate(selecionados);
              })();
            }}
          >
            <Trash2 className="mr-1 h-4 w-4 text-destructive" /> Excluir
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelecionados([])}>
            Limpar seleção
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-card">
        {isLoading && <div className="p-8 text-center text-muted-foreground">Carregando...</div>}
        {!isLoading && !notifs.length && (
          <div className="p-6">
            <EmptyState
              icon={<Bell className="h-8 w-8" />}
              title="Nenhuma notificação encontrada."
            />
          </div>
        )}
        {notifs.length > 0 && (
          <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
            <Checkbox
              checked={todosSelecionados}
              onCheckedChange={(v) => setSelecionados(v ? notifs.map((n) => n.id) : [])}
              aria-label="Selecionar todas desta página"
            />
            <span>Selecionar todas desta página</span>
          </div>
        )}
        <ul className="divide-y">
          {notifs.map((n) => {
            const dt = new Date(n.created_at).toLocaleString("pt-BR");
            const marcado = selecionados.includes(n.id);
            return (
              <li
                key={n.id}
                className={`flex items-start gap-3 p-4 ${!n.lida ? "bg-primary/5" : ""}`}
              >
                <Checkbox
                  className="mt-1"
                  checked={marcado}
                  onCheckedChange={(v) =>
                    setSelecionados((prev) =>
                      v ? [...new Set([...prev, n.id])] : prev.filter((id) => id !== n.id),
                    )
                  }
                  aria-label="Selecionar notificação"
                />
                <div
                  className={`mt-2 h-2 w-2 shrink-0 rounded-full ${!n.lida ? "bg-primary" : "bg-transparent"}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={TIPO_VARIANT[n.tipo]}>{TIPO_LABEL[n.tipo]}</Badge>
                    {n.prioridade !== "normal" && (
                      <Badge variant="outline">
                        Prioridade: {PRIORIDADE_LABEL[n.prioridade]}
                      </Badge>
                    )}
                    {n.enviada && (
                      <Badge variant="secondary" className="gap-1">
                        <Mail className="h-3 w-3" /> Também por e-mail
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{dt}</span>
                  </div>
                  <div className="mt-1 font-medium">{n.titulo}</div>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">
                    {n.mensagem}
                  </p>
                  {n.link && (
                    <button
                      type="button"
                      className="mt-1 inline-block text-sm text-primary hover:underline"
                      onClick={() => {
                        if (!n.lida) marcarLida.mutate(n.id);
                        abrirLink(navigate, n.link!);
                      }}
                    >
                      Abrir →
                    </button>
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
                        if (ok) excluir.mutate([n.id]);
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
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Página {page + 1} de {totalPaginas} · {total} registro(s)
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page + 1 >= totalPaginas}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
