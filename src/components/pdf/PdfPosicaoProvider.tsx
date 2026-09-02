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
                        className={cn(
                          "rounded-md border p-2 text-left transition-colors",
                          ativa ? "border-primary bg-primary/5" : "hover:bg-muted",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSelecionadaId(a.id)}
                          className="block w-full text-left"
                        >
                          <span className="block truncate text-xs font-semibold">
                            {a.assinatura.titular_nome ?? "Assinatura"}
                          </span>
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {a.assinatura.titular_cargo ?? a.assinatura.perfil_codigo ?? ""}
                          </span>
                        </button>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <Checkbox
                            id={`incluir-${a.id}`}
                            checked={est?.incluir ?? false}
                            onCheckedChange={(c) => atualizar({ incluir: c === true }, a.id)}
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
                {req.assinaturas.map((a) => {
                  const est = estado[a.id];
                  if (!est || !est.incluir || a.id === selecionadaId) return null;
                  if (est.pagina !== (posAtual?.pagina ?? est.pagina)) return null;
                  return (
                    <div
                      key={`ghost-${a.id}`}
                      className="pointer-events-none absolute z-40 rounded border border-dashed border-muted-foreground/60 bg-background/40"
                      style={{
                        left: est.xMm * scale,
                        top: est.yMm * scale,
                        width: req.larguraMm * (est.tamanhoPercentual / 100) * scale,
                        height: req.alturaMm * (est.tamanhoPercentual / 100) * scale,
                      }}
                    >
                      {a.assinatura.imageData ? (
                        <img
                          src={a.assinatura.imageData}
                          alt=""
                          className="h-full w-full object-contain opacity-70"
                          draggable={false}
                        />
                      ) : (
                        <span className="flex h-full items-end justify-center truncate px-1 text-[8px]">
                          {a.assinatura.titular_nome ?? ""}
                        </span>
                      )}
                    </div>
                  );
                })}

                {itemAtual && posAtual && (
                  <div
                    role="button"
                    tabIndex={0}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    className="absolute z-50 cursor-move rounded border-2 border-dashed border-primary bg-background/70 shadow-lg"
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
