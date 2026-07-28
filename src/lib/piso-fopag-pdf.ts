/**
 * I/O do PDF FOPAG (browser): texto pesquisável via pdfjs-dist, renderização de
 * páginas em imagem para a IA de Visão e hash SHA-256 do arquivo (auditoria).
 *
 * Reutiliza a instância de pdfjs já configurada em piso-pdf.ts.
 */

import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { getPdfjs } from "./piso-pdf";

export type ProgressoPdf = (feito: number, total: number) => void;

export type CancelToken = { cancelado: boolean };

/** Limites por etapa: evitam a sensação de "congelado" sem mensagem. */
export const TIMEOUTS = { abrir: 30_000, render: 30_000, ocrPagina: 60_000 } as const;

/** Falha uma promessa lenta com mensagem clara em vez de esperar indefinidamente. */
export function comTimeout<T>(p: Promise<T>, ms: number, etapa: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Tempo excedido ao ${etapa} (${ms / 1000}s).`)), ms);
    }),
  ]).finally(() => clearTimeout(timer)) as Promise<T>;
}

function checarCancelamento(token?: CancelToken) {
  if (token?.cancelado) throw new Error("Processamento cancelado pelo usuário.");
}

/** Confere se o worker do pdf.js foi resolvido antes de abrir qualquer documento. */
export async function verificarWorkerPdf(): Promise<boolean> {
  try {
    const pdfjs = await getPdfjs();
    const src = pdfjs.GlobalWorkerOptions.workerSrc;
    if (src) {
      console.info("[PDF] Worker carregado:", src);
      return true;
    }
    console.error("[PDF] Worker não encontrado (workerSrc vazio)");
    return false;
  } catch (err) {
    console.error("[PDF] Worker não encontrado", err);
    return false;
  }
}

async function abrirDocumento(file: File) {
  const pdfjs = await getPdfjs();
  const buf = await file.arrayBuffer();
  return comTimeout(
    pdfjs.getDocument({ data: new Uint8Array(buf) }).promise,
    TIMEOUTS.abrir,
    "abrir o PDF",
  );
}

async function sha256Buffer(buf: ArrayBuffer | Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** SHA-256 do arquivo em hexadecimal (rastreabilidade da importação). */
export async function sha256Arquivo(file: File): Promise<string> {
  return sha256Buffer(await file.arrayBuffer());
}

/** SHA-256 do texto de uma página (detecta PDF alterado com o mesmo nome). */
export async function sha256Texto(texto: string): Promise<string> {
  return sha256Buffer(new TextEncoder().encode(texto));
}

export type TextoPdf = {
  paginas: string[];
  numPages: number;
  totalChars: number;
  /** true quando o PDF tem texto digital suficiente para dispensar a IA. */
  pesquisavel: boolean;
  /** SHA-256 do texto de cada página, na ordem. */
  hashesPaginas: string[];
  /** Páginas que falharam e foram puladas (o processo não aborta). */
  paginasComErro: { pagina: number; erro: string }[];
  /** Tempo total de abertura + leitura, em ms. */
  duracaoMs: number;
};


/** Extrai o texto de cada página preservando quebras de linha por posição Y. */
export async function extrairTextoPdf(
  file: File,
  onProgress?: ProgressoPdf,
  token?: CancelToken,
  onDoc?: (numPages: number) => void,
): Promise<TextoPdf> {
  const t0 = Date.now();
  console.info("[PDF] Arquivo recebido:", file.name, `${(file.size / 1024).toFixed(0)} KB`);
  await verificarWorkerPdf();
  const doc = await abrirDocumento(file);
  console.info("[PDF] PDF carregado. numPages =", doc.numPages);
  onDoc?.(doc.numPages);
  const paginas: string[] = [];
  const hashesPaginas: string[] = [];
  const paginasComErro: { pagina: number; erro: string }[] = [];
  let totalChars = 0;

  for (let p = 1; p <= doc.numPages; p++) {
    checarCancelamento(token);
    console.info(`[PDF] Carregando página ${p} de ${doc.numPages}`);
    let texto = "";
    try {
      const page = await comTimeout(doc.getPage(p), TIMEOUTS.render, `abrir a página ${p}`);
      const tc = await comTimeout(
        page.getTextContent(),
        TIMEOUTS.render,
        `ler o texto da página ${p}`,
      );
      const itens = (tc.items as TextItem[])
        .filter((it) => "str" in it && String(it.str).trim())
        .map((it) => ({
          str: String(it.str),
          x: (it.transform as number[])[4],
          y: (it.transform as number[])[5],
        }));

      itens.sort((a, b) => b.y - a.y || a.x - b.x);
      const linhas: string[] = [];
      let atual: typeof itens = [];
      let yAtual = itens[0]?.y ?? 0;
      for (const it of itens) {
        if (Math.abs(it.y - yAtual) <= 2.5) {
          atual.push(it);
        } else {
          linhas.push(
            atual
              .sort((a, b) => a.x - b.x)
              .map((i) => i.str)
              .join(" "),
          );
          atual = [it];
          yAtual = it.y;
        }
      }
      if (atual.length) {
        linhas.push(
          atual
            .sort((a, b) => a.x - b.x)
            .map((i) => i.str)
            .join(" "),
        );
      }
      texto = linhas.join("\n");
      console.info(`[PDF] Página ${p} lida (${texto.length} caracteres)`);
    } catch (err) {
      // Uma página problemática não aborta o documento inteiro.
      if (token?.cancelado) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[PDF] Falha na página ${p}: ${msg}`);
      paginasComErro.push({ pagina: p, erro: msg });
    }

    totalChars += texto.replace(/\s/g, "").length;
    paginas.push(texto);
    hashesPaginas.push(await sha256Texto(texto));
    onProgress?.(p, doc.numPages);
  }

  const lidas = doc.numPages - paginasComErro.length;
  // Heurística: menos de ~120 caracteres úteis por página ⇒ PDF escaneado.
  const pesquisavel = lidas > 0 && totalChars / lidas >= 120;
  console.info(
    `[PDF] Extração concluída em ${Date.now() - t0} ms. pesquisavel = ${pesquisavel}; páginas com erro: ${paginasComErro.length}`,
  );
  return {
    paginas,
    numPages: doc.numPages,
    totalChars,
    pesquisavel,
    hashesPaginas,
    paginasComErro,
    duracaoMs: Date.now() - t0,
  };
}



