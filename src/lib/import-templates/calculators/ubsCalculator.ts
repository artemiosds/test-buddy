// Regras de cálculo do modelo "SAUDE - UBS'S" (folha de contratados das UBS).
// Isolado de propósito: novos modelos criam o seu próprio calculador e não
// alteram este arquivo.

import {
  moeda,
  numero,
  textoUpper,
  cpfDigitos,
  cpfFormatado,
  type ImportTemplateConfig,
  type LinhaCalculavel,
} from "../types";

export const ISS_ALIQUOTA = 0.05;

/** Primeiro valor não vazio entre as chaves informadas. */
function primeiro(linha: LinhaCalculavel, ...chaves: string[]): unknown {
  for (const c of chaves) {
    const v = linha[c];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

/**
 * BRUTO = BASE + INSALUBRIDADE + H.E. + AD. NOTURNO
 * ISS = BRUTO × 5%
 * TOTAL = BRUTO − ISS
 * TOTAL FINAL = H.E. + GRAT.INCENTIVO + AUX. TRANSP. + INCENTIVO
 */
export function calcularUbs(linha: LinhaCalculavel): LinhaCalculavel {
  const base = numero(linha.salario_base);
  const insalubridade = numero(linha.insalubridade);
  const horaExtra = numero(linha.hora_extra_50);
  const noturno = numero(linha.adicional_noturno);

  const bruto = moeda(base + insalubridade + horaExtra + noturno);
  const iss = moeda(bruto * ISS_ALIQUOTA);
  const total = moeda(bruto - iss);

  const gratIncentivo = numero(primeiro(linha, "gratificacao_incentivo", "gratificacao"));
  const auxTransporte = numero(primeiro(linha, "auxilio_transporte", "vale_transporte"));
  const incentivo = numero(primeiro(linha, "incentivo", "auxilio_financeiro"));
  const totalFinal = moeda(horaExtra + gratIncentivo + auxTransporte + incentivo);
  const dias = numero(primeiro(linha, "dias_trabalhados", "tempo_servico"));

  return {
    ...linha,
    nome: textoUpper(linha.nome),
    cargo: textoUpper(linha.cargo),
    unidade: textoUpper(linha.unidade),
    setor: textoUpper(linha.setor),
    cpf: cpfDigitos(linha.cpf),
    cpf_formatado: cpfFormatado(linha.cpf),
    dias_trabalhados: dias,
    tempo_servico: dias,
    salario_base: base,
    insalubridade,
    hora_extra_50: horaExtra,
    adicional_noturno: noturno,
    total_proventos: bruto,
    iss,
    total_descontos: iss,
    total_liquido_base: total,
    valor_liquido: total,
    gratificacao: gratIncentivo,
    gratificacao_incentivo: gratIncentivo,
    vale_transporte: auxTransporte,
    auxilio_transporte: auxTransporte,
    auxilio_financeiro: incentivo,
    incentivo,
    valor_final: totalFinal,
  };
}

/** Cabeçalho fiel do modelo `SAUDE - UBS'S (4)` — 16 colunas, nesta ordem. */
export const COLUNAS_SAIDA_UBS = [
  "NOME",
  "C.P.F.",
  "LOTAÇÃO",
  "CARGO",
  "DIAS",
  "BASE",
  "INSALUBRIDADE",
  "H.E.",
  "AD. NOTURNO",
  "BRUTO",
  "ISS",
  "TOTAL",
  "GRAT.INCENTIVO",
  "AUX. TRANSP.",
  "INCENTIVO",
  "TOTAL_FINAL",
] as const;

/**
 * Monta a matriz (AOA) da planilha final com as 16 colunas do modelo.
 * As linhas já devem ter passado por `calcularUbs`.
 */
export function montarPlanilhaUbs(linhas: LinhaCalculavel[]): unknown[][] {
  const corpo = linhas.map((l) => [
    textoUpper(l.nome) ?? "",
    cpfFormatado(l.cpf),
    textoUpper(l.unidade) ?? "",
    textoUpper(l.cargo) ?? "",
    numero(primeiro(l, "dias_trabalhados", "tempo_servico")),
    numero(l.salario_base),
    numero(l.insalubridade),
    numero(l.hora_extra_50),
    numero(l.adicional_noturno),
    numero(l.total_proventos),
    numero(primeiro(l, "iss", "total_descontos")),
    numero(primeiro(l, "total_liquido_base", "valor_liquido")),
    numero(primeiro(l, "gratificacao_incentivo", "gratificacao")),
    numero(primeiro(l, "auxilio_transporte", "vale_transporte")),
    numero(primeiro(l, "incentivo", "auxilio_financeiro")),
    numero(l.valor_final),
  ]);
  return [[...COLUNAS_SAIDA_UBS], ...corpo];
}

export const UBS_SAUDE: ImportTemplateConfig = {
  id: "UBS_SAUDE",
  nome: "Saúde — UBS's (contratados)",
  filePattern: /SAUDE.*UBS/i,
  cabecalhosEsperados: ["NOME", "CPF", "LOTACAO", "CARGO"],
  headerRowIndex: null,
  columnMap: {
    NOME: "nome",
    DATAADMISSAO: "data_admissao",
    CPF: "cpf",
    LOTACAO: "unidade",
    CARGO: "cargo",
    DIAS: "dias_trabalhados",
    BASE: "salario_base",
    INSALUBRIDADE: "insalubridade",
    HE: "hora_extra_50",
    ADNOTURNO: "adicional_noturno",
    BRUTO: "total_proventos",
    ISS: "iss",
    TOTAL: "total_liquido_base",
    GRATINCENTIVO: "gratificacao_incentivo",
    AUXTRANSP: "auxilio_transporte",
    INCENTIVO: "incentivo",
    VLIQUIDO: "valor_liquido",
    CONTA: "conta_bancaria",
  },
  colunasSaida: [...COLUNAS_SAIDA_UBS],
  calculationRules: calcularUbs,
  descricaoRegras: [
    "BRUTO = BASE + INSALUBRIDADE + H.E. + AD. NOTURNO",
    "ISS = BRUTO × 5%",
    "TOTAL = BRUTO − ISS",
    "TOTAL FINAL = H.E. + GRAT.INCENTIVO + AUX. TRANSP. + INCENTIVO",
    "NOME, LOTAÇÃO e CARGO em caixa alta; C.P.F. formatado 000.000.000-00",
  ],
};
