/**
 * Gerador de PDF "Folha de Frequência — Contratados/Prestadores".
 *
 * Réplica visual do padrão AGILIBlue aplicado ao modelo CER/HMO
 * (uma linha por prestador, com dados bancários). A4 paisagem, margens 10 mm.
 * Só deve ser chamado com folhas cujas linhas estejam APROVADAS.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { loadMunicipioInfo, type MunicipioInfo } from "@/lib/pdf-institucional";
import { fmtCPF, fmtConta, type ItemContratado } from "@/lib/excel-folha-contratados";
import { resolverAssinaturasDocumento } from "@/lib/pdf-assinaturas";
import { finalizarPdf } from "@/lib/pdf-pipeline";
import { LOGO_PREFEITURA, LOGO_SAUDE, LOGO_BRASAO } from "@/lib/pdf-logos-base64";

export type PdfContratadosInput = {
  competencia: { mes: number; ano: number };
  unidadeNome: string;
  itens: ItemContratado[];
  emitidoPor: string;
  secretariaId?: string | null;
  unidadeId?: string | null;
};

const MARGEM = 10;
const LINHA_ALTURA = 10;

const COR_NIVEL_1: [number, number, number] = [139, 106, 42];
const COR_NIVEL_2: [number, number, number] = [184, 147, 74];
const COR_NIVEL_3: [number, number, number] = [212, 168, 83];
const COR_BORDA: [number, number, number] = [180, 180, 180];
const COR_TEXTO: [number, number, number] = [0, 0, 0];

type Col = {
  key: string;
  w: number;
  label: string;
  align: "left" | "center" | "right";
  mono?: boolean;
};

// larguras somam ~277 mm (A4 landscape com 10 mm de margem)
const COLS: Col[] = [
  { key: "n", w: 8, label: "Nº", align: "center" },
  { key: "nome", w: 52, label: "NOME", align: "left" },
  { key: "cpf", w: 26, label: "C.P.F.", align: "center", mono: true },
  { key: "cargo", w: 30, label: "CARGO", align: "left" },
  { key: "lot", w: 28, label: "LOTAÇÃO", align: "left" },
  { key: "dias", w: 9, label: "DIAS", align: "center", mono: true },
  { key: "falta", w: 9, label: "FALTA", align: "center", mono: true },
  { key: "att", w: 9, label: "ATT", align: "center", mono: true },
  { key: "he50", w: 11, label: "H.E\n50%", align: "center", mono: true },
  { key: "he100", w: 11, label: "H.E\n100%", align: "center", mono: true },
  { key: "adn", w: 9, label: "ADN", align: "center", mono: true },
  { key: "plant", w: 12, label: "PLAN-\nTÕES", align: "center", mono: true },
  { key: "sob", w: 13, label: "SOBRE-\nAVISOS", align: "center", mono: true },
  { key: "inc", w: 12, label: "INCEN-\nTIVO", align: "center", mono: true },
  { key: "conta", w: 38, label: "CONTA", align: "left", mono: true },
];

function n(v: number | string | null | undefined): string {
  if (v == null || v === "") return "-";
  if (typeof v === "string") return v;
  const x = Number(String(v).replace(",", "."));
  if (isNaN(x)) return String(v);
  if (x === 0) return "0";
  return Number.isInteger(x) ? String(x) : x.toFixed(2).replace(".", ",");
}

function drawInstitutionalBox(
  doc: jsPDF,
  info: { data: MunicipioInfo | null; logoData: string | null },
  logos: { prefeitura: string; brasao: string; saude: string },
  subtitulo: string,
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const x = MARGEM;
  const y = 8;
  const w = pageWidth - MARGEM * 2;
  const h = 22;

  doc.setDrawColor(...COR_BORDA);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h);

  const logoSize = 18;
  // Logo 1 (esquerda)
  if (logos.prefeitura) {
    try {
      doc.addImage(logos.prefeitura, "JPEG", x + 2, y + 2, logoSize, logoSize);
    } catch { /* ignore */ }
  }

  // Logo 3 (direita)
  if (logos.saude) {
    try {
      doc.addImage(logos.saude, "PNG", x + w - logoSize - 2, y + 2, logoSize, logoSize);
    } catch { /* ignore */ }
  }

  const cx = x + w / 2;
  // Logo 2 (centro)
  if (logos.brasao) {
    try {
      doc.addImage(logos.brasao, "PNG", cx - (logoSize * 0.8) / 2, y + 1, logoSize * 0.8, logoSize * 0.8);
    } catch { /* ignore */ }
  }

  const uf = info.data?.uf ?? "PA";
  const nome = (info.data?.nome_municipio ?? "ORIXIMINÁ").toUpperCase();

  doc.setTextColor(...COR_TEXTO);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`ESTADO DO ${uf === "PA" ? "PARÁ" : uf}`, cx, y + 15.5, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`PREFEITURA MUNICIPAL DE ${nome}`, cx, y + 19.5, { align: "center" });
  // doc.setFont("helvetica", "normal");
  // doc.setFontSize(9);
  // doc.text("SECRETARIA MUNICIPAL DE SAÚDE", x + 24, y + 17);
  if (subtitulo) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(subtitulo, x + w - 2, y + 6, { align: "right" });
  }
}

