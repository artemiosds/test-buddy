/**
 * Exportação em Word (.docx) do relatório "Geral Cargos".
 *
 * Mesmo conteúdo do PDF: cabeçalho institucional, escopo, indicadores, os dois
 * gráficos (Top 10 cargos e Efetivos x Prestadores), quadro analítico com
 * zebra stripes, parecer técnico gerencial e fechamento em duas colunas.
 */

import { loadMunicipioInfo } from "@/lib/pdf-institucional";
import { pngBarras, pngRosca } from "@/lib/geral-cargos-charts";
import type { GeralCargosDados, ModoGeralCargos } from "@/lib/geral-cargos";

export type DocxOpts = {
  modo: ModoGeralCargos;
  competencia: string;
  agrupamento: string;
  escopo: string;
  parecer: { titulo: string; paragrafos: string[]; rodape?: string } | null;
  assinatura: { nome: string; cargo: string; orgao: string };
  carimbo: { nome: string; cargo: string; decreto: string };
};

const CINZA = "CCCCCC";
const LARG_TOTAL = 9360;

export async function exportarGeralCargosDocx(
  dados: GeralCargosDados,
  opts: DocxOpts,
): Promise<void> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    ImageRun,
    AlignmentType,
    BorderStyle,
    WidthType,
    ShadingType,
    HeadingLevel,
  } = await import("docx");

  const info = await loadMunicipioInfo();
  const municipio = info.data?.nome_municipio ?? "Oriximiná";
  const uf = info.data?.uf ?? "PA";

  const topCargos = [...dados.cargos]
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map((c) => ({ label: c.nome, valor: c.total }));
  const barras = await pngBarras(topCargos);
  const rosca = await pngRosca([
    { label: "Efetivos", valor: dados.efetivosAtivos },
    { label: "Prestadores/Contratados", valor: dados.prestadoresAtivos },
  ]);

  const borda = { style: BorderStyle.SINGLE, size: 1, color: CINZA } as const;
  const bordas = { top: borda, bottom: borda, left: borda, right: borda };
  const cols = [3760, 1120, 1400, 1040, 1040, 1000];

  const celula = (
    texto: string,
    i: number,
    o: { bold?: boolean; right?: boolean; fill?: string } = {},
  ) =>
    new TableCell({
      borders: bordas,
      width: { size: cols[i]!, type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      ...(o.fill ? { shading: { fill: o.fill, type: ShadingType.CLEAR } } : {}),
      children: [
        new Paragraph({
          alignment: o.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children: [new TextRun({ text: texto, bold: o.bold ?? false, size: 18 })],
        }),
      ],
    });

  const cabecalhoTabela = ["Nome do cargo", "Efetivos", "Prestadores", "Ativos", "Disponível", "Total"];

  const linhas = [
    new TableRow({
      tableHeader: true,
      children: cabecalhoTabela.map((h, i) =>
        celula(h, i, { bold: true, fill: "E4E9EF", right: i > 0 }),
      ),
    }),
    ...dados.cargos.map((c, idx) => {
      const fill = idx % 2 === 1 ? "F6F7F9" : undefined;
      return new TableRow({
        children: [
          celula(c.nome, 0, { ...(fill ? { fill } : {}) }),
          celula(String(c.efetivos), 1, { right: true, ...(fill ? { fill } : {}) }),
          celula(String(c.prestadores), 2, { right: true, ...(fill ? { fill } : {}) }),
          celula(String(c.ativos), 3, { right: true, ...(fill ? { fill } : {}) }),
          celula(String(c.disponivel), 4, { right: true, ...(fill ? { fill } : {}) }),
          celula(String(c.total), 5, { right: true, ...(fill ? { fill } : {}) }),
        ],
      });
    }),
    new TableRow({
      children: [
        celula(`TOTAL (${dados.cargos.length})`, 0, { bold: true, fill: "E4E9EF" }),
        ...[
          dados.cargos.reduce((a, c) => a + c.efetivos, 0),
          dados.cargos.reduce((a, c) => a + c.prestadores, 0),
          dados.cargos.reduce((a, c) => a + c.ativos, 0),
          dados.cargos.reduce((a, c) => a + c.disponivel, 0),
          dados.cargos.reduce((a, c) => a + c.total, 0),
        ].map((v, i) => celula(String(v), i + 1, { bold: true, right: true, fill: "E4E9EF" })),
      ],
    }),
  ];

  /* ---------------- tabelas de afastamentos por unidade e por setor */
  const colsLocal = [3760, 1120, 1120, 3360];
  const celulaLocal = (
    texto: string,
    i: number,
    o: { bold?: boolean; right?: boolean; fill?: string } = {},
  ) =>
    new TableCell({
      borders: bordas,
      width: { size: colsLocal[i]!, type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      ...(o.fill ? { shading: { fill: o.fill, type: ShadingType.CLEAR } } : {}),
      children: [
        new Paragraph({
          alignment: o.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children: [new TextRun({ text: texto, bold: o.bold ?? false, size: 18 })],
        }),
      ],
    });

  const tabelaLocal = (colLocal: string, linhasLocal: GeralCargosDados["afastamentosPorUnidade"]) => {
    const total = linhasLocal.reduce((s, l) => s + l.qtd, 0);
    const pctL = (q: number) =>
      total > 0 ? `${((q / total) * 100).toFixed(1).replace(".", ",")}%` : "—";
    return new Table({
      width: { size: LARG_TOTAL, type: WidthType.DXA },
      columnWidths: colsLocal,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [colLocal, "Quantidade", "%", "Principais tipos"].map((h, i) =>
            celulaLocal(h, i, { bold: true, fill: "E4E9EF", right: i === 1 || i === 2 }),
          ),
        }),
        ...linhasLocal.map((l, idx) => {
          const fill = idx % 2 === 1 ? "F6F7F9" : undefined;
          return new TableRow({
            children: [
              celulaLocal(l.nome, 0, { ...(fill ? { fill } : {}) }),
              celulaLocal(String(l.qtd), 1, { right: true, ...(fill ? { fill } : {}) }),
              celulaLocal(pctL(l.qtd), 2, { right: true, ...(fill ? { fill } : {}) }),
              celulaLocal(l.tipos.join(" · ") || "—", 3, { ...(fill ? { fill } : {}) }),
            ],
          });
        }),
        new TableRow({
          children: [
            celulaLocal(`TOTAL (${linhasLocal.length})`, 0, { bold: true, fill: "E4E9EF" }),
            celulaLocal(String(total), 1, { bold: true, right: true, fill: "E4E9EF" }),
            celulaLocal("100,0%", 2, { bold: true, right: true, fill: "E4E9EF" }),
            celulaLocal("", 3, { fill: "E4E9EF" }),
          ],
        }),
      ],
    });
  };

  const kpis: Array<[string, number]> =
    opts.modo === "ativos"
      ? [
          ["Ativos (ativo + férias + licença prêmio)", dados.ativos],
          ["Disponível para escala", dados.disponivel],
          ["Efetivos", dados.efetivosAtivos],
          ["Prestadores/Contratados", dados.prestadoresAtivos],
        ]
      : [
          ["Total de cadastros", dados.total],
          ["Ativos (ativo + férias + licença prêmio)", dados.ativos],
          ["Disponível para escala", dados.disponivel],
          ["Efetivos", dados.efetivosAtivos],
          ["Prestadores/Contratados", dados.prestadoresAtivos],
        ];

  const p = (texto: string, o: { bold?: boolean; size?: number; center?: boolean; italic?: boolean } = {}) =>
    new Paragraph({
      ...(o.center ? { alignment: AlignmentType.CENTER } : {}),
      children: [
        new TextRun({
          text: texto,
          bold: o.bold ?? false,
          italics: o.italic ?? false,
          size: o.size ?? 22,
        }),
      ],
    });

  const fechamento = new Table({
    width: { size: LARG_TOTAL, type: WidthType.DXA },
    columnWidths: [4680, 4680],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 4680, type: WidthType.DXA },
            margins: { top: 200, bottom: 80, left: 120, right: 120 },
            children: [
              p("__________________________________", { center: true, size: 20 }),
              p(opts.carimbo.nome, { center: true, bold: true, size: 20 }),
              p(opts.carimbo.cargo, { center: true, size: 18 }),
              p(opts.carimbo.decreto, { center: true, size: 16 }),
            ],
          }),
          new TableCell({
            width: { size: 4680, type: WidthType.DXA },
            margins: { top: 200, bottom: 80, left: 120, right: 120 },
            children: [
              p("__________________________________", { center: true, size: 20 }),
              p(opts.assinatura.cargo, { center: true, bold: true, size: 20 }),
              p(opts.assinatura.orgao, { center: true, size: 18 }),
            ],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          p(`PREFEITURA MUNICIPAL DE ${municipio.toUpperCase()} — ${uf}`, {
            center: true,
            bold: true,
            size: 20,
          }),
          p("SECRETARIA MUNICIPAL DE SAÚDE", { center: true, bold: true, size: 20 }),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "Relatório Geral de Cargos", bold: true, size: 30 })],
          }),
          p(opts.escopo, { center: true, bold: true, size: 20 }),
          p(`Agrupamento: ${opts.agrupamento} · Competência: ${opts.competencia}`, {
            center: true,
            size: 18,
          }),
          new Paragraph({ text: "" }),

          p("1 Indicadores consolidados", { bold: true }),
          ...kpis.map(([label, valor]) => p(`• ${label}: ${valor.toLocaleString("pt-BR")}`, { size: 20 })),
          new Paragraph({ text: "" }),

          p("2 Cargos com maior quantitativo (Top 10)", { bold: true }),
          new Paragraph({
            children: [
              new ImageRun({
                type: "png",
                data: barras.png,
                transformation: { width: barras.largura, height: barras.altura },
                altText: {
                  title: "Top 10 cargos",
                  description: "Gráfico de barras dos dez cargos com maior quantitativo",
                  name: "top-cargos",
                },
              }),
            ],
          }),
          p("2.1 Efetivos x Prestadores de Serviço", { bold: true }),
          new Paragraph({
            children: [
              new ImageRun({
                type: "png",
                data: rosca.png,
                transformation: { width: rosca.largura, height: rosca.altura },
                altText: {
                  title: "Efetivos x Prestadores",
                  description: "Gráfico de rosca da composição por vínculo",
                  name: "vinculos",
                },
              }),
            ],
          }),
          new Paragraph({ text: "" }),

          p("3 Quadro analítico", { bold: true }),
          new Table({
            width: { size: LARG_TOTAL, type: WidthType.DXA },
            columnWidths: cols,
            rows: linhas,
          }),
          new Paragraph({ text: "" }),

          ...(dados.afastamentosPorUnidade.length
            ? [
                p("4 Afastamentos e ausências por unidade", { bold: true }),
                tabelaLocal("Unidade", dados.afastamentosPorUnidade),
                new Paragraph({ text: "" }),
              ]
            : []),
          ...(dados.afastamentosPorSetor.length
            ? [
                p("5 Afastamentos e ausências por setor", { bold: true }),
                tabelaLocal("Setor", dados.afastamentosPorSetor),
                p(
                  "Setor é agrupamento complementar e opcional; a linha “Sem setor informado” é apenas informativa.",
                  { size: 16, italic: true },
                ),
                new Paragraph({ text: "" }),
              ]
            : []),

          ...(opts.parecer
            ? [
                p(opts.parecer.titulo, { bold: true }),
                ...opts.parecer.paragrafos.map((t) => p(t, { size: 20 })),
                ...(opts.parecer.rodape ? [p(opts.parecer.rodape, { size: 16, italic: true })] : []),
                new Paragraph({ text: "" }),
              ]
            : []),

          fechamento,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `geral-cargos-${opts.modo}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
