/**
 * Gerador de PDF "Folha de Efetivos Aprovada" — réplica visual do padrão AGILIBlue.
 *
 * Objetivo: reproduzir o mais fielmente possível o documento oficial que a
 * Secretaria de Saúde emite hoje pelo sistema Ágili. Somente para folhas
 * com status = "aprovada".
 *
 * Formato: A4 paisagem, margens 10 mm.
 *
 * ⚠ PLACEHOLDERS (dependem de modelagem futura no banco):
 *   - Códigos hierárquicos das 4 barras coloridas ("1 - Raiz",
 *     "1.18 - SECRETARIA...", "1.18.00X - UNIDADE", "X - SETOR")
 *   - Rótulos "Raiz" e "SEMSA" fixos até termos secretarias.codigo
 *   - Nome do "Emitido por" usa nome_completo do usuario logado
 */
import jsPDF from "jspdf";
import { loadMunicipioInfo, type MunicipioInfo } from "@/lib/pdf-institucional";
import { resolverAssinaturasDocumento } from "@/lib/pdf-assinaturas";
import { finalizarPdf } from "@/lib/pdf-pipeline";
import { LOGO_BRASAO } from "@/lib/pdf-logos-base64";

export type ProfissionalFolha = {
  id: string;
  matricula: string | number | null;
  nome: string;
  cargo: string | null;
  setor: string | null;
  proj: number | string | null;
  h_p: number | string | null;
  c_h: number | string | null;
  jorn: number | string | null | undefined;
  situacao?: string | null;
};

export type LinhaTotais = {
  dias_trabalhados?: number | string;
  dias_falta?: number | string;
  atestado?: number | string;
  maternidade?: number | string;
  he_50?: number | string;
  he_100?: number | string;
  ferias_terco?: number | string;
  ferias_integral?: number | string;
  sal_sub_h?: number | string;
  adicional_noturno?: number | string;
  aulas_suplementares?: number | string;
  plantao?: number | string;
  sobreaviso?: number | string;
  incentivo?: number | string;
};

export type ItemFolha = {
  profissional: ProfissionalFolha;
  totais: LinhaTotais;
};

export type GrupoFolha = {
  /** ex: "2" (placeholder até termos codigo_hierarquico de setores) */
  codigo_setor: string;
  nome_setor: string;
  itens: ItemFolha[];
};

export type UnidadeFolha = {
  /** ex: "1.18.002" (placeholder) */
  codigo_unidade: string;
  nome_unidade: string;
  grupos: GrupoFolha[];
};

export type FolhaOficialInput = {
  competencia: { mes: number; ano: number };
  unidades: UnidadeFolha[];
  emitidoPor: string;
  secretariaId?: string | null;
  unidadeId?: string | null;
  frequenciaId?: string | null;
};


/* ------------------------- Cores ------------------------- */
// Extraídas do PDF de referência
const COR_NIVEL_1: [number, number, number] = [139, 106, 42]; // marrom escuro
const COR_NIVEL_2: [number, number, number] = [184, 147, 74]; // marrom médio
const COR_NIVEL_3: [number, number, number] = [212, 168, 83]; // mostarda
const COR_NIVEL_4: [number, number, number] = [232, 197, 120]; // mostarda clara
const COR_BORDA: [number, number, number] = [180, 180, 180];
const COR_TEXTO: [number, number, number] = [0, 0, 0];

/* -------------------- Layout de colunas -------------------- */
// Somam ~277 mm (largura útil A4 landscape com margens de 10 mm)
const COLS = [
  { key: "matricula", w: 18, label: "Matricula", align: "center" as const },
  { key: "nome", w: 55, label: "Nome", align: "left" as const },
  { key: "proj", w: 10, label: "Proj", align: "center" as const },
  { key: "hp", w: 9, label: "H.P", align: "center" as const },
  { key: "ch", w: 10, label: "C.H", align: "center" as const },
  { key: "jorn", w: 10, label: "Jorn", align: "center" as const },
  { key: "dias", w: 12, label: "DIAS", align: "center" as const, group: "tot" },
  { key: "falta", w: 12, label: "FALTA", align: "center" as const, group: "tot" },
  { key: "att", w: 10, label: "ATT", align: "center" as const, group: "tot" },
  { key: "mat", w: 10, label: "MAT", align: "center" as const, group: "tot" },
  { key: "he50", w: 11, label: "50%", align: "center" as const, group: "he" },
  { key: "he100", w: 11, label: "100%", align: "center" as const, group: "he" },
  { key: "terco", w: 10, label: "1/3", align: "center" as const, group: "fe" },
  { key: "integ", w: 11, label: "Integ.", align: "center" as const, group: "fe" },
  { key: "sal", w: 13, label: "SAL.\nSUB/H.", align: "center" as const, group: "var" },
  { key: "adic", w: 12, label: "ADIC\nNOT", align: "center" as const, group: "var" },
  { key: "aulas", w: 12, label: "AULAS\nSUPLE.", align: "center" as const, group: "var" },
  { key: "plantao", w: 13, label: "PLANTÃO", align: "center" as const, group: "var" },
  { key: "sobre", w: 12, label: "SOBRE\nAVISO", align: "center" as const, group: "var" },
  { key: "incent", w: 16, label: "INCENTIVO", align: "center" as const, group: "var" },
];

