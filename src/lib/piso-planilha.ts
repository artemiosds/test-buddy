import * as XLSXNamespace from "xlsx-js-style";
import type * as XLSX from "xlsx-js-style";

/**
 * xlsx-js-style é CommonJS: em SSR o namespace pode vir empacotado em `.default`,
 * deixando `XL.utils` indefinido. Normalizamos o acesso aqui.
 */
const XL = ((XLSXNamespace as unknown as { default?: typeof XLSXNamespace }).default ??
  XLSXNamespace) as typeof XLSXNamespace;

/**
 * Gerador das planilhas oficiais do Piso Nacional da Enfermagem.
 *
 * Princípio: a planilha é RECONSTRUÍDA com fórmulas relativas (não valores
 * congelados), de modo que a Secretaria possa conferir e ajustar diretamente
 * no Excel. O número de linhas se estende automaticamente conforme a
 * quantidade de profissionais da competência.
 */

export type LinhaPlanilha = {
  nome: string;
  cpf: string | null;
  lotacao: string | null;
  cargo: string | null;
  categoria: string | null;
  dias: number | null;
  salario_base: number | null;
  insalubridade: number | null;
  hora_extra: number | null;
  adicional_noturno: number | null;
  plantao_sobreaviso: number | null;
  pensao_alimenticia: number | null;
  incentivo: number | null;
  /* Campos usados no modelo FOPAG (efetivos) */
  matricula?: string | null;
  vinculo?: string | null;
  carga_horaria?: number | null;
  tempo_servico?: number | null;
  gratificacoes?: number | null;
  valor_referencia?: number | null;
  complementacao?: number | null;
  inss?: number | null;
  irrf?: number | null;
  vale_transporte?: number | null;
  /* Rubricas detalhadas (modelo CALCULO PISO ENFERMAGEM) */
  hora_extra_50?: number | null;
  hora_extra_100?: number | null;
  plantao?: number | null;
  sobreaviso?: number | null;
  /* Campos do layout oficial "piso-enfermagem" (envio ao Ministério) */
  cnes?: string | null;
  cbo?: string | null;
  encargo_patronal?: number | null;
  encargo_trabalhista?: number | null;
  vantagem_fixa?: number | null;
  vantagem_variavel?: number | null;
  /** Campos específicos preservados do modelo SAÚDE — UBS. */
  gratificacao_incentivo?: number | null;
  auxilio_transporte?: number | null;
  total_liquido_base?: number | null;
  valor_final?: number | null;
};

/** Incentivo (auxílio) parametrizável por categoria. */
export type MapaIncentivos = Partial<Record<string, number>>;

export const INCENTIVOS_PADRAO: MapaIncentivos = {
  ENFERMEIRO: 2068.79,
  TECNICO_ENFERMAGEM: 0,
  AUXILIAR_ENFERMAGEM: 0,
};

const MOEDA = "#,##0.00";
/** Formato monetário idêntico ao modelo oficial (contabilidade em R$). */
const MOEDA_BR = '_-"R$"\\ * #,##0.00_-;\\-"R$"\\ * #,##0.00_-;_-"R$"\\ * "-"??_-;_-@_-';
/** Fonte do modelo oficial impresso pela SMS. */
const FONTE_OFICIAL = { name: "Arial", sz: 12 };

const num = (v: number | null | undefined) => (v === null || v === undefined ? 0 : Number(v) || 0);

type Cell = XLSX.CellObject & { s?: Record<string, unknown> };

const BORDA_FINA = { style: "thin", color: { rgb: "FFB7C4D6" } };
const BORDAS = { top: BORDA_FINA, left: BORDA_FINA, bottom: BORDA_FINA, right: BORDA_FINA };