function drawHierBar(doc: jsPDF, y: number, color: [number, number, number], text: string): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const w = pageWidth - MARGEM * 2;
  const h = 4.8;
  doc.setFillColor(...color);
  doc.rect(MARGEM, y, w, h, "F");
  doc.setDrawColor(...COR_BORDA);
  doc.setLineWidth(0.2);
  doc.rect(MARGEM, y, w, h);
  doc.setTextColor(255, 255, 255);
  doc.setFont("courier", "bold");
  doc.setFontSize(8.5);
  doc.text(text, MARGEM + 2, y + 3.4);
  return y + h;
}

function drawTableHeader(doc: jsPDF, y: number): number {
  const h = 9;
  let x = MARGEM;
  doc.setDrawColor(...COR_BORDA);
  doc.setLineWidth(0.2);
  doc.setFillColor(240, 240, 240);
  const totalW = COLS.reduce((s, c) => s + c.w, 0);
  doc.rect(MARGEM, y, totalW, h, "F");
  doc.setTextColor(...COR_TEXTO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  for (const c of COLS) {
    doc.rect(x, y, c.w, h);
    const lines = c.label.split("\n");
    if (lines.length === 1) {
      doc.text(lines[0], x + c.w / 2, y + h / 2 + 1.1, { align: "center" });
    } else {
      doc.text(lines[0], x + c.w / 2, y + 3.4, { align: "center" });
      doc.text(lines[1], x + c.w / 2, y + 6.6, { align: "center" });
    }
    x += c.w;
  }
  return y + h;
}

function drawRow(doc: jsPDF, y: number, idx: number, item: ItemContratado): number {
  const p = item.profissional;
  const l = item.linha ?? {};
  const values: Record<string, string> = {
    n: String(idx),
    nome: p.nome ?? "",
    cpf: fmtCPF(p.cpf),
    cargo: p.cargo ?? "-",
    lot: p.setor ?? "-",
    dias: n(l.dias_trabalhados as number),
    falta: n(l.dias_falta as number),
    att: n(l.atestado as number),
    he50: n(l.he_50 as number),
    he100: n(l.he_100 as number),
    adn: n(l.adn as number),
    plant: n(l.plantoes as number),
    sob: n(l.sobreaviso as number),
    inc: n(l.incentivo as number),
    conta: fmtConta(p),
  };

  let x = MARGEM;
  doc.setDrawColor(...COR_BORDA);
  doc.setLineWidth(0.15);
  doc.setTextColor(...COR_TEXTO);
  for (const c of COLS) {
    doc.rect(x, y, c.w, LINHA_ALTURA);
    doc.setFont(c.mono ? "courier" : "helvetica", "normal");
    doc.setFontSize(7);
    const val = values[c.key] ?? "";
    const tx = c.align === "left" ? x + 1.5 : c.align === "right" ? x + c.w - 1.5 : x + c.w / 2;
    const isTextoLongo =
      c.key === "nome" || c.key === "cargo" || c.key === "lot" || c.key === "conta";
    if (isTextoLongo) {
      // Quebra em até 2 linhas, com truncamento (elipse) se ultrapassar
      const linhas = doc.splitTextToSize(val, c.w - 2) as string[];
      const usadas = linhas.slice(0, 2);
      if (linhas.length > 2) {
        const ult = usadas[1];
        usadas[1] = ult.length > 3 ? ult.slice(0, ult.length - 1).trimEnd() + "…" : ult;
      }
      const startY = usadas.length === 1 ? y + LINHA_ALTURA / 2 + 1.2 : y + LINHA_ALTURA / 2 - 1.2;
      usadas.forEach((ln, i) => {
        doc.text(ln, tx, startY + i * 3.2, { align: c.align });
      });
    } else {
      const ty = y + LINHA_ALTURA / 2 + 1.2;
      doc.text(val, tx, ty, { align: c.align, maxWidth: c.w - 2 });
    }
    x += c.w;
  }
  return y + LINHA_ALTURA;
}

function drawFooter(doc: jsPDF, emitidoPor: string, emissaoStr: string) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const total = doc.getNumberOfPages();
  const y1 = pageHeight - 12;
  const y2 = pageHeight - 7;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...COR_BORDA);
    doc.setLineWidth(0.2);
    doc.line(MARGEM, y1 - 3, pageWidth - MARGEM, y1 - 3);
    doc.setTextColor(...COR_TEXTO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Data: ${emissaoStr}`, MARGEM, y1);
    doc.text(`Página: ${i} de ${total}`, pageWidth / 2, y1, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(90, 90, 90);
    doc.text(`Data da emissão: ${emissaoStr}`, MARGEM, y2);
    doc.text("ÁGILIBlue Recursos Humanos - Ágili Software Brasil", pageWidth / 2, y2, {
      align: "center",
    });
    doc.text(`Emitido por: ${emitidoPor}`, pageWidth - MARGEM, y2, { align: "right" });
  }
}

export async function gerarFolhaContratadosOficial(input: PdfContratadosInput): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const info = await loadMunicipioInfo();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const MARGEM_PDF = 10;

  const logoPrefeitura = LOGO_PREFEITURA;
  const logoBrasaoAlt = LOGO_BRASAO;
  const logoSaude = LOGO_SAUDE;

  const assinaturas = await resolverAssinaturasDocumento("folha_contratados", {
    secretariaId: input.secretariaId ?? null,
    unidadeId: input.unidadeId ?? null,
  });

  const MESES = [
    "JANEIRO",
    "FEVEREIRO",
    "MARÇO",
    "ABRIL",
    "MAIO",
    "JUNHO",
    "JULHO",
    "AGOSTO",
    "SETEMBRO",
    "OUTUBRO",
    "NOVEMBRO",
    "DEZEMBRO",
  ];
  const compStr = `${MESES[(input.competencia.mes - 1 + 12) % 12]}/${input.competencia.ano}`;
  const unidadeUp = (input.unidadeNome || "-").toUpperCase();

  const drawHeader = () => {
    const logoSize = 18;
    const logoY = 8;
    // Logo 1 (esquerda)
    if (logoPrefeitura) {
      try {
        doc.addImage(logoPrefeitura, "JPEG", MARGEM_PDF, logoY, logoSize, logoSize);
      } catch (e) { console.warn(e); }
    }
    // Logo 3 (direita)
    if (logoSaude) {
      try {
        doc.addImage(logoSaude, "PNG", pageW - MARGEM_PDF - logoSize, logoY, logoSize, logoSize);
      } catch (e) { console.warn(e); }
    }

    const cx = pageW / 2;
    // Logo 2 (centro)
    if (logoBrasaoAlt) {
      try {
        doc.addImage(logoBrasaoAlt, "PNG", cx - (logoSize * 0.8) / 2, logoY - 2, logoSize * 0.8, logoSize * 0.8);
      } catch (e) { console.warn(e); }
    }
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    let ty = logoY + logoSize + 3;
    doc.setFontSize(9);
    doc.text("ESTADO DO PARÁ", cx, ty, { align: "center" });
    ty += 4;
    doc.setFontSize(10);
    doc.text("PREFEITURA MUNICIPAL DE ORIXIMINÁ", cx, ty, { align: "center" });
    ty += 4;
    doc.setFontSize(9);
    doc.text("SECRETARIA MUNICIPAL DE SAÚDE", cx, ty, { align: "center" });
    ty += 4;
    doc.setFontSize(9);
    doc.text(`${unidadeUp} — FREQUÊNCIA DOS PRESTADORES — MÊS ${compStr}`, cx, ty, {
      align: "center",
    });
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.3);
    doc.line(MARGEM_PDF, ty + 2, pageW - MARGEM_PDF, ty + 2);
  };

  const head = [
    [
      "Nº",
      "NOME",
      "C.P.F.",
      "CARGO",
      "LOTAÇÃO",
      "DIAS",
      "FALTA",
      "ATT",
      "H.E 50%",
      "H.E 100%",
      "ADN",
      "PLANTÕES",
      "SOBRE-AVISOS",
      "INCENTIVO",
      "CONTA",
    ],
  ];

  const body = input.itens.map((it, i) => {
    const p = it.profissional;
    const l = it.linha ?? {};
    const situacao = (it as any).situacao;
    const nVal = (v: any) => {
      if (situacao && situacao !== "Ativo") return situacao;
      if (v == null || v === "") return "";
      if (typeof v === "string") return v;
      const x = Number(String(v).replace(",", "."));
      if (isNaN(x)) return String(v);
      if (x === 0) return "0";
      return Number.isInteger(x) ? String(x) : x.toFixed(2).replace(".", ",");
    };
    return [
      String(i + 1),
      p.nome ?? "",
      fmtCPF(p.cpf),
      p.cargo ?? "",
      p.setor || input.unidadeNome || "",
      nVal(l.dias_trabalhados),
      nVal(l.dias_falta),
      nVal(l.atestado),
      nVal(l.he_50),
      nVal(l.he_100),
      nVal(l.adn),
      nVal(l.plantoes),
      nVal(l.sobreaviso),
      nVal(l.incentivo),
      fmtConta(p),
    ];
  });

  autoTable(doc, {
    head,
    body,
    startY: 52,
    margin: { left: MARGEM_PDF, right: MARGEM_PDF, top: 52, bottom: 40 },
    rowPageBreak: "avoid",
    styles: {
      fontSize: 8,
      cellPadding: 1.5,
      lineColor: [180, 180, 180],
      lineWidth: 0.15,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [226, 232, 240],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
      fontSize: 8,
      lineColor: [120, 120, 120],
      lineWidth: 0.25,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { halign: "left", cellWidth: 50 },
      2: { halign: "center", cellWidth: 24 },
      3: { halign: "left", cellWidth: 28 },
      4: { halign: "left", cellWidth: 24 },
      5: { halign: "center", cellWidth: 10 },
      6: { halign: "center", cellWidth: 10 },
      7: { halign: "center", cellWidth: 10 },
      8: { halign: "center", cellWidth: 12 },
      9: { halign: "center", cellWidth: 12 },
      10: { halign: "center", cellWidth: 10 },
      11: { halign: "center", cellWidth: 14 },
      12: { halign: "center", cellWidth: 16 },
      13: { halign: "center", cellWidth: 14 },
      14: { halign: "left", cellWidth: 45 },
    },
    didDrawPage: (data) => {
      drawHeader();
      const emissao = new Date().toLocaleString("pt-BR");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(90, 90, 90);
      doc.text(`Emissão: ${emissao} | Emitido por: ${input.emitidoPor}`, MARGEM_PDF, pageH - 5);
      const pageNum = data.pageNumber;
      const pageTotal = doc.getNumberOfPages();
      doc.text(`Página ${pageNum} de ${pageTotal}`, pageW / 2, pageH - 5, { align: "center" });
    },
  });

  let assinaturaBaseY: number | undefined;
  if (assinaturas.length > 0) {
    const lastY = (doc as any).lastAutoTable.finalY || 52;
    // Se não couber na mesma página, joga para a próxima
    let signY = lastY + 10;
    if (signY + 30 > pageH - 15) {
      doc.addPage();
      drawHeader();
      signY = 52 + 10;
    }
    
    assinaturaBaseY = signY;
  }

  const compFile = `${String(input.competencia.mes).padStart(2, "0")}-${input.competencia.ano}`;
  await finalizarPdf(doc, {
    filename: `folha-contratados-oficial-${compFile}.pdf`,
    tipo: "folha_contratados",
    unidadeId: input.unidadeId ?? null,
    secretariaId: input.secretariaId ?? null,
    assinaturas,
    yPadraoMm: assinaturaBaseY,
    xPadraoMm: MARGEM_PDF,
  });
}
