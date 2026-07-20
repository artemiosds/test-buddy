/** Exportações multi-bloco: PDF institucional (com sumário) e Excel multi-aba. */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { drawInstitutionalHeader, loadMunicipioInfo } from "@/lib/pdf-institucional";
import type { Row } from "./tipos";

export type BlocoExport = {
  titulo: string;
  descricao?: string;
  colunas: { header: string; key: string; width?: number }[];
  linhas: Row[];
};

export async function exportarPdfMulti(opts: {
  filename: string;
  titulo: string;
  subtitulo?: string;
  resumo?: string[];
  blocos: BlocoExport[];
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const info = await loadMunicipioInfo();
  let y = drawInstitutionalHeader(doc, info, opts.titulo);

  if (opts.subtitulo) {
    doc.setFontSize(9).setFont("helvetica", "italic");
    doc.text(opts.subtitulo, 14, y);
    y += 5;
  }

  // Sumário
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Sumário", 14, y); y += 5;
  doc.setFont("helvetica", "normal").setFontSize(9);
  opts.blocos.forEach((b, i) => {
    doc.text(`${i + 1}. ${b.titulo}`, 18, y);
    y += 4.5;
  });
  y += 3;

  if (opts.resumo?.length) {
    doc.setFont("helvetica", "bold").setFontSize(10);
    doc.text("Resumo Executivo", 14, y); y += 4.5;
    doc.setFont("helvetica", "normal").setFontSize(8);
    for (const line of opts.resumo) {
      const wrapped = doc.splitTextToSize(`• ${line}`, doc.internal.pageSize.getWidth() - 28);
      doc.text(wrapped, 14, y);
      y += wrapped.length * 3.5;
    }
    y += 2;
  }

  opts.blocos.forEach((b, idx) => {
    if (y > doc.internal.pageSize.getHeight() - 40 || idx > 0) {
      doc.addPage();
      y = 18;
    }
    doc.setFont("helvetica", "bold").setFontSize(11);
    doc.text(`${idx + 1}. ${b.titulo}`, 14, y); y += 2;
    if (b.descricao) {
      doc.setFont("helvetica", "italic").setFontSize(8);
      doc.text(b.descricao, 14, y + 3); y += 5;
    }
    autoTable(doc, {
      startY: y + 2,
      head: [b.colunas.map((c) => c.header)],
      body: b.linhas.map((r) => b.colunas.map((c) => {
        const v = r[c.key];
        if (v == null) return "";
        return typeof v === "number" ? v.toLocaleString("pt-BR") : String(v);
      })),
      styles: { fontSize: 7, cellPadding: 1.2 },
      headStyles: { fillColor: [92, 64, 32], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 246, 240] },
      margin: { left: 10, right: 10 },
      didDrawPage: () => {
        const total = doc.getNumberOfPages();
        const current = doc.getCurrentPageInfo().pageNumber;
        const w = doc.internal.pageSize.getWidth();
        const h = doc.internal.pageSize.getHeight();
        doc.setFontSize(8).setTextColor(120);
        doc.text(`Página ${current} de ${total}${current > 1 ? " (cont.)" : ""}`, w - 14, h - 6, { align: "right" });
        doc.text(new Date().toLocaleString("pt-BR"), 14, h - 6);
        doc.setTextColor(0);
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable?.finalY ?? y + 20;
  });

  doc.save(opts.filename.endsWith(".pdf") ? opts.filename : `${opts.filename}.pdf`);
}

export function exportarExcelMulti(opts: { filename: string; blocos: BlocoExport[] }) {
  const wb = XLSX.utils.book_new();
  opts.blocos.forEach((b, i) => {
    const aoa: (string | number)[][] = [b.colunas.map((c) => c.header)];
    for (const r of b.linhas) {
      aoa.push(b.colunas.map((c) => {
        const v = r[c.key];
        return v == null ? "" : typeof v === "number" ? v : String(v);
      }));
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = b.colunas.map((c) => ({ wch: c.width ?? Math.max(12, c.header.length + 2) }));
    const nome = (b.titulo || `Bloco ${i + 1}`).replace(/[\\/:*?[\]]/g, "").slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, nome || `Bloco${i + 1}`);
  });
  XLSX.writeFile(wb, opts.filename.endsWith(".xlsx") ? opts.filename : `${opts.filename}.xlsx`);
}

export function exportarCsvMulti(opts: { filenamePrefix: string; blocos: BlocoExport[] }) {
  for (const b of opts.blocos) {
    const rows = [
      b.colunas.map((c) => JSON.stringify(c.header)).join(","),
      ...b.linhas.map((r) => b.colunas.map((c) => JSON.stringify(r[c.key] ?? "")).join(",")),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = b.titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    a.href = url;
    a.download = `${opts.filenamePrefix}-${slug}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
}
