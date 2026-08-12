/**
 * Motor de relatórios institucionais em layout ABNT (A4, margens 3-2-3-2 cm,
 * fonte serifada 12/10, sumário de dados, gráficos vetoriais e paginação
 * "Página X de Y" no canto superior direito).
 *
 * Não altera nenhum fluxo do sistema: recebe apenas dados já carregados na tela
 * e devolve o PDF pronto, com certificado de fé pública e log de download.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { loadMunicipioInfo } from "@/lib/pdf-institucional";
import { gerarCertificado, drawCertificadoRodape, registrarDownload } from "@/lib/fe-publica";
import { finalizarPdf } from "@/lib/pdf-pipeline";

/* ---------------------------------------------------------------- tipos */

export type AbntColuna<T> = {
  header: string;
  value: (r: T) => string | number | null | undefined;
  align?: "left" | "center" | "right";
  width?: number;
  /** Formatação aplicada apenas na renderização da célula. */
  formato?: "texto" | "moeda" | "percentual" | "numero";
};


export type AbntKpi = { label: string; valor: string | number };

export type AbntGrafico = {
  tipo: "barras" | "rosca";
  titulo: string;
  dados: Array<{ label: string; valor: number }>;
  /** Limita o número de itens plotados (o restante vira "Outros"). */
  limite?: number;
  /** Sufixo/unidade exibida ao lado do valor. */
  sufixo?: string;
};

export type AbntRelatorio<T> = {
  arquivo: string;
  titulo: string;
  subtitulo?: string;
  orientacao?: "portrait" | "landscape";
  filtros?: Array<{ label: string; valor: string }>;
  kpis?: AbntKpi[];
  graficos?: AbntGrafico[];
  colunas: AbntColuna<T>[];
  linhas: T[];
  /** Notas de rodapé/observações metodológicas. */
  notas?: string[];
  /** Linhas de assinatura ao final do relatório. */
  assinaturas?: string[];
  emitidoPor?: { nome: string; identificador: string };
};

/* --------------------------------------------------------------- paleta */

const PALETA: Array<[number, number, number]> = [
  [92, 64, 32],
  [176, 132, 74],
  [46, 105, 96],
  [96, 139, 168],
  [151, 106, 122],
  [122, 138, 84],
  [180, 160, 120],
  [110, 110, 122],
];
const TINTA = 32;
const TINTA_SUAVE = 96;

/* ------------------------------------------------------------ utilidades */

const M = { esq: 30, dir: 20, sup: 20, inf: 22 }; // mm — ABNT (3/2 cm laterais)

