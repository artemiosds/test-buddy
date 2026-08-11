import { PDFDocument, rgb } from "pdf-lib";
import { supabase } from "@/integrations/supabase/client";

export interface SignatureInstance {
  id: string;
  type: "image" | "institutional";
  page: number; // 0-indexed
  x: number; // pt (PDF units)
  y: number; // pt (PDF units)
  width: number;
  height: number;
  imageData?: string; // Data URL for image type
  institutionalData?: {
    nome: string;
    cargo: string;
    matricula: string;
    data: string;
    codigo: string;
  };
}

/**
 * Applies multiple signatures to a PDF and returns the new PDF as a Blob.
 */
export async function applySignaturesToPdf(
  pdfBuffer: ArrayBuffer,
  signatures: SignatureInstance[]
): Promise<Blob> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();

  for (const sig of signatures) {
    if (sig.page >= pages.length) continue;
    const page = pages[sig.page];
    const { height: pageHeight } = page.getSize();

    // PDF coordinates are from bottom-left
    const pdfY = pageHeight - sig.y - sig.height;

    if (sig.type === "image" && sig.imageData) {
      try {
        const imageBytes = await fetch(sig.imageData).then((res) => res.arrayBuffer());
        const image = sig.imageData.includes("png") 
          ? await pdfDoc.embedPng(imageBytes) 
          : await pdfDoc.embedJpg(imageBytes);

        page.drawImage(image, {
          x: sig.x,
          y: pdfY,
          width: sig.width,
          height: sig.height,
        });
      } catch (err) {
        console.error("Error embedding image signature:", err);
      }
    } else if (sig.type === "institutional" && sig.institutionalData) {
      const { nome, cargo, matricula, data, codigo } = sig.institutionalData;
      
      // Draw background box for institutional signature
      page.drawRectangle({
        x: sig.x,
        y: pdfY,
        width: sig.width,
        height: sig.height,
        color: rgb(0.98, 0.98, 0.98),
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 0.5,
      });

      const fontSizeTitle = 8;
      const fontSizeText = 7;
      let currentY = pdfY + sig.height - 10;

      page.drawText("ASSINADO ELETRONICAMENTE", {
        x: sig.x + 5,
        y: currentY,
        size: fontSizeTitle,
        color: rgb(0.1, 0.1, 0.1),
      });

      currentY -= 10;
      page.drawText(`Nome: ${nome}`, { x: sig.x + 5, y: currentY, size: fontSizeText });
      currentY -= 8;
      page.drawText(`Cargo: ${cargo}`, { x: sig.x + 5, y: currentY, size: fontSizeText });
      currentY -= 8;
      page.drawText(`Matrícula: ${matricula}`, { x: sig.x + 5, y: currentY, size: fontSizeText });
      currentY -= 8;
      page.drawText(`Data: ${data}`, { x: sig.x + 5, y: currentY, size: fontSizeText });
      currentY -= 8;
      page.drawText(`Código: ${codigo}`, { x: sig.x + 5, y: currentY, size: fontSizeText });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes as any], { type: "application/pdf" });
}
