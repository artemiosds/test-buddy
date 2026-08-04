// Regras de cálculo do modelo "SAUDE - CAPS" (Centro de Atenção Psicossocial).
//
// Engenharia reversa dos arquivos institucionais `SAUDE - CAPS.xlsx` e
// `SAUDE - CAPS (4).xlsx`:
//  • entrada: cabeçalho na linha 6 (Nº, NOME, DATA ADMISSÃO, C.P.F., LOTAÇÃO,
//    CARGO, DIAS, BASE, INSALUBRIDADE, H.E., BRUTO, ISS, LIQUIDO, CONTA);
//  • saída fiel (aba "CAPS"): 13 colunas A..M;
//  • INSALUBRIDADE: enfermeiro(a) = 517,20 fixo; técnico/auxiliar = BASE × 20%;
//  • INCENTIVO: exclusivo de enfermeiro(a) = 2.068,79;
//  • BRUTO = BASE + INSALUBRIDADE + H.E. (o modelo não tem ad. noturno/plantão);
//  • ISS = BRUTO × 5% · LIQUIDO = BRUTO − ISS;
//  • TOTAL (última coluna) = SOMA(H.E.; INCENTIVO);
//  • BRUTO, ISS, LIQUIDO, TOTAL e a insalubridade dos técnicos são FÓRMULAS.

import {
  moeda,
  numero,
  textoUpper,
  cpfDigitos,
  cpfFormatado,
  type ImportTemplateConfig,
  type LinhaCalculavel,
} from "../types";
import {
  categoriaUbs,
  ISS_ALIQUOTA,
  INSALUBRIDADE_ENFERMEIRO,
  INSALUBRIDADE_TECNICO_PCT,
  INCENTIVO_ENFERMEIRO,
  type CategoriaUbs,
} from "./ubsCalculator";

