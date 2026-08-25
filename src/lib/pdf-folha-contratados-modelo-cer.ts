/**
 * PDF "Modelo Gestão-SMS" — Frequência de Contratados / Atenção Básica.
 * A4 paisagem, cabeçalho institucional com brasões, tabela via jspdf-autotable
 * com zebra striping. Recebe os itens JÁ filtrados pela tela.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtCPF, fmtConta, type ItemContratado } from "@/lib/excel-folha-contratados";
import { LOGO_PREFEITURA, LOGO_SAUDE, LOGO_BRASAO } from "@/lib/pdf-logos-base64";
import { resolverAssinaturasDocumento } from "@/lib/pdf-assinaturas";
import { finalizarPdf } from "@/lib/pdf-pipeline";

export type PdfContratadosModeloCerInput = {
  competencia: { mes: number; ano: number };
  unidadeNome: string;
  itens: ItemContratado[];
  emitidoPor: string;
  secretariaId?: string | null;
  unidadeId?: string | null;
};

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


function fmtNum(v: number | string | null | undefined): string {
  if (v == null || v === "") return "";
  if (typeof v === "string") return v;
  const x = Number(String(v).replace(",", "."));
  if (isNaN(x)) return String(v);
  if (x === 0) return "0";
  return Number.isInteger(x) ? String(x) : x.toFixed(2).replace(".", ",");
}

export async function gerarFolhaContratadosModeloCer(
  input: PdfContratadosModeloCerInput,
): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const MARGEM = 10;

  const logoPrefeitura = LOGO_PREFEITURA;
  const logoBrasaoAlt = LOGO_BRASAO;
  const logoSaude = LOGO_SAUDE;

  const mesNome = MESES[(input.competencia.mes - 1 + 12) % 12];
  const compStr = `${mesNome}/${input.competencia.ano}`;
  const unidadeUp = (input.unidadeNome || "-").toUpperCase();
  
  const assinaturas = await resolverAssinaturasDocumento("folha_contratados", {
    secretariaId: input.secretariaId ?? null,
    unidadeId: input.unidadeId ?? null,
  });

  const drawHeader = () => {
    // NÍVEL 1 — linha de logos no topo (y = 6 .. 22 mm, altura máx. 16 mm)
    const logoH = 16;
    const logoY = 6;
    const cx = pageW / 2;

    if (logoPrefeitura) {
      try {
        doc.addImage(logoPrefeitura, "JPEG", MARGEM, logoY, logoH, logoH);
      } catch (e) {
        console.warn("Erro ao desenhar logoPrefeitura", e);
      }
    }
    if (logoBrasaoAlt) {
      try {
        doc.addImage(logoBrasaoAlt, "PNG", cx - logoH / 2, logoY, logoH, logoH);
      } catch (e) {
        console.warn("Erro ao desenhar logoBrasaoAlt", e);
      }
    }
    if (logoSaude) {
      try {
        doc.addImage(logoSaude, "PNG", pageW - MARGEM - logoH, logoY, logoH, logoH);
      } catch (e) {
        console.warn("Erro ao desenhar logoSaude", e);
      }
    }

    // NÍVEL 2 — bloco de texto institucional, iniciando abaixo das imagens
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("ESTADO DO PARÁ", cx, 25, { align: "center" });
    doc.setFontSize(10);
    doc.text("PREFEITURA MUNICIPAL DE ORIXIMINÁ", cx, 30, { align: "center" });
    doc.setFontSize(9);
    doc.text("SECRETARIA MUNICIPAL DE SAÚDE", cx, 35, { align: "center" });
    const tituloUnidade = `${unidadeUp} — FREQUÊNCIA DOS PRESTADORES — MÊS ${compStr}`;
    doc.text(tituloUnidade, cx, 40, { align: "center", maxWidth: pageW - MARGEM * 2 - 4 });

    // Linha divisória
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.3);
    doc.line(MARGEM, 42, pageW - MARGEM, 42);
  };


  const head = [
    [
      "Nº",
      "NOME",
      "C.P.F.",
      "CARGO",
      "LOTAÇÃO",
      "DIAS",
      "FLT",
      "ATT",
      "50%",
      "100%",
      "ADN",
      "PLANT.",
      "SOBR.",
      "INC.",
      "CONTA",
    ],
  ];

  const body = input.itens.map((it, i) => {
    const p = it.profissional;
    const l = it.linha ?? {};
    const situacao = (it as any).situacao;
    const fmtLocal = (v: any) => {
      if (situacao && situacao !== "Ativo") return situacao;
      return fmtNum(v);
    };
    return [
      String(i + 1),
      p.nome ?? "",
      fmtCPF(p.cpf),
      p.cargo ?? "",
      p.setor || "CAPS II",
      fmtLocal(l.dias_trabalhados as number),
      fmtLocal(l.dias_falta as number),
      fmtLocal(l.atestado as number),
      fmtLocal(l.he_50 as number),
      fmtLocal(l.he_100 as number),
      fmtLocal(l.adn as number),
      fmtLocal(l.plantoes as number),
      fmtLocal(l.sobreaviso as number),
      fmtLocal(l.incentivo as number),
      fmtConta(p),
    ];
  });

  autoTable(doc, {
    head,
    body,
    startY: 44,
    tableWidth: "auto",
    margin: { top: 44, left: 10, right: 10, bottom: 15 },
    rowPageBreak: "avoid",
    styles: {
      fontSize: 7,
      cellPadding: 1.2,
      lineColor: [180, 180, 180],
      lineWidth: 0.15,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [240, 243, 246],
      textColor: [30, 41, 59],
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      fontSize: 6.5,
      cellPadding: 1.2,
      lineColor: [120, 120, 120],
      lineWidth: 0.25,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { halign: "center" },
      1: { cellWidth: 50, halign: "left" },
      2: { cellWidth: 24, halign: "center" },
      3: { cellWidth: 35, halign: "left" },
      4: { cellWidth: 18, halign: "center" },
      5: { halign: "center" },
      6: { halign: "center" },
      7: { halign: "center" },
      8: { halign: "center" },
      9: { halign: "center" },
      10: { halign: "center" },
      11: { halign: "center" },
      12: { halign: "center" },
      13: { halign: "center" },
      14: { cellWidth: 40, halign: "left" },
    },
    didDrawPage: () => {
      drawHeader();
      // rodapé
      const emissao = new Date().toLocaleString("pt-BR");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(90, 90, 90);
      doc.text(`Emissão: ${emissao}`, MARGEM, pageH - 5);
      doc.text(`Emitido por: ${input.emitidoPor}`, pageW - MARGEM, pageH - 5, { align: "right" });
      const pageNum = doc.getCurrentPageInfo().pageNumber;
      const pageTotal = doc.getNumberOfPages();
      doc.text(`Página ${pageNum} de ${pageTotal}`, pageW / 2, pageH - 5, { align: "center" });
    },
  });

  let assinaturaBaseY: number | undefined;
  if (assinaturas.length > 0) {
    const lastY = (doc as any).lastAutoTable?.finalY || 44;
    let signY = lastY + 5;
    if (signY + 35 > pageH - 15) {
      doc.addPage();
      drawHeader();
      signY = 44 + 5;
    }
    assinaturaBaseY = signY;
  }

  const compFile = `${String(input.competencia.mes).padStart(2, "0")}-${input.competencia.ano}`;
  await finalizarPdf(doc, {
    filename: `folha-contratados-gestao-sms-${compFile}.pdf`,
    tipo: "folha_contratados",
    unidadeId: input.unidadeId ?? null,
    secretariaId: input.secretariaId ?? null,
    assinaturas,
    yPadraoMm: assinaturaBaseY,
    xPadraoMm: MARGEM,
  });
}
