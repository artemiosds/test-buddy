import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRetryMutation, type RetryConfig } from "@/lib/retry-mutation";
import { supabase } from "@/integrations/supabase/client";
import {
  listPendencias,
  contarPendenciasAbertas,
  criarPendencia,
  getPendencia,
  atribuirPendencia,
  responderPendencia,
  resolverPendencia,
  reabrirPendencia,
  cancelarPendencia,
  alterarPrioridade,
  alterarPrazo,
  registrarAnexoPendencia,
  listarAnexosPendencia,
} from "@/lib/pendencias.functions";
import type { Database } from "@/integrations/supabase/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState, StatusBadge } from "@/components/shared";
import { statusLabel, statusOptions } from "@/lib/status";
import { formatDate as fmtDate, formatDateTime as fmtDateTime } from "@/lib/formatters";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Download,
  MessageSquare,
  Paperclip,
  Plus,
  Repeat2,
  Search,
  UserPlus2,
  XCircle,
  Flag,
  Loader2,
} from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { BotaoRelatorioAbnt } from "@/components/relatorios-gerenciais/botao-relatorio-abnt";
import { relatorioPainelAbnt } from "@/lib/painel-abnt";
import { ANEXO_ACCEPT, validarArquivoAnexo, formatarBytes } from "@/lib/anexos-linha";

const PAGE_SIZE = 50;

