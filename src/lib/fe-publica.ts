/**
 * Fé Pública: certificado de autenticidade (hash SHA-256 + QR de verificação),
 * marca d'água dinâmica de rastreio e log de downloads/extrações.
 */
import type jsPDF from "jspdf";
import { auditClient } from "./audit-client";
import { capturarMetadadosDocumento } from "./documento-metadata.functions";

export type Rastreio = {
  nome: string;
  cpfOuEmail: string;
  dataHora: string;
  ip: string | null;
};

export type Certificado = {
  hash: string;
  qrDataUrl: string | null;
  verificacaoUrl: string;
  rastreio: Rastreio;
};

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function qrDataUrl(text: string): Promise<string | null> {
  try {
    const QRCode = await import("qrcode");
    const toDataURL = QRCode.toDataURL ?? QRCode.default?.toDataURL;
    if (!toDataURL) return null;
    return await toDataURL(text, { margin: 1, width: 160 });
  } catch {
    return null;
  }
}

/**
 * Gera o certificado de fé pública de uma exportação: hash do conteúdo,
 * QR de verificação e os dados de rastreio (usuário, data/hora e IP).
 */
export async function gerarCertificado(opts: {
  conteudo: unknown;
  usuario: { nome: string; identificador: string };
}): Promise<Certificado> {
  const payload = JSON.stringify(opts.conteudo);
  const hash = await sha256Hex(payload);

  let ip: string | null = null;
  let dataHora = new Date().toISOString();
  try {
    const meta = await capturarMetadadosDocumento();
    ip = meta.ip;
    dataHora = meta.timestampConfiavel;
  } catch {
    /* fallback silencioso */
  }

  const origem = typeof window !== "undefined" ? window.location.origin : "";
  const verificacaoUrl = `${origem}/validar/hash-${hash.slice(0, 16)}`;
  return {
    hash,
    qrDataUrl: await qrDataUrl(verificacaoUrl),
    verificacaoUrl,
    rastreio: { nome: opts.usuario.nome, cpfOuEmail: opts.usuario.identificador, dataHora, ip },
  };
}

/** Marca d'água diagonal de rastreio em todas as páginas (perfil com acesso completo). */
export function drawWatermark(doc: jsPDF, r: Rastreio) {
  const total = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const linha = `${r.nome} · ${r.cpfOuEmail} · ${new Date(r.dataHora).toLocaleString("pt-BR")} · IP ${r.ip ?? "n/d"}`;
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.saveGraphicsState();
    // @ts-expect-error jsPDF GState existe em runtime
    doc.setGState(new doc.GState({ opacity: 0.08 }));
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    for (let y = 40; y < h; y += 48) {
      doc.text(linha, w / 2, y, { align: "center", angle: 20 });
    }
    doc.restoreGraphicsState();
  }
}

/** Rodapé de fé pública com hash SHA-256 e QR de verificação em todas as páginas. */
export function drawCertificadoRodape(doc: jsPDF, cert: Certificado) {
  const total = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    const y = h - 16;
    doc.setLineWidth(0.2);
    doc.setDrawColor(180);
    doc.line(12, y - 3, w - 12, y - 3);
    let x = 12;
    if (cert.qrDataUrl) {
      try {
        doc.addImage(cert.qrDataUrl, "PNG", 12, y - 2, 12, 12);
        x = 27;
      } catch {
        /* ignore */
      }
    }
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90);
    doc.text(`Documento com fé pública · SHA-256: ${cert.hash}`, x, y + 1);
    doc.text(
      `Emitido por ${cert.rastreio.nome} em ${new Date(cert.rastreio.dataHora).toLocaleString("pt-BR")} · IP ${cert.rastreio.ip ?? "n/d"} · Verifique em ${cert.verificacaoUrl}`,
      x,
      y + 4.5,
    );
    doc.setTextColor(0);
  }
}

/** Bloco de fé pública para exportações XLSX/CSV (última linha da planilha). */
export function linhasCertificadoPlanilha(cert: Certificado): string[][] {
  return [
    [],
    ["CERTIFICADO DE AUTENTICIDADE — FÉ PÚBLICA"],
    ["Hash SHA-256", cert.hash],
    ["Verificação", cert.verificacaoUrl],
    ["Emitido por", `${cert.rastreio.nome} (${cert.rastreio.cpfOuEmail})`],
    ["Data/hora", new Date(cert.rastreio.dataHora).toLocaleString("pt-BR")],
    ["IP de origem", cert.rastreio.ip ?? "n/d"],
  ];
}

/** Log de downloads e extrações em audit_log (quem, o quê, filtros, quando). */
export function registrarDownload(opts: {
  relatorio: string;
  formato: "pdf" | "xlsx" | "csv";
  filtros?: Record<string, unknown>;
  hash?: string;
  registros?: number;
}) {
  void auditClient.action("export.download", {
    tabela: "_relatorio_download",
    contexto: {
      relatorio: opts.relatorio,
      formato: opts.formato,
      filtros: opts.filtros ?? {},
      hash: opts.hash ?? null,
      registros: opts.registros ?? null,
    },
  });
}
