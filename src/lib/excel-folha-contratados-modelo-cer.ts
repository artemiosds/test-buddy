/**
 * Excel "Modelo Gestão-SMS" — Frequência de Contratados.
 * Cabeçalho institucional fiel ao modelo oficial, com 3 logos travadas no topo
 * e a logo central acima da linha "ESTADO DO PARÁ", tabela iniciando na linha 6 com
 * autoFilter e larguras de coluna calibradas.
 */
import ExcelJS from "exceljs";
import brasaoOriximina from "@/assets/brasao-oriximina.png.asset.json";
import brasaoOriximinaAlt from "@/assets/brasao-oriximina-alt.png.asset.json";
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

  // Larguras calibradas pelo modelo oficial
  const widths = [5.28515625, 31.85546875, 18.28515625, 20.28515625, 23, 7.140625, 9.140625, 7.140625, 7.140625, 7.140625, 7.140625, 9, 8.140625, 15.28515625, 25.140625];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Cabeçalho oficial: cada linha mesclada separadamente para manter a logo
  // central posicionada acima de "ESTADO DO PARÁ", como no arquivo referência.
  ws.getRow(1).height = 83.25;
  for (let r = 2; r <= 4; r++) ws.getRow(r).height = 15.6;
  ws.getRow(5).height = 49.15;
  ["A1:O1", "A2:O2", "A3:O3", "A4:O4", "A5:O5"].forEach((range) => ws.mergeCells(range));

  const headerLines = [
    { cell: "A1", text: "ESTADO DO PARÁ", size: 11, vertical: "bottom" as const },
    { cell: "A2", text: "PREFEITURA MUNICIPAL DE ORIXIMINÁ  ", size: 11, vertical: "top" as const },
    { cell: "A3", text: "SECRETARIA MUNICIPAL DE SAÚDE", size: 11, vertical: "top" as const },
    { cell: "A4", text: "GABINETE DA SECRETÁRIA", size: 11, vertical: "top" as const },
    { cell: "A5", text: `           FREQUÊNCIA DOS PRESTADORES DE ${unidadeUp} - MÊS ${compStr}`, size: 10, vertical: "middle" as const },
  ];
  headerLines.forEach(({ cell, text, size, vertical }) => {
    const c = ws.getCell(cell);
    c.value = text;
    c.font = { name: "Calibri", bold: true, size };
    c.alignment = { horizontal: "center", vertical, wrapText: true };
    c.border = cell === "A4" || cell === "A5"
      ? { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      : undefined;
  });

  const anchor = (nativeCol: number, nativeColOff: number, nativeRow: number, nativeRowOff: number) => ({
    nativeCol,
    nativeColOff,
    nativeRow,
    nativeRowOff,
  }) as unknown as ExcelJS.Anchor;

  // 3 logos institucionais — ancoragem igual ao modelo oficial de referência.
  // A logo central fica na primeira linha, acima do texto "ESTADO DO PARÁ".
  const [brasaoBuf, brasaoAltBuf, smsBuf] = await Promise.all([
    fetchAsBuffer(brasaoOriximina.url),
    fetchAsBuffer(brasaoOriximinaAlt.url),
    fetchAsBuffer(logoSms.url),
  ]);
  if (brasaoBuf) {
    const id = wb.addImage({ buffer: brasaoBuf, extension: "png" });
    ws.addImage(id, {
      tl: anchor(1, 725805, 0, 217170),
      br: anchor(1, 1463040, 0, 953313),
      editAs: "oneCell",
    });
  }
  if (brasaoAltBuf) {
    const id = wb.addImage({ buffer: brasaoAltBuf, extension: "png" });
    ws.addImage(id, {
      tl: anchor(4, 1551680, 0, 213360),
      br: anchor(6, 22859, 0, 815340),
      editAs: "oneCell",
    });
  }
  if (smsBuf) {
    const id = wb.addImage({ buffer: smsBuf, extension: "png" });
    ws.addImage(id, {
      tl: anchor(13, 480061, 0, 274320),
      ext: { width: 746760 / 9525, height: 609600 / 9525 },
      editAs: "oneCell",
    });
  }

  const headers = [
    "Nº","NOME","C.P.F.","CARGO","LOTAÇÃO",
    "DIAS","FALTA","ATT","H.E 50%","H.E 100%","ADN",
    "PLANTÕES","SOBRE-AVISOS","INCENTIVO","CONTA",
  ];
  // Cabeçalho da tabela (linha 6)
  const headerRow = ws.getRow(6);
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
  ws.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6, column: headers.length } };

  // Dados
  input.itens.forEach((it, i) => {
    const rowIdx = 7 + i;
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
