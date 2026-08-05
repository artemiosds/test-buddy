import type jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import logoBrasao from "@/assets/brasao-oriximina-v2.png.asset.json";

export type PdfConfig = {
  logo_size: number;
  logo_x: number;
  logo_y: number;
};

export type MunicipioInfo = {
  nome_municipio: string | null;
  uf: string | null;
  razao_social: string | null;
  logotipo_url: string | null;
  parametros?: {
    pdf_config?: PdfConfig;
  };
};

let cached: { data: MunicipioInfo | null; logoData: string | null } | null = null;

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function loadMunicipioInfo(): Promise<{
  data: MunicipioInfo | null;
  logoData: string | null;
}> {
  if (cached) return cached;
  const { data } = await supabase
    .from("municipio_config")
    .select("nome_municipio, uf, razao_social, logotipo_url, parametros")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let logoData: string | null = null;
  if (data) {
    const info: MunicipioInfo = {
      nome_municipio: data.nome_municipio,
      uf: data.uf,
      razao_social: data.razao_social,
      logotipo_url: data.logotipo_url,
      parametros: data.parametros as any,
    };
    if (info.logotipo_url) {
      logoData = await urlToDataUrl(info.logotipo_url);
    }
    cached = { data: info, logoData };
  } else {
    cached = { data: null, logoData: null };
  }
  return cached;
}

export function drawInstitutionalHeader(
  doc: jsPDF,
  info: { data: MunicipioInfo | null; logoData: string | null },
  subtitle: string,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const MARGEM = 14;
  const logoSize = 18;
  const logoY = 8;
  const cx = pageWidth / 2;

  const nome = info.data?.nome_municipio
    ? `PREFEITURA MUNICIPAL DE ${info.data.nome_municipio.toUpperCase()}`
    : "PREFEITURA MUNICIPAL DE ORIXIMINÁ";
  
  const uf = info.data?.uf ?? "PA";

  if (logoBrasao.url) {
    try {
      doc.addImage(logoBrasao.url, "PNG", cx - logoSize / 2, logoY, logoSize, logoSize);
    } catch { /* ignore */ }
  } else if (info.logoData) {
    try {
      doc.addImage(info.logoData, "PNG", cx - logoSize / 2, logoY, logoSize, logoSize);
    } catch { /* ignore */ }
  }

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(`ESTADO DO ${uf === "PA" ? "PARÁ" : uf}`, cx, logoY + logoSize + 4, { align: "center" });
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(nome, cx, logoY + logoSize + 9, { align: "center" });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("SECRETARIA MUNICIPAL DE SAÚDE", cx, logoY + logoSize + 14, { align: "center" });
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(subtitle, cx, logoY + logoSize + 21, { align: "center" });
  
  doc.setLineWidth(0.3);
  doc.line(MARGEM, logoY + logoSize + 26, pageWidth - MARGEM, logoY + logoSize + 26);
  
  return logoY + logoSize + 30;
}

export function drawSignatureFooter(doc: jsPDF, y?: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const yPos = y ?? pageHeight - 30;
  const half = pageWidth / 2;
  const pad = 20;

  doc.setLineWidth(0.3);
  doc.line(14 + pad, yPos, half - pad, yPos);
  doc.line(half + pad, yPos, pageWidth - 14 - pad, yPos);
  doc.setFontSize(9);
  doc.text("Diretor(a) da Unidade", (14 + pad + half - pad) / 2, yPos + 5, { align: "center" });
  doc.text(
    "Responsável pela Conferência (Gestor)",
    (half + pad + pageWidth - 14 - pad) / 2,
    yPos + 5,
    { align: "center" },
  );
}
