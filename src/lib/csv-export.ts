import Papa from "papaparse";

/**
 * Utilitário profissional de exportação CSV usando PapaParse.
 * Garante tratamento correto de caracteres especiais, aspas e encoding UTF-8 (BOM).
 */
export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  // Transforma os dados no formato esperado pelo PapaParse
  const data = rows.map((row) => {
    const obj: Record<string, string | number | null | undefined> = {};
    columns.forEach((col) => {
      obj[col.header] = col.value(row);
    });
    return obj;
  });

  return Papa.unparse(data, {
    quotes: true,
    delimiter: ",",
    header: true,
    skipEmptyLines: true,
  });
}

export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  const csv = toCsv(rows, columns);
  
  // BOM (\ufeff) para Excel reconhecer UTF-8 com acentos
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  
  document.body.appendChild(a);
  a.click();
  
  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}
