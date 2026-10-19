import { loadMunicipioInfo, drawInstitutionalHeader } from "@/lib/pdf-institucional";

export type LinhaProfissionalPdf = {
  matricula: string;
  nome: string;
  cpf: string;
  lotacao: string;
  cargo: string;
  vinculo: string;
  ch: string;
  situacao: string;
};

/** Gera a relação de profissionais em A4 paisagem, respeitando os filtros já aplicados. */
export async function gerarPdfProfissionaisLista(linhas: LinhaProfissionalPdf[], filtros: string) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const info = await loadMunicipioInfo();
  let y = drawInstitutionalHeader(doc, info, "RELAÇÃO GERAL DE PROFISSIONAIS");
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const emissao = new Date().toLocaleString("pt-BR");
  const txt = doc.splitTextToSize(
    `Filtros: ${filtros || "Nenhum (relação completa)"}   |   Total: ${linhas.length}   |   Emitido em: ${emissao}`,
    pageW - 28,
  );
  doc.text(txt, 14, y);
  y += txt.length * 3.5 + 1;

  autoTable(doc, {
    startY: y,
    margin: { left: 10, right: 10, bottom: 14 },
    head: [["#", "Matrícula", "Nome completo", "CPF", "Lotação (Unidade / Setor)", "Cargo / Função", "Vínculo", "C.H.", "Situação"]],
    body: linhas.map((l, i) => [String(i + 1), l.matricula, l.nome, l.cpf, l.lotacao, l.cargo, l.vinculo, l.ch, l.situacao]),
    styles: { fontSize: 7, cellPadding: 1.2, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [30, 64, 120], textColor: 255, fontStyle: "bold", halign: "center" },
    alternateRowStyles: { fillColor: [244, 246, 250] },
    columnStyles: {
      0: { cellWidth: 9, halign: "center" },
      1: { cellWidth: 20 },
      2: { cellWidth: 62 },
      3: { cellWidth: 26 },
      4: { cellWidth: 52 },
      5: { cellWidth: 46 },
      6: { cellWidth: 26 },
      7: { cellWidth: 12, halign: "center" },
      8: { cellWidth: 24 },
    },
  });

  const total = doc.getNumberOfPages();
  const pageH = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(110);
    doc.text("Gestão da Saúde — Secretaria Municipal de Saúde", 10, pageH - 6);
    doc.text(`Página ${p} de ${total}`, pageW - 10, pageH - 6, { align: "right" });
  }
  doc.save(`profissionais_${new Date().toISOString().slice(0, 10)}.pdf`);
}