const ESTILO_CABECALHO = {
  font: { bold: true, color: { rgb: "FFFFFFFF" }, sz: 11 },
  fill: { patternType: "solid", fgColor: { rgb: "FF4F81BD" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: BORDAS,
};

const ESTILO_TOTAIS = {
  font: { bold: true },
  fill: { patternType: "solid", fgColor: { rgb: "FFD9E1F2" } },
  border: BORDAS,
};

const money = (v: number | null | undefined): Cell => ({ t: "n", v: num(v), z: MOEDA });
const formula = (f: string): Cell => ({ t: "n", f, z: MOEDA });
const texto = (v: string | null | undefined): Cell => ({ t: "s", v: v ?? "" });
const inteiro = (v: number | null | undefined): Cell => ({ t: "n", v: num(v) });

function montarSheet(
  matriz: Cell[][],
  larguras: number[],
  comTotais = false,
  opts: { fonte?: { name: string; sz: number }; cabecalhoSimples?: boolean } = {},
) {
  const ws: XLSX.WorkSheet = {};
  const range = { s: { r: 0, c: 0 }, e: { r: matriz.length - 1, c: larguras.length - 1 } };
  const ultima = matriz.length - 1;
  const fonte = opts.fonte;
  const cabecalho = opts.cabecalhoSimples
    ? {
        font: { bold: true, ...(fonte ?? {}) },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: BORDAS,
      }
    : ESTILO_CABECALHO;
  matriz.forEach((linha, r) => {
    linha.forEach((cell, c) => {
      if (!cell) return;
      const base =
        r === 0
          ? cabecalho
          : comTotais && r === ultima
            ? ESTILO_TOTAIS
            : { border: BORDAS, alignment: { vertical: "center" } };
      const estilo =
        fonte && r > 0
          ? { ...base, font: { ...(base as { font?: object }).font, ...fonte } }
          : base;
      ws[XL.utils.encode_cell({ r, c })] = { ...cell, s: { ...estilo, ...(cell.s ?? {}) } };
    });
  });
  ws["!ref"] = XL.utils.encode_range(range);
  ws["!cols"] = larguras.map((w) => ({ wch: w }));
  ws["!rows"] = matriz.map((_, r) => ({ hpt: r === 0 ? 26 : 18 }));
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  ws["!autofilter"] = {
    ref: XL.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: comTotais ? Math.max(0, ultima - 1) : ultima, c: larguras.length - 1 },
    }),
  };
  return ws;
}

function escrever(wb: XLSX.WorkBook) {
  return XL.write(wb, { type: "base64", bookType: "xlsx" }) as string;
}

// ---------------------------------------------------------------------------
// Modelo CONTRATADOS — abas oficiais por lotação:
//   • "H.M.S.D.S. (3)" → 16 colunas (A..P), com PENSÃO ALIMENTICIA
//   • "H.M.O (3)"      → 14 colunas (A..N), sem PENSÃO e sem coluna TOTAL (K-L)
// ---------------------------------------------------------------------------

export const CABECALHO_CONTRATADOS = [
  "NOME",
  "C.P.F.",
  "LOTAÇÃO",
  "CARGO",
  "DIAS",
  "BASE",
  "INSALUBRIDADE",
  "H.E.",
  "AD.NOTURNO",
  "PLANTÃO E SOBREAVISO",
  "BRUTO",
  "ISS",
  "TOTAL",
  "PENSÃO ALIMENTICIA",
  "INCENTIVO",
  "TOTAL",
];

/** Cabeçalho do modelo H.M.O — mantém a grafia do arquivo oficial. */
export const CABECALHO_HMO = [
  "NOME",
  "C.P.F.",
  "LOTAÇÃO",
  "CARGO",
  "DIAS",
  "BASE",
  "INSALUBIRADE",
  "H.E.",
  "AD.NOTURNO",
  "PLANTO E SOBREAVISO",
  "BRUTO",
  "ISS",
  "INCENTIVO",
  "TOTAL",
];

const LARGURA_CONTRATADOS = [38, 16, 26, 26, 7, 14, 15, 12, 13, 20, 14, 12, 14, 18, 14, 14];
const LARGURA_HMO = [38, 16, 26, 26, 7, 14, 15, 12, 13, 20, 14, 12, 14, 14];

