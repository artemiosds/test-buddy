/**
 * PDF "Modelo CER" — réplica fiel do arquivo FOLHA_CER.xlsx enviado pela SMS.
 *
 * Difere do PDF Oficial (AGILIBlue) por trazer os brasões oficiais no topo
 * e um cabeçalho institucional de 5 linhas centralizadas + faixa da unidade,
 * mantendo a mesma grade de 15 colunas usada pela folha CER.
 */
import jsPDF from "jspdf";
import brasaoOriximina from "@/assets/brasao-oriximina.png.asset.json";
import brasaoOriximinaAlt from "@/assets/brasao-oriximina-alt.png.asset.json";
import logoSms from "@/assets/logo-sms.png.asset.json";
import { fmtCPF, fmtConta, type ItemContratado } from "@/lib/excel-folha-contratados";

export type PdfContratadosModeloCerInput = {
  competencia: { mes: number; ano: number };
  unidadeNome: string;
  itens: ItemContratado[];
  emitidoPor: string;
};

const MARGEM = 10;
const LINHA_ALTURA = 10;

const MESES = [
  "JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO",
  "JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO",
];

type Col = { key: string; w: number; label: string; align: "left" | "center" | "right"; mono?: boolean };

const COLS: Col[] = [
  { key: "n",     w:  8, label: "Nº",             align: "center" },
  { key: "nome",  w: 52, label: "NOME",           align: "left"   },
  { key: "cpf",   w: 26, label: "C.P.F.",         align: "center", mono: true },
  { key: "cargo", w: 30, label: "CARGO",          align: "left"   },
  { key: "lot",   w: 22, label: "LOTAÇÃO",        align: "left"   },
  { key: "dias",  w:  9, label: "DIAS",           align: "center", mono: true },
  { key: "falta", w:  9, label: "FALTA",          align: "center", mono: true },
  { key: "att",   w:  9, label: "ATT",            align: "center", mono: true },
  { key: "he50",  w: 11, label: "H.E\n50%",       align: "center", mono: true },
  { key: "he100", w: 11, label: "H.E\n100%",      align: "center", mono: true },
  { key: "adn",   w:  9, label: "ADN",            align: "center", mono: true },
  { key: "plant", w: 12, label: "PLAN-\nTÕES",    align: "center", mono: true },
  { key: "sob",   w: 13, label: "SOBRE-\nAVISOS", align: "center", mono: true },
  { key: "inc",   w: 12, label: "INCEN-\nTIVO",   align: "center", mono: true },
  { key: "conta", w: 44, label: "CONTA",          align: "left",   mono: true },
];

function n(v: number | null | undefined): string {
  const x = Number(v ?? 0);
  if (!x) return "-";
  return Number.isInteger(x) ? String(x) : x.toFixed(2).replace(".", ",");
}

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

