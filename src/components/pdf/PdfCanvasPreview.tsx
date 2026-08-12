import { useEffect, useRef, useState } from "react";

/**
 * Renderiza a primeira/qualquer página do PDF em um <canvas> via pdf.js.
 * Evita o leitor nativo do navegador (bloqueado por CSP em blob:/data:).
 */
export function PdfCanvasPreview({
  url,
  pagina = 1,
  className,
}: {
  url: string;
  pagina?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    let renderTask: { cancel: () => void } | null = null;

    (async () => {
      setCarregando(true);
      setErro(null);
      try {
        const pdfjs = await import("pdfjs-dist");
        // Worker local (sem CDN) — compatível com CSP restritiva
        const workerUrl = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

        const buffer = await (await fetch(url)).arrayBuffer();
        if (cancelado) return;
        const pdf = await pdfjs.getDocument({ data: buffer }).promise;
        const page = await pdf.getPage(Math.min(Math.max(pagina, 1), pdf.numPages));
        const canvas = canvasRef.current;
        if (!canvas || cancelado) return;

        const parentWidth = canvas.parentElement?.clientWidth ?? 600;
        const base = page.getViewport({ scale: 1 });
        const scale = parentWidth / base.width;
        const viewport = page.getViewport({ scale });
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = "100%";
        canvas.style.height = "auto";

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        renderTask = page.render({ canvas, canvasContext: ctx, viewport } as never);
        await (renderTask as unknown as { promise: Promise<void> }).promise;
      } catch (e) {
        if (!cancelado) setErro((e as Error)?.message ?? "Falha ao renderizar o PDF");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();

    return () => {
      cancelado = true;
      try {
        renderTask?.cancel();
      } catch {
        /* noop */
      }
    };
  }, [url, pagina]);

  return (
    <div className={className}>
      <canvas ref={canvasRef} className="block h-auto w-full bg-white" />
      {carregando && (
        <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
          Carregando documento...
        </div>
      )}
      {erro && (
        <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs text-destructive">
          {erro}
        </div>
      )}
    </div>
  );
}