/** Identifica se a lotação pertence ao Hospital Municipal de Oriximiná (H.M.O). */
export function ehLotacaoHMO(lotacao: string | null | undefined): boolean {
  const n = (lotacao ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (/H\W*M\W*S\W*D\W*S/.test(n)) return false;
  return /\bH\W*M\W*O\b/.test(n) || /HOSPITAL MUNICIPAL DE ORIXIMINA/.test(n);
}

const moneyBr = (v: number | null | undefined): Cell => ({ t: "n", v: num(v), z: MOEDA_BR });
const formulaBr = (f: string): Cell => ({ t: "n", f, z: MOEDA_BR });

type OpcoesContratados = {
  competencia?: string | null;
  incentivos?: MapaIncentivos;
  percentualInsalubridade?: number;
  percentualIss?: number;
  /** Os modelos oficiais não possuem linha de totais; ative apenas para conferência interna. */
  comTotais?: boolean;
};

function valorIncentivo(p: LinhaPlanilha, incentivos: MapaIncentivos): number {
  return p.incentivo !== null && p.incentivo !== undefined
    ? Number(p.incentivo)
    : num(incentivos[p.categoria ?? ""]);
}

/**
 * INSALUBRIDADE é sempre o valor fixo vindo da folha importada.
 * A fórmula sobre a base só é usada como fallback quando não há valor.
 */
function celulaInsalubridade(p: LinhaPlanilha, r: number, pInsal: number): Cell {
  return p.insalubridade !== null && p.insalubridade !== undefined
    ? moneyBr(p.insalubridade)
    : formulaBr(`F${r}*${pInsal * 100}%`);
}

function abaHMSDS(linhas: LinhaPlanilha[], opts: OpcoesContratados) {
  const incentivos = { ...INCENTIVOS_PADRAO, ...(opts.incentivos ?? {}) };
  const pInsal = opts.percentualInsalubridade ?? 0.2;
  const pIss = opts.percentualIss ?? 0.05;
  const comTotais = opts.comTotais === true && linhas.length > 0;
  const matriz: Cell[][] = [CABECALHO_CONTRATADOS.map((h) => texto(h))];

  linhas.forEach((p, i) => {
    const r = i + 2; // linha 1 = cabeçalho
    matriz.push([
      texto(p.nome),
      texto(p.cpf),
      texto(p.lotacao ?? "HMSDS"),
      texto(p.cargo),
      inteiro(p.dias ?? 30),
      moneyBr(p.salario_base),
      celulaInsalubridade(p, r, pInsal),
      moneyBr(p.hora_extra),
      moneyBr(p.adicional_noturno),
      moneyBr(p.plantao_sobreaviso),
      formulaBr(`F${r}+G${r}+H${r}+I${r}+J${r}`), // BRUTO
      formulaBr(`K${r}*${pIss * 100}%`), // ISS
      formulaBr(`K${r}-L${r}`), // TOTAL
      moneyBr(p.pensao_alimenticia),
      moneyBr(valorIncentivo(p, incentivos)),
      formulaBr(`SUM(H${r},J${r},O${r})`), // TOTAL final (H.E. + plantão/sobreaviso + incentivo)
    ]);
  });

  if (comTotais) {
    const ultima = linhas.length + 1;
    const totais: Cell[] = [texto("TOTAL GERAL"), texto(""), texto(""), texto(""), texto("")];
    for (const col of ["F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"]) {
      totais.push(formulaBr(`SUM(${col}2:${col}${ultima})`));
    }
    matriz.push(totais);
  }

  return montarSheet(matriz, LARGURA_CONTRATADOS, comTotais, {
    fonte: FONTE_OFICIAL,
    cabecalhoSimples: true,
  });
}

function abaHMO(linhas: LinhaPlanilha[], opts: OpcoesContratados) {
  const incentivos = { ...INCENTIVOS_PADRAO, ...(opts.incentivos ?? {}) };
  const pInsal = opts.percentualInsalubridade ?? 0.2;
  const pIss = opts.percentualIss ?? 0.05;
  const comTotais = opts.comTotais === true && linhas.length > 0;
  const matriz: Cell[][] = [CABECALHO_HMO.map((h) => texto(h))];

  linhas.forEach((p, i) => {
    const r = i + 2;
    matriz.push([
      texto(p.nome),
      texto(p.cpf),
      texto(p.lotacao ?? "H.M.O"),
      texto(p.cargo),
      inteiro(p.dias ?? 30),
      moneyBr(p.salario_base),
      celulaInsalubridade(p, r, pInsal),
      moneyBr(p.hora_extra),
      moneyBr(p.adicional_noturno),
      moneyBr(p.plantao_sobreaviso),
      formulaBr(`F${r}+G${r}+H${r}+I${r}+J${r}`), // BRUTO
      formulaBr(`K${r}*${pIss * 100}%`), // ISS
      moneyBr(valorIncentivo(p, incentivos)), // INCENTIVO
      formulaBr(`SUM(H${r},J${r},M${r})`), // TOTAL final (H.E. + plantão/sobreaviso + incentivo)
    ]);
  });

  if (comTotais) {
    const ultima = linhas.length + 1;
    const totais: Cell[] = [texto("TOTAL GERAL"), texto(""), texto(""), texto(""), texto("")];
    for (const col of ["F", "G", "H", "I", "J", "K", "L", "M", "N"]) {
      totais.push(formulaBr(`SUM(${col}2:${col}${ultima})`));
    }
    matriz.push(totais);
  }

  return montarSheet(matriz, LARGURA_HMO, comTotais, {
    fonte: FONTE_OFICIAL,
    cabecalhoSimples: true,
  });
}

/**
 * Gera o arquivo dos contratados separando automaticamente as lotações:
 * a aba "H.M.O (3)" é criada quando existem profissionais lotados no H.M.O.
 */
export function gerarPlanilhaContratados(
  linhas: LinhaPlanilha[],
  opts: OpcoesContratados = {},
) {
  const hmo = linhas.filter((p) => ehLotacaoHMO(p.lotacao));
  const hmsds = linhas.filter((p) => !ehLotacaoHMO(p.lotacao));

  const wb = XL.utils.book_new();
  if (hmsds.length > 0 || hmo.length === 0) {
    XL.utils.book_append_sheet(wb, abaHMSDS(hmsds, opts), "H.M.S.D.S. (3)");
  }
  if (hmo.length > 0) {
    XL.utils.book_append_sheet(wb, abaHMO(hmo, opts), "H.M.O (3)");
  }
  if (opts.competencia) wb.Props = { Title: `Contratados ${opts.competencia}` };
  return escrever(wb);
}



// ---------------------------------------------------------------------------
// Modelo EFETIVOS — padrão FOPAG
// ---------------------------------------------------------------------------

export const CABECALHO_EFETIVOS = [
  "NOME",
  "C.P.F.",
  "MATRÍCULA",
  "LOTAÇÃO",
  "CARGO",
  "VÍNCULO",
  "C.H.",
  "DIAS",
  "SALÁRIO BASE",
  "INSALUBRIDADE",
  "TEMPO DE SERVIÇO",
  "GRATIFICAÇÕES",
  "H.E.",
  "AD.NOTURNO",
  "PLANTÃO E SOBREAVISO",
  "TOTAL PROVENTOS",
  "PISO DE REFERÊNCIA",
  "COMPLEMENTAÇÃO",
  "INSS",
  "IRRF",
  "VALE TRANSPORTE",
  "PENSÃO ALIMENTICIA",
  "TOTAL DESCONTOS",
  "LÍQUIDO",
];

const LARGURA_EFETIVOS = [
  38, 16, 14, 26, 26, 16, 7, 7, 14, 15, 16, 15, 12, 13, 20, 16, 17, 16, 12, 12, 15, 18, 16, 14,
];

export function gerarPlanilhaEfetivos(
  linhas: LinhaPlanilha[],
  opts: { competencia?: string | null; percentualInsalubridade?: number } = {},
) {
  const pInsal = opts.percentualInsalubridade ?? 0.2;
  const matriz: Cell[][] = [CABECALHO_EFETIVOS.map((h) => texto(h))];

  linhas.forEach((p, i) => {
    const r = i + 2;
    matriz.push([
      texto(p.nome),
      texto(p.cpf),
      texto(p.matricula ?? ""),
      texto(p.lotacao),
      texto(p.cargo),
      texto(p.vinculo ?? ""),
      inteiro(p.carga_horaria ?? 0),
      inteiro(p.dias ?? 30),
      money(p.salario_base),
      p.insalubridade !== null && p.insalubridade !== undefined
        ? money(p.insalubridade)
        : formula(`I${r}*${pInsal}`),
      money(p.tempo_servico),
      money(p.gratificacoes),
      money(p.hora_extra),
      money(p.adicional_noturno),
      money(p.plantao_sobreaviso),
      formula(`SUM(I${r}:O${r})`), // TOTAL PROVENTOS
      money(p.valor_referencia),
      // COMPLEMENTAÇÃO = piso de referência - (base + insalubridade), nunca negativo
      formula(`MAX(0,Q${r}-(I${r}+J${r}))`),
      money(p.inss),
      money(p.irrf),
      money(p.vale_transporte),
      money(p.pensao_alimenticia),
      formula(`SUM(S${r}:V${r})`), // TOTAL DESCONTOS
      formula(`P${r}+R${r}-W${r}`), // LÍQUIDO
    ]);
  });

  const primeira = 2;
  const ultima = linhas.length + 1;
  if (linhas.length > 0) {
    const totais: Cell[] = [
      texto("TOTAL GERAL"),
      texto(""),
      texto(""),
      texto(""),
      texto(""),
      texto(""),
      texto(""),
      texto(""),
    ];
    for (const col of [
      "I",
      "J",
      "K",
      "L",
      "M",
      "N",
      "O",
      "P",
      "Q",
      "R",
      "S",
      "T",
      "U",
      "V",
      "W",
      "X",
    ]) {
      totais.push(formula(`SUM(${col}${primeira}:${col}${ultima})`));
    }
    matriz.push(totais);
  }

  const ws = montarSheet(matriz, LARGURA_EFETIVOS, linhas.length > 0);
  const wb = XL.utils.book_new();
  XL.utils.book_append_sheet(wb, ws, "FOPAG");
  if (opts.competencia) wb.Props = { Title: `Efetivos ${opts.competencia}` };
  return escrever(wb);
}

// ---------------------------------------------------------------------------
// Modelo CALCULO PISO ENFERMAGEM (arquivo oficial "CALCULO_PISO_FOPAG")
//   • A1:U2 → título mesclado; A3 (faixa "Funcionario"); linha 4 = cabeçalho
//   • Q = SUM(B:P) por linha  |  T = SUM(R:S) por linha
//   • Última linha "TOTAL" com SUM das colunas Q, T e U
// ---------------------------------------------------------------------------

export const CABECALHO_CALCULO_PISO = [
  "CPF",
  "AUX. FINANC.",
  "TEMPO DE SERV.",
  "INSALUBRIDADE",
  "1/3 FÉRIAS",
  "FÉRIAS NORMAS",
  "HR. EX. 50%",
  "HR. EX.100%",
  "PLANTÃO",
  "SOBREAVISOS",
  "VALE TRANSP.",
  "GRAT. FUN VR",
  "GRAT. FUN %VB",
  "GRAT. NIVEL SUP.",
  "INCENTIVOS",
  "AUX. FIN. PISO",
  "TOTAL  POSITIVOS",
  "INSS",
  "IRRF",
  "TOTAL DESCONTO",
  "ADN",
];

const LARGURA_CALCULO_PISO = [
  18, 14, 15, 15, 12, 14, 12, 12, 12, 13, 13, 13, 14, 16, 13, 14, 16, 12, 12, 15, 12,
];

/** Célula monetária que fica em branco quando não há valor (como no modelo). */
const moedaOuVazio = (v: number | null | undefined): Cell =>
  v === null || v === undefined || Number(v) === 0
    ? ({ t: "z" } as unknown as Cell)
    : { t: "n", v: Number(v), z: MOEDA };

export function gerarPlanilhaCalculoPiso(
  linhas: LinhaPlanilha[],
  opts: { competencia?: string | null } = {},
) {
  const PRIMEIRA = 5; // linha 1-based da primeira pessoa
  const matriz: Cell[][] = [];

  // Linha 1 (título) e linha 2 (mesclada com a 1)
  matriz.push([texto("CALCULO PISO ENFERMAGEM")]);
  matriz.push([]);
  // Linha 3 — faixa "Funcionario"
  matriz.push([texto("Funcionario")]);
  // Linha 4 — cabeçalho
  matriz.push(CABECALHO_CALCULO_PISO.map((h) => texto(h)));

  linhas.forEach((p, i) => {
    const r = PRIMEIRA + i;
    matriz.push([
      texto(p.cpf ?? ""),
      moedaOuVazio(p.incentivo),
      moedaOuVazio(p.tempo_servico),
      moedaOuVazio(p.insalubridade),
      moedaOuVazio(null), // 1/3 FÉRIAS
      moedaOuVazio(null), // FÉRIAS NORMAS
      moedaOuVazio(p.hora_extra_50 ?? p.hora_extra),
      moedaOuVazio(p.hora_extra_100),
      moedaOuVazio(p.plantao ?? p.plantao_sobreaviso),
      moedaOuVazio(p.sobreaviso),
      moedaOuVazio(p.vale_transporte),
      moedaOuVazio(p.gratificacoes),
      moedaOuVazio(null), // GRAT. FUN %VB
      moedaOuVazio(null), // GRAT. NIVEL SUP.
      moedaOuVazio(null), // INCENTIVOS
      moedaOuVazio(p.complementacao), // AUX. FIN. PISO
      formula(`SUM(B${r}:P${r})`), // TOTAL POSITIVOS
      moedaOuVazio(p.inss),
      moedaOuVazio(p.irrf),
      formula(`SUM(R${r}:S${r})`), // TOTAL DESCONTO
      moedaOuVazio(p.adicional_noturno), // ADN
    ]);
  });

  const ultima = PRIMEIRA + linhas.length - 1;
  if (linhas.length > 0) {
    const total: Cell[] = [texto("TOTAL")];
    for (let c = 1; c <= 20; c++) {
      const col = XL.utils.encode_col(c);
      total.push(
        col === "Q" || col === "T" || col === "U"
          ? formula(`SUM(${col}${PRIMEIRA}:${col}${ultima})`)
          : ({ t: "z" } as unknown as Cell),
      );
    }
    matriz.push(total);
  }

  // Montagem manual (o cabeçalho não está na linha 0)
  const ws: XLSX.WorkSheet = {};
  const totalLinhas = matriz.length;
  matriz.forEach((linha, r) => {
    linha.forEach((cell, c) => {
      if (!cell) return;
      const cabecalho = r === 3;
      const titulo = r === 0 || r === 2;
      const rodape = linhas.length > 0 && r === totalLinhas - 1;
      const estilo = titulo
        ? {
            font: { bold: true, sz: 14, name: "Arial" },
            alignment: { horizontal: "center", vertical: "center" },
          }
        : cabecalho
          ? {
              font: { bold: true, sz: 10, name: "Arial" },
              alignment: { horizontal: "center", vertical: "center", wrapText: true },
              border: BORDAS,
            }
          : rodape
            ? { ...ESTILO_TOTAIS, font: { bold: true, name: "Arial" } }
            : { border: BORDAS, font: { name: "Arial", sz: 10 } };
      ws[XL.utils.encode_cell({ r, c })] = { ...cell, s: estilo };
    });
  });

  ws["!ref"] = XL.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(3, totalLinhas - 1), c: LARGURA_CALCULO_PISO.length - 1 },
  });
  ws["!cols"] = LARGURA_CALCULO_PISO.map((w) => ({ wch: w }));
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 20 } },
    { s: { r: 2, c: 1 }, e: { r: 2, c: 20 } },
  ];
  ws["!freeze"] = { xSplit: 0, ySplit: 4 };

  const wb = XL.utils.book_new();
  XL.utils.book_append_sheet(wb, ws, "Planilha1");
  if (opts.competencia) wb.Props = { Title: `Cálculo Piso ${opts.competencia}` };
  return escrever(wb);
}

