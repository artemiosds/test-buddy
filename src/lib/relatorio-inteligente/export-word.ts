/**
 * Exportação Word (.doc) sem dependências externas.
 * Gera um HTML compatível com Microsoft Word e faz download com MIME `application/msword`.
 * Word abre nativamente; salvar como .docx é feito pelo usuário se desejar.
 */
import type { BlocoExport } from "./export-multi";
import type { ParecerBloco } from "./parecer";
import type { IndiceAutomatico } from "./indice";

export function exportarWord(opts: {
  filename: string;
  titulo: string;
  subtitulo?: string;
  resumo?: string[];
  indice?: IndiceAutomatico;
  pareceres?: ParecerBloco[];
  blocos: BlocoExport[];
}) {
  const html = buildHtml(opts);
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.filename.endsWith(".doc") ? opts.filename : `${opts.filename}.doc`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function esc(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "number" ? v.toLocaleString("pt-BR") : String(v);
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildHtml(o: Parameters<typeof exportarWord>[0]): string {
  const rowsHtml = (b: BlocoExport) => b.linhas.map((r) =>
    `<tr>${b.colunas.map((c) => `<td>${esc(r[c.key])}</td>`).join("")}</tr>`).join("");

  const bloquesHtml = o.blocos.map((b, i) => `
    <h2>${i + 1}. ${esc(b.titulo)}</h2>
    ${b.descricao ? `<p><i>${esc(b.descricao)}</i></p>` : ""}
    <table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:10pt;">
      <thead><tr style="background:#5C4020;color:#fff;">
        ${b.colunas.map((c) => `<th align="left">${esc(c.header)}</th>`).join("")}
      </tr></thead>
      <tbody>${rowsHtml(b)}</tbody>
    </table>
  `).join("");

  const parHtml = (o.pareceres ?? []).map((p) => `
    <h3>${esc(p.titulo)}</h3>
    <ul>${p.frases.map((f) => `<li>${esc(f.replace(/\*\*/g, ""))}</li>`).join("")}</ul>
  `).join("");

  const indiceHtml = o.indice ? `
    <h2>Índice Automático da Gestão</h2>
    <p style="font-size:28pt;font-weight:bold;color:#5C4020;">${o.indice.score} / 100 <span style="font-size:12pt;color:#555;">(${o.indice.nivel})</span></p>
    <p>${esc(o.indice.interpretacao)}</p>
    <table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-size:10pt;">
      <thead><tr style="background:#EBD79A;"><th align="left">Componente</th><th>Peso</th><th>Valor</th></tr></thead>
      <tbody>${o.indice.componentes.map((c) => `<tr><td>${esc(c.rotulo)}</td><td align="center">${c.peso}%</td><td align="right">${c.valor}</td></tr>`).join("")}</tbody>
    </table>
  ` : "";

  const resumoHtml = o.resumo?.length ? `
    <h2>Resumo Executivo</h2>
    <ul>${o.resumo.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
  ` : "";

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(o.titulo)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page { size: A4; margin: 3cm 2cm 2cm 3cm; }
  body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.5; color:#111; }
  h1 { font-size: 18pt; color:#5C4020; }
  h2 { font-size: 14pt; color:#5C4020; border-bottom:1px solid #B7873B; padding-bottom:2px; margin-top:16pt; }
  h3 { font-size: 12pt; color:#7B5A2A; }
  table { page-break-inside: avoid; }
</style></head>
<body>
  <h1>${esc(o.titulo)}</h1>
  ${o.subtitulo ? `<p><i>${esc(o.subtitulo)}</i></p>` : ""}
  ${indiceHtml}
  ${resumoHtml}
  ${parHtml ? `<h2>Parecer Técnico</h2>${parHtml}` : ""}
  <h2>Blocos</h2>
  ${bloquesHtml}
</body></html>`;
}