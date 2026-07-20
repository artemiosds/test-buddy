/**
 * Sublote 13 — Exportações institucionais para os relatórios gerenciais.
 * PDF via jsPDF+autotable (paisagem) e Excel via xlsx.
 * Reutiliza o cabeçalho institucional já existente.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { drawInstitutionalHeader, loadMunicipioInfo } from "@/lib/pdf-institucional";

export type ExportColumn<T> = { header: string; value: (r: T) => string | number | null | undefined; width?: number };

export async function exportarPdfInstitucional<T>(opts: {
  filename: string;
  titulo: string;
  subtitulo?: string;
  colunas: ExportColumn<T>[];
  linhas: T[];
  resumo?: string[];
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const info = await loadMunicipioInfo();
  let y = drawInstitutionalHeader(doc, info, opts.titulo);
  if (opts.subtitulo) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text(opts.subtitulo, 14, y);
    y += 5;
  }
  if (opts.resumo && opts.resumo.length) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    for (const line of opts.resumo) {
      const wrapped = doc.splitTextToSize(`• ${line}`, doc.internal.pageSize.getWidth() - 28);
      doc.text(wrapped, 14, y);
      y += wrapped.length * 3.5;
    }
    y += 2;
  }
  autoTable(doc, {
    startY: y,
    head: [opts.colunas.map((c) => c.header)],
    body: opts.linhas.map((r) => opts.colunas.map((c) => {
      const v = c.value(r);
      return v == null ? "" : String(v);
    })),
    styles: { fontSize: 7, cellPadding: 1.2 },
    headStyles: { fillColor: [92, 64, 32], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 246, 240] },
    margin: { left: 10, right: 10 },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      const current = doc.getCurrentPageInfo().pageNumber;
      const w = doc.internal.pageSize.getWidth();
      const h = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Página ${current} de ${pageCount}${current > 1 ? " (cont.)" : ""}`, w - 14, h - 6, { align: "right" });
      doc.text(new Date().toLocaleString("pt-BR"), 14, h - 6);
      doc.setTextColor(0);
    },
  });
  doc.save(opts.filename.endsWith(".pdf") ? opts.filename : `${opts.filename}.pdf`);
}

export function exportarExcel<T>(opts: { filename: string; sheet?: string; colunas: ExportColumn<T>[]; linhas: T[] }) {
  const aoa: (string | number)[][] = [opts.colunas.map((c) => c.header)];
  for (const r of opts.linhas) {
    aoa.push(opts.colunas.map((c) => {
      const v = c.value(r);
      return v == null ? "" : (typeof v === "number" ? v : String(v));
    }));
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = opts.colunas.map((c) => ({ wch: c.width ?? Math.max(12, c.header.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, (opts.sheet ?? "Dados").slice(0, 31));
  XLSX.writeFile(wb, opts.filename.endsWith(".xlsx") ? opts.filename : `${opts.filename}.xlsx`);
}

export function imprimirPagina() {
  window.print();
}