// ---------------------------------------------------------------------------
// Modelo OFICIAL "piso-enfermagem" (envio) — 11 colunas, SEM fórmulas.
// Chave do registro: CPF DO PROFISSIONAL. Todos os valores são gravados como
// dados brutos (fiéis à consolidação), sem cálculo dentro do Excel.
// ---------------------------------------------------------------------------

export const CABECALHO_PISO_ENFERMAGEM = [
  "CPF PROFISSIONAL",
  "CNES EMPREGADOR",
  "CBO",
  "JORNADA SEMANAL (CARGA HORARIA)",
  "SALÁRIO BASE (MENSAL)",
  "INSALUBRIDADE",
  "ADICIONAL NOTURNO",
  "ENCARGO PATRONAL",
  "ENCARGO TRABALHISTA",
  "VANTAGEM FIXA (VFPG)",
  "VANTAGEM VARIÁVEL (VPVT)",
];

const LARGURA_PISO_ENFERMAGEM = [18.4, 19.7, 8, 36.4, 24, 16, 21.1, 20.7, 23.4, 23, 27.9];

const FORMATO_VALOR = "#,##0.00_);(#,##0.00)";
const FORMATO_JORNADA = "#,##0_);(#,##0)";

/** Só dígitos — o modelo oficial não aceita máscara no CPF/CNES/CBO. */
const soDigitos = (v: string | null | undefined) => (v ?? "").replace(/\D+/g, "");

