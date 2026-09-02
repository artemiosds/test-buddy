/**
 * Barramento entre a camada de geração de PDF (não-React) e o
 * Modal de Posicionamento Interativo (React, montado no __root).
 */
import type { AssinaturaResolvida } from "@/lib/pdf-assinaturas";

export type PdfPosicaoItemRequest = {
  /** identificador estável (assinatura_id ou regra_id) */
  id: string;
  assinatura: AssinaturaResolvida;
  xPadraoMm: number;
  yPadraoMm: number;
  paginaPadrao: number;
  tamanhoPercentualPadrao: number;
  /** marcada por padrão (usuário logado / direção da unidade) */
  incluirPadrao: boolean;
};

export type PdfPosicaoRequest = {
  /** PDF em memória (sem assinatura) para pré-visualização */
  previewUrl: string;
  /** dimensões da página em mm */
  pageWidthMm: number;
  pageHeightMm: number;
  pageCount: number;
  /** tamanho base do bloco de assinatura (100%) */
  larguraMm: number;
  alturaMm: number;
  filename: string;
  /** todas as assinaturas aplicáveis ao documento */
  assinaturas: PdfPosicaoItemRequest[];
};

export type PdfPosicaoItemResult = {
  assinaturaId: string;
  xMm: number;
  yMm: number;
  pagina: number;
  tamanhoPercentual: number;
  incluir: boolean;
  salvarPadrao: boolean;
};

export type PdfPosicaoResult = { itens: PdfPosicaoItemResult[] } | null;

type Handler = (req: PdfPosicaoRequest) => Promise<PdfPosicaoResult>;

let handler: Handler | null = null;

export function setPdfPosicaoHandler(h: Handler | null) {
  handler = h;
}

export function hasPdfPosicaoHandler() {
  return handler !== null;
}

/**
 * Solicita ao usuário o posicionamento das assinaturas.
 * Sem handler montado (SSR, testes), devolve `undefined` para que o
 * chamador use as posições padrão sem quebrar o download.
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
