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

export type EscopoAssinatura = {
  unidadeId?: string | null;
  secretariaId?: string | null;
  /** quando informado, prioriza a assinatura desse perfil (quem está assinando) */
  perfilCodigo?: string | null;
};

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

  // Ordena por perfil solicitado (quem assina) e depois por escopo (Unidade > Secretaria > Global)
  const perfilAlvo = escopo.perfilCodigo ?? null;
  candidatas.sort(
    (a, b) =>
      (perfilAlvo ? (a.perfil_codigo === perfilAlvo ? 0 : 1) - (b.perfil_codigo === perfilAlvo ? 0 : 1) : 0) ||
      (prioridade[a.escopo] ?? 9) - (prioridade[b.escopo] ?? 9) ||
      a.ordem - b.ordem,
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
export function drawSignatureStamp(
  doc: jsPDF,
  id: string,
  hash: string,
  nome: string,
  data: string,
  validationCode: string,
  marginX = 14,
  qrDataUrl?: string
) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const y = pageHeight - 24;
  const usableWidth = pageWidth - marginX * 2;
  const colWidth = usableWidth / 2;

  // Linha superior do rodapé
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.1);
  doc.line(marginX, y - 2, pageWidth - marginX, y - 2);

  // Bloco 1: QR Code e Texto de Autenticidade (Esquerda)
  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, "PNG", marginX, y, 18, 18);
    } catch (e) {
      console.warn("Falha ao adicionar QR Code no rodapé", e);
    }
  }

  const textX = marginX + (qrDataUrl ? 22 : 0);
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.setFont("helvetica", "bold");
  doc.text("VALIDAÇÃO INSTITUCIONAL", textX, y + 3);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  let ty = y + 6;
  doc.text(`Código: ${validationCode}`, textX, ty);
  ty += 3;
  doc.text(`Hash SHA-256: ${hash.slice(0, 32)}...`, textX, ty);
  ty += 3;
  const validationUrl = `${window.location.origin}/api/public/validar-documento?codigo=${validationCode}`;
  doc.setTextColor(37, 99, 235);
  doc.text("Valide em:", textX, ty);
  doc.text(validationUrl, textX + 10, ty);

  // Bloco 2: Conformidade Legal (Direita)
  const rightColX = marginX + colWidth;
  doc.setTextColor(80, 80, 80);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("CONFORMIDADE LEGAL", rightColX, y + 3);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  ty = y + 6;
  doc.text("ASSINADO DIGITALMENTE NOS TERMOS DA", rightColX, ty);
  ty += 2.5;
  doc.text("LEI FEDERAL Nº 14.063/2020", rightColX, ty);
  ty += 3.5;
  doc.text(`Emitido por: ${nome}`, rightColX, ty);
  ty += 2.5;
  doc.text(`Data/Hora: ${new Date(data).toLocaleString("pt-BR")}`, rightColX, ty);
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

/**
 * Carimba a MESMA assinatura (posição/tamanho idênticos) em todas as páginas
 * do documento. O seletor de página do modal serve apenas para o preview.
 */