const MARGEM = 10;
const LINHA_ALTURA = 14; // altura da linha de profissional (2 sub-linhas)

/* -------------------- Helpers de desenho -------------------- */

function fmt(v: number | string | null | undefined): string {
  if (v == null || v === "") return "";
  if (typeof v === "string") return v;
  const x = Number(String(v).replace(",", "."));
  if (isNaN(x)) return String(v);
  if (x === 0) return "0";
  if (Number.isInteger(x)) return String(x);
  return x.toFixed(2).replace(".", ",");
}

function drawInstitutionalBox(
  doc: jsPDF,
  info: { data: MunicipioInfo | null; logoData: string | null },
  logoBrasao: string | null,
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const x = MARGEM;
  const y = 8;
  const w = pageWidth - MARGEM * 2;
  const h = 22;

  doc.setDrawColor(...COR_BORDA);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h);

  const logoSize = 18;
  const bx = x + 3; // Logo à esquerda

  if (logoBrasao) {
    try {
      doc.addImage(logoBrasao, "PNG", bx, y + 2, logoSize, logoSize);
    } catch { /* ignore */ }
  } else if (info.logoData) {
    try {
      doc.addImage(info.logoData, "PNG", bx, y + 2, logoSize, logoSize);
    } catch { /* ignore */ }
  }

  const uf = info.data?.uf ?? "PA";
  const nome = (info.data?.nome_municipio ?? "ORIXIMINÁ").toUpperCase();

  doc.setTextColor(...COR_TEXTO);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`ESTADO DO ${uf === "PA" ? "PARÁ" : uf}`, x + 24, y + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`PREFEITURA MUNICIPAL DE ${nome}`, x + 24, y + 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("SECRETARIA MUNICIPAL DE SAÚDE", x + 24, y + 16);
}

function drawHierBar(
  doc: jsPDF,
  y: number,
  color: [number, number, number],
  text: string,
  textColor: [number, number, number] = [255, 255, 255],
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const w = pageWidth - MARGEM * 2;
  const h = 4.6;
  doc.setFillColor(...color);
  doc.rect(MARGEM, y, w, h, "F");
  doc.setDrawColor(...COR_BORDA);
  doc.setLineWidth(0.2);
  doc.rect(MARGEM, y, w, h);
  doc.setTextColor(...textColor);
  doc.setFont("courier", "bold");
  doc.setFontSize(8.5);
  doc.text(text, MARGEM + 2, y + 3.3);
  return y + h;
}


/* -------------------- Cabeçalho da tabela -------------------- */

function drawTableHeader(doc: jsPDF, y: number): number {
  const startX = MARGEM;
  const rowH1 = 5; // banda "Totalizadores / Hora extra / Férias / Variáveis"
  const rowH2 = 8; // labels das colunas (2 linhas)

  doc.setDrawColor(...COR_BORDA);
  doc.setLineWidth(0.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COR_TEXTO);

  // Banda superior: só desenha borda inferior por baixo da tabela; os grupos
  // ocupam apenas as colunas "tot", "he", "fe", "var". As primeiras 6 colunas
  // ficam vazias na banda superior.
  const groupSpans: Record<string, { start: number; end: number; label: string }> = {
    tot: { start: Infinity, end: -Infinity, label: "Totalizadores" },
    he: { start: Infinity, end: -Infinity, label: "Hora extra" },
    fe: { start: Infinity, end: -Infinity, label: "Férias" },
    var: { start: Infinity, end: -Infinity, label: "Variáveis" },
  };
  let xCursor = startX;
  const colX: number[] = [];
  for (const c of COLS) {
    colX.push(xCursor);
    if (c.group) {
      const g = groupSpans[c.group];
      g.start = Math.min(g.start, xCursor);
      g.end = Math.max(g.end, xCursor + c.w);
    }
    xCursor += c.w;
  }
  const totalWidth = xCursor - startX;

  // Desenha rótulos de grupo (sem preenchimento, só texto centralizado)
  for (const key of Object.keys(groupSpans)) {
    const g = groupSpans[key];
    doc.text(g.label, (g.start + g.end) / 2, y + 3.5, { align: "center" });
  }

  // Linha horizontal separando banda de grupo dos labels
  doc.line(startX, y + rowH1, startX + totalWidth, y + rowH1);

  // Labels das colunas (segunda linha), com bordas verticais
  const y2 = y + rowH1;
  doc.setFontSize(7);
  for (let i = 0; i < COLS.length; i++) {
    const c = COLS[i];
    const x = colX[i];
    doc.rect(x, y2, c.w, rowH2);
    // texto pode ter \n
    const lines = c.label.split("\n");
    const total = lines.length;
    for (let li = 0; li < total; li++) {
      const ly = y2 + 3 + li * 3;
      doc.text(lines[li], x + c.w / 2, ly, { align: "center" });
    }
  }

  // Borda superior da banda de grupo (para dar o retângulo fechado nos grupos)
  for (const key of Object.keys(groupSpans)) {
    const g = groupSpans[key];
    doc.line(g.start, y, g.end, y);
    doc.line(g.start, y, g.start, y + rowH1);
    doc.line(g.end, y, g.end, y + rowH1);
  }

  return y2 + rowH2;
}

