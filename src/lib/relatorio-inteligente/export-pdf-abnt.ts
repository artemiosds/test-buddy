/**
 * PDF em padrão ABNT (Times 12, entrelinhas 1,5; margens 3/2/2/3).
 * Inclui capa institucional simplificada, sumário, índice, parecer e blocos.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { loadMunicipioInfo } from "@/lib/pdf-institucional";
import type { BlocoExport } from "./export-multi";
import type { ParecerBloco } from "./parecer";
import type { IndiceAutomatico } from "./indice";

export async function exportarPdfAbnt(opts: {
  filename: string;
  titulo: string;
  subtitulo?: string;
  resumo?: string[];
  indice?: IndiceAutomatico;
  pareceres?: ParecerBloco[];
  blocos: BlocoExport[];
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const info = await loadMunicipioInfo();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Capa ABNT.
  doc.setFont("times", "bold").setFontSize(14);
  doc.text([info.estado ?? "", info.municipio ?? "", info.secretaria ?? ""].filter(Boolean).map((s) => String(s).toUpperCase()), w / 2, 40, { align: "center" });
  doc.setFontSize(16);
  doc.text(opts.titulo.toUpperCase(), w / 2, h / 2, { align: "center", maxWidth: w - 40 });
  if (opts.subtitulo) {
    doc.setFont("times", "italic").setFontSize(12);
    doc.text(opts.subtitulo, w / 2, h / 2 + 12, { align: "center", maxWidth: w - 40 });
  }
  doc.setFont("times", "normal").setFontSize(12);
  doc.text([info.municipio ?? "", new Date().toLocaleDateString("pt-BR")].filter(Boolean).map(String), w / 2, h - 30, { align: "center" });

  doc.addPage();
  let y = 30;
  doc.setFont("times", "bold").setFontSize(14);
  doc.text("SUMÁRIO", w / 2, y, { align: "center" }); y += 10;
  doc.setFont("times", "normal").setFontSize(12);
  const secoes = [
    opts.indice ? "1. Índice Automático da Gestão" : null,
    opts.resumo?.length ? "2. Resumo Executivo" : null,
    opts.pareceres?.length ? "3. Parecer Técnico" : null,
    ...opts.blocos.map((b, i) => `${4 + i}. ${b.titulo}`),
  ].filter(Boolean) as string[];
  for (const s of secoes) { doc.text(s, 30, y); y += 8; }

  // Índice.
  if (opts.indice) {
    doc.addPage(); y = 30;
    titulo(doc, "1  ÍNDICE AUTOMÁTICO DA GESTÃO", y); y += 12;
    doc.setFont("times", "bold").setFontSize(28).setTextColor(92, 64, 32);
    doc.text(`${opts.indice.score} / 100`, w / 2, y + 4, { align: "center" });
    doc.setFontSize(12).setFont("times", "italic").setTextColor(90);
    doc.text(`Nível: ${opts.indice.nivel.toUpperCase()}`, w / 2, y + 14, { align: "center" });
    doc.setTextColor(0);
    y += 26;
    doc.setFont("times", "normal").setFontSize(12);
    for (const linha of doc.splitTextToSize(opts.indice.interpretacao, w - 60)) { doc.text(linha, 30, y); y += 6; }
    y += 3;
    autoTable(doc, {
      startY: y,
      head: [["Componente", "Peso", "Valor"]],
      body: opts.indice.componentes.map((c) => [c.rotulo, `${c.peso}%`, String(c.valor)]),
      styles: { font: "times", fontSize: 11, cellPadding: 2 },
      headStyles: { fillColor: [235, 215, 154], textColor: 20, fontStyle: "bold" },
      margin: { left: 30, right: 30 },
      didDrawPage: () => rodape(doc, w, h),
    });
  }

  // Resumo.
  if (opts.resumo?.length) {
    doc.addPage(); y = 30; titulo(doc, "2  RESUMO EXECUTIVO", y); y += 10;
    doc.setFont("times", "normal").setFontSize(12);
    for (const f of opts.resumo) {
      const linhas = doc.splitTextToSize(`• ${f}`, w - 60);
      doc.text(linhas, 30, y); y += linhas.length * 6 + 1;
      if (y > h - 30) { doc.addPage(); y = 30; }
    }
  }

  // Parecer.
  if (opts.pareceres?.length) {
    doc.addPage(); y = 30; titulo(doc, "3  PARECER TÉCNICO", y); y += 10;
    doc.setFont("times", "normal").setFontSize(12);
    for (const p of opts.pareceres) {
      if (y > h - 40) { doc.addPage(); y = 30; }
      doc.setFont("times", "bold").setFontSize(12); doc.text(p.titulo, 30, y); y += 7;
      doc.setFont("times", "normal");
      for (const frase of p.frases) {
        const linhas = doc.splitTextToSize(`• ${frase.replace(/\*\*/g, "")}`, w - 60);
        doc.text(linhas, 30, y); y += linhas.length * 6 + 1;
        if (y > h - 30) { doc.addPage(); y = 30; }
      }
      y += 2;
    }
  }

  // Blocos.
  opts.blocos.forEach((b, i) => {
    doc.addPage(); y = 30; titulo(doc, `${4 + i}  ${b.titulo.toUpperCase()}`, y); y += 8;
    if (b.descricao) {
      doc.setFont("times", "italic").setFontSize(11);
      const linhas = doc.splitTextToSize(b.descricao, w - 60);
      doc.text(linhas, 30, y); y += linhas.length * 5 + 2;
    }
    autoTable(doc, {
      startY: y,
      head: [b.colunas.map((c) => c.header)],
      body: b.linhas.map((r) => b.colunas.map((c) => {
        const v = r[c.key]; return v == null ? "" : typeof v === "number" ? v.toLocaleString("pt-BR") : String(v);
      })),
      styles: { font: "times", fontSize: 10, cellPadding: 1.5 },
      headStyles: { fillColor: [92, 64, 32], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 246, 240] },
      margin: { left: 30, right: 20 },
      didDrawPage: () => rodape(doc, w, h),
    });
  });

  doc.save(opts.filename.endsWith(".pdf") ? opts.filename : `${opts.filename}.pdf`);
}

function titulo(doc: jsPDF, texto: string, y: number) {
  doc.setFont("times", "bold").setFontSize(14).setTextColor(92, 64, 32);
  doc.text(texto, 30, y);
  doc.setTextColor(0);
}
function rodape(doc: jsPDF, w: number, h: number) {
  const total = doc.getNumberOfPages();
  const cur = doc.getCurrentPageInfo().pageNumber;
  doc.setFont("times", "normal").setFontSize(9).setTextColor(120);
  doc.text(`${cur} / ${total}`, w - 20, h - 10, { align: "right" });
  doc.setTextColor(0);
}