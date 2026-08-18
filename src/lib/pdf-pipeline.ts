/**
 * PIPELINE CENTRAL DE PDF — resolução da assinatura institucional,
 * modal de posicionamento interativo e download final.
 *
 * Todo gerador de PDF do sistema deve terminar chamando `finalizarPdf(doc, {...})`
 * em vez de `doc.save(...)`.
 */
import type jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import {
  resolverAssinaturasDocumento,
  desenharImagemProporcional,
  type AssinaturaResolvida,
  type TipoDocumento,
} from "@/lib/pdf-assinaturas";
import { getSignatureSignedUrl } from "@/lib/assinatura-storage";
import { requestPdfPosicao } from "@/lib/pdf-posicao-bus";

/** Dimensões de referência usadas pelo editor visual (A4 retrato em px) */
const REF_W = 400;
const REF_H = 560;

/** Largura/altura base do bloco de assinatura em mm (100%) */
const BASE_W = 75;
const BASE_H = 30;

export type EscopoAssinatura = { unidadeId?: string | null; secretariaId?: string | null };

/**
 * FASE 1 — Função central: devolve a assinatura institucional ATIVA aplicável,
 * respeitando a prioridade Unidade atual > Secretaria atual > Global.
 * Retorna `null` quando o usuário/unidade não possui assinatura cadastrada.
 */
export async function obterAssinaturaInstitucionalAtual(
  tipo: TipoDocumento,
  escopo: EscopoAssinatura = {},
  preResolvidas?: AssinaturaResolvida[],
): Promise<AssinaturaResolvida | null> {
  let lista = preResolvidas;
  if (!lista) {
    try {
      lista = await resolverAssinaturasDocumento(tipo, {
        secretariaId: escopo.secretariaId ?? null,
        unidadeId: escopo.unidadeId ?? null,
      });
    } catch {
      return null;
    }
  }
  const prioridade: Record<string, number> = { unidade: 0, secretaria: 1, global: 2, ausente: 9 };
  
  // Filtra candidatas: deve ter algum dado (imagem ou nome) e não ser ausente
  const candidatas = (lista ?? []).filter(
    (a) =>
      a.escopo !== "ausente" &&
      (!!a.imageData || !!a.titular_nome),
  );
  if (candidatas.length === 0) return null;

  // Ordena por escopo (Unidade > Secretaria > Global)
  candidatas.sort(
    (a, b) => (prioridade[a.escopo] ?? 9) - (prioridade[b.escopo] ?? 9) || a.ordem - b.ordem,
  );

  const selecionada = candidatas[0];

  // CORREÇÃO CRÍTICA: Se a assinatura selecionada for do tipo "institutional_electronic" 
  // (metadata indicando método institucional) e não tiver imagem física,
  // tentamos buscar o carimbo/imagem PNG mais recente do mesmo titular para injetar visualmente.
  if (
    selecionada && 
    selecionada.metadata?.method === "institutional_electronic" && 
    !selecionada.imageData
  ) {
    const titularId = selecionada.metadata?.usuario_id || selecionada.assinatura_id;
    if (titularId) {
      const backup = (lista ?? []).find(
        (a) => 
          a.perfil_codigo === selecionada.perfil_codigo && 
          a.imageData && 
          a.tipo_assinatura !== "logo"
      );
      if (backup?.imageData) {
        selecionada.imageData = backup.imageData;
      }
    }
  }

  return selecionada ?? null;
}

function dimensoes(a: AssinaturaResolvida) {
  const factor = (a.tamanho_percentual ?? 80) / 100;
  return { w: BASE_W * factor, h: BASE_H * factor };
}

/**
 * FASE 2 — Baixa uma imagem remota (URL assinada do Storage) e devolve o
 * Data URI Base64. O jsPDF é síncrono: sem esta pré-carga a imagem é ignorada.
 */
export const preCarregarImagem = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

