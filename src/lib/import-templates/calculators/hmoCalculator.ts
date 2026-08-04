// Regras de cálculo do modelo "SAUDE - H.M.O" (Hospital Municipal de Oriximiná).
//
// Engenharia reversa do arquivo institucional `SAUDE - H.M.O (4).xlsx`:
//  • cabeçalho na linha 1, 14 colunas (A..N), última coluna chamada "TOTAL";
//  • INSALUBRIDADE: enfermeiro(a) = valor fixo 517,20; técnico/auxiliar = BASE × 20%;
//  • INCENTIVO: exclusivo de enfermeiro(a) = 2.068,79;
//  • BRUTO = BASE + INSALUBRIDADE + H.E. + AD.NOTURNO + PLANTÃO E SOBREAVISO;
//  • ISS = BRUTO × 5%;
//  • TOTAL (última coluna) = SOMA(H.E.; PLANTÃO E SOBREAVISO; INCENTIVO);
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

/**
 * BRUTO = BASE + INSALUBRIDADE + H.E. + AD.NOTURNO + PLANTÃO E SOBREAVISO
 * ISS = BRUTO × 5% · LÍQUIDO = BRUTO − ISS
 * TOTAL (última coluna) = H.E. + PLANTÃO E SOBREAVISO + INCENTIVO
 */
export function calcularHmo(linha: LinhaCalculavel): LinhaCalculavel {
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
  const noturno = numero(linha.adicional_noturno);
  const plantao = numero(primeiro(linha, "plantao", "sobreaviso"));

  const bruto = moeda(base + insalubridade + horaExtra + noturno + plantao);
  const iss = moeda(bruto * ISS_ALIQUOTA);
  const liquido = moeda(bruto - iss);

  const incentivo = temValor(linha, "incentivo", "auxilio_financeiro")
    ? numero(primeiro(linha, "incentivo", "auxilio_financeiro"))
    : categoria === "enfermeiro"
      ? INCENTIVO_ENFERMEIRO
      : 0;

  const totalFinal = moeda(horaExtra + plantao + incentivo);
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
    adicional_noturno: noturno,
    plantao,
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

/** Cabeçalho fiel do modelo `SAUDE - H.M.O (4)` — 14 colunas, nesta ordem. */
export const COLUNAS_SAIDA_HMO = [
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
] as const;

/** Nome da aba do modelo institucional. */
export const ABA_HMO = "H.M.O (3)";

/**
 * Monta a matriz (AOA) da planilha final com as 14 colunas do modelo.
 * Fórmulas vivas: G=F*20% (técnicos) · K=F+G+H+I+J · L=K*5% · N=SUM(H,J,M)
 */
export function montarPlanilhaHmo(
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
      numero(primeiro(l, "plantao", "sobreaviso")),
      comFormulas ? { f: `F${r}+G${r}+H${r}+I${r}+J${r}` } : numero(l.total_proventos),
      comFormulas ? { f: `K${r}*5%` } : numero(primeiro(l, "iss", "total_descontos")),
      numero(primeiro(l, "incentivo", "auxilio_financeiro")),
      comFormulas ? { f: `SUM(H${r},J${r},M${r})` } : numero(l.valor_final),
    ];
  });
  return [[...COLUNAS_SAIDA_HMO], ...corpo];
}

export const HMO_SAUDE: ImportTemplateConfig = {
  id: "HMO_SAUDE",
  nome: "Saúde — H.M.O (contratados)",
  filePattern: /SAUDE.*H\W*M\W*O/i,
  cabecalhosEsperados: ["NOME", "CPF", "LOTACAO", "CARGO", "PLANTOESOBREAVISO"],
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
    INSALUBIRADE: "insalubridade",
    INSALUBRIDADE: "insalubridade",
    HE: "hora_extra_50",
    ADNOTURNO: "adicional_noturno",
    PLANTOESOBREAVISO: "plantao",
    PLANTAOESOBREAVISO: "plantao",
    BRUTO: "total_proventos",
    ISS: "iss",
    INCENTIVO: "incentivo",
    LIQUIDO: "valor_liquido",
    TOTAL: "valor_final",
    CONTA: "conta_bancaria",
  },
  colunasSaida: [...COLUNAS_SAIDA_HMO],
  calculationRules: calcularHmo,
  descricaoRegras: [
    "INSALUBRIDADE: enfermeiro(a) = R$ 517,20 fixo; técnico/auxiliar = BASE × 20%",
    "INCENTIVO: exclusivo de enfermeiro(a) = R$ 2.068,79",
    "BRUTO = BASE + INSALUBRIDADE + H.E. + AD.NOTURNO + PLANTÃO E SOBREAVISO",
    "ISS = BRUTO × 5%",
    "TOTAL (última coluna) = SOMA(H.E.; PLANTÃO E SOBREAVISO; INCENTIVO)",
    "Planilha exportada mantém as fórmulas vivas nas colunas G (técnicos), K, L e N",
    "NOME, LOTAÇÃO e CARGO em caixa alta; C.P.F. formatado 000.000.000-00",
  ],
};
