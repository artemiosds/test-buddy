/**
 * Excel "Modelo Gestão-SMS" — Frequência de Contratados.
 * Cabeçalho mesclado B1:N4 com identificação institucional, brasões travados
 * em 80x80 px em A1 e na última coluna, tabela iniciando na linha 6 com
 * autoFilter e larguras de coluna calibradas.
 */
import ExcelJS from "exceljs";
import brasaoOriximina from "@/assets/brasao-oriximina.png.asset.json";
import logoSms from "@/assets/logo-sms.png.asset.json";
import { fmtCPF, fmtConta, type ItemContratado } from "@/lib/excel-folha-contratados";

export type ExcelContratadosModeloCerInput = {
  competencia: { mes: number; ano: number };
  unidadeNome: string;
  itens: ItemContratado[];
};

const MESES = [
  "JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO",
  "JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO",
];

async function fetchAsBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch { return null; }
}

function num(v: number | null | undefined): number | "" {
  const x = Number(v ?? 0);
  return x || "";
}

export async function gerarExcelFolhaContratadosModeloCer(
  input: ExcelContratadosModeloCerInput,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SMS Oriximiná";
  wb.created = new Date();
  const ws = wb.addWorksheet("Frequência", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: "frozen", ySplit: 7 }],
  });

  const mesNome = MESES[(input.competencia.mes - 1 + 12) % 12];
  const compStr = `${mesNome}/${input.competencia.ano}`;
  const unidadeUp = (input.unidadeNome || "-").toUpperCase();

  // Larguras — Nome/Lotação largas, contadores estreitos
  const widths = [6, 35, 16, 22, 35, 10, 10, 10, 10, 10, 10, 12, 14, 14, 30];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Altura das linhas 1-4 para acomodar logos e header mesclado
  for (let r = 1; r <= 4; r++) ws.getRow(r).height = 22;
  ws.getRow(5).height = 6;

  // Cabeçalho institucional mesclado B1:N4
  ws.mergeCells("B1:N4");
  const headerCell = ws.getCell("B1");
  headerCell.value = {
    richText: [
      { text: "ESTADO DO PARÁ\n", font: { bold: true, size: 11, name: "Calibri" } },
      { text: "PREFEITURA MUNICIPAL DE ORIXIMINÁ\n", font: { bold: true, size: 13, name: "Calibri" } },
      { text: "SECRETARIA MUNICIPAL DE SAÚDE\n", font: { bold: true, size: 11, name: "Calibri" } },
      { text: `${unidadeUp} — FREQUÊNCIA DOS PRESTADORES — MÊS ${compStr}`,
        font: { bold: true, size: 10, name: "Calibri" } },
    ],
  };
  headerCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  // Logos travados em 80x80 px
  const [brasaoBuf, smsBuf] = await Promise.all([
    fetchAsBuffer(brasaoOriximina.url),
    fetchAsBuffer(logoSms.url),
  ]);
  if (brasaoBuf) {
    const id = wb.addImage({ buffer: brasaoBuf, extension: "png" });
    ws.addImage(id, {
      tl: { col: 0.1, row: 0.1 },
      ext: { width: 80, height: 80 },
      editAs: "oneCell",
    });
  }
  if (smsBuf) {
    const id = wb.addImage({ buffer: smsBuf, extension: "png" });
    // Coluna O = índice 14 (0-based)
    ws.addImage(id, {
      tl: { col: 14.05, row: 0.1 },
      ext: { width: 80, height: 80 },
      editAs: "oneCell",
    });
  }

  const headers = [
    "Nº","NOME","C.P.F.","CARGO","LOTAÇÃO",
    "DIAS","FALTA","ATT","H.E 50%","H.E 100%","ADN",
    "PLANTÕES","SOBRE-AVISOS","INCENTIVO","CONTA",
  ];
  // Cabeçalho da tabela (linha 7)
  const headerRow = ws.getRow(7);
  headerRow.height = 26;
  headers.forEach((h, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = h;
    c.font = { name: "Calibri", bold: true, size: 10 };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    c.border = {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" },
    };
  });

  // Filtro automático
  ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7, column: headers.length } };

  // Dados
  input.itens.forEach((it, i) => {
    const rowIdx = 8 + i;
    const p = it.profissional;
    const l = it.linha ?? {};
    const values: Array<string | number> = [
      i + 1,
      p.nome ?? "",
      fmtCPF(p.cpf),
      p.cargo ?? "-",
      p.setor ?? "-",
      "",
      num(l.dias_falta as number),
      num(l.atestado as number),
      num(l.he_50 as number),
      num(l.he_100 as number),
      num(l.adn as number),
      num(l.plantoes as number),
      num(l.sobreaviso as number),
      num(l.incentivo as number),
      fmtConta(p),
    ];
    const row = ws.getRow(rowIdx);
    row.height = 18;
    values.forEach((v, ci) => {
      const c = row.getCell(ci + 1);
      c.value = v as ExcelJS.CellValue;
      c.font = { name: "Calibri", size: 9 };
      const leftAlign = ci === 1 || ci === 3 || ci === 4 || ci === 14;
      c.alignment = {
        horizontal: leftAlign ? "left" : "center",
        vertical: "middle",
        wrapText: leftAlign,
      };
      // Zebra striping
      if (i % 2 === 1) {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      }
      c.border = {
        top: { style: "hair", color: { argb: "FFCBD5E1" } },
        bottom: { style: "hair", color: { argb: "FFCBD5E1" } },
        left: { style: "hair", color: { argb: "FFCBD5E1" } },
        right: { style: "hair", color: { argb: "FFCBD5E1" } },
      };
    });
  });

  ws.pageSetup.margins = { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `folha-contratados-gestao-sms-${String(input.competencia.mes).padStart(2, "0")}-${input.competencia.ano}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
