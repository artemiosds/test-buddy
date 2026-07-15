import type jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

export type MunicipioInfo = {
  nome_municipio: string | null;
  uf: string | null;
  razao_social: string | null;
  logotipo_url: string | null;
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

export async function loadMunicipioInfo(): Promise<{ data: MunicipioInfo | null; logoData: string | null }> {
  if (cached) return cached;
  const { data } = await supabase
    .from("municipio_config")
    .select("nome_municipio, uf, razao_social, logotipo_url")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  let logoData: string | null = null;
  if (data?.logotipo_url) {
    logoData = await urlToDataUrl(data.logotipo_url);
  }
  cached = { data, logoData };
  return cached;
}

export function drawInstitutionalHeader(
  doc: jsPDF,
  info: { data: MunicipioInfo | null; logoData: string | null },
  subtitle: string,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const nome = info.data?.nome_municipio
    ? `PREFEITURA MUNICIPAL DE ${info.data.nome_municipio.toUpperCase()}${info.data.uf ? ` - ${info.data.uf}` : ""}`
    : "PREFEITURA MUNICIPAL DE ORIXIMINÁ - PA";

  let textX = 14;
  if (info.logoData) {
    try {
      doc.addImage(info.logoData, "PNG", 14, 8, 18, 18);
      textX = 36;
    } catch {
      /* ignore image errors */
    }
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(nome, textX, 14);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("SECRETARIA MUNICIPAL DE SAÚDE - GESTÃO SAÚDE ORIXIMINÁ", textX, 20);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(subtitle, textX, 27);
  doc.setFont("helvetica", "normal");
  doc.setLineWidth(0.3);
  doc.line(14, 32, pageWidth - 14, 32);
  return 36;
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
