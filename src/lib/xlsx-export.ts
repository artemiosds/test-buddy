import * as XLSX from "xlsx-js-style";

export type XlsxColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
  /** Tipo do dado para formatação da célula. Padrão: "texto". */
  tipo?: "texto" | "numero" | "moeda" | "data";
  /** Largura aproximada da coluna (em caracteres). */
  largura?: number;
};

const BORDA = { style: "thin", color: { rgb: "D9D9D9" } } as const;

function limparNumero(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v)
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}\b)/g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Exporta linhas para um arquivo .xlsx com cabeçalho estilizado,
 * colunas dimensionadas, congelamento da primeira linha e autofiltro.
 */
export function downloadXlsx<T>(
  filename: string,
  rows: T[],
  columns: XlsxColumn<T>[],
  opts?: { sheetName?: string; titulo?: string },
) {
  const sheetName = (opts?.sheetName ?? "Dados").slice(0, 31);
  const temTitulo = Boolean(opts?.titulo);
  const linhaCabecalho = temTitulo ? 1 : 0;

  const aoa: unknown[][] = [];
  if (temTitulo) aoa.push([opts!.titulo]);
  aoa.push(columns.map((c) => c.header));

  for (const r of rows) {
    aoa.push(
      columns.map((c) => {
        const raw = c.value(r);
        if (c.tipo === "numero" || c.tipo === "moeda") return limparNumero(raw) ?? 0;
        return raw === null || raw === undefined ? "" : String(raw);
      }),
    );
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  if (temTitulo) {
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } }];
    const ref = XLSX.utils.encode_cell({ r: 0, c: 0 });
    ws[ref].s = {
      font: { bold: true, sz: 13, color: { rgb: "1F2937" } },
      alignment: { horizontal: "left", vertical: "center" },
    };
  }

  columns.forEach((c, i) => {
    const ref = XLSX.utils.encode_cell({ r: linhaCabecalho, c: i });
    if (!ws[ref]) return;
    ws[ref].s = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
      fill: { fgColor: { rgb: "B45309" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA },
    };
  });

  rows.forEach((_, ri) => {
    const r = linhaCabecalho + 1 + ri;
    const zebra = ri % 2 === 1;
    columns.forEach((c, i) => {
      const ref = XLSX.utils.encode_cell({ r, c: i });
      const cell = ws[ref];
      if (!cell) return;
      const numerico = c.tipo === "numero" || c.tipo === "moeda";
      if (numerico) {
        cell.t = "n";
        cell.z = c.tipo === "moeda" ? 'R$ #,##0.00;[Red]-R$ #,##0.00;"—"' : "#,##0.##";
      }
      cell.s = {
        alignment: {
          horizontal: numerico ? "right" : "left",
          vertical: "center",
        },
        fill: zebra ? { fgColor: { rgb: "FAFAF9" } } : undefined,
        border: { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA },
      };
    });
  });

  ws["!cols"] = columns.map((c) => {
    if (c.largura) return { wch: c.largura };
    const maiorValor = rows.reduce((max, r) => {
      const s = c.value(r);
      return Math.max(max, s === null || s === undefined ? 0 : String(s).length);
    }, 0);
    return { wch: Math.min(42, Math.max(c.header.length + 2, maiorValor + 2, 10)) };
  });

  ws["!rows"] = [];
  if (temTitulo) ws["!rows"][0] = { hpt: 24 };
  ws["!rows"][linhaCabecalho] = { hpt: 26 };

  ws["!freeze"] = { xSplit: "0", ySplit: String(linhaCabecalho + 1) };
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: linhaCabecalho, c: 0 },
      e: { r: linhaCabecalho + rows.length, c: columns.length - 1 },
    }),
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const nome = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, nome, { bookType: "xlsx" });
}
