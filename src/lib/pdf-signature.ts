import type jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

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
};

export type SignResult = {
  id: string;
  hash: string;
  validationUrl: string;
  qrDataUrl: string;
  assinadoEm: string;
  assinadoPorNome: string | null;
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

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("nome_completo")
    .eq("id", user.id)
    .maybeSingle();

  const assinadoEm = new Date().toISOString();
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
  };
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

