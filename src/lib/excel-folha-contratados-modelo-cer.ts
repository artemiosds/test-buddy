/**
 * Excel "Modelo CER" — réplica fiel do arquivo FOLHA_CER.xlsx enviado pela SMS.
 *
 * Reproduz a mesma estrutura do template original:
 *   Linha 1..5 (mescladas em O)  — cabeçalho institucional
 *   Linha 6                      — cabeçalho da tabela
 *   Linha 7+                     — prestadores
 * E embute os 3 brasões oficiais (Prefeitura, Prefeitura alternativa e SMS).
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
  const ws = wb.addWorksheet("CER", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const mesNome = MESES[(input.competencia.mes - 1 + 12) % 12];
  const compStr = `${mesNome}/${input.competencia.ano}`;
  const unidadeUp = (input.unidadeNome || "-").toUpperCase();

  // Larguras baseadas no template original
  ws.columns = [
    { width: 5.3 },   // A - Nº
    { width: 32 },    // B - NOME
    { width: 18 },    // C - CPF
    { width: 20 },    // D - CARGO
    { width: 23 },    // E - LOTAÇÃO
    { width: 7 },     // F - DIAS
    { width: 9 },     // G - FALTA
    { width: 7 },     // H - ATT
    { width: 9 },     // I - H.E 50%
    { width: 9 },     // J - H.E 100%
    { width: 7 },     // K - ADN
    { width: 9 },     // L - PLANTÕES
    { width: 8 },     // M - SOBREAVISOS
    { width: 15 },    // N - INCENTIVO
    { width: 30 },    // O - CONTA
  ];

  // Linhas altas para os brasões
  ws.getRow(1).height = 22;
  ws.getRow(2).height = 22;
  ws.getRow(3).height = 22;
  ws.getRow(4).height = 22;
  ws.getRow(5).height = 20;

  const textos = [
    "ESTADO DO PARÁ",
    "PREFEITURA MUNICIPAL DE ORIXIMINÁ",
    "SECRETARIA MUNICIPAL DE SAÚDE",
    unidadeUp,
    `FREQUÊNCIA DOS PRESTADORES DE ${unidadeUp} — MÊS ${compStr}`,
  ];

  for (let i = 0; i < 5; i++) {
    const row = i + 1;
    ws.mergeCells(row, 1, row, 15);
    const c = ws.getCell(row, 1);
    c.value = textos[i];
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.font = { name: "Calibri", bold: i !== 3, size: i === 1 ? 13 : i === 4 ? 12 : 11 };
  }

  // Embed logos
  const [brasaoLeftBuf, brasaoAltBuf, smsBuf] = await Promise.all([
    fetchAsBuffer(brasaoOriximina.url),
    fetchAsBuffer(brasaoOriximinaAlt.url),
    fetchAsBuffer(logoSms.url),
  ]);

  const addImg = (
    buf: ArrayBuffer | null,
    tl: { col: number; row: number },
    ext: { width: number; height: number },
  ) => {
    if (!buf) return;
    const id = wb.addImage({ buffer: buf, extension: "png" });
    ws.addImage(id, { tl, ext, editAs: "oneCell" });
  };

  // Brasão da Prefeitura, à esquerda (col B, linhas 1-4)
  addImg(brasaoLeftBuf, { col: 1.1, row: 0.1 }, { width: 70, height: 80 });
  // Brasão alternativo, próximo (col E)
  addImg(brasaoAltBuf,  { col: 4.1, row: 0.1 }, { width: 60, height: 80 });
  // Logo SMS, à direita (col N-O)
  addImg(smsBuf,        { col: 13.1, row: 0.2 }, { width: 90, height: 78 });

  // Cabeçalho da tabela (linha 6)
  const headers = [
    "Nº","NOME","C.P.F.","CARGO","LOTAÇÃO",
    "DIAS","FALTA","ATT","H.E 50%","H.E 100%","ADN",
    "PLANTÕES","SOBREAVISOS","INCENTIVO","CONTA",
  ];
  const headerRow = ws.getRow(6);
  headerRow.height = 24;
  headers.forEach((h, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = h;
    c.font = { name: "Calibri", bold: true, size: 10 };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6E6E6" } };
    c.border = {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" },
    };
  });

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
    row.height = 20;
    values.forEach((v, ci) => {
      const c = row.getCell(ci + 1);
      c.value = v as ExcelJS.CellValue;
      c.font = { name: "Calibri", size: 9 };
      c.alignment = {
        horizontal: ci === 1 || ci === 3 || ci === 4 || ci === 14 ? "left" : "center",
        vertical: "middle",
        wrapText: ci === 1 || ci === 3 || ci === 4 || ci === 14,
      };
      c.border = {
        top: { style: "hair" }, bottom: { style: "hair" },
        left: { style: "hair" }, right: { style: "hair" },
      };
    });
  });

  // Freeze until linha 6 (cabeçalho)
  ws.views = [{ state: "frozen", ySplit: 6 }];
  ws.pageSetup.margins = { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `folha-contratados-modelo-cer-${String(input.competencia.mes).padStart(2, "0")}-${input.competencia.ano}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}