import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Bot,
  Check,
  FileDown,
  FileSpreadsheet,
  FileText,
  FileType,
  Loader2,
  Maximize2,
  MessageSquarePlus,
  Minimize2,
  Move,
  Pencil,
  Search,
  Send,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDraggable } from "@/hooks/use-draggable";
import { Markdown } from "./markdown";
import {
  atualizarConversaHSM,
  confirmarAcaoHSM,
  enviarMensagemHSM,
  lerMensagensHSM,
  listarConversasHSM,
  registrarFeedbackHSM,
  type HsmMensagem,
  type HsmResposta,
} from "@/lib/hsm-expert.functions";
import { useCompetenciaAtiva } from "@/hooks/use-competencia-ativa";
import { HSM_AGENTES, agentePorSlug } from "@/lib/hsm/agentes";
import {
  exportarCsv,
  exportarExcel,
  exportarPdf,
  exportarWord,
  type HsmExportacao,
} from "@/lib/hsm/exportacao";

const BOAS_VINDAS = `Olá! Eu sou o **HSM Expert**.

Sou seu especialista inteligente em Gestão da Saúde. Posso consultar dados do sistema, analisar informações, gerar relatórios, responder dúvidas e auxiliar nas tarefas do ERP.

Como posso ajudar hoje?`;

const SUGESTOES = [
  "Quantos profissionais estão ativos?",
  "Qual unidade possui mais profissionais?",
  "Liste os profissionais de licença",
  "Mostre as pendências em aberto",
];

