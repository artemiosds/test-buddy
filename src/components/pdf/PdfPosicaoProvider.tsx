import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, Move } from "lucide-react";
import {
  setPdfPosicaoHandler,
  type PdfPosicaoRequest,
  type PdfPosicaoResult,
} from "@/lib/pdf-posicao-bus";
import { PdfCanvasPreview } from "@/components/pdf/PdfCanvasPreview";

type Pending = {
  req: PdfPosicaoRequest;
  resolve: (r: PdfPosicaoResult) => void;
};

/**
 * FASE 2 — Modal de Posicionamento Interativo.
 * Mostra o PDF gerado em memória e permite arrastar (ou usar sliders X/Y)
 * a assinatura institucional antes de confirmar o download.
 */
export function PdfPosicaoProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [xMm, setXMm] = useState(0);
  const [yMm, setYMm] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [tamanho, setTamanho] = useState(80);
  const [salvarPadrao, setSalvarPadrao] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const [areaW, setAreaW] = useState(0);

  useEffect(() => {
    setPdfPosicaoHandler(
      (req) =>
        new Promise<PdfPosicaoResult>((resolve) => {
          setXMm(req.xPadraoMm);
          setYMm(req.yPadraoMm);
          setPagina(req.paginaPadrao);
          setTamanho(req.tamanhoPercentualPadrao);
          setSalvarPadrao(false);
          setPending({ req, resolve });
        }),
    );
    return () => setPdfPosicaoHandler(null);
  }, []);

  const req = pending?.req;

  useEffect(() => {
    if (!req) return;
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAreaW(el.clientWidth));
    ro.observe(el);
    setAreaW(el.clientWidth);
    return () => ro.disconnect();
  }, [req]);

  const scale = useMemo(
    () => (req && areaW ? areaW / req.pageWidthMm : 0),
    [areaW, req],
  );

  const clamp = useCallback(
    (x: number, y: number) => {
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
    if (!scale) return;
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      dx: (e.clientX - rect.left) / scale - xMm,
      dy: (e.clientY - rect.top) / scale - yMm,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !scale) return;
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const next = clamp(
      (e.clientX - rect.left) / scale - dragRef.current.dx,
      (e.clientY - rect.top) / scale - dragRef.current.dy,
    );
    setXMm(next.x);
    setYMm(next.y);
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const finalizar = (result: PdfPosicaoResult) => {
    pending?.resolve(result);
    setPending(null);
  };

  // Revoga o blob URL apenas quando ele deixa de ser usado (desmontagem/troca),
  // nunca durante re-renderizações — evita quebrar o preview.
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
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Move className="h-4 w-4" />
              Posicionar assinatura no documento
            </DialogTitle>
          </DialogHeader>

          {req && (
            <div className="grid gap-4 md:grid-cols-[1fr_240px]">
              <div
                ref={areaRef}
                className="relative overflow-hidden rounded-md border bg-muted"
                style={{ aspectRatio: `${req.pageWidthMm} / ${req.pageHeightMm}` }}
              >
                {req.previewUrl ? (
                  <PdfCanvasPreview
                    url={req.previewUrl}
                    pagina={pagina}
                    className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden bg-white"
                  />
                ) : (
                  <div className="absolute inset-0 z-0 grid place-items-center text-xs text-muted-foreground">
                    Pré-visualização indisponível
                  </div>
                )}

                <div
                  role="button"
                  tabIndex={0}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  className="absolute z-50 cursor-move rounded border-2 border-dashed border-primary bg-background/70 shadow-lg"
                  style={{
                    left: xMm * scale,
                    top: yMm * scale,
                    width: req.larguraMm * (tamanho / 100) * scale,
                    height: req.alturaMm * (tamanho / 100) * scale,
                    touchAction: "none",
                  }}

                >
                  {req.assinatura.imageData ? (
                    <img
                      src={req.assinatura.imageData}
                      alt="Assinatura"
                      className="pointer-events-none relative z-50 h-full w-full object-contain"
                      draggable={false}
                    />
                  ) : (

                    <div className="pointer-events-none flex h-full flex-col items-center justify-end px-1 pb-0.5 text-center leading-tight">
                      <span className="w-full truncate border-t border-foreground/50 text-[8px] font-semibold">
                        {req.assinatura.titular_nome ?? "Assinatura"}
                      </span>
                      <span className="w-full truncate text-[7px]">
                        {req.assinatura.titular_cargo ?? ""}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Arraste a assinatura sobre o documento ou ajuste com os controles abaixo.
                </p>

                {req.pageCount > 1 && (
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Página: {pagina} de {req.pageCount}
                    </Label>
                    <Slider
                      min={1}
                      max={req.pageCount}
                      step={1}
                      value={[pagina]}
                      onValueChange={(v) => setPagina(v[0] ?? 1)}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">Horizontal (X): {Math.round(xMm)} mm</Label>
                  <Slider
                    min={0}
                    max={Math.max(1, Math.round(req.pageWidthMm - req.larguraMm))}
                    step={1}
                    value={[Math.round(xMm)]}
                    onValueChange={(v) => setXMm(v[0] ?? 0)}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Vertical (Y): {Math.round(yMm)} mm</Label>
                  <Slider
                    min={0}
                    max={Math.max(1, Math.round(req.pageHeightMm - req.alturaMm - 5))}
                    step={1}
                    value={[Math.round(yMm)]}
                    onValueChange={(v) => setYMm(v[0] ?? 0)}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Tamanho: {tamanho}%</Label>
                  <Slider
                    min={30}
                    max={200}
                    step={5}
                    value={[tamanho]}
                    onValueChange={(v) => setTamanho(v[0] ?? 100)}
                  />
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="salvar-posicao-padrao"
                    checked={salvarPadrao}
                    onCheckedChange={(c) => setSalvarPadrao(c === true)}
                  />
                  <Label htmlFor="salvar-posicao-padrao" className="text-xs leading-snug">
                    Salvar esta posição como padrão para os próximos documentos
                  </Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => finalizar(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                finalizar({ xMm, yMm, pagina, tamanhoPercentual: tamanho, salvarPadrao })
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Confirmar e Baixar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
