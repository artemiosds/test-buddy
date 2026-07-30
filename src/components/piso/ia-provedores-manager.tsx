/**
 * Gerenciador de Provedores de IA — substitui a antiga seção "IA de Visão".
 *
 * Lista os provedores por prioridade (drag-and-drop), permite cadastro
 * independente por provedor, teste de conexão e exibe as métricas de uso.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  GripVertical,
  Loader2,
  Pencil,
  Plug,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/toast";
import {
  PROVEDORES,
  definicao,
  type ProvedorPublico,
  type TipoProvedor,
} from "@/lib/ai-providers/catalog";
import {
  excluirProvedorIA,
  listarProvedoresIA,
  ordenarProvedoresIA,
  salvarModoIA,
  salvarProvedorIA,
  testarProvedorIA,
} from "@/lib/piso-ia-provedores.functions";

type Rascunho = {
  id: string | null;
  tipo: TipoProvedor;
  nome: string;
  modelo: string;
  base_url: string;
  timeout_ms: number;
  tentativas: number;
  ativo: boolean;
  api_key: string;
};

function rascunhoDe(p?: ProvedorPublico): Rascunho {
  if (!p) {
    const d = definicao("gemini");
    return {
      id: null,
      tipo: "gemini",
      nome: d.nome,
      modelo: d.modeloPadrao,
      base_url: d.baseUrlPadrao,
      timeout_ms: 120000,
      tentativas: 3,
      ativo: true,
      api_key: "",
    };
  }
  return {
    id: p.id,
    tipo: p.tipo,
    nome: p.nome,
    modelo: p.modelo,
    base_url: p.base_url ?? definicao(p.tipo).baseUrlPadrao,
    timeout_ms: p.timeout_ms,
    tentativas: p.tentativas,
    ativo: p.ativo,
    api_key: "",
  };
}

const fmtMs = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v)} ms`);

export function IaProvedoresManager() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["piso-ia-provedores"],
    queryFn: () => listarProvedoresIA(),
  });

  const provedores = useMemo(() => data?.provedores ?? [], [data]);
  const config = data?.config ?? { modo: "automatico" as const, provedor_id: null };

  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState<Rascunho>(rascunhoDe());
  const [teste, setTeste] = useState<{
    ok: boolean;
    ms: number;
    status: number;
    modelo: string;
    mensagem: string;
  } | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);

  const invalidar = () => qc.invalidateQueries({ queryKey: ["piso-ia-provedores"] });

  const salvar = useMutation({
    mutationFn: () =>
      salvarProvedorIA({
        data: {
          id: rascunho.id,
          tipo: rascunho.tipo,
          nome: rascunho.nome,
          modelo: rascunho.modelo,
          base_url: rascunho.base_url || null,
          timeout_ms: rascunho.timeout_ms,
          tentativas: rascunho.tentativas,
          prioridade: rascunho.id
            ? (provedores.find((p) => p.id === rascunho.id)?.prioridade ?? 100)
            : provedores.length + 1,
          ativo: rascunho.ativo,
          extra: {},
          ...(rascunho.api_key.trim() ? { api_key: rascunho.api_key.trim() } : {}),
        },
      }),
    onSuccess: () => {
      setAberto(false);
      setTeste(null);
      invalidar();
      toast.success("Provedor salvo.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => excluirProvedorIA({ data: { id } }),
    onSuccess: () => {
      invalidar();
      toast.success("Provedor removido.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao remover."),
  });

  const ordenar = useMutation({
    mutationFn: (ids: string[]) => ordenarProvedoresIA({ data: { ids } }),
    onSuccess: invalidar,
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao reordenar."),
  });

  const modo = useMutation({
    mutationFn: (v: { modo: "automatico" | "manual"; provedor_id: string | null }) =>
      salvarModoIA({ data: v }),
    onSuccess: invalidar,
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao salvar modo."),
  });

  const testar = useMutation({
    mutationFn: () =>
      testarProvedorIA({
        data: {
          id: rascunho.id,
          tipo: rascunho.tipo,
          nome: rascunho.nome,
          modelo: rascunho.modelo,
          base_url: rascunho.base_url || null,
          timeout_ms: 60000,
          tentativas: 1,
          ...(rascunho.api_key.trim() ? { api_key: rascunho.api_key.trim() } : {}),
        },
      }),
    onSuccess: (r) => setTeste(r),
    onError: (e: unknown) =>
      setTeste({
        ok: false,
        ms: 0,
        status: 0,
        modelo: rascunho.modelo,
        mensagem: e instanceof Error ? e.message : "Falha no teste.",
      }),
  });

  function soltarEm(destinoId: string) {
    if (!arrastando || arrastando === destinoId) return;
    const ids = provedores.map((p) => p.id);
    const de = ids.indexOf(arrastando);
    const para = ids.indexOf(destinoId);
    if (de < 0 || para < 0) return;
    ids.splice(para, 0, ids.splice(de, 1)[0]);
    setArrastando(null);
    ordenar.mutate(ids);
  }

  const def = definicao(rascunho.tipo);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5" /> Gerenciador de Provedores de IA
            </CardTitle>
            <CardDescription>
              Vários provedores com prioridade e failover automático. Se um falhar, o sistema troca
              sozinho para o próximo — sem intervenção do usuário.
            </CardDescription>
          </div>
          <Button
            onClick={() => {
              setRascunho(rascunhoDe());
              setTeste(null);
              setAberto(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Adicionar provedor
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-4 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Switch
              id="modo-auto"
              checked={config.modo === "automatico"}
              onCheckedChange={(v) =>
                modo.mutate({
                  modo: v ? "automatico" : "manual",
                  provedor_id: v ? null : (config.provedor_id ?? provedores[0]?.id ?? null),
                })
              }
            />
            <Label htmlFor="modo-auto">Automático (Recomendado)</Label>
          </div>
          {config.modo === "manual" ? (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Provedor fixo</Label>
              <Select
                value={config.provedor_id ?? ""}
                onValueChange={(v) => modo.mutate({ modo: "manual", provedor_id: v })}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Escolha o provedor" />
                </SelectTrigger>
                <SelectContent>
                  {provedores.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} — {p.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              PDF pesquisável → OCR Local → IA (melhor provedor disponível, por prioridade).
            </p>
          )}
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Carregando provedores…</p>}

        {!isLoading && provedores.length === 0 && (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum provedor cadastrado. O sistema continua funcionando com PDF pesquisável e OCR
            local; adicione um provedor para habilitar a IA de Visão.
          </div>
        )}

        <ul className="space-y-2">
          {provedores.map((p, i) => {
            const d = definicao(p.tipo);
            const m = p.metricas;
            const taxa = m.execucoes > 0 ? Math.round((m.sucessos / m.execucoes) * 100) : null;
            return (
              <li
                key={p.id}
                draggable
                onDragStart={() => setArrastando(p.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => soltarEm(p.id)}
                className={`rounded-md border p-3 ${arrastando === p.id ? "opacity-60" : ""}`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
                  <Badge variant="outline" className="shrink-0">
                    {i + 1}
                  </Badge>
                  <div className="min-w-48 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{p.nome}</span>
                      <Badge variant={p.ativo ? "default" : "secondary"}>
                        {p.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                      {d.exigeChave && !p.tem_chave && (
                        <Badge variant="destructive">Sem API Key</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {d.fornecedor} · {p.modelo || "modelo não definido"} · {p.tentativas}{" "}
                      tentativa(s) · {Math.round(p.timeout_ms / 1000)}s
                      {p.chave_final4 ? ` · chave ••••${p.chave_final4}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setRascunho(rascunhoDe(p));
                        setTeste(null);
                        setAberto(true);
                      }}
                      aria-label={`Editar ${p.nome}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => excluir.mutate(p.id)}
                      aria-label={`Remover ${p.nome}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-2 grid gap-x-4 gap-y-1 border-t pt-2 text-[11px] text-muted-foreground sm:grid-cols-3 lg:grid-cols-4">
                  <span className="flex items-center gap-1">
                    <Activity className="h-3 w-3" /> Sucesso: {taxa == null ? "—" : `${taxa}%`}
                  </span>
                  <span>Médio: {fmtMs(m.tempo_medio_ms)}</span>
                  <span>Mín: {fmtMs(m.tempo_min_ms)}</span>
                  <span>Máx: {fmtMs(m.tempo_max_ms)}</span>
                  <span>PDFs: {m.pdfs}</span>
                  <span>Falhas: {m.falhas}</span>
                  <span>Timeouts: {m.timeouts}</span>
                  <span>
                    429/503: {m.erros_429}/{m.erros_503}
                  </span>
                  <span>
                    Confiança:{" "}
                    {m.confianca_media == null ? "—" : `${Math.round(m.confianca_media * 100)}%`}
                  </span>
                  <span className="sm:col-span-2">
                    Última utilização:{" "}
                    {m.ultima_utilizacao
                      ? new Date(m.ultima_utilizacao).toLocaleString("pt-BR")
                      : "—"}
                  </span>
                  {m.ultimo_erro && (
                    <span className="text-destructive sm:col-span-3 lg:col-span-4">
                      Último erro: {m.ultimo_erro}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {provedores.length > 1 && (
          <p className="text-xs text-muted-foreground">
            Arraste os cartões para alterar a ordem de prioridade do failover.
          </p>
        )}
      </CardContent>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{rascunho.id ? "Editar provedor" : "Novo provedor"}</DialogTitle>
            <DialogDescription>{def.descricao}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prov-tipo">Fornecedor</Label>
              <Select
                value={rascunho.tipo}
                onValueChange={(v) => {
                  const d = definicao(v);
                  setTeste(null);
                  setRascunho((r) => ({
                    ...r,
                    tipo: v as TipoProvedor,
                    nome: d.nome,
                    modelo: d.modeloPadrao,
                    base_url: d.baseUrlPadrao,
                  }));
                }}
              >
                <SelectTrigger id="prov-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVEDORES.map((p) => (
                    <SelectItem key={p.tipo} value={p.tipo}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prov-nome">Nome de exibição</Label>
              <Input
                id="prov-nome"
                value={rascunho.nome}
                onChange={(e) => setRascunho((r) => ({ ...r, nome: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prov-modelo">Modelo</Label>
              <Input
                id="prov-modelo"
                list="modelos-sugeridos"
                value={rascunho.modelo}
                onChange={(e) => setRascunho((r) => ({ ...r, modelo: e.target.value }))}
                placeholder={def.modeloPadrao || "nome do modelo"}
              />
              <datalist id="modelos-sugeridos">
                {def.modelos.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              {def.modelos.length > 0 && (
                <p className="text-xs text-muted-foreground">Sugestões: {def.modelos.join(", ")}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="prov-url">URL Base</Label>
              <Input
                id="prov-url"
                value={rascunho.base_url}
                onChange={(e) => setRascunho((r) => ({ ...r, base_url: e.target.value }))}
                placeholder={def.baseUrlPadrao}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prov-key">API Key</Label>
              <Input
                id="prov-key"
                type="password"
                autoComplete="off"
                value={rascunho.api_key}
                onChange={(e) => setRascunho((r) => ({ ...r, api_key: e.target.value }))}
                placeholder={
                  def.exigeChave ? "Cole a chave do provedor" : "Opcional para este provedor"
                }
              />
              <p className="text-xs text-muted-foreground">
                A chave fica somente no servidor e nunca é devolvida ao navegador.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="prov-timeout">Timeout (s)</Label>
                <Input
                  id="prov-timeout"
                  type="number"
                  min={5}
                  max={600}
                  value={Math.round(rascunho.timeout_ms / 1000)}
                  onChange={(e) =>
                    setRascunho((r) => ({
                      ...r,
                      timeout_ms: Math.max(5, Number(e.target.value) || 120) * 1000,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prov-retry">Tentativas</Label>
                <Select
                  value={String(rascunho.tentativas)}
                  onValueChange={(v) => setRascunho((r) => ({ ...r, tentativas: Number(v) }))}
                >
                  <SelectTrigger id="prov-retry">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prov-ativo">Ativo</Label>
                <div className="flex h-9 items-center">
                  <Switch
                    id="prov-ativo"
                    checked={rascunho.ativo}
                    onCheckedChange={(v) => setRascunho((r) => ({ ...r, ativo: v }))}
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Backoff exponencial entre tentativas: 2s, 4s, 8s, 16s.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={() => testar.mutate()} disabled={testar.isPending}>
                {testar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Testar conexão
              </Button>
              {teste && (
                <span
                  className={`flex items-center gap-1 text-sm ${teste.ok ? "text-emerald-600" : "text-destructive"}`}
                >
                  {teste.ok ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {teste.ok
                    ? `OK · ${teste.ms} ms · ${teste.modelo} · disponível`
                    : `${teste.status || "erro"} · ${teste.mensagem}`}
                </span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar provedor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default IaProvedoresManager;
