/**
 * Lazy loader for heavy export libraries (xlsx, jspdf, jspdf-autotable, and
 * shared PDF helpers). Kept in a dedicated module so a single dynamic
 * `import("@/lib/lazy-exports")` splits ~800 KB out of the initial route
 * bundle. Handlers call `loadPdfKit()` / `loadXlsxKit()` on demand.
 */
export async function loadXlsxKit() {
  const XLSX = await import("xlsx");
  return { XLSX };
}

export async function loadPdfKit() {
  const [jspdf, autotable, inst, assin] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    import("@/lib/pdf-institucional"),
    import("@/lib/pdf-assinaturas"),
  ]);
  return {
    jsPDF: jspdf.default,
    autoTable: autotable.default,
    drawInstitutionalHeader: inst.drawInstitutionalHeader,
    loadMunicipioInfo: inst.loadMunicipioInfo,
    resolverAssinaturasDocumento: assin.resolverAssinaturasDocumento,
    drawAssinaturasBlock: assin.drawAssinaturasBlock,
  };
}