const valorOficial = (v: number | null | undefined): Cell =>
  v === null || v === undefined || Number.isNaN(Number(v))
    ? ({ t: "z" } as unknown as Cell)
    : { t: "n", v: Number(v), z: FORMATO_VALOR };

export function gerarPlanilhaPisoEnfermagem(
  linhas: LinhaPlanilha[],
  opts: { competencia?: string | null } = {},
) {
  const matriz: Cell[][] = [CABECALHO_PISO_ENFERMAGEM.map((h) => texto(h))];

  for (const p of linhas) {
    matriz.push([
      texto(soDigitos(p.cpf)),
      texto(soDigitos(p.cnes)),
      texto(soDigitos(p.cbo)),
      p.carga_horaria === null || p.carga_horaria === undefined
        ? ({ t: "z" } as unknown as Cell)
        : { t: "n", v: Number(p.carga_horaria), z: FORMATO_JORNADA },
      valorOficial(p.salario_base),
      valorOficial(p.insalubridade),
      valorOficial(p.adicional_noturno),
      valorOficial(p.encargo_patronal),
      valorOficial(p.encargo_trabalhista),
      valorOficial(p.vantagem_fixa),
      valorOficial(p.vantagem_variavel),
    ]);
  }

  const ws = montarSheet(matriz, LARGURA_PISO_ENFERMAGEM, false, {
    fonte: { name: "Calibri", sz: 11 },
    cabecalhoSimples: true,
  });

  const wb = XL.utils.book_new();
  XL.utils.book_append_sheet(wb, ws, "PisoEnfermagem");
  if (opts.competencia) wb.Props = { Title: `Piso Enfermagem ${opts.competencia}` };
  return escrever(wb);
}

export const somaOuNulo = (vs: Array<number | null | undefined>) => {
  const nums = vs.map((v) => Number(v) || 0);
  const total = nums.reduce((a, b) => a + b, 0);
  return total === 0 ? null : Number(total.toFixed(2));
};

const MESES_PT = [
  "JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];

/** "2026-07" -> "JULHO" (fallback: a própria competência higienizada). */
export function rotuloMes(competencia: string) {
  const m = /^(\d{4})-(\d{2})/.exec(competencia.trim());
  if (!m) return competencia.replace(/[^\dA-Za-z]/g, "-") || "GERAL";
  return MESES_PT[Number(m[2]) - 1] ?? competencia;
}

