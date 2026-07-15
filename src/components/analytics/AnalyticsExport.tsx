import * as XLSX from "xlsx";

export const AnalyticsExport = {
  toCsv: (rows: any[], filename = "export.csv") => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "data");
    XLSX.writeFile(wb, filename);
  },
  toXlsx: (rows: any[], filename = "export.xlsx") => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "data");
    XLSX.writeFile(wb, filename);
  },
};