/** Detecta o formato aceito pelo jsPDF a partir do Data URI. */
function formatoImagem(dataUri: string): "PNG" | "JPEG" | "WEBP" {
  const head = dataUri.slice(0, 40).toLowerCase();
  if (head.includes("image/jpeg") || head.includes("image/jpg")) return "JPEG";
  if (head.includes("image/webp")) return "WEBP";
  return "PNG";
}

/**
 * Garante que a assinatura tenha `imageData` em Base64 ANTES de desenhar.
 * Se veio uma URL (http/blob) ou nada, baixa e converte de forma assíncrona.
 */
export async function garantirImagemAssinatura(
  a: AssinaturaResolvida,
): Promise<AssinaturaResolvida> {
  const { removerFundoTransparente } = await import("./pdf-assinaturas");
  
  if (a.imageData?.startsWith("data:")) {
    const cleanImg = await removerFundoTransparente(a.imageData);
    return { ...a, imageData: cleanImg };
  }

  // Caso a imagem tenha chegado como URL direta
  if (a.imageData && /^(https?:|blob:)/.test(a.imageData)) {
    const dataUri = await preCarregarImagem(a.imageData);
    if (dataUri) {
      const cleanImg = await removerFundoTransparente(dataUri);
      return { ...a, imageData: cleanImg };
    }
  }

  if (a.storage_path) {
    try {
      const signed = await getSignatureSignedUrl(a.storage_path, null, 300);
      if (signed) {
        const dataUri = await preCarregarImagem(signed);
        if (dataUri) {
          const cleanImg = await removerFundoTransparente(dataUri);
          return { ...a, imageData: cleanImg };
        }
      }
    } catch {
      /* segue com bloco textual */
    }
  }
  return { ...a, imageData: null };
}


/** FASE 3 — Injeta a assinatura (imagem ou bloco institucional textual) no PDF. */
export async function drawSignatureStamp(
  doc: jsPDF,
  id: string,
  hash: string,
  nome: string,
  data: string,
  validationCode: string,
  marginX = 14,
  qrDataUrl?: string
) {
  console.log(`[PDF] Gerando rodapé universal com QR Code para documento: ${validationCode}`);

  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Posicionamento do rodapé superior (Linha de Auditoria)
  // Ocupa ~10mm acima do bloco de assinaturas
  const yAudit = pageHeight - 38;
  const usableWidth = pageWidth - marginX * 2;
  
  // Recupera o contexto do usuário para o "Emitido por"
  let emitidoPor = nome || "Sistema";
  try {
    const { data: userCtx } = await supabase.rpc("get_my_user_context");
    const me = userCtx as any;
    if (me?.nome_completo) emitidoPor = me.nome_completo;
  } catch (err) {
    console.warn("Falha ao obter contexto para rodapé:", err);
  }

  const pagAtual = doc.getCurrentPageInfo().pageNumber;
  const pagTotal = doc.getNumberOfPages();
  const dataFormatada = new Date().toLocaleString("pt-BR");
  
  // 1. Linha de Auditoria e Metadados (Superior)
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.1);
  doc.line(marginX, yAudit, pageWidth - marginX, yAudit);
  
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  const auditText = `Emissão: ${dataFormatada} | Página ${pagAtual} de ${pagTotal} | Emitido por: ${emitidoPor.toUpperCase()}`;
  doc.text(auditText, marginX, yAudit + 4);

  // 2. Organização em 2 Colunas (Assinaturas vs Conformidade)
  const yBlocks = pageHeight - 30;
  const colWidth = usableWidth / 2;

  // Lado Esquerdo / Central: Quadros de Assinatura (injetados externamente via drawAssinaturasBlock se houver)
  // Se esta função for chamada isoladamente (fallback), apenas o lado direito é preenchido aqui.

  // Lado Direito: Bloco de Conformidade Legal
  const rightColX = marginX + colWidth + 5;
  const blockW = colWidth - 5;
  
  // Fundo discreto para o bloco de conformidade
  doc.setDrawColor(240, 240, 240);
  doc.setFillColor(252, 252, 252);
  doc.roundedRect(rightColX, yBlocks, blockW, 26, 1, 1, "FD");

  // QR Code (22x22mm)
  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, "PNG", rightColX + 2, yBlocks + 2, 22, 22);
    } catch (e) {
      console.warn("Falha ao adicionar QR Code no rodapé", e);
    }
  }

  const infoX = rightColX + 26;
  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("VERIFICAÇÃO DE AUTENTICIDADE", infoX, yBlocks + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  let ty = yBlocks + 10;
  doc.setFont("helvetica", "bold");
  doc.text(`Código: ${validationCode}`, infoX, ty);
  doc.setFont("helvetica", "normal");
  ty += 3.5;
  doc.text(`Hash: ${hash.slice(0, 24)}...`, infoX, ty);
  ty += 4.5;
  doc.setFontSize(6);
  doc.setTextColor(80, 80, 80);
  const legalText = "Assinado digitalmente nos termos da\nLei Federal nº 14.063/2020.";
  doc.text(legalText, infoX, ty);

  // Link de validação
  ty += 5.5;
  const validationUrl = `${window.location.origin}/validar-documento?codigo=${validationCode}`;
  doc.setTextColor(37, 99, 235);
  doc.setFontSize(5.5);
  doc.text("Validar em:", infoX, ty);
  doc.text(validationUrl, infoX + 11, ty);
}