/* -------------------- Linha do profissional -------------------- */

function drawProfissionalRow(doc: jsPDF, y: number, item: ItemFolha): number {
  const startX = MARGEM;
  let xCursor = startX;
  const h = LINHA_ALTURA;
  const halfH = h / 2;

  doc.setDrawColor(...COR_BORDA);
  doc.setLineWidth(0.2);
  doc.setTextColor(...COR_TEXTO);

  const t = item.totais;
  const situacao = item.profissional.situacao;
  const values: Record<string, string> = {
    proj: fmt(item.profissional.proj),
    hp: fmt(item.profissional.h_p),
    ch: fmt(item.profissional.c_h),
    jorn: fmt(item.profissional.jorn),
    dias: situacao && situacao !== "Ativo" ? situacao : fmt(t.dias_trabalhados),
    falta: situacao && situacao !== "Ativo" ? situacao : fmt(t.dias_falta),
    att: situacao && situacao !== "Ativo" ? situacao : fmt(t.atestado),
    mat: situacao && situacao !== "Ativo" ? situacao : fmt(t.maternidade),
    he50: situacao && situacao !== "Ativo" ? situacao : fmt(t.he_50),
    he100: situacao && situacao !== "Ativo" ? situacao : fmt(t.he_100),
    terco: situacao && situacao !== "Ativo" ? situacao : (t.ferias_terco ? "X" : ""),
    integ: situacao && situacao !== "Ativo" ? situacao : fmt(t.ferias_integral),
    sal: situacao && situacao !== "Ativo" ? situacao : fmt(t.sal_sub_h),
    adic: situacao && situacao !== "Ativo" ? situacao : fmt(t.adicional_noturno),
    aulas: situacao && situacao !== "Ativo" ? situacao : fmt(t.aulas_suplementares),
    plantao: situacao && situacao !== "Ativo" ? situacao : fmt(t.plantao),
    sobre: situacao && situacao !== "Ativo" ? situacao : fmt(t.sobreaviso),
    incent: situacao && situacao !== "Ativo" ? situacao : fmt(t.incentivo),
  };

  for (const c of COLS) {
    doc.rect(xCursor, y, c.w, h);
    if (c.key === "matricula") {
      // linha horizontal do meio (divide matricula/cargo-label)
      doc.line(xCursor, y + halfH, xCursor + c.w, y + halfH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(String(item.profissional.matricula ?? ""), xCursor + c.w / 2, y + halfH - 1.5, {
        align: "center",
      });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text("Cargo", xCursor + 1, y + halfH + 4);
    } else if (c.key === "nome") {
      doc.line(xCursor, y + halfH, xCursor + c.w, y + halfH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      const nome = item.profissional.nome ?? "";
      const nomeLinhas = doc.splitTextToSize(nome, c.w - 2) as string[];
      const nomeShow =
        nomeLinhas.length > 1 ? nomeLinhas[0].trimEnd() + "…" : (nomeLinhas[0] ?? "");
      doc.text(nomeShow, xCursor + c.w / 2, y + halfH - 1.5, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      const cargo = item.profissional.cargo ?? "";
      const cargoLinhas = doc.splitTextToSize(cargo, c.w - 2) as string[];
      const cargoShow =
        cargoLinhas.length > 1 ? cargoLinhas[0].trimEnd() + "…" : (cargoLinhas[0] ?? "");
      doc.text(cargoShow, xCursor + c.w / 2, y + halfH + 4, { align: "center" });
    } else {
      // valor numérico centralizado verticalmente na célula
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const val = values[c.key] ?? "";
      if (val) {
        // Se for um texto longo (como status de situação), reduzimos a fonte e permitimos quebra básica se necessário
        const isStatus = val.length > 5 && situacao && situacao !== "Ativo" && val === situacao;
        if (isStatus) doc.setFontSize(6);
        doc.text(val, xCursor + c.w / 2, y + h / 2 + 1, { align: "center", maxWidth: c.w - 1 });
        if (isStatus) doc.setFontSize(8);
      }
    }
    xCursor += c.w;
  }
  return y + h;
}

/* -------------------- Entry point -------------------- */

export async function gerarFolhaEfetivosOficial(input: FolhaOficialInput): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const info = await loadMunicipioInfo();
  
  const logoBrasaoAlt = LOGO_BRASAO;

  const assinaturas = await resolverAssinaturasDocumento("folha_efetivos", {
    secretariaId: input.secretariaId ?? null,
    unidadeId: input.unidadeId ?? null,
    frequenciaId: input.frequenciaId ?? null,
  });


  const pageHeight = doc.internal.pageSize.getHeight();
  const rodapeReserva = 18;
  const limiteBaixo = pageHeight - rodapeReserva;

  const emissaoStr = new Date().toLocaleString("pt-BR");

  const desenhaTopo = (): number => {
    drawInstitutionalBox(doc, info, logoBrasaoAlt);
    return 32;
  };

  const primeiraPagina = (unidade: UnidadeFolha, grupo: GrupoFolha) => {
    let y = desenhaTopo();
    // 4 barras hierárquicas — ⚠ placeholders para os códigos
    y = drawHierBar(doc, y, COR_NIVEL_1, "1 - Raiz");
    y = drawHierBar(doc, y, COR_NIVEL_2, "1.18 - SECRETARIA MUNICIPAL DE SAUDE");
    y = drawHierBar(
      doc,
      y,
      COR_NIVEL_3,
      `${unidade.codigo_unidade} - ${unidade.nome_unidade.toUpperCase()}`,
    );
    y = drawHierBar(
      doc,
      y,
      COR_NIVEL_4,
      `${grupo.codigo_setor} - ${grupo.nome_setor.toUpperCase()}`,
    );
    // linha "Qtd funcionários"
    y += 1.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COR_TEXTO);
    doc.text(`Qtd funcionários: ${grupo.itens.length}`, MARGEM, y + 3);
    y += 5;
    y = drawTableHeader(doc, y);
    return y;
  };

  let firstPage = true;

  for (const unidade of input.unidades) {
    for (const grupo of unidade.grupos) {
      if (!firstPage) doc.addPage();
      firstPage = false;
      let y = primeiraPagina(unidade, grupo);

      for (const item of grupo.itens) {
        if (y + LINHA_ALTURA > limiteBaixo) {
          doc.addPage();
          y = desenhaTopo();
          y = drawHierBar(doc, y, COR_NIVEL_1, "1 - Raiz");
          y = drawHierBar(doc, y, COR_NIVEL_2, "1.18 - SECRETARIA MUNICIPAL DE SAUDE");
          y = drawHierBar(
            doc,
            y,
            COR_NIVEL_3,
            `${unidade.codigo_unidade} - ${unidade.nome_unidade.toUpperCase()}`,
          );
          y = drawHierBar(
            doc,
            y,
            COR_NIVEL_4,
            `${grupo.codigo_setor} - ${grupo.nome_setor.toUpperCase()} (cont.)`,
          );
          y += 1.5;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.text(`Qtd funcionários: ${grupo.itens.length}`, MARGEM, y + 3);
          y += 5;
          y = drawTableHeader(doc, y);
        }
        y = drawProfissionalRow(doc, y, item);
      }
    }
  }

  drawFooter(doc, input.emitidoPor, emissaoStr);

  const compStr = `${String(input.competencia.mes).padStart(2, "0")}-${input.competencia.ano}`;
  await finalizarPdf(doc, {
    filename: `folha-efetivos-oficial-${compStr}.pdf`,
    tipo: "folha_efetivos",
    unidadeId: input.unidadeId ?? null,
    secretariaId: input.secretariaId ?? null,
    assinaturas,
    yPadraoMm: pageHeight - 60,
    xPadraoMm: MARGEM,
    competencia: input.competencia, // Passa a competência para o metadado
  });

}
