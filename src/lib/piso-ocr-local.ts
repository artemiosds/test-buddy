/**
 * Modo 2 — OCR Local (custo zero, 100% no navegador).
 *
 * Nenhum byte do documento sai do dispositivo: o reconhecimento roda em
 * WebAssembly (tesseract.js) dentro da própria aba do usuário.
 *
 * Observação técnica: PaddleOCR e EasyOCR são bibliotecas Python e não possuem
 * runtime executável no navegador nem no runtime serverless deste projeto, por
 * isso a cadeia local de fallback termina no Tesseract (WASM), que é o único
 * motor local disponível aqui. A ordem de tentativa é declarada abaixo para
 * facilitar a inclusão futura de outros motores locais.
 */

import {
  comTimeout,
  criarRenderizador,
  TIMEOUTS,
  type CancelToken,
  type ProgressoPdf,
} from "./piso-fopag-pdf";

export const MOTORES_LOCAIS = ["paddleocr", "easyocr", "tesseract"] as const;
export type MotorLocal = (typeof MOTORES_LOCAIS)[number];

/** Motores locais realmente disponíveis neste runtime (browser/WASM). */
export function motoresLocaisDisponiveis(): MotorLocal[] {
  return ["tesseract"];
}

export type ResultadoOcrLocal = {
  paginas: string[];
  motor: MotorLocal;
  totalChars: number;
  /** true quando o OCR produziu texto suficiente para o parser. */
  suficiente: boolean;
  /** Páginas puladas por erro/timeout (o processo continua nas demais). */
  paginasComErro: { pagina: number; erro: string }[];
  duracaoMs: number;
};

/**
 * Executa OCR local nas páginas do PDF e devolve o texto por página, no mesmo
 * formato de `extrairTextoPdf`, para reutilizar exatamente o mesmo parser.
 */
export async function ocrLocalPdf(
  file: File,
  numPages: number,
  opts?: { idioma?: string },
  onProgress?: ProgressoPdf,
  token?: CancelToken,
): Promise<ResultadoOcrLocal> {
  const t0 = Date.now();
  const idioma = opts?.idioma?.trim() || "por";
  console.info(`[OCR] Iniciando OCR local (Tesseract, idioma=${idioma}) em ${numPages} página(s)`);
  const { createWorker } = await import("tesseract.js");
  let worker: Awaited<ReturnType<typeof createWorker>>;
  try {
    worker = await comTimeout(createWorker(idioma), TIMEOUTS.ocrPagina, `carregar o idioma do OCR (${idioma})`);
  } catch (err) {
    console.error("[OCR] Falha ao preparar o worker do Tesseract", err);
    throw new Error(
      `Não foi possível carregar o pacote de idioma "${idioma}" do OCR. Verifique a conexão ou escolha outro idioma em Motor de Extração.`,
    );
  }
  const paginas: string[] = [];
  const paginasComErro: { pagina: number; erro: string }[] = [];
  let totalChars = 0;

  const render = await criarRenderizador(file, { escala: 2.2, qualidade: 0.9 });

  try {
    for (let p = 1; p <= numPages; p++) {
      if (token?.cancelado) throw new Error("Processamento cancelado pelo usuário.");
      let texto = "";
      try {
        console.info(`[OCR] Renderizando página ${p} de ${numPages}`);
        const base64 = await render.renderizar(p, token);
        if (!base64) throw new Error(`Não foi possível gerar a imagem da página ${p}.`);
        console.info(`[OCR] Página ${p}: imagem pronta, executando reconhecimento`);
        const { data } = await comTimeout(
          worker.recognize(`data:image/jpeg;base64,${base64}`),
          TIMEOUTS.ocrPagina,
          `executar o OCR da página ${p}`,
        );
        texto = (data.text ?? "").trim();
        console.info(`[OCR] Página ${p} concluída (${texto.length} caracteres)`);
      } catch (err) {
        if (token?.cancelado) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[OCR] Falha na página ${p}: ${msg}`);
        paginasComErro.push({ pagina: p, erro: msg });
      }
      totalChars += texto.replace(/\s/g, "").length;
      paginas.push(texto);
      onProgress?.(p, numPages);
    }
  } finally {
    render.destruir();
    await worker.terminate();
    console.info(`[OCR] OCR local finalizado em ${Date.now() - t0} ms`);
  }

  const lidas = numPages - paginasComErro.length;
  return {
    paginas,
    motor: "tesseract",
    totalChars,
    suficiente: lidas > 0 && totalChars / lidas >= 120,
    paginasComErro,
    duracaoMs: Date.now() - t0,
  };
}