function nf(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function agrupar(dados: Array<{ label: string; valor: number }>, limite?: number) {
  const ordenado = [...dados]
    .filter((d) => Number.isFinite(d.valor) && d.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  if (!limite || ordenado.length <= limite) return ordenado;
  const topo = ordenado.slice(0, limite);
  const resto = ordenado.slice(limite).reduce((a, d) => a + d.valor, 0);
  if (resto > 0) topo.push({ label: "Outros", valor: resto });
  return topo;
}

/* ------------------------------------------------------------- desenho */

type Ctx = { doc: jsPDF; y: number; larg: number; alt: number };

function novaPagina(ctx: Ctx) {
  ctx.doc.addPage();
  ctx.y = M.sup + 8;
}

function garantir(ctx: Ctx, altura: number) {
  if (ctx.y + altura > ctx.alt - M.inf) novaPagina(ctx);
}

function tituloSecao(ctx: Ctx, texto: string) {
  garantir(ctx, 14);
  const { doc } = ctx;
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.setTextColor(TINTA);
  doc.text(texto.toUpperCase(), M.esq, ctx.y);
  doc.setDrawColor(...PALETA[0]);
  doc.setLineWidth(0.4);
  doc.line(M.esq, ctx.y + 1.6, ctx.larg - M.dir, ctx.y + 1.6);
  ctx.y += 8;
  doc.setTextColor(0);
}

/** Cabeçalho institucional (logo + identificação + título do relatório). */
function cabecalho(
  ctx: Ctx,
  info: Awaited<ReturnType<typeof loadMunicipioInfo>>,
  titulo: string,
  subtitulo?: string,
) {
  const { doc } = ctx;
  const nome = info.data?.nome_municipio
    ? `PREFEITURA MUNICIPAL DE ${info.data.nome_municipio.toUpperCase()}${info.data.uf ? ` — ${info.data.uf}` : ""}`
    : "PREFEITURA MUNICIPAL DE ORIXIMINÁ — PA";

  const centro = (M.esq + (ctx.larg - M.dir)) / 2;
  let y = M.sup;

  if (info.logoData) {
    try {
      doc.addImage(info.logoData, "PNG", M.esq, y - 4, 20, 20);
    } catch {
      /* logo indisponível — segue sem imagem */
    }
  }

  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.setTextColor(TINTA);
  doc.text(nome, centro, y + 1, { align: "center" });
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text("SECRETARIA MUNICIPAL DE SAÚDE", centro, y + 6, { align: "center" });
  doc.setFontSize(8.5);
  doc.setTextColor(TINTA_SUAVE);
  doc.text("Relatório Gerencial — Gestão Saúde", centro, y + 10.5, { align: "center" });

  y += 16;
  doc.setDrawColor(...PALETA[0]);
  doc.setLineWidth(0.6);
  doc.line(M.esq, y, ctx.larg - M.dir, y);

  y += 10;
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.setTextColor(TINTA);
  const tituloLinhas = doc.splitTextToSize(titulo.toUpperCase(), ctx.larg - M.esq - M.dir);
  doc.text(tituloLinhas, centro, y, { align: "center" });
  y += tituloLinhas.length * 6;

  if (subtitulo) {
    doc.setFont("times", "italic");
    doc.setFontSize(10);
    doc.setTextColor(TINTA_SUAVE);
    const sub = doc.splitTextToSize(subtitulo, ctx.larg - M.esq - M.dir);
    doc.text(sub, centro, y, { align: "center" });
    y += sub.length * 4.6;
  }

  doc.setTextColor(0);
  ctx.y = y + 6;
}

/** Ficha técnica: identificação da emissão e filtros aplicados. */
function fichaTecnica(
  ctx: Ctx,
  filtros: Array<{ label: string; valor: string }>,
  totalRegistros: number,
) {
  const { doc } = ctx;
  const larguraUtil = ctx.larg - M.esq - M.dir;
  const itens = [
    { label: "Emitido em", valor: new Date().toLocaleString("pt-BR") },
    { label: "Registros", valor: nf(totalRegistros) },
    ...filtros,
  ];
  const colunas = 2;
  const colLarg = larguraUtil / colunas;
  const linhas = Math.ceil(itens.length / colunas);
  const altura = linhas * 6 + 6;

  garantir(ctx, altura + 4);
  doc.setDrawColor(205);
  doc.setFillColor(249, 247, 244);
  doc.setLineWidth(0.2);
  doc.roundedRect(M.esq, ctx.y, larguraUtil, altura, 1.5, 1.5, "FD");

  itens.forEach((it, i) => {
    const col = i % colunas;
    const lin = Math.floor(i / colunas);
    const x = M.esq + 4 + col * colLarg;
    const y = ctx.y + 6 + lin * 6;
    doc.setFont("times", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(TINTA_SUAVE);
    const rotulo = `${it.label}: `;
    doc.text(rotulo, x, y);
    const dx = doc.getTextWidth(rotulo);
    doc.setFont("times", "normal");
    doc.setTextColor(TINTA);
    doc.text(
      doc.splitTextToSize(String(it.valor || "—"), colLarg - dx - 8)[0] ?? "—",
      x + dx,
      y,
    );
  });
  doc.setTextColor(0);
  ctx.y += altura + 8;
}

/** Cartões de indicadores, distribuídos sem sobreposição. */
function kpis(ctx: Ctx, lista: AbntKpi[]) {
  const { doc } = ctx;
  const larguraUtil = ctx.larg - M.esq - M.dir;
  const porLinha = lista.length <= 3 ? lista.length : lista.length === 4 ? 4 : 4;
  const gap = 4;
  const cardLarg = (larguraUtil - gap * (porLinha - 1)) / porLinha;
  const cardAlt = 17;

  for (let i = 0; i < lista.length; i += porLinha) {
    const fatia = lista.slice(i, i + porLinha);
    garantir(ctx, cardAlt + 4);
    fatia.forEach((k, j) => {
      const x = M.esq + j * (cardLarg + gap);
      doc.setDrawColor(214);
      doc.setFillColor(255, 255, 255);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, ctx.y, cardLarg, cardAlt, 1.5, 1.5, "FD");
      doc.setFillColor(...PALETA[j % PALETA.length]);
      doc.rect(x, ctx.y, 1.6, cardAlt, "F");

      doc.setFont("times", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(TINTA_SUAVE);
      const rot = doc.splitTextToSize(k.label, cardLarg - 8).slice(0, 2);
      doc.text(rot, x + 4, ctx.y + 5);

      doc.setFont("times", "bold");
      doc.setFontSize(13);
      doc.setTextColor(TINTA);
      const v = typeof k.valor === "number" ? nf(k.valor) : String(k.valor);
      doc.text(doc.splitTextToSize(v, cardLarg - 8)[0] ?? "—", x + 4, ctx.y + cardAlt - 4);
    });
    ctx.y += cardAlt + gap;
  }
  doc.setTextColor(0);
  ctx.y += 4;
}

/** Barras horizontais: rótulo à esquerda, valor reservado à direita (sem colisão). */
function grafBarras(ctx: Ctx, g: AbntGrafico) {
  const dados = agrupar(g.dados, g.limite ?? 10);
  if (!dados.length) return;
  const { doc } = ctx;
  const larguraUtil = ctx.larg - M.esq - M.dir;
  const linhaAlt = 7.2;
  const alturaTotal = dados.length * linhaAlt + 6;

  tituloSecao(ctx, g.titulo);
  garantir(ctx, alturaTotal);

  const rotuloLarg = Math.min(58, larguraUtil * 0.36);
  const valorLarg = 22;
  const trilhaX = M.esq + rotuloLarg + 3;
  const trilhaLarg = larguraUtil - rotuloLarg - 3 - valorLarg;
  const maxValor = Math.max(...dados.map((d) => d.valor));

  dados.forEach((d, i) => {
    const y = ctx.y + i * linhaAlt;
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.setTextColor(TINTA);
    const rot = doc.splitTextToSize(d.label, rotuloLarg)[0] ?? "—";
    doc.text(rot, M.esq, y + 3.6);

    doc.setFillColor(238, 236, 232);
    doc.rect(trilhaX, y, trilhaLarg, 4.8, "F");
    const larg = maxValor > 0 ? Math.max(0.6, (d.valor / maxValor) * trilhaLarg) : 0;
    doc.setFillColor(...PALETA[i % PALETA.length]);
    doc.rect(trilhaX, y, larg, 4.8, "F");

    doc.setFont("times", "bold");
    doc.setFontSize(8);
    doc.setTextColor(TINTA);
    doc.text(`${nf(d.valor)}${g.sufixo ?? ""}`, ctx.larg - M.dir, y + 3.6, { align: "right" });
  });

  doc.setTextColor(0);
  ctx.y += alturaTotal;
}

/** Rosca (donut) com legenda em coluna — proporções e percentuais. */
function grafRosca(ctx: Ctx, g: AbntGrafico) {
  const dados = agrupar(g.dados, g.limite ?? 6);
  if (!dados.length) return;
  const { doc } = ctx;
  const total = dados.reduce((a, d) => a + d.valor, 0);
  if (total <= 0) return;

  tituloSecao(ctx, g.titulo);
  const raio = 22;
  const alturaTotal = Math.max(raio * 2 + 6, dados.length * 6 + 6);
  garantir(ctx, alturaTotal);

  const cx = M.esq + raio + 4;
  const cy = ctx.y + raio;

  let inicio = -Math.PI / 2;
  dados.forEach((d, i) => {
    const ang = (d.valor / total) * Math.PI * 2;
    const passos = Math.max(6, Math.ceil((ang / (Math.PI * 2)) * 72));
    const pontos: Array<[number, number]> = [];
    let px = cx;
    let py = cy;
    for (let s = 0; s <= passos; s++) {
      const a = inicio + (ang * s) / passos;
      const nx = cx + Math.cos(a) * raio;
      const ny = cy + Math.sin(a) * raio;
      pontos.push([nx - px, ny - py]);
      px = nx;
      py = ny;
    }
    pontos.push([cx - px, cy - py]);
    doc.setFillColor(...PALETA[i % PALETA.length]);
    doc.lines(pontos, cx, cy, [1, 1], "F", true);
    inicio += ang;
  });

  // miolo branco → rosca
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, raio * 0.55, "F");
  doc.setFont("times", "bold");
  doc.setFontSize(9);
  doc.setTextColor(TINTA);
  doc.text(nf(total), cx, cy + 1, { align: "center" });
  doc.setFont("times", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(TINTA_SUAVE);
  doc.text("total", cx, cy + 5, { align: "center" });

  const legX = cx + raio + 8;
  const legLarg = ctx.larg - M.dir - legX;
  dados.forEach((d, i) => {
    const y = ctx.y + 3 + i * 6;
    doc.setFillColor(...PALETA[i % PALETA.length]);
    doc.rect(legX, y - 2.6, 3, 3, "F");
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.setTextColor(TINTA);
    const pct = ((d.valor / total) * 100).toFixed(1).replace(".", ",");
    const valorTxt = `${nf(d.valor)}${g.sufixo ?? ""} · ${pct}%`;
    const valorLarg = doc.getTextWidth(valorTxt) + 3;
    const rot = doc.splitTextToSize(d.label, Math.max(12, legLarg - valorLarg - 6))[0] ?? "—";
    doc.text(rot, legX + 5, y);
    doc.setFont("times", "bold");
    doc.text(valorTxt, ctx.larg - M.dir, y, { align: "right" });
  });

  doc.setTextColor(0);
  ctx.y += alturaTotal + 2;
}

/* --------------------------------------------------------------- público */

export async function gerarRelatorioAbnt<T>(opts: AbntRelatorio<T>): Promise<void> {
  const doc = new jsPDF({
    orientation: opts.orientacao ?? "portrait",
    unit: "mm",
    format: "a4",
  });
  const ctx: Ctx = {
    doc,
    y: M.sup,
    larg: doc.internal.pageSize.getWidth(),
    alt: doc.internal.pageSize.getHeight(),
  };

  const info = await loadMunicipioInfo();
  cabecalho(ctx, info, opts.titulo, opts.subtitulo);
  fichaTecnica(ctx, opts.filtros ?? [], opts.linhas.length);

  if (opts.kpis?.length) {
    tituloSecao(ctx, "1 Indicadores consolidados");
    kpis(ctx, opts.kpis);
  }

  const graficos = (opts.graficos ?? []).filter((g) => g.dados.some((d) => d.valor > 0));
  if (graficos.length) {
    for (const g of graficos) {
      if (g.tipo === "rosca") grafRosca(ctx, g);
      else grafBarras(ctx, g);
      ctx.y += 4;
    }
  }

  // Tabela analítica
  if (opts.linhas.length) {
    tituloSecao(ctx, `${graficos.length || opts.kpis?.length ? "3" : "1"} Quadro analítico`);
    autoTable(doc, {
      startY: ctx.y,
      head: [opts.colunas.map((c) => c.header)],
      body: opts.linhas.map((r) =>
        opts.colunas.map((c) => {
          const v = c.value(r);
          if (v == null || v === "") return "—";
          if (typeof v !== "number") return String(v);
          if (c.formato === "moeda")
            return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          if (c.formato === "percentual")
            return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
          return nf(v);
        }),
      ),

      styles: {
        font: "times",
        fontSize: 8,
        cellPadding: { top: 1.4, bottom: 1.4, left: 1.8, right: 1.8 },
        overflow: "linebreak",
        lineColor: [220, 216, 210],
        lineWidth: 0.1,
        textColor: TINTA,
        valign: "middle",
      },
      headStyles: {
        font: "times",
        fontStyle: "bold",
        fontSize: 8,
        fillColor: PALETA[0],
        textColor: 255,
        halign: "left",
      },
      alternateRowStyles: { fillColor: [250, 248, 245] },
      columnStyles: Object.fromEntries(
        opts.colunas.map((c, i) => [
          i,
          { halign: c.align ?? "left", ...(c.width ? { cellWidth: c.width } : {}) },
        ]),
      ),
      margin: { left: M.esq, right: M.dir, top: M.sup + 8, bottom: M.inf + 4 },
      tableWidth: "auto",
    });
    // @ts-expect-error lastAutoTable é injetado pelo plugin
    ctx.y = (doc.lastAutoTable?.finalY ?? ctx.y) + 8;
  }

  if (opts.notas?.length) {
    tituloSecao(ctx, "Notas");
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.setTextColor(TINTA_SUAVE);
    for (const n of opts.notas) {
      const linhas = doc.splitTextToSize(`— ${n}`, ctx.larg - M.esq - M.dir);
      garantir(ctx, linhas.length * 4 + 2);
      doc.text(linhas, M.esq, ctx.y);
      ctx.y += linhas.length * 4 + 1.5;
    }
    doc.setTextColor(0);
    ctx.y += 4;
  }

  if (opts.assinaturas?.length) {
    const larguraUtil = ctx.larg - M.esq - M.dir;
    const cols = Math.min(2, opts.assinaturas.length);
    const bloco = larguraUtil / cols;
    garantir(ctx, 24);
    ctx.y += 8;
    opts.assinaturas.forEach((a, i) => {
      const col = i % cols;
      const lin = Math.floor(i / cols);
      const x = M.esq + col * bloco;
      const y = ctx.y + lin * 16;
      doc.setDrawColor(140);
      doc.setLineWidth(0.3);
      doc.line(x + 8, y, x + bloco - 8, y);
      doc.setFont("times", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(TINTA);
      doc.text(a, x + bloco / 2, y + 4.5, { align: "center" });
    });
    ctx.y += Math.ceil(opts.assinaturas.length / cols) * 16;
    doc.setTextColor(0);
  }

  // Paginação ABNT: canto superior direito.
  const totalPaginas = doc.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.setTextColor(TINTA_SUAVE);
    doc.text(`Página ${p} de ${totalPaginas}`, ctx.larg - M.dir, 12, { align: "right" });
    if (p > 1) {
      doc.setFontSize(7.5);
      doc.text(opts.titulo, M.esq, 12);
      doc.setDrawColor(215);
      doc.setLineWidth(0.2);
      doc.line(M.esq, 14, ctx.larg - M.dir, 14);
    }
    doc.setTextColor(0);
  }

  // Fé pública: hash + QR + rastreio no rodapé de todas as páginas.
  const cert = await gerarCertificado({
    conteudo: { titulo: opts.titulo, filtros: opts.filtros, registros: opts.linhas.length },
    usuario: opts.emitidoPor ?? { nome: "Gestão Saúde", identificador: "—" },
  });
  drawCertificadoRodape(doc, cert);

  const nome = opts.arquivo.endsWith(".pdf") ? opts.arquivo : `${opts.arquivo}.pdf`;
  await finalizarPdf(doc, { filename: nome, tipo: "relatorio" });

  registrarDownload({
    relatorio: `gerencial.${opts.arquivo}`,
    formato: "pdf",
    filtros: Object.fromEntries((opts.filtros ?? []).map((f) => [f.label, f.valor])),
    hash: cert.hash,
    registros: opts.linhas.length,
  });
}
