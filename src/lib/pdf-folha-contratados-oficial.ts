/**
 * Gerador de PDF "Folha de Frequência — Contratados/Prestadores".
 *
 * Réplica visual do padrão AGILIBlue aplicado ao modelo CER/HMO
 * (uma linha por prestador, com dados bancários). A4 paisagem, margens 10 mm.
 * Só deve ser chamado com folhas cujas linhas estejam APROVADAS.
 */
import jsPDF from "jspdf";
import { loadMunicipioInfo, type MunicipioInfo } from "@/lib/pdf-institucional";
import { fmtCPF, fmtConta, type ItemContratado } from "@/lib/excel-folha-contratados";
import {
  resolverAssinaturasDocumento,
  drawAssinaturasBlock,
} from "@/lib/pdf-assinaturas";

export type PdfContratadosInput = {
  competencia: { mes: number; ano: number };
  unidadeNome: string;
  itens: ItemContratado[];
  emitidoPor: string;
  secretariaId?: string | null;
  unidadeId?: string | null;
};

const MARGEM = 10;
const LINHA_ALTURA = 8;

const COR_NIVEL_1: [number, number, number] = [139, 106, 42];
const COR_NIVEL_2: [number, number, number] = [184, 147, 74];
const COR_NIVEL_3: [number, number, number] = [212, 168, 83];
const COR_BORDA: [number, number, number] = [180, 180, 180];
const COR_TEXTO: [number, number, number] = [0, 0, 0];

type Col = { key: string; w: number; label: string; align: "left" | "center" | "right"; mono?: boolean };

// larguras somam ~277 mm (A4 landscape com 10 mm de margem)
const COLS: Col[] = [
  { key: "n",       w:  8,  label: "Nº",           align: "center" },
  { key: "nome",    w: 55,  label: "NOME",         align: "left"   },
  { key: "cpf",     w: 28,  label: "C.P.F.",       align: "center", mono: true },
  { key: "cargo",   w: 32,  label: "CARGO",        align: "left"   },
  { key: "lot",     w: 30,  label: "LOTAÇÃO",      align: "left"   },
  { key: "dias",    w:  9,  label: "DIAS",         align: "center", mono: true },
  { key: "falta",   w:  9,  label: "FALTA",        align: "center", mono: true },
  { key: "att",     w:  9,  label: "ATT",          align: "center", mono: true },
  { key: "he50",    w: 11,  label: "H.E 50%",      align: "center", mono: true },
  { key: "he100",   w: 11,  label: "H.E 100%",     align: "center", mono: true },
  { key: "adn",     w:  9,  label: "ADN",          align: "center", mono: true },
  { key: "plant",   w: 11,  label: "PLANTÕES",     align: "center", mono: true },
  { key: "sob",     w: 14,  label: "SOBREAVISOS",  align: "center", mono: true },
  { key: "inc",     w: 12,  label: "INCENTIVO",    align: "center", mono: true },
  { key: "conta",   w: 29,  label: "CONTA",        align: "left",   mono: true },
];

function n(v: number | null | undefined): string {
  const x = Number(v ?? 0);
  if (!x) return "-";
  return Number.isInteger(x) ? String(x) : x.toFixed(2).replace(".", ",");
}

