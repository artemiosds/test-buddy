import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
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
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (const sig of signatures) {
    if (sig.page >= pages.length) continue;
    const page = pages[sig.page];
    const { height: pageHeight } = page.getSize();

    // PDF coordinates are from bottom-left
    const pdfY = pageHeight - sig.y - sig.height;

    if (sig.type === "image" && sig.imageData) {
      try {
        const base64Data = sig.imageData.split(',')[1];
        const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        
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
        borderColor: rgb(0.23, 0.51, 0.96), // Royal Blue border
        borderWidth: 1,
      });

      const fontSizeTitle = 8;
      const fontSizeText = 7;
      let currentY = pdfY + sig.height - 12;

      page.drawText("ASSINADO ELETRONICAMENTE", {
        x: sig.x + 8,
        y: currentY,
        size: fontSizeTitle,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });

      currentY -= 12;
      page.drawText(`Nome: ${nome}`, { x: sig.x + 8, y: currentY, size: fontSizeText, font });
      currentY -= 10;
      page.drawText(`Cargo: ${cargo}`, { x: sig.x + 8, y: currentY, size: fontSizeText, font });
      currentY -= 10;
      page.drawText(`Matrícula: ${matricula}`, { x: sig.x + 8, y: currentY, size: fontSizeText, font });
      currentY -= 10;
      page.drawText(`Data: ${data}`, { x: sig.x + 8, y: currentY, size: fontSizeText, font });
      currentY -= 10;
      page.drawText(`Hash: ${codigo}`, { x: sig.x + 8, y: currentY, size: fontSizeText, font });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes as any], { type: "application/pdf" });
}