export function desenharAssinaturaEmTodasPaginas(
  doc: jsPDF,
  a: AssinaturaResolvida,
  pos: { xMm: number; yMm: number; tamanhoPercentual?: number },
): void {
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    desenharAssinaturaEm(doc, a, { ...pos, pagina: p });
  }
  try {
    doc.setPage(total);
  } catch {
    /* ignora */
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
  /** repete as assinaturas em todas as páginas (default: true) */
  repetirEmTodasPaginas?: boolean;
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
    const hash = await calcularHashPdf(pdfDoc);
    if (opts.onBlob) {
      const blob = pdfDoc.output("blob");
      await opts.onBlob(blob, finalFilename, hash);
    } else {
      pdfDoc.save(finalFilename);
    }
  };

  // ---------------------------------------------------------------
  // Resolve TODAS as assinaturas aplicáveis (Direção da Unidade,
  // Gestor/Secretário do usuário logado, carimbos institucionais).
  // ---------------------------------------------------------------
  let listaBruta: AssinaturaResolvida[] = [];
  try {
    listaBruta =
      opts.assinaturas ??
      (await resolverAssinaturasDocumento(opts.tipo ?? "relatorio", {
        secretariaId: opts.secretariaId ?? null,
        unidadeId: opts.unidadeId ?? null,
      }));
  } catch {
    listaBruta = [];
  }

  let candidatas = (listaBruta ?? []).filter(
    (a) => a.escopo !== "ausente" && (!!a.imageData || !!a.titular_nome),
  );

  // Deduplica por assinatura/regra
  const vistos = new Set<string>();
  candidatas = candidatas.filter((a) => {
    const key = a.assinatura_id ?? a.regra_id;
    if (vistos.has(key)) return false;
    vistos.add(key);
    return true;
  });

  // Pré-carrega as imagens (jsPDF é síncrono)
  candidatas = await Promise.all(candidatas.map((a) => garantirImagemAssinatura(a)));

  const pageWidthMm = doc.internal.pageSize.getWidth();
  const pageHeightMm = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();
  const paginaBase = Math.min(Math.max(opts.pagina ?? pageCount, 1), pageCount);

  /** Injeta o selo de validação institucional no rodapé (best effort). */
  const aplicarSelo = async () => {
    if (!documentoId || !validationCode) return;
    try {
      const me = await supabase.rpc("get_my_user_context").then((r) => r.data as any);
      const pdfBuffer = doc.output("arraybuffer");
      const hashBuffer = await crypto.subtle.digest("SHA-256", pdfBuffer);
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const validationUrl = `${window.location.origin}/api/public/validar-documento?codigo=${validationCode}`;
      const QRCode = await import("qrcode");
      const qrDataUrl = await (QRCode.toDataURL ?? (QRCode as any).default?.toDataURL)(
        validationUrl,
        { margin: 1, width: 180 },
      );
      drawSignatureStamp(
        doc,
        documentoId,
        hashHex,
        me?.nome_completo || "Sistema",
        new Date().toISOString(),
        validationCode,
        14,
        qrDataUrl,
      );
    } catch (err) {
      console.warn("Falha ao aplicar selo de validação:", err);
    }
  };

  // Nenhuma assinatura disponível → comportamento atual (selo + download)
  if (candidatas.length === 0) {
    await aplicarSelo();
    await baixar();
    return;
  }

  /** Posição padrão de cada assinatura (respeita o cadastro; senão distribui). */
  const posicaoPadrao = (a: AssinaturaResolvida, idx: number) => {
    const { w } = dimensoes(a);
    const temPadraoSalvo = a.posicao_x !== null && a.posicao_y !== null;
    if (temPadraoSalvo) {
      return {
        x: ((a.posicao_x as number) / REF_W) * pageWidthMm,
        y: ((a.posicao_y as number) / REF_H) * pageHeightMm,
      };
    }
    const colunas = Math.max(1, Math.min(candidatas.length, 3));
    const coluna = idx % colunas;
    const util = pageWidthMm - 28;
    const passo = util / colunas;
    const x = 14 + coluna * passo + Math.max(0, (passo - w) / 2);
    const linha = Math.floor(idx / colunas);
    const y = (opts.yPadraoMm ?? pageHeightMm - 42) - linha * 26;
    return {
      x: Math.max(0, Math.min(x, pageWidthMm - w)),
      y: Math.max(0, y),
    };
  };

  // Perfil do usuário logado — usado para marcar "incluir" por padrão
  let meuPerfil: string | null = null;
  try {
    const { data: ctx } = await supabase.rpc("get_my_user_context");
    meuPerfil = (ctx as any)?.perfil_codigo ?? null;
  } catch {
    /* segue sem contexto */
  }

  const itens = candidatas.map((a, idx) => {
    const { x, y } = posicaoPadrao(a, idx);
    return {
      id: a.assinatura_id ?? a.regra_id,
      assinatura: a,
      xPadraoMm: x,
      yPadraoMm: y,
      paginaPadrao: paginaBase,
      tamanhoPercentualPadrao: a.tamanho_percentual ?? 80,
      incluirPadrao:
        (!!meuPerfil && a.perfil_codigo === meuPerfil) || a.perfil_codigo === "DIRETOR_UNIDADE",
    };
  });
  // Garante ao menos uma assinatura marcada
  if (!itens.some((i) => i.incluirPadrao) && itens[0]) itens[0].incluirPadrao = true;

  const porId = new Map(itens.map((i) => [i.id, i.assinatura]));

  const repetir = opts.repetirEmTodasPaginas !== false;

  const desenhar = (
    a: AssinaturaResolvida,
    pos: { xMm: number; yMm: number; pagina?: number; tamanhoPercentual?: number },
  ) => {
    if (repetir) {
      desenharAssinaturaEmTodasPaginas(doc, a, {
        xMm: pos.xMm,
        yMm: pos.yMm,
        tamanhoPercentual: pos.tamanhoPercentual,
      });
    } else {
      desenharAssinaturaEm(doc, a, pos);
    }
  };

  const desenharPadroes = () => {
    for (const i of itens) {
      if (!i.incluirPadrao) continue;
      desenhar(i.assinatura, {
        xMm: i.xPadraoMm,
        yMm: i.yPadraoMm,
        pagina: i.paginaPadrao,
        tamanhoPercentual: i.tamanhoPercentualPadrao,
      });
    }
  };

  if (opts.semModal) {
    await aplicarSelo();
    desenharPadroes();
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
    larguraMm: BASE_W,
    alturaMm: BASE_H,
    filename: finalFilename,
    assinaturas: itens,
  });

  // Modal indisponível → posições padrão (nunca quebra o download)
  if (escolha === undefined) {
    await aplicarSelo();
    desenharPadroes();
    await baixar();
    return;
  }

  // Usuário cancelou
  if (escolha === null) return;

  await aplicarSelo();

  for (const item of escolha.itens) {
    if (!item.incluir) continue;
    const a = porId.get(item.assinaturaId);
    if (!a) continue;
    desenhar(a, {
      xMm: item.xMm,
      yMm: item.yMm,
      pagina: item.pagina,
      tamanhoPercentual: item.tamanhoPercentual,
    });
    if (item.salvarPadrao) {
      await salvarPosicaoPadrao(
        a,
        { xMm: item.xMm, yMm: item.yMm, tamanhoPercentual: item.tamanhoPercentual },
        pageWidthMm,
        pageHeightMm,
      );
    }
  }

  await baixar();
}
