import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, Move } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  setPdfPosicaoHandler,
  type PdfPosicaoRequest,
  type PdfPosicaoResult,
  type PdfPosicaoItemResult,
} from "@/lib/pdf-posicao-bus";
import { PdfCanvasPreview } from "@/components/pdf/PdfCanvasPreview";

type Pending = {
  req: PdfPosicaoRequest;
  resolve: (r: PdfPosicaoResult) => void;
};

type Estado = Record<string, PdfPosicaoItemResult>;

/**
 * FASE 2 — Modal de Posicionamento Interativo (multi-assinaturas).
 * Mostra o PDF gerado em memória e permite arrastar (ou usar sliders X/Y)
 * cada assinatura institucional antes de confirmar o download.
 */
export function PdfPosicaoProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [estado, setEstado] = useState<Estado>({});
  const [selecionadaId, setSelecionadaId] = useState<string>("");
  const areaRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const [areaW, setAreaW] = useState(0);

  useEffect(() => {
    setPdfPosicaoHandler(
      (req) =>
        new Promise<PdfPosicaoResult>((resolve) => {
          const inicial: Estado = {};
          for (const item of req.assinaturas) {
            inicial[item.id] = {
              assinaturaId: item.id,
              xMm: item.xPadraoMm,
              yMm: item.yPadraoMm,
              pagina: item.paginaPadrao,
              tamanhoPercentual: item.tamanhoPercentualPadrao,
              incluir: item.incluirPadrao,
              salvarPadrao: false,
            };
          }
          setEstado(inicial);
          setSelecionadaId(
            req.assinaturas.find((a) => a.incluirPadrao)?.id ?? req.assinaturas[0]?.id ?? "",
          );
          setPending({ req, resolve });
        }),
    );
    return () => setPdfPosicaoHandler(null);
  }, []);

  const req = pending?.req;
  const itemAtual = req?.assinaturas.find((a) => a.id === selecionadaId);
  const posAtual = estado[selecionadaId];

  useEffect(() => {
    if (!req) return;
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAreaW(el.clientWidth));
    ro.observe(el);
    setAreaW(el.clientWidth);
    return () => ro.disconnect();
  }, [req]);

  const scale = useMemo(() => (req && areaW ? areaW / req.pageWidthMm : 0), [areaW, req]);

  const atualizar = useCallback(
    (patch: Partial<PdfPosicaoItemResult>, id = selecionadaId) => {
      setEstado((prev) => {
        const atual = prev[id];
        if (!atual) return prev;
        return { ...prev, [id]: { ...atual, ...patch } };
      });
    },
    [selecionadaId],
  );

  const clamp = useCallback(
    (x: number, y: number, tamanho: number) => {
      if (!req) return { x, y };
      const factor = tamanho / 100;
      const w = req.larguraMm * factor;
      const h = req.alturaMm * factor;
      return {
        x: Math.max(0, Math.min(x, req.pageWidthMm - w)),
        y: Math.max(0, Math.min(y, req.pageHeightMm - h - 5)),
      };
    },
    [req],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (!scale || !posAtual) return;
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      dx: (e.clientX - rect.left) / scale - posAtual.xMm,
      dy: (e.clientY - rect.top) / scale - posAtual.yMm,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !scale || !posAtual) return;
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const next = clamp(
      (e.clientX - rect.left) / scale - dragRef.current.dx,
      (e.clientY - rect.top) / scale - dragRef.current.dy,
      posAtual.tamanhoPercentual,
    );
    atualizar({ xMm: next.x, yMm: next.y });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  /** Redimensionamento proporcional pelos handles de canto (30%–200%). */
  const iniciarResize = (e: React.PointerEvent, canto: "nw" | "ne" | "sw" | "se") => {
    e.stopPropagation();
    e.preventDefault();
    if (!req || !scale || !posAtual) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startTam = posAtual.tamanhoPercentual;
    const baseW = req.larguraMm * scale;
    const id = selecionadaId;

    const onMove = (ev: PointerEvent) => {
      const dxPx = (ev.clientX - startX) * (canto === "ne" || canto === "se" ? 1 : -1);
      const dyPx = (ev.clientY - startY) * (canto === "sw" || canto === "se" ? 1 : -1);
      const delta = ((dxPx + dyPx) / 2 / Math.max(1, baseW)) * 100;
      const tam = Math.max(30, Math.min(200, Math.round((startTam + delta) / 5) * 5));
      setEstado((prev) => {
        const atual = prev[id];
        if (!atual) return prev;
        const pos = clamp(atual.xMm, atual.yMm, tam);
        return { ...prev, [id]: { ...atual, tamanhoPercentual: tam, xMm: pos.x, yMm: pos.y } };
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };


  const finalizar = (result: PdfPosicaoResult) => {
    pending?.resolve(result);
    setPending(null);
  };

  // Revoga o blob URL apenas quando ele deixa de ser usado (desmontagem/troca).
  const previewUrl = req?.previewUrl;
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <>
      {children}
      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) finalizar(null);
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Move className="h-4 w-4" />
              Posicionar assinaturas no documento
            </DialogTitle>
          </DialogHeader>

          {req && (
            <div className="grid gap-4 md:grid-cols-[200px_1fr_240px]">
              {/* Seletor de assinaturas */}
              <div className="space-y-2">
                <p className="text-xs font-medium">Assinaturas disponíveis</p>
                <div className="space-y-1">
                  {req.assinaturas.map((a) => {
                    const est = estado[a.id];
                    const ativa = a.id === selecionadaId;
                    return (
                      <div
                        key={a.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelecionadaId(a.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelecionadaId(a.id);
                          }
                        }}
                        className={cn(
                          "cursor-pointer rounded-md border p-2 text-left transition-colors",
                          ativa
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "hover:bg-muted",
                        )}
                      >
                        <span className="block truncate text-xs font-semibold">
                          {a.assinatura.titular_nome ?? "Assinatura"}
                        </span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {a.assinatura.titular_cargo ?? a.assinatura.perfil_codigo ?? ""}
                        </span>
                        {ativa && (
                          <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-wide text-primary">
                            Editando
                          </span>
                        )}
                        <div
                          className="mt-1.5 flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            id={`incluir-${a.id}`}
                            checked={est?.incluir ?? false}
                            onCheckedChange={(c) => {
                              atualizar({ incluir: c === true }, a.id);
                              if (c === true) setSelecionadaId(a.id);
                            }}
                          />
                          <Label htmlFor={`incluir-${a.id}`} className="text-[10px]">
                            Incluir no documento
                          </Label>
                        </div>
                      </div>
                    );

                  })}
                </div>
              </div>

              {/* Preview */}
              <div
                ref={areaRef}
                className="relative overflow-hidden rounded-md border bg-muted"
                style={{ aspectRatio: `${req.pageWidthMm} / ${req.pageHeightMm}` }}
              >
                {req.previewUrl ? (
                  <PdfCanvasPreview
                    url={req.previewUrl}
                    pagina={posAtual?.pagina ?? 1}
                    className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden bg-white"
                  />
                ) : (
                  <div className="absolute inset-0 z-0 grid place-items-center text-xs text-muted-foreground">
                    Pré-visualização indisponível
                  </div>
                )}

                {/* Fantasmas das demais assinaturas marcadas na mesma página */}
                {scale > 0 && req.assinaturas.map((a) => {
                  const est = estado[a.id];
                  if (!est || !est.incluir || a.id === selecionadaId) return null;
                  if (est.pagina !== (posAtual?.pagina ?? 1)) return null;
                  return (
                    <div
                      key={`ghost-${a.id}`}
                      role="button"
                      tabIndex={0}
                      title="Clique para selecionar esta assinatura"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setSelecionadaId(a.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelecionadaId(a.id);
                        }
                      }}
                      className="absolute z-40 cursor-pointer rounded border border-dashed border-muted-foreground/60 bg-background/30 opacity-70 outline-none transition hover:border-primary/70 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-primary/40"
                      style={{
                        left: est.xMm * scale,
                        top: est.yMm * scale,
                        width: req.larguraMm * (est.tamanhoPercentual / 100) * scale,
                        height: req.alturaMm * (est.tamanhoPercentual / 100) * scale,
                        touchAction: "none",
                      }}
                    >
                      {a.assinatura.imageData ? (
                        <img
                          src={a.assinatura.imageData}
                          alt=""
                          className="pointer-events-none h-full w-full object-contain"
                          draggable={false}
                        />
                      ) : (
                        <span className="pointer-events-none flex h-full items-end justify-center truncate px-1 text-[8px]">
                          {a.assinatura.titular_nome ?? ""}
                        </span>
                      )}
                    </div>
                  );
                })}

                {scale > 0 && itemAtual && posAtual && posAtual.incluir && (
                  <div
                    role="button"
                    tabIndex={0}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    className="absolute z-50 cursor-move rounded border-2 border-solid border-primary bg-background/70 shadow-lg outline-none ring-2 ring-primary/25"
                    style={{
                      left: posAtual.xMm * scale,
                      top: posAtual.yMm * scale,
                      width: req.larguraMm * (posAtual.tamanhoPercentual / 100) * scale,
                      height: req.alturaMm * (posAtual.tamanhoPercentual / 100) * scale,
                      touchAction: "none",
                    }}
                  >
                    {itemAtual.assinatura.imageData ? (
                      <img
                        src={itemAtual.assinatura.imageData}
                        alt="Assinatura"
                        className="pointer-events-none relative z-50 h-full w-full object-contain"
                        draggable={false}
                      />
                    ) : (
                      <div className="pointer-events-none flex h-full flex-col items-center justify-end px-1 pb-0.5 text-center leading-tight">
                        <span className="w-full truncate border-t border-foreground/50 text-[8px] font-semibold">
                          {itemAtual.assinatura.titular_nome ?? "Assinatura"}
                        </span>
                        <span className="w-full truncate text-[7px]">
                          {itemAtual.assinatura.titular_cargo ?? ""}
                        </span>
                      </div>
                    )}

                    {/* Handles de redimensionamento (cantos) */}
                    {(["nw", "ne", "sw", "se"] as const).map((canto) => (
                      <span
                        key={canto}
                        onPointerDown={(e) => iniciarResize(e, canto)}
                        className={cn(
                          "absolute z-[60] h-2.5 w-2.5 rounded-sm border border-background bg-primary",
                          canto === "nw" && "-left-1.5 -top-1.5 cursor-nwse-resize",
                          canto === "ne" && "-right-1.5 -top-1.5 cursor-nesw-resize",
                          canto === "sw" && "-bottom-1.5 -left-1.5 cursor-nesw-resize",
                          canto === "se" && "-bottom-1.5 -right-1.5 cursor-nwse-resize",
                        )}
                        style={{ touchAction: "none" }}
                      />
                    ))}
                  </div>
                )}

              </div>

              {/* Controles da assinatura selecionada */}
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Arraste a assinatura selecionada sobre o documento ou ajuste com os controles
                  abaixo. Cada assinatura guarda sua própria posição.
                </p>

                {posAtual && (
                  <>
                    {req.pageCount > 1 && (
                      <div className="space-y-1">
                        <Label className="text-xs">
                          Página: {posAtual.pagina} de {req.pageCount}
                        </Label>
                        <Slider
                          min={1}
                          max={req.pageCount}
                          step={1}
                          value={[posAtual.pagina]}
                          onValueChange={(v) => atualizar({ pagina: v[0] ?? 1 })}
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-xs">
                        Horizontal (X): {Math.round(posAtual.xMm)} mm
                      </Label>
                      <Slider
                        min={0}
                        max={Math.max(1, Math.round(req.pageWidthMm - req.larguraMm))}
                        step={1}
                        value={[Math.round(posAtual.xMm)]}
                        onValueChange={(v) => atualizar({ xMm: v[0] ?? 0 })}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">
                        Vertical (Y): {Math.round(posAtual.yMm)} mm
                      </Label>
                      <Slider
                        min={0}
                        max={Math.max(1, Math.round(req.pageHeightMm - req.alturaMm - 5))}
                        step={1}
                        value={[Math.round(posAtual.yMm)]}
                        onValueChange={(v) => atualizar({ yMm: v[0] ?? 0 })}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Tamanho: {posAtual.tamanhoPercentual}%</Label>
                      <Slider
                        min={30}
                        max={200}
                        step={5}
                        value={[posAtual.tamanhoPercentual]}
                        onValueChange={(v) => atualizar({ tamanhoPercentual: v[0] ?? 100 })}
                      />
                    </div>

                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="salvar-posicao-padrao"
                        checked={posAtual.salvarPadrao}
                        onCheckedChange={(c) => atualizar({ salvarPadrao: c === true })}
                      />
                      <Label htmlFor="salvar-posicao-padrao" className="text-xs leading-snug">
                        Salvar esta posição como padrão para os próximos documentos
                      </Label>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => finalizar(null)}>
              Cancelar
            </Button>
            <Button onClick={() => finalizar({ itens: Object.values(estado) })}>
              <Download className="mr-2 h-4 w-4" />
              Confirmar e Baixar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
