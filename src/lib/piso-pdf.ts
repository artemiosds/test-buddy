// Extração de tabelas de PDF pesquisável para AOA (compatível com XLSX.sheet_to_json)
// Estratégia: pdfjs-dist → agrupar itens de texto por linha (Y) e por coluna (X-bins).

import type { TextItem } from "pdfjs-dist/types/src/display/api";

let _pdfjs: typeof import("pdfjs-dist") | null = null;

export async function getPdfjs() {
  if (_pdfjs) return _pdfjs;
  const mod = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  mod.GlobalWorkerOptions.workerSrc = workerUrl;
  _pdfjs = mod;
  return mod;
}

export class PdfSemTextoError extends Error {
  constructor() {
    super(
      "PDF escaneado detectado. Converta para Excel/CSV ou use um PDF com texto digital.",
    );
    this.name = "PdfSemTextoError";
  }
}
export class PdfSemTabelasError extends Error {
  constructor() {
    super("Nenhuma tabela encontrada no PDF.");
    this.name = "PdfSemTabelasError";
  }
}
export class PdfInvalidoError extends Error {
  constructor() {
    super("Arquivo PDF inválido.");
    this.name = "PdfInvalidoError";
  }
}

type PosItem = { str: string; x: number; y: number; w: number };

const Y_TOL = 2.5; // tolerância vertical p/ agrupar linha (em unidades PDF ~pt)
const X_TOL_RATIO = 0.6; // fração da largura média de char para juntar em coluna

/**
 * Extrai o conteúdo tabular de um PDF pesquisável em formato AOA.
 * Concatena páginas na ordem, mantendo colunas alinhadas por página.
 * Lança PdfSemTextoError se o PDF não contém texto digital.
 */
export async function extractPdfAoa(file: File): Promise<unknown[][]> {
  const pdfjs = await getPdfjs();
  let doc: import("pdfjs-dist").PDFDocumentProxy;
  try {
    const buf = await file.arrayBuffer();
    doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  } catch {
    throw new PdfInvalidoError();
  }

  const allRows: unknown[][] = [];
  let colCountMax = 0;
  let totalChars = 0;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items: PosItem[] = [];
    for (const it of tc.items as TextItem[]) {
      if (!("str" in it) || !it.str) continue;
      const t = String(it.str).replace(/\s+$/g, "");
      if (!t.trim()) continue;
      const tr = it.transform as number[];
      const x = tr[4];
      const y = tr[5];
      const w = (it.width as number) ?? t.length * 5;
      items.push({ str: t, x, y, w });
      totalChars += t.length;
    }
    if (items.length === 0) continue;

    // Agrupa por linha (Y descendente — PDF origem no canto inferior)
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: PosItem[][] = [];
    let current: PosItem[] = [];
    let currentY = items[0].y;
    for (const it of items) {
      if (Math.abs(it.y - currentY) <= Y_TOL) {
        current.push(it);
      } else {
        current.sort((a, b) => a.x - b.x);
        lines.push(current);
        current = [it];
        currentY = it.y;
      }
    }
    if (current.length > 0) {
      current.sort((a, b) => a.x - b.x);
      lines.push(current);
    }

    // Detectar bins de coluna: usa Xs de linhas mais "cheias" (top quartile) como referência
    const linhasDensas = lines
      .map((ln) => ({ ln, n: ln.length }))
      .sort((a, b) => b.n - a.n)
      .slice(0, Math.max(3, Math.ceil(lines.length * 0.25)))
      .map((x) => x.ln);

    const avgCharW =
      items.reduce((s, i) => s + (i.w > 0 ? i.w / Math.max(i.str.length, 1) : 5), 0) /
      items.length;
    const xTol = Math.max(4, avgCharW * X_TOL_RATIO * 4); // ~4 chars

    const xsRef: number[] = [];
    for (const ln of linhasDensas) {
      for (const it of ln) {
        const near = xsRef.find((x) => Math.abs(x - it.x) < xTol);
        if (near == null) xsRef.push(it.x);
      }
    }
    xsRef.sort((a, b) => a - b);

    // Fallback: se poucos bins detectados, use posições únicas de todas as linhas
    let bins = xsRef;
    if (bins.length < 2) {
      const allX: number[] = [];
      for (const ln of lines)
        for (const it of ln) {
          const near = allX.find((x) => Math.abs(x - it.x) < xTol);
          if (near == null) allX.push(it.x);
        }
      bins = allX.sort((a, b) => a - b);
    }
    if (bins.length === 0) continue;

    // Mapear cada linha para colunas (concatenando textos que caírem no mesmo bin)
    for (const ln of lines) {
      const row: string[] = new Array(bins.length).fill("");
      for (const it of ln) {
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < bins.length; i++) {
          const d = Math.abs(bins[i] - it.x);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        row[bestIdx] = row[bestIdx] ? `${row[bestIdx]} ${it.str}` : it.str;
      }
      const cleaned = row.map((c) => c.trim());
      // Descarta linhas totalmente vazias
      if (cleaned.some((c) => c !== "")) {
        allRows.push(cleaned);
        if (cleaned.length > colCountMax) colCountMax = cleaned.length;
      }
    }
  }

  if (totalChars < 20) {
    throw new PdfSemTextoError();
  }
  if (allRows.length === 0 || colCountMax < 2) {
    throw new PdfSemTabelasError();
  }

  // Normalizar largura das linhas
  return allRows.map((r) => {
    const arr = [...r];
    while (arr.length < colCountMax) arr.push("");
    return arr;
  });
}