/**
 * Abre o PDF UMA única vez e devolve um renderizador reutilizável. Evita
 * reabrir/reparsear o arquivo inteiro a cada página (principal causa de
 * lentidão e da sensação de "travado" no OCR local de documentos grandes).
 */
export async function criarRenderizador(
  file: File,
  opts?: { escala?: number; qualidade?: number },
) {
  const doc = await abrirDocumento(file);
  const escala = opts?.escala ?? 1.6;
  const qualidade = opts?.qualidade ?? 0.75;

  async function renderizar(n: number, token?: CancelToken): Promise<string> {
    checarCancelamento(token);
    const page = await comTimeout(doc.getPage(n), TIMEOUTS.render, `abrir a página ${n}`);
    const viewport = page.getViewport({ scale: escala });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível preparar o canvas para renderizar o PDF.");
    try {
      await comTimeout(
        page.render({ canvas, canvasContext: ctx, viewport } as never).promise,
        TIMEOUTS.render,
        `renderizar a página ${n}`,
      );
      const dataUrl = canvas.toDataURL("image/jpeg", qualidade);
      return dataUrl.split(",")[1] ?? "";
    } finally {
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup?.();
    }
  }

  return {
    numPages: doc.numPages as number,
    renderizar,
    destruir: () => {
      try {
        void (doc as unknown as { destroy?: () => Promise<void> }).destroy?.();
      } catch {
        /* nada a fazer */
      }
    },
  };
}

/**
 * Renderiza as páginas indicadas em JPEG base64 (sem prefixo data:) para envio
 * à IA de Visão. Processa uma página por vez para manter o uso de memória baixo.
 */
export async function renderizarPaginasJpeg(
  file: File,
  paginas: number[],
  opts?: { escala?: number; qualidade?: number },
  onProgress?: ProgressoPdf,
  token?: CancelToken,
): Promise<{ pagina: number; base64: string }[]> {
  const r = await criarRenderizador(file, opts);
  const out: { pagina: number; base64: string }[] = [];
  try {
    for (let i = 0; i < paginas.length; i++) {
      const n = paginas[i];
      out.push({ pagina: n, base64: await r.renderizar(n, token) });
      onProgress?.(i + 1, paginas.length);
    }
  } finally {
    r.destruir();
  }
  return out;
}

