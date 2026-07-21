/**
 * PDF "Modelo Gestão-SMS" — Frequência de Contratados / Atenção Básica.
 * A4 paisagem, cabeçalho institucional com brasões, tabela via jspdf-autotable
 * com zebra striping. Recebe os itens JÁ filtrados pela tela.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import brasaoOriximina from "@/assets/brasao-oriximina.png.asset.json";
import logoSms from "@/assets/logo-sms.png.asset.json";
import { fmtCPF, fmtConta, type ItemContratado } from "@/lib/excel-folha-contratados";

export type PdfContratadosModeloCerInput = {
  competencia: { mes: number; ano: number };
  unidadeNome: string;
  itens: ItemContratado[];
  emitidoPor: string;
};

const MESES = [
  "JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO",
  "JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO",
];

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

function fmtNum(v: number | null | undefined): string {
  const x = Number(v ?? 0);
  if (!x) return "-";
  return Number.isInteger(x) ? String(x) : x.toFixed(2).replace(".", ",");
}

export async function gerarFolhaContratadosModeloCer(
  input: PdfContratadosModeloCerInput,
): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const MARGEM = 10;

  const [brasao, sms] = await Promise.all([
    fetchAsDataUrl(brasaoOriximina.url),
    fetchAsDataUrl(logoSms.url),
  ]);

  const mesNome = MESES[(input.competencia.mes - 1 + 12) % 12];
  const compStr = `${mesNome}/${input.competencia.ano}`;
  const unidadeUp = (input.unidadeNome || "-").toUpperCase();

  const drawHeader = () => {
    const logoSize = 25;
    if (brasao) { try { doc.addImage(brasao, "PNG", MARGEM, 8, logoSize, logoSize); } catch { /* noop */ } }
    if (sms)    { try { doc.addImage(sms, "PNG", pageW - MARGEM - logoSize, 8, logoSize, logoSize); } catch { /* noop */ } }

    const cx = pageW / 2;
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("ESTADO DO PARÁ", cx, 13, { align: "center" });
    doc.setFontSize(12);
    doc.text("PREFEITURA MUNICIPAL DE ORIXIMINÁ", cx, 19, { align: "center" });
    doc.setFontSize(11);
    doc.text("SECRETARIA MUNICIPAL DE SAÚDE", cx, 25, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(
      `${unidadeUp} — FREQUÊNCIA DOS PRESTADORES — MÊS ${compStr}`,
      cx, 31, { align: "center" },
    );
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.3);
    doc.line(MARGEM, 35, pageW - MARGEM, 35);
  };

  const head = [[
    "Nº","NOME","C.P.F.","CARGO","LOTAÇÃO",
    "DIAS","FALTA","ATT","H.E 50%","H.E 100%","ADN",
    "PLANTÕES","SOBRE-AVISOS","INCENTIVO","CONTA",
  ]];

  const body = input.itens.map((it, i) => {
    const p = it.profissional;
    const l = it.linha ?? {};
    return [
      String(i + 1),
      p.nome ?? "",
      fmtCPF(p.cpf),
      p.cargo ?? "-",
      p.setor ?? "-",
      "-",
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
    startY: 38,
    margin: { left: MARGEM, right: MARGEM, top: 38, bottom: 12 },
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
      0:  { halign: "center", cellWidth: 8 },
      1:  { halign: "left",   cellWidth: 50 },
      2:  { halign: "center", cellWidth: 24 },
      3:  { halign: "left",   cellWidth: 28 },
      4:  { halign: "left",   cellWidth: 24 },
      5:  { halign: "center", cellWidth: 10 },
      6:  { halign: "center", cellWidth: 10 },
      7:  { halign: "center", cellWidth: 10 },
      8:  { halign: "center", cellWidth: 12 },
      9:  { halign: "center", cellWidth: 12 },
      10: { halign: "center", cellWidth: 10 },
      11: { halign: "center", cellWidth: 14 },
      12: { halign: "center", cellWidth: 16 },
      13: { halign: "center", cellWidth: 14 },
      14: { halign: "left",   cellWidth: 45 },
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
