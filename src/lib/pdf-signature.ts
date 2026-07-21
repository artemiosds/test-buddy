import type jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { capturarMetadadosDocumento } from "./documento-metadata.functions";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type SignInput = {
  tipo: string;
  referencia_id?: string | null;
  descricao: string;
  dados: Record<string, unknown>;
  termoAceite?: boolean;
};

export type SignResult = {
  id: string;
  hash: string;
  validationUrl: string;
  qrDataUrl: string;
  assinadoEm: string;
  assinadoPorNome: string | null;
  timestampConfiavel?: string;
  timestampFonte?: string;
};

async function createQrDataUrl(text: string): Promise<string> {
  const QRCode = await import("qrcode");
  const toDataURL = QRCode.toDataURL ?? QRCode.default?.toDataURL;
  if (!toDataURL) throw new Error("Gerador de QR Code indisponível");
  return toDataURL(text, { margin: 1, width: 180 });
}

/**
 * Registra um documento assinado no banco e devolve o QR Code em data URL.
 * O QR Code aponta para /validar/{id} onde qualquer pessoa pode verificar.
 */
export async function registrarDocumentoAssinado(input: SignInput): Promise<SignResult> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("Não autenticado");

  if (input.termoAceite === false) {
    throw new Error("É necessário aceitar o termo de assinatura eletrônica");
  }

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("nome_completo")
    .eq("id", user.id)
    .maybeSingle();

  // Metadados: IP + timestamp confiável (NTP com fallback)
  let meta = { ip: null as string | null, timestampConfiavel: new Date().toISOString(), timestampFonte: "servidor" };
  try {
    meta = await capturarMetadadosDocumento();
  } catch {
    /* fallback silencioso */
  }
  const assinadoEm = meta.timestampConfiavel;
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 512) : null;

  const payload = JSON.stringify({
    tipo: input.tipo,
    referencia_id: input.referencia_id ?? null,
    descricao: input.descricao,
    dados: input.dados,
    assinado_por: user.id,
    assinado_em: assinadoEm,
  });
  const hash = await sha256Hex(payload);

  const { data, error } = await supabase
    .from("documentos_assinados")
    .insert({
      tipo: input.tipo,
      referencia_id: input.referencia_id ?? null,
      descricao: input.descricao,
      hash_conteudo: hash,
      dados_json: input.dados as never,
      assinado_por: user.id,
      assinado_por_nome: perfil?.nome_completo ?? user.email ?? null,
      assinado_em: assinadoEm,
      ip_origem: meta.ip,
      user_agent: userAgent,
      termo_aceite: input.termoAceite ?? true,
      timestamp_confiavel: meta.timestampConfiavel,
      timestamp_fonte: meta.timestampFonte,
    })
    .select("id, assinado_em, assinado_por_nome")
    .single();

  if (error || !data) throw error ?? new Error("Falha ao registrar documento");

  const validationUrl = `${window.location.origin}/validar/${data.id}`;
  const qrDataUrl = await createQrDataUrl(validationUrl);

  return {
    id: data.id,
    hash,
    validationUrl,
    qrDataUrl,
    assinadoEm: data.assinado_em,
    assinadoPorNome: data.assinado_por_nome,
    timestampConfiavel: meta.timestampConfiavel,
    timestampFonte: meta.timestampFonte,
  };
}

/**
 * Faz upload do PDF gerado ao bucket privado `documentos-assinados` e
 * grava o caminho em `pdf_storage_path` para reemissão fiel.
 * Falhas de upload não invalidam a assinatura (best effort).
 */
export async function armazenarPdfAssinado(sig: SignResult, blob: Blob): Promise<void> {
  try {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return;
    const path = `${uid}/${sig.id}.pdf`;
    const up = await supabase.storage
      .from("documentos-assinados")
      .upload(path, blob, { contentType: "application/pdf", upsert: true });
    if (up.error) return;
    await supabase
      .from("documentos_assinados")
      .update({ pdf_storage_path: path })
      .eq("id", sig.id);
  } catch {
    /* best effort */
  }
}

/**
 * Desenha o selo de autenticidade (QR + hash + link) no rodapé do PDF.
 */
export function drawSignatureStamp(doc: jsPDF, sig: SignResult) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const y = pageHeight - 30;
  const qrSize = 22;

  try {
    doc.addImage(sig.qrDataUrl, "PNG", 14, y - 2, qrSize, qrSize);
  } catch {
    /* ignore */
  }

  const textX = 14 + qrSize + 4;
  const lineH = 3.4;
  let ty = y + 2;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("DOCUMENTO ASSINADO ELETRONICAMENTE", textX, ty);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  ty += lineH + 0.6;
  doc.text(`ID: ${sig.id}`, textX, ty);
  ty += lineH;
  doc.text(`Hash SHA-256: ${sig.hash.slice(0, 32)}...`, textX, ty);
  ty += lineH;
  doc.text(
    `Assinado por: ${sig.assinadoPorNome ?? "-"} em ${new Date(sig.assinadoEm).toLocaleString("pt-BR")}`,
    textX,
    ty,
  );
  ty += lineH;
  doc.text(`Valide em: ${sig.validationUrl}`, textX, ty);

  doc.setLineWidth(0.2);
  doc.line(14, y - 4, pageWidth - 14, y - 4);
}

