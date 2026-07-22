import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRetryMutation, type RetryConfig } from "@/lib/retry-mutation";
import { supabase } from "@/integrations/supabase/client";
import {
  listPendencias,
  getPendencia,
  atribuirPendencia,
  responderPendencia,
  resolverPendencia,
  reabrirPendencia,
  cancelarPendencia,
  alterarPrioridade,
  alterarPrazo,
} from "@/lib/pendencias.functions";
import type { Database } from "@/integrations/supabase/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState, StatusBadge } from "@/components/shared";
import { statusLabel, statusOptions } from "@/lib/status";
import { formatDate as fmtDate, formatDateTime as fmtDateTime } from "@/lib/formatters";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  Repeat2,
  Search,
  UserPlus2,
  XCircle,
  Flag,
  Loader2,
} from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";

const searchSchema = z.object({
  status: z.string().optional(),
  categoria: z.string().optional(),
  prioridade: z.string().optional(),
  q: z.string().optional(),
  id: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/pendencias")({
  validateSearch: searchSchema,
  component: PendenciasPage,
});

type Status = Database["public"]["Enums"]["pendencia_status"];
type Prioridade = Database["public"]["Enums"]["pendencia_prioridade"];
type Categoria = Database["public"]["Enums"]["pendencia_categoria"];

const PRIORIDADE_LABEL: Record<Prioridade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

const PRIORIDADE_CLASSES: Record<Prioridade, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-primary/10 text-primary",
  alta: "bg-warning/15 text-warning-soft-foreground",
  critica: "bg-destructive/15 text-destructive",
};

const CATEGORIA_LABEL: Record<Categoria, string> = {
  frequencia: "Frequência",
  documento: "Documento",
  ponto: "Ponto",
  folha: "Folha",
  geral: "Geral",
};

function slaBadge(prazo?: string | null, status?: Status) {
  if (!prazo || (status && ["resolvida", "cancelada"].includes(status))) return null;
  const dias = Math.ceil((new Date(prazo).getTime() - Date.now()) / 86400000);
  if (isNaN(dias)) return null;
  if (dias < 0) return <Badge variant="destructive">Atrasada {Math.abs(dias)}d</Badge>;
  if (dias <= 2)
    return (
      <Badge className="bg-warning/15 text-warning-soft-foreground hover:bg-warning/25">
        Vence em {dias}d
      </Badge>
    );
  return <Badge variant="outline">{dias}d</Badge>;
}

function PendenciasPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const perms = usePermissions();
  const qc = useQueryClient();

  const listFn = useServerFn(listPendencias);
  const list = useQuery({
    queryKey: ["pendencias", "list", search.status, search.categoria, search.q],
    queryFn: () =>
      listFn({
        data: {
          status: search.status ?? null,
          categoria: search.categoria ?? null,
          q: search.q ?? null,
        },
      }),
  });

  const rows = useMemo(() => {
    let r = list.data ?? [];
    if (search.prioridade) r = r.filter((x: any) => x.prioridade === search.prioridade);
    return r;
  }, [list.data, search.prioridade]);

  const kpis = useMemo(() => {
    const all = list.data ?? [];
    return {
      total: all.length,
      abertas: all.filter((x: any) => x.status === "aberta" || x.status === "reaberta").length,
      analise: all.filter(
        (x: any) => x.status === "em_analise" || x.status === "aguardando_resposta",
      ).length,
      resolvidas: all.filter((x: any) => x.status === "resolvida").length,
    };
  }, [list.data]);

  const setSearch = (patch: Record<string, string | undefined>) =>
    navigate({ to: ".", search: (prev: any) => ({ ...prev, ...patch }) });

  const openId = search.id;
  const closeSheet = () => setSearch({ id: undefined });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pendências Institucionais</h1>
          <p className="text-muted-foreground text-sm">
            Fluxo corporativo: abertura, análise, resposta, resolução e reabertura.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={<ClipboardList className="h-4 w-4" />} label="Total" value={kpis.total} />
        <KpiCard
          icon={<AlertCircle className="h-4 w-4" />}
          label="Abertas / Reabertas"
          value={kpis.abertas}
          tone="warning"
        />
        <KpiCard
          icon={<Loader2 className="h-4 w-4" />}
          label="Em análise"
          value={kpis.analise}
          tone="info"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Resolvidas"
          value={kpis.resolvidas}
          tone="success"
        />
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título…"
              className="pl-8"
              defaultValue={search.q ?? ""}
              onBlur={(e) => setSearch({ q: e.target.value || undefined })}
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  setSearch({ q: (e.target as HTMLInputElement).value || undefined });
              }}
            />
          </div>
          <FilterSelect
            value={search.status ?? "todos"}
            onValueChange={(v) => setSearch({ status: v === "todos" ? undefined : v })}
            placeholder="Status"
            options={[
              { v: "todos", l: "Todos os status" },
              ...statusOptions("pendencia").map((s) => ({ v: s.value, l: s.label })),
            ]}
          />
          <FilterSelect
            value={search.categoria ?? "todas"}
            onValueChange={(v) => setSearch({ categoria: v === "todas" ? undefined : v })}
            placeholder="Categoria"
            options={[
              { v: "todas", l: "Todas as categorias" },
              ...(Object.keys(CATEGORIA_LABEL) as Categoria[]).map((c) => ({
                v: c,
                l: CATEGORIA_LABEL[c],
              })),
            ]}
          />
          <FilterSelect
            value={search.prioridade ?? "todas"}
            onValueChange={(v) => setSearch({ prioridade: v === "todas" ? undefined : v })}
            placeholder="Prioridade"
            options={[
              { v: "todas", l: "Todas as prioridades" },
              ...(Object.keys(PRIORIDADE_LABEL) as Prioridade[]).map((p) => ({
                v: p,
                l: PRIORIDADE_LABEL[p],
              })),
            ]}
          />
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardContent className="p-0">
          {list.isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Nenhuma pendência encontrada."
                description="Ajuste os filtros ou aguarde novos registros."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Número</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Aberta em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p: any) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => setSearch({ id: p.id })}
                    >
                      <TableCell className="font-mono text-xs">{p.numero}</TableCell>
                      <TableCell className="max-w-[420px] truncate">{p.titulo}</TableCell>
                      <TableCell>
                        {CATEGORIA_LABEL[p.categoria as Categoria] ?? p.categoria}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${PRIORIDADE_CLASSES[p.prioridade as Prioridade]}`}
                        >
                          <Flag className="h-3 w-3" />
                          {PRIORIDADE_LABEL[p.prioridade as Prioridade]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge domain="pendencia" value={p.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{fmtDate(p.prazo)}</span>
                          {slaBadge(p.prazo, p.status as Status)}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {fmtDateTime(p.aberta_em)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!openId} onOpenChange={(o) => !o && closeSheet()}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {openId && (
            <PendenciaDetail
              id={openId}
              perms={perms}
              onChange={() => {
                qc.invalidateQueries({ queryKey: ["pendencias"] });
              }}
              onClose={closeSheet}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FilterSelect({
  value,
  onValueChange,
  placeholder,
  options,
}: {
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
  options: { v: string; l: string }[];
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.v} value={o.v}>
            {o.l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "warning" | "info" | "success";
}) {
  const toneCls =
    tone === "warning"
      ? "text-warning-soft-foreground"
      : tone === "info"
        ? "text-primary"
        : tone === "success"
          ? "text-success"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-9 w-9 rounded-md bg-muted flex items-center justify-center ${toneCls}`}>
          {icon}
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold leading-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function PendenciaDetail({
  id,
  perms,
  onChange,
  onClose,
}: {
  id: string;
  perms: ReturnType<typeof usePermissions>;
  onChange: () => void;
  onClose: () => void;
}) {
  const getFn = useServerFn(getPendencia);
  const detail = useQuery({
    queryKey: ["pendencia", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const usersList = useQuery({
    queryKey: ["usuarios-ativos-min"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nome_completo, email")
        .eq("status", "ativo")
        .is("deleted_at", null)
        .order("nome_completo")
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  // `retry` só deve ser informado para operações IDEMPOTENTES.
  // `responderPendencia` cria um novo registro de histórico — repetir causaria
  // duplicata visível — por isso é a única que segue sem retry.
  const useAction = (fn: any, msgOk: string, retry?: RetryConfig) => {
    const call = useServerFn(fn);
    const base = {
      onSuccess: () => {
        toast.success(msgOk);
        detail.refetch();
        onChange();
      },
      onError: (e: any) => toast.error(e?.message ?? "Falha na operação"),
    };
    if (retry) {
      return useRetryMutation<unknown, any>({
        ...base,
        retry,
        mutationFn: (payload: any) => call({ data: payload }),
      });
    }
    return useMutation({
      ...base,
      mutationFn: (payload: any) => call({ data: payload }),
    });
  };

  const mAtribuir = useAction(atribuirPendencia, "Responsável atualizado.", {
    operation: "pendencia.atribuir",
  });
  const mResponder = useAction(responderPendencia, "Resposta registrada."); // NÃO idempotente
  const mResolver = useAction(resolverPendencia, "Pendência resolvida.", {
    operation: "pendencia.resolver",
  });
  const mReabrir = useAction(reabrirPendencia, "Pendência reaberta.", {
    operation: "pendencia.reabrir",
  });
  const mCancelar = useAction(cancelarPendencia, "Pendência cancelada.", {
    operation: "pendencia.cancelar",
  });
  const mPrioridade = useAction(alterarPrioridade, "Prioridade alterada.", {
    operation: "pendencia.alterar_prioridade",
  });
  const mPrazo = useAction(alterarPrazo, "Prazo alterado.", {
    operation: "pendencia.alterar_prazo",
  });

  const [resposta, setResposta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [novoPrazo, setNovoPrazo] = useState("");
  const [novaPrio, setNovaPrio] = useState<Prioridade | "">("");
  const [novoResp, setNovoResp] = useState<string>("");

  if (detail.isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (detail.isError || !detail.data)
    return <div className="p-6 text-sm text-destructive">Erro ao carregar pendência.</div>;

  const p: any = detail.data.pendencia;
  const historico: any[] = detail.data.historico ?? [];
  const encerrada = ["resolvida", "cancelada"].includes(p.status);

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">{p.numero}</span>
          <span>{p.titulo}</span>
        </SheetTitle>
        <SheetDescription className="flex flex-wrap gap-2 items-center">
          <StatusBadge domain="pendencia" value={p.status} />
          <span
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${PRIORIDADE_CLASSES[p.prioridade as Prioridade]}`}
          >
            <Flag className="h-3 w-3" />
            {PRIORIDADE_LABEL[p.prioridade as Prioridade]}
          </span>
          <span className="text-xs">
            Categoria: {CATEGORIA_LABEL[p.categoria as Categoria] ?? p.categoria}
          </span>
        </SheetDescription>
      </SheetHeader>

      <div className="mt-4 space-y-4 text-sm">
        {p.descricao && (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Descrição
            </div>
            <p className="whitespace-pre-wrap">{p.descricao}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Info label="Aberta em" value={fmtDateTime(p.aberta_em)} />
          <Info label="Prazo" value={fmtDate(p.prazo)} />
          <Info label="Respondida em" value={fmtDateTime(p.respondida_em)} />
          <Info label="Resolvida em" value={fmtDateTime(p.resolvida_em)} />
          <Info
            label="Responsável"
            value={
              usersList.data?.find((u: any) => u.id === p.responsavel_id)?.nome_completo ??
              (p.responsavel_id ? p.responsavel_id.slice(0, 8) : "—")
            }
          />
          <Info label="Unidade" value={p.unidade_id ? p.unidade_id.slice(0, 8) : "—"} />
        </div>
      </div>

      <Separator className="my-4" />

      <Tabs defaultValue="acoes">
        <TabsList>
          <TabsTrigger value="acoes">Ações</TabsTrigger>
          <TabsTrigger value="historico">Histórico ({historico.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="acoes" className="space-y-5 pt-4">
          {/* Atribuir */}
          {perms.has("pendencia.atribuir") && !encerrada && (
            <Section title="Atribuir responsável" icon={<UserPlus2 className="h-4 w-4" />}>
              <div className="flex gap-2">
                <Select value={novoResp} onValueChange={setNovoResp}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um responsável…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(usersList.data ?? []).map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome_completo ?? u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => mAtribuir.mutate({ id, responsavel_id: novoResp || null })}
                  disabled={mAtribuir.isPending || !novoResp}
                >
                  Atribuir
                </Button>
              </div>
            </Section>
          )}

          {/* Responder */}
          {perms.has("pendencia.responder") && !encerrada && (
            <Section title="Registrar resposta" icon={<MessageSquare className="h-4 w-4" />}>
              <Textarea
                placeholder="Descreva a resposta / providências…"
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
                rows={3}
              />
              <div className="flex justify-end mt-2">
                <Button
                  onClick={() => {
                    mResponder.mutate(
                      { id, resposta },
                      {
                        onSuccess: () => setResposta(""),
                      },
                    );
                  }}
                  disabled={mResponder.isPending || resposta.trim().length < 1}
                >
                  Enviar resposta
                </Button>
              </div>
            </Section>
          )}

          {/* Resolver / Reabrir / Cancelar */}
          <div className="flex flex-wrap gap-2">
            {perms.has("pendencia.resolver") && !encerrada && (
              <Button
                variant="default"
                onClick={() => mResolver.mutate({ id, comentario: motivo || null })}
                disabled={mResolver.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" /> Resolver
              </Button>
            )}
            {perms.has("pendencia.reabrir") && p.status === "resolvida" && (
              <Button
                variant="secondary"
                onClick={() => {
                  if (motivo.trim().length < 3)
                    return toast.error("Informe o motivo da reabertura.");
                  mReabrir.mutate({ id, motivo });
                }}
                disabled={mReabrir.isPending}
              >
                <Repeat2 className="h-4 w-4 mr-1" /> Reabrir
              </Button>
            )}
            {perms.has("pendencia.cancelar") && !encerrada && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (motivo.trim().length < 3)
                    return toast.error("Informe o motivo do cancelamento.");
                  mCancelar.mutate({ id, motivo });
                }}
                disabled={mCancelar.isPending}
              >
                <XCircle className="h-4 w-4 mr-1" /> Cancelar
              </Button>
            )}
          </div>
          <div>
            <Textarea
              placeholder="Motivo / comentário (obrigatório para reabrir e cancelar)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
            />
          </div>

          {/* Prioridade / Prazo */}
          {perms.has("pendencia.editar") && !encerrada && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Section title="Alterar prioridade" icon={<Flag className="h-4 w-4" />}>
                <div className="flex gap-2">
                  <Select value={novaPrio} onValueChange={(v) => setNovaPrio(v as Prioridade)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Nova prioridade" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PRIORIDADE_LABEL) as Prioridade[]).map((pp) => (
                        <SelectItem key={pp} value={pp}>
                          {PRIORIDADE_LABEL[pp]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => novaPrio && mPrioridade.mutate({ id, prioridade: novaPrio })}
                    disabled={mPrioridade.isPending || !novaPrio}
                  >
                    Aplicar
                  </Button>
                </div>
              </Section>

              <Section title="Alterar prazo" icon={<CalendarClock className="h-4 w-4" />}>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={novoPrazo}
                    onChange={(e) => setNovoPrazo(e.target.value)}
                  />
                  <Button
                    onClick={() => mPrazo.mutate({ id, prazo: novoPrazo || null })}
                    disabled={mPrazo.isPending}
                  >
                    Aplicar
                  </Button>
                </div>
              </Section>
            </div>
          )}
        </TabsContent>

        <TabsContent value="historico" className="pt-4">
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>
          ) : (
            <ol className="relative border-l border-border ml-3 space-y-4">
              {historico.map((h) => (
                <li key={h.id} className="pl-4">
                  <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
                  <div className="text-xs text-muted-foreground">{fmtDateTime(h.created_at)}</div>
                  <div className="text-sm font-medium capitalize">
                    {String(h.acao).replaceAll("_", " ")}
                  </div>
                  {h.status_anterior && h.status_novo && (
                    <div className="text-xs text-muted-foreground">
                      {statusLabel("pendencia", h.status_anterior)}
                      {" → "}
                      {statusLabel("pendencia", h.status_novo)}
                    </div>
                  )}
                  {h.comentario && (
                    <p className="text-sm mt-1 whitespace-pre-wrap">{h.comentario}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-medium mb-2">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
