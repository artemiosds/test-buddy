/**
 * PDF "Modelo Gestão-SMS" — Frequência de Contratados / Atenção Básica.
 * A4 paisagem, cabeçalho institucional com brasões, tabela via jspdf-autotable
 * com zebra striping. Recebe os itens JÁ filtrados pela tela.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtCPF, fmtConta, type ItemContratado } from "@/lib/excel-folha-contratados";

export type PdfContratadosModeloCerInput = {
  competencia: { mes: number; ano: number };
  unidadeNome: string;
  itens: ItemContratado[];
  emitidoPor: string;
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


function fmtNum(v: number | null | undefined): string {
  const x = Number(v ?? 0);
  if (!x) return "";
  return Number.isInteger(x) ? String(x) : x.toFixed(2).replace(".", ",");
}

export async function gerarFolhaContratadosModeloCer(
  input: PdfContratadosModeloCerInput,
): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const MARGEM = 10;

  // Helper para converter URL em Base64
  async function getBase64Image(url: string): Promise<string | null> {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Erro ao carregar imagem para o PDF:", e);
      return null;
    }
  }

  // Importar os assets JSON para pegar as URLs do CDN e converter para Base64 (mais estável na Vercel)
  const logoPrefeituraUrl = (await import("@/assets/logo-prefeitura.jpg.asset.json")).default.url;
  const logoBrasaoAltUrl = (await import("@/assets/brasao-oriximina-v2.png.asset.json")).default.url;
  const logoSaudeUrl = (await import("@/assets/logo-saude.png.asset.json")).default.url;

  const [logoPrefeitura, logoBrasaoAlt, logoSaude] = await Promise.all([
    getBase64Image(logoPrefeituraUrl),
    getBase64Image(logoBrasaoAltUrl),
    getBase64Image(logoSaudeUrl),
  ]);

  const mesNome = MESES[(input.competencia.mes - 1 + 12) % 12];
  const compStr = `${mesNome}/${input.competencia.ano}`;
  const unidadeUp = (input.unidadeNome || "-").toUpperCase();

  const drawHeader = () => {
    const logoSize = 18;
    const logoY = 8;
    // Logo 1 (esquerda) — Prefeitura
    if (logoPrefeitura) {
      try {
        doc.addImage(logoPrefeitura, "JPEG", MARGEM, logoY, logoSize, logoSize);
      } catch (e) {
        console.warn("Erro ao desenhar logoPrefeitura", e);
      }
    }
    // Logo 3 (direita) — Secretaria Municipal de Saúde
    if (logoSaude) {
      try {
        doc.addImage(logoSaude, "PNG", pageW - MARGEM - logoSize, logoY, logoSize, logoSize);
      } catch (e) {
        console.warn("Erro ao desenhar logoSaude", e);
      }
    }

    const cx = pageW / 2;
    // Logo 2 (centro) — brasão alternativo, acima dos textos
    if (logoBrasaoAlt) {
      try {
        // A segunda imagem (brasão) deve ficar ACIMA do texto "ESTADO DO PARÁ"
        doc.addImage(logoBrasaoAlt, "PNG", cx - (logoSize * 0.8) / 2, logoY - 2, logoSize * 0.8, logoSize * 0.8);
      } catch (e) {
        console.warn("Erro ao desenhar logoBrasaoAlt", e);
      }
    }
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    // Textos ficam abaixo da logo central (Y > logoY + logoSize)
    let ty = logoY + logoSize + 3; // ~31mm
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
    doc.line(MARGEM, ty + 2, pageW - MARGEM, ty + 2);
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
    return [
      String(i + 1),
      p.nome ?? "",
      fmtCPF(p.cpf),
      p.cargo ?? "",
      p.setor || input.unidadeNome || "",
      fmtNum(l.dias_trabalhados as number),
      fmtNum(l.dias_falta as number),
      fmtNum(l.atestado as number),
      fmtNum(l.he_50 as number),
      fmtNum(l.he_100 as number),
      fmtNum(l.adn as number),
      fmtNum(l.plantoes as number),
      fmtNum(l.sobreaviso as number),
      fmtNum(l.incentivo as number),
      fmtConta(p),
    ];
  });

  autoTable(doc, {
    head,
    body,
    startY: 52,
    margin: { left: MARGEM, right: MARGEM, top: 52, bottom: 12 },
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

  const compFile = `${String(input.competencia.mes).padStart(2, "0")}-${input.competencia.ano}`;
  doc.save(`folha-contratados-gestao-sms-${compFile}.pdf`);
}