/** FASE 3 — Injeta a assinatura (imagem ou bloco institucional textual) no PDF. */
export function desenharAssinaturaEm(
  doc: jsPDF,
  a: AssinaturaResolvida,
  pos: { xMm: number; yMm: number; pagina?: number; tamanhoPercentual?: number },
): void {
  const factor = (pos.tamanhoPercentual ?? a.tamanho_percentual ?? 80) / 100;
  const w = BASE_W * factor;
  const h = BASE_H * factor;
  
  try {
    if (pos.pagina && pos.pagina >= 1) doc.setPage(pos.pagina);
  } catch {
    /* página inexistente — mantém a atual */
  }
  const x = pos.xMm;
  const y = pos.yMm;

  if (a.imageData) {
    desenharImagemProporcional(doc, a.imageData, x, y, w, h);
  }

  const lineY = y + h + 1.5;
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.2);
  doc.line(x, lineY, x + w, lineY);
  doc.setTextColor(0, 0, 0);
  let ty = lineY + 3.5;
  if (a.mostrar_nome && a.titular_nome) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(a.titular_nome, x + w / 2, ty, { align: "center", maxWidth: w });
    ty += 3.4;
  }
  if (a.mostrar_cargo && a.titular_cargo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(a.titular_cargo, x + w / 2, ty, { align: "center", maxWidth: w });
    ty += 3.2;
  }
  const matricula = a.metadata?.matricula as string | undefined;
  if (matricula) {
    doc.setFontSize(6.5);
    doc.text(`Matrícula: ${matricula}`, x + w / 2, ty, { align: "center", maxWidth: w });
  }
}

async function salvarPosicaoPadrao(
  a: AssinaturaResolvida,
  pos: { xMm: number; yMm: number; tamanhoPercentual: number },
  pageWidthMm: number,
  pageHeightMm: number,
) {
  if (!a.assinatura_id) return;
  try {
    await supabase
      .from("assinaturas_institucionais")
      .update({
        posicao_x: Math.round((pos.xMm / pageWidthMm) * REF_W),
        posicao_y: Math.round((pos.yMm / pageHeightMm) * REF_H),
        tamanho_percentual: pos.tamanhoPercentual,
      })
      .eq("id", a.assinatura_id);
  } catch {
    /* best effort */
  }
}