const searchSchema = z.object({
  status: z.string().optional(),
  categoria: z.string().optional(),
  prioridade: z.string().optional(),
  unidade_id: z.string().uuid().optional(),
  responsavel_id: z.string().uuid().optional(),
  atrasadas: z.boolean().optional(),
  page: z.number().int().min(1).optional(),
  q: z.string().optional(),
  id: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/pendencias")({ errorComponent: ErrorComponent,
  head: () => ({
    meta: [
      { title: "Pendências Institucionais | Gestão Saúde" },
      {
        name: "description",
        content:
          "Abertura, análise, resposta e resolução de pendências institucionais das unidades de saúde.",
      },
      { property: "og:title", content: "Pendências Institucionais" },
      {
        property: "og:description",
        content: "Fluxo corporativo de pendências: abertura, análise, resposta e resolução.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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

/** Unidades ativas (para filtro e formulário de abertura). */
function useUnidades() {
  return useQuery({
    queryKey: ["unidades-min-pendencias"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidades")
        .select("id, nome, secretaria_id")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useUsuarios() {
  return useQuery({
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
}

function PendenciasPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const perms = usePermissions();
  const qc = useQueryClient();
  const [novaAberta, setNovaAberta] = useState(false);

  const unidades = useUnidades();
  const usuarios = useUsuarios();

  const page = search.page ?? 1;
  const filtros = {
    status: search.status ?? null,
    categoria: search.categoria ?? null,
    prioridade: search.prioridade ?? null,
    unidade_id: search.unidade_id ?? null,
    responsavel_id: search.responsavel_id ?? null,
    somente_atrasadas: search.atrasadas ?? null,
    q: search.q ?? null,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };

  const listFn = useServerFn(listPendencias);
  const list = useQuery({
    queryKey: ["pendencias", "list", JSON.stringify(filtros)],
    queryFn: () => listFn({ data: filtros }),
  });

  const contarFn = useServerFn(contarPendenciasAbertas);
  const contagem = useQuery({
    queryKey: ["pendencias", "contagem", search.unidade_id ?? null],
    queryFn: () => contarFn({ data: { unidade_id: search.unidade_id ?? null } }),
  });

  const rows: any[] = (list.data as any)?.rows ?? [];
  const total: number = (list.data as any)?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const kpis = useMemo(
    () => ({
      total,
      abertas: (contagem.data as any)?.abertas ?? 0,
      atrasadas: (contagem.data as any)?.atrasadas ?? 0,
      naPagina: rows.length,
    }),
    [total, contagem.data, rows.length],
  );

  const setSearch = (patch: Record<string, string | number | boolean | undefined>) =>
    navigate({ to: ".", search: (prev: any) => ({ ...prev, page: undefined, ...patch }) });

  const nomeUnidade = (id?: string | null) =>
    (unidades.data ?? []).find((u: any) => u.id === id)?.nome ?? "—";
  const nomeUsuario = (id?: string | null) =>
    (usuarios.data ?? []).find((u: any) => u.id === id)?.nome_completo ?? "—";

  function exportarExcel() {
    void (async () => {
      const XLSX = await import("xlsx-js-style");
      const dados = rows.map((p) => ({
        Número: p.numero,
        Título: p.titulo,
        Categoria: CATEGORIA_LABEL[p.categoria as Categoria] ?? p.categoria,
        Prioridade: PRIORIDADE_LABEL[p.prioridade as Prioridade] ?? p.prioridade,
        Status: statusLabel("pendencia", p.status),
        Unidade: nomeUnidade(p.unidade_id),
        Responsável: p.responsavel_id ? nomeUsuario(p.responsavel_id) : "Não atribuída",
        Prazo: fmtDate(p.prazo),
        "Aberta em": fmtDateTime(p.aberta_em),
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dados), "Pendências");
      XLSX.writeFile(wb, "pendencias-institucionais.xlsx", { bookType: "xlsx" });
    })();
  }

  const openId = search.id;
  const closeSheet = () => navigate({ to: ".", search: (prev: any) => ({ ...prev, id: undefined }) });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pendências Institucionais</h1>
          <p className="text-muted-foreground text-sm">
            Fluxo corporativo: abertura, análise, resposta, resolução e reabertura.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportarExcel} disabled={!rows.length}>
            <Download className="mr-1 h-4 w-4" />
            Excel
          </Button>
          <BotaoRelatorioAbnt
            label="Imprimir PDF (ABNT)"
            variant="outline"
            disabled={!rows.length}
            relatorio={() =>
              relatorioPainelAbnt({
                arquivo: "pendencias-institucionais",
                titulo: "Pendências Institucionais",
                subtitulo: "Abertura, análise, resposta e resolução",
                orientacao: "landscape",
                filtros: [
                  {
                    label: "Status",
                    valor: search.status ? statusLabel("pendencia", search.status) : "Todos",
                  },
                  {
                    label: "Categoria",
                    valor: search.categoria
                      ? (CATEGORIA_LABEL[search.categoria as Categoria] ?? search.categoria)
                      : "Todas",
                  },
                  {
                    label: "Prioridade",
                    valor: search.prioridade
                      ? (PRIORIDADE_LABEL[search.prioridade as Prioridade] ?? search.prioridade)
                      : "Todas",
                  },
                  { label: "Unidade", valor: search.unidade_id ? nomeUnidade(search.unidade_id) : "Todas" },
                  { label: "Somente atrasadas", valor: search.atrasadas ? "Sim" : "Não" },
                ],
                kpis: [
                  { label: "Total no filtro", valor: total },
                  { label: "Em aberto", valor: kpis.abertas },
                  { label: "Atrasadas", valor: kpis.atrasadas },
                ],
                blocos: [
                  {
                    titulo: `Relação de pendências (página ${page} de ${totalPaginas})`,
                    head: [
                      "Número",
                      "Título",
                      "Categoria",
                      "Prioridade",
                      "Status",
                      "Unidade",
                      "Responsável",
                      "Prazo",
                    ],
                    align: [
                      "left",
                      "left",
                      "left",
                      "left",
                      "left",
                      "left",
                      "left",
                      "center",
                    ],
                    larguras: [24, 62, 24, 22, 28, 46, 42, 22],
                    body: rows.map((p) => [
                      p.numero,
                      p.titulo,
                      CATEGORIA_LABEL[p.categoria as Categoria] ?? p.categoria,
                      PRIORIDADE_LABEL[p.prioridade as Prioridade] ?? p.prioridade,
                      statusLabel("pendencia", p.status),
                      nomeUnidade(p.unidade_id),
                      p.responsavel_id ? nomeUsuario(p.responsavel_id) : "Não atribuída",
                      fmtDate(p.prazo),
                    ]),
                  },
                ],
                registros: rows.length,
              })
            }
          />
          {((perms.data as any)?.is_master || perms.has("pendencia.criar")) && (
            <Button size="sm" onClick={() => setNovaAberta(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Nova pendência
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<ClipboardList className="h-4 w-4" />}
          label="Total no filtro"
          value={kpis.total}
        />
        <KpiCard
          icon={<AlertCircle className="h-4 w-4" />}
          label="Em aberto (institucional)"
          value={kpis.abertas}
          tone="warning"
        />
        <KpiCard
          icon={<CalendarClock className="h-4 w-4" />}
          label="Atrasadas"
          value={kpis.atrasadas}
          tone="warning"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Exibidas nesta página"
          value={kpis.naPagina}
          tone="info"
        />
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número ou título…"
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
          <FilterSelect
            value={search.unidade_id ?? "todas"}
            onValueChange={(v) => setSearch({ unidade_id: v === "todas" ? undefined : v })}
            placeholder="Unidade"
            options={[
              { v: "todas", l: "Todas as unidades" },
              ...(unidades.data ?? []).map((u: any) => ({ v: u.id, l: u.nome })),
            ]}
          />
          <FilterSelect
            value={search.responsavel_id ?? "todos"}
            onValueChange={(v) => setSearch({ responsavel_id: v === "todos" ? undefined : v })}
            placeholder="Responsável"
            options={[
              { v: "todos", l: "Todos os responsáveis" },
              ...(usuarios.data ?? []).map((u: any) => ({ v: u.id, l: u.nome_completo })),
            ]}
          />
          <div className="flex items-center gap-2">
            <Button
              variant={search.atrasadas ? "default" : "outline"}
              size="sm"
              onClick={() => setSearch({ atrasadas: search.atrasadas ? undefined : true })}
            >
              <CalendarClock className="mr-1 h-4 w-4" />
              Somente atrasadas
            </Button>
          </div>
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
                description="Ajuste os filtros ou abra uma nova pendência."
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
                    <TableHead>Unidade</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Aberta em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p: any) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() =>
                        navigate({ to: ".", search: (prev: any) => ({ ...prev, id: p.id }) })
                      }
                    >
                      <TableCell className="font-mono text-xs">{p.numero}</TableCell>
                      <TableCell className="max-w-[380px] truncate">{p.titulo}</TableCell>
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
                      <TableCell className="max-w-[220px] truncate">
                        {nomeUnidade(p.unidade_id)}
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

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t p-3 text-sm">
              <span className="text-muted-foreground">
                Página {page} de {totalPaginas} — {total} pendência(s)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() =>
                    navigate({ to: ".", search: (prev: any) => ({ ...prev, page: page - 1 }) })
                  }
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPaginas}
                  onClick={() =>
                    navigate({ to: ".", search: (prev: any) => ({ ...prev, page: page + 1 }) })
                  }
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <NovaPendenciaDialog
        open={novaAberta}
        onOpenChange={setNovaAberta}
        unidades={unidades.data ?? []}
        usuarios={usuarios.data ?? []}
        onCriada={() => qc.invalidateQueries({ queryKey: ["pendencias"] })}
      />

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

/** Abertura manual de pendência institucional. */
function NovaPendenciaDialog({
  open,
  onOpenChange,
  unidades,
  usuarios,
  onCriada,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  unidades: any[];
  usuarios: any[];
  onCriada: () => void;
}) {
  const criarFn = useServerFn(criarPendencia);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<Categoria>("geral");
  const [prioridade, setPrioridade] = useState<Prioridade>("media");
  const [unidadeId, setUnidadeId] = useState<string>("");
  const [responsavelId, setResponsavelId] = useState<string>("");
  const [prazo, setPrazo] = useState<string>("");

  const unidade = unidades.find((u) => u.id === unidadeId);

  const criar = useMutation({
    mutationFn: () =>
      criarFn({
        data: {
          titulo,
          descricao: descricao || null,
          categoria,
          prioridade,
          secretaria_id: unidade?.secretaria_id as string,
          unidade_id: unidadeId || null,
          responsavel_id: responsavelId || null,
          prazo: prazo || null,
        },
      }),
    onSuccess: () => {
      toast.success("Pendência aberta.");
      setTitulo("");
      setDescricao("");
      setPrazo("");
      setResponsavelId("");
      onOpenChange(false);
      onCriada();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao abrir a pendência."),
  });

  const podeSalvar = titulo.trim().length >= 3 && !!unidade?.secretaria_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova pendência</DialogTitle>
          <DialogDescription>
            A pendência é registrada com número oficial, histórico e aviso ao responsável.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Título</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Folha de março sem comprovante de plantão"
            />
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhe o que precisa ser corrigido ou enviado."
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as Categoria)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORIA_LABEL) as Categoria[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORIA_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as Prioridade)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORIDADE_LABEL) as Prioridade[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORIDADE_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Unidade</Label>
            <Select value={unidadeId} onValueChange={setUnidadeId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                {unidades.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Responsável (opcional)</Label>
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Definir depois" />
                </SelectTrigger>
                <SelectContent>
                  {usuarios.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Prazo (opcional)</Label>
              <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!podeSalvar || criar.isPending} onClick={() => criar.mutate()}>
            {criar.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Abrir pendência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Anexos de comprovação da pendência. */
function AnexosPendencia({ pendencia }: { pendencia: any }) {
  const listarFn = useServerFn(listarAnexosPendencia);
  const registrarFn = useServerFn(registrarAnexoPendencia);
  const [enviando, setEnviando] = useState(false);

  const anexos = useQuery({
    queryKey: ["pendencia-anexos", pendencia.id],
    queryFn: () => listarFn({ data: { pendencia_id: pendencia.id } }),
  });

  async function enviar(file: File) {
    const check = validarArquivoAnexo(file);
    if (!check.ok) {
      toast.error(check.erro);
      return;
    }
    setEnviando(true);
    try {
      const pasta = pendencia.unidade_id ?? pendencia.secretaria_id;
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const path = `${pendencia.secretaria_id}/${pasta}/pendencias/${pendencia.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("documentos")
        .upload(path, file, { contentType: check.mime, upsert: false });
      if (error) throw new Error(error.message);
      await registrarFn({
        data: {
          pendencia_id: pendencia.id,
          nome: file.name,
          storage_path: path,
          mime_type: check.mime,
          tamanho_bytes: file.size,
        },
      });
      toast.success("Anexo enviado.");
      anexos.refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar o anexo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium flex items-center gap-2">
          <Paperclip className="h-4 w-4" /> Anexos
        </div>
        <label className="inline-flex">
          <input
            type="file"
            accept={ANEXO_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void enviar(f);
            }}
          />
          <Button size="sm" variant="outline" asChild disabled={enviando}>
            <span>
              {enviando ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="mr-1 h-4 w-4" />
              )}
              Anexar arquivo
            </span>
          </Button>
        </label>
      </div>
      {(anexos.data ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhum anexo. Aceita PDF, JPG, PNG ou WEBP (até 10 MB).
        </p>
      ) : (
        <ul className="space-y-1 text-sm">
          {(anexos.data ?? []).map((a: any) => (
            <li key={a.id} className="flex items-center justify-between gap-2">
              <a
                href={a.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="truncate text-primary hover:underline"
              >
                {a.nome}
              </a>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatarBytes(a.tamanho_bytes)} · {fmtDateTime(a.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
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
  // NOTA: `retry` é sempre estável por call-site (literal fixo), garantindo
  // ordem de hooks consistente entre renders — invariante seguro por convenção.
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
      // eslint-disable-next-line react-hooks/rules-of-hooks -- retry estável por call-site
      return useRetryMutation<unknown, any>({
        ...base,
        retry,
        mutationFn: (payload: any) => call({ data: payload }),
      });
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks -- retry estável por call-site
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

      <AnexosPendencia pendencia={p} />

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
