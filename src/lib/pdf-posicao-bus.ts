/**
 * Barramento entre a camada de geração de PDF (não-React) e o
 * Modal de Posicionamento Interativo (React, montado no __root).
 */
import type { AssinaturaResolvida } from "@/lib/pdf-assinaturas";

export type PdfPosicaoRequest = {
  /** PDF em memória (sem assinatura) para pré-visualização */
  previewUrl: string;
  /** dimensões da página em mm */
  pageWidthMm: number;
  pageHeightMm: number;
  pageCount: number;
  /** página onde a assinatura será inserida por padrão (1-based) */
  paginaPadrao: number;
  /** posição padrão em mm */
  xPadraoMm: number;
  yPadraoMm: number;
  larguraMm: number;
  alturaMm: number;
  tamanhoPercentualPadrao: number;
  assinatura: AssinaturaResolvida;
  filename: string;
};

export type PdfPosicaoResult = {
  xMm: number;
  yMm: number;
    pagina: number;
    tamanhoPercentual: number;
    salvarPadrao: boolean;
} | null;

type Handler = (req: PdfPosicaoRequest) => Promise<PdfPosicaoResult>;

let handler: Handler | null = null;

export function setPdfPosicaoHandler(h: Handler | null) {
  handler = h;
}

export function hasPdfPosicaoHandler() {
  return handler !== null;
}

/**
 * Solicita ao usuário o posicionamento da assinatura.
 * Sem handler montado (SSR, testes), devolve `undefined` para que o
 * chamador use a posição padrão sem quebrar o download.
 */
export async function requestPdfPosicao(
  req: PdfPosicaoRequest,
): Promise<PdfPosicaoResult | undefined> {
  if (!handler) return undefined;
  try {
    return await handler(req);
  } catch {
    return undefined;
  }
}