function drawInstitutionalBox(doc: jsPDF, info: { data: MunicipioInfo | null; logoData: string | null }, subtitulo: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const x = MARGEM;
  const y = 8;
  const w = pageWidth - MARGEM * 2;
  const h = 22;

  doc.setDrawColor(...COR_BORDA);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h);

  if (info.logoData) {
    try { doc.addImage(info.logoData, "PNG", x + 2, y + 2, 18, 18); } catch { /* ignore */ }
  }

  const uf = info.data?.uf ?? "PA";
  const nome = (info.data?.nome_municipio ?? "ORIXIMINÁ").toUpperCase();

  doc.setTextColor(...COR_TEXTO);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`ESTADO DO ${uf === "PA" ? "PARÁ" : uf}`, x + 24, y + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`PREFEITURA MUNICIPAL DE ${nome}`, x + 24, y + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("SECRETARIA MUNICIPAL DE SAÚDE", x + 24, y + 17);
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
  const h = 7;
  let x = MARGEM;
  doc.setDrawColor(...COR_BORDA);
  doc.setLineWidth(0.2);
  doc.setFillColor(240, 240, 240);
  const totalW = COLS.reduce((s, c) => s + c.w, 0);
  doc.rect(MARGEM, y, totalW, h, "F");
  doc.setTextColor(...COR_TEXTO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  for (const c of COLS) {
    doc.rect(x, y, c.w, h);
    doc.text(c.label, x + c.w / 2, y + 4.5, { align: "center" });
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
  doc.setDrawColor(...COR_BORDA);
  doc.setLineWidth(0.15);
  doc.setTextColor(...COR_TEXTO);
  for (const c of COLS) {
    doc.rect(x, y, c.w, LINHA_ALTURA);
    doc.setFont(c.mono ? "courier" : "helvetica", "normal");
    doc.setFontSize(7.5);
    const val = values[c.key] ?? "";
    const tx = c.align === "left" ? x + 1.5 : c.align === "right" ? x + c.w - 1.5 : x + c.w / 2;
    const ty = y + LINHA_ALTURA / 2 + 1.2;
    doc.text(val, tx, ty, { align: c.align, maxWidth: c.w - 2 });
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
    doc.text("ÁGILIBlue Recursos Humanos - Ágili Software Brasil", pageWidth / 2, y2, { align: "center" });
    doc.text(`Emitido por: ${emitidoPor}`, pageWidth - MARGEM, y2, { align: "right" });
  }
}

export async function gerarFolhaContratadosOficial(input: PdfContratadosInput): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const info = await loadMunicipioInfo();

  const assinaturas = await resolverAssinaturasDocumento("folha_contratados", {
    secretariaId: input.secretariaId ?? null,
    unidadeId: input.unidadeId ?? null,
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  const rodapeReserva = 18;
  const limiteBaixo = pageHeight - rodapeReserva;
  const emissaoStr = new Date().toLocaleString("pt-BR");

  const MESES = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
  const compStr = `${MESES[(input.competencia.mes - 1 + 12) % 12]}/${input.competencia.ano}`;
  const unidadeUp = (input.unidadeNome || "-").toUpperCase();

  const drawTopo = (cont: boolean) => {
    drawInstitutionalBox(doc, info, `FREQUÊNCIA — PRESTADORES • ${compStr}`);
    let y = 32;
    y = drawHierBar(doc, y, COR_NIVEL_1, "1 - Raiz");
    y = drawHierBar(doc, y, COR_NIVEL_2, "1.18 - SECRETARIA MUNICIPAL DE SAÚDE");
    y = drawHierBar(doc, y, COR_NIVEL_3, `${unidadeUp}${cont ? " (cont.)" : ""}`);
    y += 1.5;
    doc.setTextColor(...COR_TEXTO);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Qtd prestadores: ${input.itens.length}`, MARGEM, y + 3);
    y += 5;
    return drawTableHeader(doc, y);
  };

  let y = drawTopo(false);
  let idx = 1;
  for (const item of input.itens) {
    if (y + LINHA_ALTURA > limiteBaixo) {
      doc.addPage();
      y = drawTopo(true);
    }
    y = drawRow(doc, y, idx++, item);
  }

  if (assinaturas.length > 0) {
    drawAssinaturasBlock(doc, assinaturas, {
      startY: pageHeight - 60,
      marginX: MARGEM,
    });
  }

  drawFooter(doc, input.emitidoPor, emissaoStr);

  const compFile = `${String(input.competencia.mes).padStart(2, "0")}-${input.competencia.ano}`;
  doc.save(`folha-contratados-oficial-${compFile}.pdf`);
}