export default function HsmExpertPanel({
  aberto,
  onFechar,
}: {
  aberto: boolean;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const rota = useRouterState({ select: (s) => s.location.pathname });
  const competencia = useCompetenciaAtiva();

  const enviar = useServerFn(enviarMensagemHSM);
  const confirmar = useServerFn(confirmarAcaoHSM);
  const atualizar = useServerFn(atualizarConversaHSM);
  const carregarMsgs = useServerFn(lerMensagensHSM);
  const enviarFeedback = useServerFn(registrarFeedbackHSM);

  const [conversaId, setConversaId] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  const [pendente, setPendente] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<HsmResposta["confirmacao"]>(null);
  const [exportacao, setExportacao] = useState<HsmExportacao | null>(null);
  const [modelo, setModelo] = useState<string | null>(null);
  const [agente, setAgente] = useState("geral");
  const [feedback, setFeedback] = useState<Record<string, boolean>>({});
  const areaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [maximizado, setMaximizado] = useState(false);

  // Painel flutuante: pode ser arrastado para qualquer canto da tela.
  const drag = useDraggable({
    chave: "hsm-expert-pos",
    ativo: aberto && !maximizado,
    inicial: (tamanho, janela) => ({
      x: janela.largura - tamanho.largura - 24,
      y: Math.max(16, janela.altura - tamanho.altura - 24),
    }),
  });

  const conversas = useQuery({
    queryKey: ["hsm-conversas"],
    queryFn: () => listarConversasHSM(),
    enabled: aberto,
  });

  const mensagens = useQuery({
    queryKey: ["hsm-mensagens", conversaId],
    queryFn: () => carregarMsgs({ data: { conversa_id: conversaId! } }),
    enabled: aberto && !!conversaId,
  });

  const ctx = useMemo(
    () => ({
      rota,
      competencia: competencia.data
        ? `${String(competencia.data.mes).padStart(2, "0")}/${competencia.data.ano}`
        : null,
    }),
    [rota, competencia.data],
  );

  const mut = useMutation({
    mutationFn: async (pergunta: string) => {
      setPendente(pergunta);
      return enviar({ data: { conversa_id: conversaId, texto: pergunta, agente, contexto: ctx } });
    },
    onSuccess: (r) => {
      setPendente(null);
      setConversaId(r.conversa_id);
      setConfirmacao(r.confirmacao);
      setExportacao(r.exportacao);
      setModelo(r.mensagem.modelo ?? null);
      qc.invalidateQueries({ queryKey: ["hsm-mensagens", r.conversa_id] });
      qc.invalidateQueries({ queryKey: ["hsm-conversas"] });
      inputRef.current?.focus();
    },
    onError: (e) => {
      setPendente(null);
      toast.error(e instanceof Error ? e.message : "Falha ao falar com o HSM Expert.");
    },
  });

  const mutConfirmar = useMutation({
    mutationFn: async () =>
      confirmar({
        data: {
          conversa_id: conversaId!,
          ferramenta: confirmacao!.ferramenta,
          argumentos_json: confirmacao!.argumentos_json,
          agente,
          contexto: ctx,
        },
      }),
    onSuccess: (r) => {
      setConfirmacao(null);
      setExportacao(r.exportacao);
      qc.invalidateQueries({ queryKey: ["hsm-mensagens", r.conversa_id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível executar."),
  });

  useEffect(() => {
    if (aberto) setTimeout(() => inputRef.current?.focus(), 120);
  }, [aberto, conversaId]);

  useEffect(() => {
    const el = areaRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensagens.data, pendente]);

  const lista = (conversas.data ?? []).filter((c) =>
    busca ? c.titulo.toLowerCase().includes(busca.toLowerCase()) : true,
  );

  async function avaliar(mensagemId: string, util: boolean) {
    setFeedback((f) => ({ ...f, [mensagemId]: util }));
    try {
      await enviarFeedback({ data: { mensagem_id: mensagemId, util } });
      toast.success(util ? "Obrigado pelo retorno!" : "Retorno registrado. Vamos melhorar.");
    } catch {
      toast.error("Não foi possível registrar sua avaliação.");
    }
  }

  function submeter() {
    const t = texto.trim();
    if (!t || mut.isPending) return;
    setTexto("");
    mut.mutate(t);
  }

  async function acaoConversa(id: string, patch: { favorito?: boolean; excluir?: boolean; titulo?: string }) {
    await atualizar({ data: { conversa_id: id, ...patch } });
    if (patch.excluir && id === conversaId) setConversaId(null);
    qc.invalidateQueries({ queryKey: ["hsm-conversas"] });
  }

  if (!aberto) return null;

  return (
    <div
      ref={drag.elementoRef}
      role="dialog"
      aria-label="HSM Expert"
      style={maximizado ? undefined : drag.style}
      className={cn(
        "fixed z-50 flex flex-col gap-0 overflow-hidden rounded-xl border bg-background shadow-2xl",
        drag.arrastando && "select-none",
        maximizado
          ? "inset-2 h-auto w-auto"
          : "h-[min(85vh,44rem)] w-[min(94vw,44rem)]",
      )}
    >
      {/* Header (também é o punho de arrasto) */}
      <header
        {...drag.handleProps}
        className={cn(
          "flex items-start gap-3 border-b bg-muted/30 px-4 py-3",
          maximizado ? "" : drag.arrastando ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Bot className="size-5" />
        </div>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">HSM Expert</h2>
            <p className="truncate text-xs text-muted-foreground">
              Especialista Inteligente em Gestão da Saúde
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="gap-1 border-emerald-500/40 text-[10px] text-emerald-600">
                <span className="size-1.5 rounded-full bg-emerald-500" /> Online
              </Badge>
              {modelo ? (
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {modelo}
                </Badge>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {HSM_AGENTES.map((a) => (
                <button
                  key={a.slug}
                  type="button"
                  title={a.descricao}
                  onClick={() => setAgente(a.slug)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[10px] transition",
                    a.slug === agente
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  {a.nome}
                </button>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5" data-no-drag>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMaximizado((v) => !v)}
              aria-label={maximizado ? "Restaurar tamanho" : "Maximizar"}
              title={maximizado ? "Restaurar" : "Maximizar"}
            >
              {maximizado ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={drag.reposicionar}
              aria-label="Reposicionar painel"
              title="Voltar à posição padrão"
            >
              <Move className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onFechar} aria-label="Fechar">
              <X className="size-4" />
            </Button>
          </div>

        </header>

        <div className="flex min-h-0 flex-1">
          {/* Histórico */}
          <aside className="hidden w-56 shrink-0 flex-col border-r bg-muted/20 md:flex">
            <div className="space-y-2 p-2">
              <Button
                size="sm"
                variant="secondary"
                className="w-full justify-start gap-2"
                onClick={() => {
                  setConversaId(null);
                  setConfirmacao(null);
                  setExportacao(null);
                  inputRef.current?.focus();
                }}
              >
                <MessageSquarePlus className="size-4" /> Nova conversa
              </Button>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Pesquisar"
                  className="h-8 pl-7 text-xs"
                />
              </div>
            </div>
            <Separator />
            <ScrollArea className="flex-1">
              <div className="space-y-0.5 p-2">
                {lista.map((c) => (
                  <div
                    key={c.id}
                    className={cn(
                      "group flex items-center gap-1 rounded-md px-2 py-1.5 text-xs",
                      c.id === conversaId ? "bg-primary/10 text-primary" : "hover:bg-muted",
                    )}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left"
                      onClick={() => {
                        setConversaId(c.id);
                        setConfirmacao(null);
                        setExportacao(null);

                      }}
                    >
                      {c.titulo}
                    </button>
                    <button
                      type="button"
                      aria-label="Favoritar"
                      className="opacity-0 transition group-hover:opacity-100"
                      onClick={() => acaoConversa(c.id, { favorito: !c.favorito })}
                    >
                      <Star
                        className={cn(
                          "size-3.5",
                          c.favorito ? "fill-amber-400 text-amber-500" : "text-muted-foreground",
                        )}
                      />
                    </button>
                    <button
                      type="button"
                      aria-label="Renomear"
                      className="opacity-0 transition group-hover:opacity-100"
                      onClick={() => {
                        const novo = window.prompt("Novo título", c.titulo);
                        if (novo?.trim()) acaoConversa(c.id, { titulo: novo.trim() });
                      }}
                    >
                      <Pencil className="size-3.5 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      aria-label="Excluir"
                      className="opacity-0 transition group-hover:opacity-100"
                      onClick={() => acaoConversa(c.id, { excluir: true })}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </button>
                  </div>
                ))}
                {lista.length === 0 ? (
                  <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">
                    Nenhuma conversa ainda.
                  </p>
                ) : null}
              </div>
            </ScrollArea>
          </aside>

          {/* Chat */}
          <section className="flex min-w-0 flex-1 flex-col">
            <ScrollArea ref={areaRef} className="flex-1">
              <div className="space-y-4 px-4 py-4">
                {!conversaId && !pendente ? (
                  <>
                    <Markdown texto={BOAS_VINDAS} />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(agentePorSlug(agente).sugestoes ?? SUGESTOES).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => mut.mutate(s)}
                          className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}

                {(mensagens.data ?? []).map((m: HsmMensagem) =>
                  m.papel === "user" ? (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                        {m.conteudo}
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className="space-y-1">
                      <Markdown texto={m.conteudo} />
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                        {m.ferramentas?.map((f) => (
                          <span key={f.nome} className="rounded bg-muted px-1.5 py-0.5">
                            {f.nome}
                          </span>
                        ))}
                        {m.modelo ? <span>{m.modelo}</span> : null}
                        {m.duracao_ms ? <span>{(m.duracao_ms / 1000).toFixed(1)}s</span> : null}
                        <span className="ml-auto flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="Resposta útil"
                            onClick={() => avaliar(m.id, true)}
                            className={cn(
                              "rounded p-1 transition hover:bg-muted",
                              feedback[m.id] === true && "text-emerald-600",
                            )}
                          >
                            <ThumbsUp className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Resposta não útil"
                            onClick={() => avaliar(m.id, false)}
                            className={cn(
                              "rounded p-1 transition hover:bg-muted",
                              feedback[m.id] === false && "text-destructive",
                            )}
                          >
                            <ThumbsDown className="size-3.5" />
                          </button>
                        </span>
                      </div>
                    </div>
                  ),
                )}

                {pendente ? (
                  <>
                    <div className="flex justify-end">
                      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                        {pendente}
                      </div>
                    </div>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" /> Consultando o sistema...
                    </p>
                  </>
                ) : null}

                {exportacao ? (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {exportacao.linhas.length} registro(s)
                      </span>{" "}
                      prontos para exportar.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => exportarExcel(exportacao)}>
                        <FileSpreadsheet className="size-3.5" /> Excel
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => exportarCsv(exportacao)}>
                        <FileDown className="size-3.5" /> CSV
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => exportarPdf(exportacao)}>
                        <FileText className="size-3.5" /> PDF
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => exportarWord(exportacao)}>
                        <FileType className="size-3.5" /> Word
                      </Button>
                    </div>
                  </div>
                ) : null}

                {confirmacao ? (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                    <p className="text-xs text-muted-foreground">
                      Esta ação altera dados do sistema e será registrada na auditoria.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        className="gap-1"
                        disabled={mutConfirmar.isPending}
                        onClick={() => mutConfirmar.mutate()}
                      >
                        {mutConfirmar.isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Check className="size-3.5" />
                        )}
                        Confirmar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmacao(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </ScrollArea>

            <div className="border-t bg-background p-3">
              <div className="flex items-end gap-2">
                <Textarea
                  ref={inputRef}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submeter();
                    }
                  }}
                  rows={1}
                  placeholder="Pergunte ao HSM Expert..."
                  className="max-h-40 min-h-[42px] resize-none text-sm"
                />
                <Button
                  size="icon"
                  onClick={submeter}
                  disabled={!texto.trim() || mut.isPending}
                  aria-label="Enviar"
                >
                  {mut.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                As respostas respeitam suas permissões e são registradas na auditoria.
              </p>
            </div>
          </section>
        </div>
    </div>

  );
}
