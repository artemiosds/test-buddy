/**
 * Fechamento oficial dos relatórios inteligentes: assinaturas em duas colunas
 * (uma única vez, na última página) + box de fé pública com hash e QR.
 */
import type jsPDF from "jspdf";
import { gerarCertificado, drawCertificadoBox } from "@/lib/fe-publica";

export type FechamentoAssinatura = { nome: string; cargo: string };

export async function desenharFechamentoOficial(
  doc: jsPDF,
  opts: {
    titulo: string;
    registros: number;
    margem?: number;
    assinaturas?: FechamentoAssinatura[];
    emitidoPor?: { nome: string; identificador: string };
  },
) {
  const M = opts.margem ?? 20;
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const larguraUtil = w - M * 2;

  doc.setPage(doc.getNumberOfPages());
  doc.addPage();
  let y = 30;

  doc.setFont("times", "bold").setFontSize(13).setTextColor(92, 64, 32);
  doc.text("FECHAMENTO OFICIAL DO DOCUMENTO", M, y);
  doc.setTextColor(0);
  y += 12;

  const assinaturas = (opts.assinaturas ?? []).slice(0, 2);
  if (assinaturas.length) {
    const colLarg = (larguraUtil - 14) / Math.max(1, assinaturas.length);
    const baseY = y + 16;
    assinaturas.forEach((a, i) => {
      const x = M + i * (colLarg + 14);
      doc.setDrawColor(140);
      doc.setLineWidth(0.3);
      doc.line(x + 6, baseY, x + colLarg - 6, baseY);
      doc.setFont("times", "bold").setFontSize(10).setTextColor(40);
      doc.text(a.nome, x + colLarg / 2, baseY + 5, { align: "center" });
      doc.setFont("times", "normal").setFontSize(9);
      doc.text(a.cargo, x + colLarg / 2, baseY + 10, { align: "center" });
      doc.setTextColor(0);
    });
    y = baseY + 18;
  }

  const cert = await gerarCertificado({
    conteudo: { titulo: opts.titulo, registros: opts.registros },
    usuario: opts.emitidoPor ?? { nome: "Gestão Saúde", identificador: "—" },
  });
  drawCertificadoBox(doc, cert, M, Math.min(y + 10, h - 60), larguraUtil);
}