export type FinalizarPdfOpts = {
  filename: string;
  tipo?: TipoDocumento;
  unidadeId?: string | null;
  secretariaId?: string | null;
  /** assinaturas já resolvidas pelo gerador (evita segunda consulta) */
  assinaturas?: AssinaturaResolvida[];
  /** posição inicial sugerida em mm */
  xPadraoMm?: number;
  yPadraoMm?: number;
  /** página onde a assinatura entra por padrão (default: última) */
  pagina?: number;
  /** desliga o modal (ex.: exportações em lote) */
  semModal?: boolean;
  /** callback com o blob final (upload/arquivamento). O terceiro argumento é o hash SHA-256 real. */
  onBlob?: (blob: Blob, filename: string, hash: string) => void | Promise<void>;
  /** Metadados extras para o registro do documento */
  competencia?: { mes: number; ano: number };
};


/**
 * FASE 2 + 3 — Gera o PDF em memória, abre o Modal de Posicionamento,
 * injeta a assinatura nas coordenadas escolhidas e baixa o arquivo.
 * Sem assinatura ativa, baixa o PDF direto (FALLBACK).
 */
export async function finalizarPdf(doc: jsPDF, opts: FinalizarPdfOpts): Promise<void> {
  const finalFilename = opts.filename.endsWith(".pdf") ? opts.filename : `${opts.filename}.pdf`;

  // Persiste o registro do documento no banco para permitir validação futura
  let documentoId: string | null = null;
  let validationCode: string | null = null;
  try {
    const { data: userCtx } = await supabase.rpc("get_my_user_context");
    const me = userCtx as any;
    
    // Cálculo real do Hash SHA-256 do documento ANTES da assinatura visual
    const pdfBuffer = doc.output("arraybuffer");
    const hashBuffer = await crypto.subtle.digest("SHA-256", pdfBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Gerar um código único amigável conforme solicitado
    const randomSuffix = Math.random().toString(36).substring(2, 10).toUpperCase();
    validationCode = `HSM-2026-${randomSuffix}`;

    const { data: newDoc } = await supabase
      .from("documentos_assinados")
      .insert({
        documento_tipo: opts.tipo || "relatorio",
        descricao: finalFilename,
        hash_sha256: hashHex,
        codigo_validacao: validationCode,
        nome_assinante: me?.nome_completo || "Sistema",
        assinado_por_id: me?.id || null,
        metadata: {
          filename: finalFilename,
          competencia: (opts as any).competencia,
        }
      } as any)
      .select("id")
      .single();

    if (newDoc) {
      documentoId = newDoc.id;
    }
  } catch (err) {
    console.warn("Erro ao registrar documento para validação:", err);
  }
  /** Calcula o hash SHA-256 real do conteúdo do PDF */
  const calcularHashPdf = async (pdfDoc: jsPDF): Promise<string> => {
    try {
      const buffer = pdfDoc.output("arraybuffer");
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (err) {
      console.error("Erro ao calcular hash do PDF:", err);
      return "SHA-256-ERRO";
    }
  };

  const baixar = async (pdfDoc: jsPDF = doc) => {
    console.log(`[PDF] Finalizando documento "${finalFilename}" e preparando download...`);
    const hash = await calcularHashPdf(pdfDoc);
    if (opts.onBlob) {
      const blob = pdfDoc.output("blob");
      await opts.onBlob(blob, finalFilename, hash);
    } else {
      pdfDoc.save(finalFilename);
    }
  };

  let assinatura: AssinaturaResolvida | null = null;
  try {
    assinatura = await obterAssinaturaInstitucionalAtual(
      opts.tipo ?? "relatorio",
      { unidadeId: opts.unidadeId, secretariaId: opts.secretariaId },
      opts.assinaturas,
    );
    if (assinatura) assinatura = await garantirImagemAssinatura(assinatura);
  } catch {
    assinatura = null;
  }

  if (!assinatura) {
    if (documentoId && validationCode) {
      // Mesmo sem assinatura visual, injeta o selo de autenticidade no rodapé
      const me = await supabase.rpc("get_my_user_context").then(r => r.data as any);
      const pdfBuffer = doc.output("arraybuffer");
      const hashBuffer = await crypto.subtle.digest("SHA-256", pdfBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      const validationUrl = `${window.location.origin}/api/public/validar-documento?codigo=${validationCode}`;
      const QRCode = await import("qrcode");
      const qrDataUrl = await (QRCode.toDataURL ?? QRCode.default?.toDataURL)(validationUrl, { margin: 1, width: 180 });

      drawSignatureStamp(doc, documentoId, hashHex, me?.nome_completo || "Sistema", new Date().toISOString(), validationCode, 14, qrDataUrl);
    }
    await baixar();
    return;
  }

  const pageWidthMm = doc.internal.pageSize.getWidth();
  const pageHeightMm = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();
  const { w, h } = dimensoes(assinatura);

  const temPadraoSalvo = assinatura.posicao_x !== null && assinatura.posicao_y !== null;
  const xPadrao = temPadraoSalvo
    ? ((assinatura.posicao_x as number) / REF_W) * pageWidthMm
    : (opts.xPadraoMm ?? pageWidthMm - 14 - w);
  const yPadrao = temPadraoSalvo
    ? ((assinatura.posicao_y as number) / REF_H) * pageHeightMm
    : (opts.yPadraoMm ?? pageHeightMm - 42);
  const pagina = Math.min(Math.max(opts.pagina ?? pageCount, 1), pageCount);

  if (opts.semModal) {
    desenharAssinaturaEm(doc, assinatura, { xMm: xPadrao, yMm: yPadrao, pagina });
    await baixar();
    return;
  }

  let previewUrl = "";
  try {
    previewUrl = doc.output("bloburl") as unknown as string;
  } catch (err) {
    console.error("Erro ao gerar preview:", err);
    previewUrl = "";
  }


  const escolha = await requestPdfPosicao({
    previewUrl,
    pageWidthMm,
    pageHeightMm,
    pageCount,
    paginaPadrao: pagina,
    xPadraoMm: xPadrao,
    yPadraoMm: yPadrao,
    larguraMm: BASE_W,
    alturaMm: BASE_H,
    tamanhoPercentualPadrao: assinatura.tamanho_percentual ?? 80,
    assinatura,
    filename: finalFilename,
  });

  // Modal indisponível → posição padrão (nunca quebra o download)
  if (escolha === undefined) {
    desenharAssinaturaEm(doc, assinatura, { xMm: xPadrao, yMm: yPadrao, pagina });
    await baixar();
    return;
  }

  // Usuário cancelou
  if (escolha === null) return;

  // Antes de desenhar a assinatura visual, injetamos o carimbo de autenticidade (Selo Verde)
  if (documentoId && validationCode) {
    const me = await supabase.rpc("get_my_user_context").then(r => r.data as any);
    // Recalcula o hash final antes da assinatura (o hash registrado no banco é do PDF base)
    const pdfBuffer = doc.output("arraybuffer");
    const hashBuffer = await crypto.subtle.digest("SHA-256", pdfBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    const validationUrl = `${window.location.origin}/api/public/validar-documento?codigo=${validationCode}`;
    const QRCode = await import("qrcode");
    const qrDataUrl = await (QRCode.toDataURL ?? QRCode.default?.toDataURL)(validationUrl, { margin: 1, width: 180 });

    drawSignatureStamp(doc, documentoId, hashHex, me?.nome_completo || "Sistema", new Date().toISOString(), validationCode, 14, qrDataUrl);
  }

  desenharAssinaturaEm(doc, assinatura, {
    xMm: escolha.xMm,
    yMm: escolha.yMm,
    pagina: escolha.pagina,
    tamanhoPercentual: escolha.tamanhoPercentual,
  });
  if (escolha.salvarPadrao) {
    await salvarPosicaoPadrao(
      assinatura,
      { 
        xMm: escolha.xMm, 
        yMm: escolha.yMm, 
        tamanhoPercentual: escolha.tamanhoPercentual 
      },
      pageWidthMm,
      pageHeightMm,
    );
  }
  // Se temos um ID de documento e o PDF foi gerado com sucesso, 
  // poderíamos fazer o upload do PDF aqui se desejado (onBlob já trata isso).
  await baixar();
}