function drawHeader(
  doc: jsPDF,
  logos: { brasaoLeft: string | null; brasaoRight: string | null; sms: string | null },
  unidadeUp: string,
  compStr: string,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const x = MARGEM;
  const y = 8;
  const w = pageWidth - MARGEM * 2;
  const h = 30;

  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h);

  const logoH = 22;
  const logoW = 22;
  const logoY = y + (h - logoH) / 2;
  if (logos.brasaoLeft) {
    try { doc.addImage(logos.brasaoLeft, "PNG", x + 3, logoY, logoW, logoH); } catch { /* noop */ }
  }
  if (logos.brasaoRight) {
    try { doc.addImage(logos.brasaoRight, "PNG", x + 3 + logoW + 4, logoY, logoW, logoH); } catch { /* noop */ }
  }
  if (logos.sms) {
    try { doc.addImage(logos.sms, "PNG", x + w - logoW - 3, logoY, logoW, logoH); } catch { /* noop */ }
  }

  const cx = x + w / 2;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("ESTADO DO PARÁ", cx, y + 6.5, { align: "center" });
  doc.setFontSize(11);
  doc.text("PREFEITURA MUNICIPAL DE ORIXIMINÁ", cx, y + 12, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("SECRETARIA MUNICIPAL DE SAÚDE", cx, y + 17.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(unidadeUp, cx, y + 22.5, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    `FREQUÊNCIA DOS PRESTADORES DE ${unidadeUp} — MÊS ${compStr}`,
    cx, y + 28, { align: "center" }
  );

  return y + h + 3;
}

function drawTableHeader(doc: jsPDF, y: number): number {
  const h = 9;
  let x = MARGEM;
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.25);
  doc.setFillColor(230, 230, 230);
  const totalW = COLS.reduce((s, c) => s + c.w, 0);
  doc.rect(MARGEM, y, totalW, h, "F");
  doc.setTextColor(0, 0, 0);
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
    dias: "-",
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
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.15);
  doc.setTextColor(0, 0, 0);
  for (const c of COLS) {
    doc.rect(x, y, c.w, LINHA_ALTURA);
    doc.setFont(c.mono ? "courier" : "helvetica", "normal");
    doc.setFontSize(7);
    const val = values[c.key] ?? "";
    const tx = c.align === "left" ? x + 1.5 : c.align === "right" ? x + c.w - 1.5 : x + c.w / 2;
    const isTextoLongo = c.key === "nome" || c.key === "cargo" || c.key === "lot" || c.key === "conta";
    if (isTextoLongo) {
      const linhas = doc.splitTextToSize(val, c.w - 2) as string[];
      const usadas = linhas.slice(0, 2);
      if (linhas.length > 2) {
        const ult = usadas[1];
        usadas[1] = ult.length > 3 ? ult.slice(0, ult.length - 1).trimEnd() + "…" : ult;
      }
      const startY = usadas.length === 1
        ? y + LINHA_ALTURA / 2 + 1.2
        : y + LINHA_ALTURA / 2 - 1.2;
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
  const y1 = pageHeight - 8;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.2);
    doc.line(MARGEM, y1 - 4, pageWidth - MARGEM, y1 - 4);
    doc.setTextColor(90, 90, 90);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`Emissão: ${emissaoStr}`, MARGEM, y1);
    doc.text(`Página ${i} de ${total}`, pageWidth / 2, y1, { align: "center" });
    doc.text(`Emitido por: ${emitidoPor}`, pageWidth - MARGEM, y1, { align: "right" });
  }
}

export async function gerarFolhaContratadosModeloCer(input: PdfContratadosModeloCerInput): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const [brasaoLeft, brasaoRight, sms] = await Promise.all([
    fetchAsDataUrl(brasaoOriximina.url),
    fetchAsDataUrl(brasaoOriximinaAlt.url),
    fetchAsDataUrl(logoSms.url),
  ]);
  const logos = { brasaoLeft, brasaoRight, sms };

  const pageHeight = doc.internal.pageSize.getHeight();
  const limiteBaixo = pageHeight - 12;
  const emissaoStr = new Date().toLocaleString("pt-BR");
  const compStr = `${MESES[(input.competencia.mes - 1 + 12) % 12]}/${input.competencia.ano}`;
  const unidadeUp = (input.unidadeNome || "-").toUpperCase();

  const drawTopo = () => {
    const y = drawHeader(doc, logos, unidadeUp, compStr);
    return drawTableHeader(doc, y);
  };

  let y = drawTopo();
  let idx = 1;
  for (const item of input.itens) {
    if (y + LINHA_ALTURA > limiteBaixo) {
      doc.addPage();
      y = drawTopo();
    }
    y = drawRow(doc, y, idx++, item);
  }

  drawFooter(doc, input.emitidoPor, emissaoStr);

  const compFile = `${String(input.competencia.mes).padStart(2, "0")}-${input.competencia.ano}`;
  doc.save(`folha-contratados-modelo-cer-${compFile}.pdf`);
}