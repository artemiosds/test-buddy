// Modelo "PADRÃO ADM" — nasceu do arquivo institucional
// `SAUDE - CENTRO ESPECIALIZADO - CER.xlsx` e serve como padrão administrativo
// reaproveitável para qualquer unidade ainda não mapeada.
//
// Engenharia reversa dos arquivos `SAUDE - CENTRO ESPECIALIZADO -CER.xlsx` e
// `SAUDE - CENTRO ESPECIALIZADO -CER (8).xlsx`:
//  • entrada: Nº, NOME, DATA ADMISSÃO, C.P.F., LOTAÇÃO, CARGO, DIAS, BASE,
//    INSALUBRIDADE, H.E., AD.NOTURNO, BRUTO, ISS, V.LÍQUIDO, CONTA;
//  • saída fiel (aba "PADRAO ADM"): 13 colunas A..M;
//  • INSALUBRIDADE: enfermeiro(a) = 517,20 fixo; técnico/auxiliar = BASE × 20%;
//  • INCENTIVO: exclusivo de enfermeiro(a) = 2.068,79;
//  • BRUTO = BASE + INSALUBRIDADE + H.E. + AD.NOTURNO (sem plantão);
//  • ISS = BRUTO × 5% · LÍQUIDO = BRUTO − ISS;
//  • TOTAL (última coluna) = SOMA(H.E.; INCENTIVO);
//  • BRUTO, ISS, TOTAL e a insalubridade dos técnicos são FÓRMULAS vivas.

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

export function calcularPadraoAdm(linha: LinhaCalculavel): LinhaCalculavel {
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
  const adicionalNoturno = numero(linha.adicional_noturno);
  const bruto = moeda(base + insalubridade + horaExtra + adicionalNoturno);
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
    adicional_noturno: adicionalNoturno,
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

/** Cabeçalho fiel do modelo "PADRÃO ADM" — 13 colunas, nesta ordem. */
export const COLUNAS_SAIDA_PADRAO_ADM = [
  "NOME",
  "C.P.F.",
  "LOTAÇÃO",
  "CARGO",
  "DIAS",
  "BASE",
  "INSALUBRIDADE",
  "H.E.",
  "AD.NOTURNO",
  "BRUTO",
  "ISS",
  "INCENTIVO",
  "TOTAL",
] as const;

/** Nome da aba gerada. */
export const ABA_PADRAO_ADM = "PADRAO ADM";

/**
 * Monta a matriz (AOA) com as 13 colunas do modelo.
 * Fórmulas vivas: G=F*20% (técnicos) · J=F+G+H+I · K=J*5% · M=SUM(H,L)
 */
export function montarPlanilhaPadraoAdm(
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
      numero(l.adicional_noturno),
      comFormulas ? { f: `F${r}+G${r}+H${r}+I${r}` } : numero(l.total_proventos),
      comFormulas ? { f: `J${r}*5%` } : numero(primeiro(l, "iss", "total_descontos")),
      numero(primeiro(l, "incentivo", "auxilio_financeiro")),
      comFormulas ? { f: `SUM(H${r},L${r})` } : numero(l.valor_final),
    ];
  });
  return [[...COLUNAS_SAIDA_PADRAO_ADM], ...corpo];
}

export const PADRAO_ADM: ImportTemplateConfig = {
  id: "PADRAO_ADM",
  nome: "Padrão ADM (contratados — qualquer unidade)",
  filePattern: /\bCER\b|CENTRO[\s_.-]*ESPECIALIZAD|PADRAO[\s_.-]*ADM/i,
  cabecalhosEsperados: [
    "NOME",
    "CPF",
    "LOTACAO",
    "CARGO",
    "DIAS",
    "BASE",
    "ADNOTURNO",
    "BRUTO",
    "ISS",
  ],
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
    ADNOTURNO: "adicional_noturno",
    BRUTO: "total_proventos",
    ISS: "iss",
    VLIQUIDO: "total_liquido_base",
    LIQUIDO: "total_liquido_base",
    INCENTIVO: "incentivo",
    INCETIVO: "incentivo",
    TOTAL: "valor_final",
    CONTA: "conta_bancaria",
  },
  colunasSaida: [...COLUNAS_SAIDA_PADRAO_ADM],
  calculationRules: calcularPadraoAdm,
  descricaoRegras: [
    "Modelo reaproveitável: serve para qualquer unidade administrativa ainda não mapeada",
    "INSALUBRIDADE: enfermeiro(a) = R$ 517,20 fixo; técnico/auxiliar = BASE × 20%",
    "INCENTIVO: exclusivo de enfermeiro(a) = R$ 2.068,79",
    "BRUTO = BASE + INSALUBRIDADE + H.E. + AD.NOTURNO (modelo sem plantão)",
    "ISS = BRUTO × 5% · LÍQUIDO = BRUTO − ISS",
    "TOTAL (última coluna) = SOMA(H.E.; INCENTIVO)",
    "Planilha exportada mantém as fórmulas vivas em G (técnicos), J, K e M",
    "NOME, LOTAÇÃO e CARGO em caixa alta; C.P.F. formatado 000.000.000-00",
  ],
};
