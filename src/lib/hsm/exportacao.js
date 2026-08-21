/**
 * HSM Expert — Fase 5: Exportação de resultados.
 *
 * Client-safe: a geração dos arquivos acontece no navegador, a partir do
 * conjunto de dados que o próprio usuário já recebeu na conversa (portanto já
 * filtrado pelo RLS). Nenhum dado adicional é buscado aqui.
 */
const ROTULOS = {
    nome_completo: "Nome",
    cpf: "CPF",
    matricula: "Matrícula",
    status: "Status",
    situacao_funcional: "Situação funcional",
    carga_horaria_semanal: "Carga horária",
    unidade: "Unidade",
    cargo: "Cargo",
    funcao: "Função",
    competencia: "Competência",
    created_at: "Criado em",
    updated_at: "Atualizado em",
};
function rotulo(chave) {
    return (ROTULOS[chave] ??
        chave.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()));
}
function celula(v) {
    if (v === null || v === undefined)
        return null;
    if (typeof v === "number" || typeof v === "string")
        return v;
    if (typeof v === "boolean")
        return v ? "Sim" : "Não";
    return JSON.stringify(v);
}
/**
 * Converte o resultado de uma ferramenta em tabela exportável.
 * Retorna null quando os dados não têm formato tabular.
 */
export function montarExportacao(titulo, dados) {
    const lista = Array.isArray(dados)
        ? dados
        : dados && typeof dados === "object"
            ? Object.values(dados).find((v) => Array.isArray(v) && v.length > 0 && typeof v[0] === "object")
            : undefined;
    if (!Array.isArray(lista) || lista.length === 0)
        return null;
    const objetos = lista.filter((l) => l && typeof l === "object");
    if (objetos.length === 0)
        return null;
    const chaves = [];
    for (const o of objetos.slice(0, 50))
        for (const k of Object.keys(o))
            if (!chaves.includes(k) && k !== "id")
                chaves.push(k);
    if (chaves.length === 0)
        return null;
    return {
        titulo,
        colunas: chaves.map(rotulo),
        linhas: objetos.slice(0, 5000).map((o) => chaves.map((k) => celula(o[k]))),
    };
}
function nomeArquivo(titulo, ext) {
    const base = titulo
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .toUpperCase();
    const hoje = new Date().toISOString().slice(0, 10);
    return `${base || "HSM-EXPERT"}-${hoje}.${ext}`;
}
function baixarBlob(blob, nome) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
}
export async function exportarExcel(exp) {
    const { downloadXlsx } = await import("@/lib/xlsx-export");
    const linhas = exp.linhas.map((l) => exp.colunas.reduce((acc, c, i) => {
        acc[c] = l[i] ?? "";
        return acc;
    }, {}));
    downloadXlsx(nomeArquivo(exp.titulo, "xlsx"), linhas, exp.colunas.map((c) => ({ header: c, value: (r) => r[c] })), { sheetName: "HSM Expert", titulo: exp.titulo });
}
export function exportarCsv(exp) {
    const escape = (v) => {
        const s = v === null ? "" : String(v);
        return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const conteudo = [
        exp.colunas.map(escape).join(";"),
        ...exp.linhas.map((l) => l.map(escape).join(";")),
    ].join("\r\n");
    baixarBlob(new Blob(["\uFEFF" + conteudo], { type: "text/csv;charset=utf-8" }), nomeArquivo(exp.titulo, "csv"));
}
export async function exportarPdf(exp) {
    const [{ default: jsPDF }, { default: autoTable }, { finalizarPdf }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
        import("@/lib/pdf-pipeline"),
    ]);
    const doc = new jsPDF({ orientation: exp.colunas.length > 6 ? "landscape" : "portrait" });
    doc.setFontSize(13);
    doc.text(exp.titulo, 14, 14);
    doc.setFontSize(9);
    doc.text(`Gerado pelo HSM Expert em ${new Date().toLocaleString("pt-BR")}`, 14, 20);
    autoTable(doc, {
        head: [exp.colunas],
        body: exp.linhas.map((l) => l.map((c) => (c === null ? "" : String(c)))),
        startY: 25,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [30, 64, 92], textColor: 255 },
        theme: "grid",
    });
    await finalizarPdf(doc, { filename: nomeArquivo(exp.titulo, "pdf"), tipo: "relatorio" });
}
/** Word: documento HTML compatível com .doc (sem dependência extra). */
export function exportarWord(exp) {
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;font-size:10pt}
h1{font-size:14pt}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #999;padding:4px;font-size:8pt;text-align:left}
th{background:#1E405C;color:#fff}
</style></head><body>
<h1>${esc(exp.titulo)}</h1>
<p>Gerado pelo HSM Expert em ${esc(new Date().toLocaleString("pt-BR"))}</p>
<table><thead><tr>${exp.colunas.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
<tbody>${exp.linhas
        .map((l) => `<tr>${l.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table></body></html>`;
    baixarBlob(new Blob([html], { type: "application/msword" }), nomeArquivo(exp.titulo, "doc"));
}