function primeiro(linha: LinhaCalculavel, ...chaves: string[]): unknown {
  for (const c of chaves) {
    const v = linha[c];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

function temValor(linha: LinhaCalculavel, ...chaves: string[]): boolean {
  return primeiro(linha, ...chaves) !== null;
}

export function calcularCaps(linha: LinhaCalculavel): LinhaCalculavel {
  const base = numero(linha.salario_base);
  const categoria = categoriaUbs(linha.cargo);

  const insalubridade = temValor(linha, "insalubridade")
    ? numero(linha.insalubridade)
    : categoria === "enfermeiro"
      ? INSALUBRIDADE_ENFERMEIRO
      : categoria === "tecnico"
        ? moeda(base * INSALUBRIDADE_TECNICO_PCT)
        : 0;

  const horaExtra = numero(linha.hora_extra_50);
  const bruto = moeda(base + insalubridade + horaExtra);
  const iss = moeda(bruto * ISS_ALIQUOTA);
  const liquido = moeda(bruto - iss);

  const incentivo = temValor(linha, "incentivo", "auxilio_financeiro")
    ? numero(primeiro(linha, "incentivo", "auxilio_financeiro"))
    : categoria === "enfermeiro"
      ? INCENTIVO_ENFERMEIRO
      : 0;

  const totalFinal = moeda(horaExtra + incentivo);
  const dias = numero(primeiro(linha, "dias_trabalhados", "tempo_servico"));

  return {
    ...linha,
    categoria_ubs: categoria,
    nome: textoUpper(linha.nome),
    cargo: textoUpper(linha.cargo),
    unidade: textoUpper(linha.unidade),
    cpf: cpfDigitos(linha.cpf),
    cpf_formatado: cpfFormatado(linha.cpf),
    dias_trabalhados: dias,
    tempo_servico: dias,
    salario_base: base,
    insalubridade,
    hora_extra_50: horaExtra,
    adicional_noturno: 0,
    total_proventos: bruto,
    iss,
    total_descontos: iss,
    total_liquido_base: liquido,
    valor_liquido: liquido,
    auxilio_financeiro: incentivo,
    incentivo,
    valor_final: totalFinal,
  };
}

/** Cabeçalho fiel do modelo `SAUDE - CAPS` — 13 colunas, nesta ordem. */
export const COLUNAS_SAIDA_CAPS = [
  "NOME",
  "C.P.F.",
  "LOTAÇÃO",
  "CARGO",
  "DIAS",
  "BASE",
  "INSALUBRIDADE",
  "H.E.",
  "BRUTO",
  "ISS",
  "LIQUIDO",
  "INCETIVO",
  "TOTAL",
] as const;

/** Nome da aba do modelo institucional. */
export const ABA_CAPS = "CAPS";

/**
 * Monta a matriz (AOA) da planilha final com as 13 colunas do modelo.
 * Fórmulas vivas: G=F*20% (técnicos) · I=F+G+H · J=I*5% · K=I-J · M=SUM(H,L)
 */
export function montarPlanilhaCaps(
  linhas: LinhaCalculavel[],
  opts?: { formulas?: boolean },
): unknown[][] {
  const comFormulas = opts?.formulas !== false;
  const corpo = linhas.map((l, i) => {
    const r = i + 2; // linha 1 = cabeçalho
    const categoria = (l.categoria_ubs as CategoriaUbs) ?? categoriaUbs(l.cargo);
    const insalubridade =
      comFormulas && categoria === "tecnico" ? { f: `F${r}*20%` } : numero(l.insalubridade);
    return [
      textoUpper(l.nome) ?? "",
      cpfFormatado(l.cpf),
      textoUpper(l.unidade) ?? "",
      textoUpper(l.cargo) ?? "",
      numero(primeiro(l, "dias_trabalhados", "tempo_servico")),
      numero(l.salario_base),
      insalubridade,
      numero(l.hora_extra_50),
      comFormulas ? { f: `F${r}+G${r}+H${r}` } : numero(l.total_proventos),
      comFormulas ? { f: `I${r}*5%` } : numero(primeiro(l, "iss", "total_descontos")),
      comFormulas ? { f: `I${r}-J${r}` } : numero(l.total_liquido_base),
      numero(primeiro(l, "incentivo", "auxilio_financeiro")),
      comFormulas ? { f: `SUM(H${r},L${r})` } : numero(l.valor_final),
    ];
  });
  return [[...COLUNAS_SAIDA_CAPS], ...corpo];
}

export const CAPS_SAUDE: ImportTemplateConfig = {
  id: "CAPS_SAUDE",
  nome: "Saúde — CAPS (contratados)",
  filePattern: /CAPS/i,
  cabecalhosEsperados: ["NOME", "CPF", "LOTACAO", "CARGO", "DIAS", "LIQUIDO"],
  headerRowIndex: null,
  columnMap: {
    N: "sequencial",
    NOME: "nome",
    DATAADMISSAO: "data_admissao",
    CPF: "cpf",
    LOTACAO: "unidade",
    CARGO: "cargo",
    DIAS: "dias_trabalhados",
    BASE: "salario_base",
    INSALUBRIDADE: "insalubridade",
    INSALUBIRADE: "insalubridade",
    HE: "hora_extra_50",
    BRUTO: "total_proventos",
    ISS: "iss",
    LIQUIDO: "total_liquido_base",
    INCETIVO: "incentivo",
    INCENTIVO: "incentivo",
    TOTAL: "valor_final",
    CONTA: "conta_bancaria",
  },
  colunasSaida: [...COLUNAS_SAIDA_CAPS],
  calculationRules: calcularCaps,
  descricaoRegras: [
    "INSALUBRIDADE: enfermeiro(a) = R$ 517,20 fixo; técnico/auxiliar = BASE × 20%",
    "INCENTIVO: exclusivo de enfermeiro(a) = R$ 2.068,79",
    "BRUTO = BASE + INSALUBRIDADE + H.E. (modelo sem ad. noturno e sem plantão)",
    "ISS = BRUTO × 5% · LIQUIDO = BRUTO − ISS",
    "TOTAL (última coluna) = SOMA(H.E.; INCENTIVO)",
    "Planilha exportada mantém as fórmulas vivas em G (técnicos), I, J, K e M",
    "NOME, LOTAÇÃO e CARGO em caixa alta; C.P.F. formatado 000.000.000-00",
  ],
};
