// Regras de cálculo do modelo "SAUDE - H.M.S.D.S" (Hospital Maternidade São
// Domingos Sávio).
//
// Engenharia reversa dos arquivos institucionais `SAUDE - H.M.S.D.S (4).xlsx`
// e `SAUDE - H.M.S.D.S. (3) (4).xlsx`:
//  • entrada: cabeçalho na linha 6 (Nº, NOME, DATA ADMISSÃO, C.P.F., LOTAÇÃO,
//    CARGO, DIAS, BASE, INSALUBRIDADE, H.E., AD.NOTURNO, PLANTÃI E SOBREAVISO,
//    BRUTO, ISS, TOTAL, PENSÃO ALIMENTICIA, LIQUIDO, CONTA);
//  • saída fiel (aba "H.M.S.D.S. (3)"): 16 colunas A..P;
//  • INSALUBRIDADE: enfermeiro(a) = 517,20 fixo; técnico/auxiliar = BASE × 20%;
//  • INCENTIVO: exclusivo de enfermeiro(a) = 2.068,79;
//  • BRUTO = BASE + INSALUBRIDADE + H.E. + AD.NOTURNO + PLANTÃO E SOBREAVISO;
//  • ISS = BRUTO × 5% · TOTAL = BRUTO − ISS;
//  • TOTAL (última coluna) = SOMA(H.E.; PLANTÃO E SOBREAVISO; INCENTIVO);
//  • BRUTO, ISS, TOTAL, TOTAL final e a insalubridade dos técnicos são FÓRMULAS.

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

export function calcularHmsds(linha: LinhaCalculavel): LinhaCalculavel {
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
  const pensao = numero(primeiro(linha, "pensao_alimenticia", "pensao", "total_descontos_extra"));

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
    valor_liquido: moeda(liquido - pensao),
    pensao_alimenticia: pensao,
    auxilio_financeiro: incentivo,
    incentivo,
    valor_final: totalFinal,
  };
}

/** Cabeçalho fiel do modelo `SAUDE - H.M.S.D.S. (3)` — 16 colunas, nesta ordem. */
export const COLUNAS_SAIDA_HMSDS = [
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
] as const;

/** Nome da aba do modelo institucional. */
export const ABA_HMSDS = "H.M.S.D.S. (3)";

/**
 * Monta a matriz (AOA) da planilha final com as 16 colunas do modelo.
 * Fórmulas vivas: G=F*20% (técnicos) · K=F+G+H+I+J · L=K*5% · M=K-L ·
 * P=SUM(H,J,O)
 */
export function montarPlanilhaHmsds(
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
      comFormulas ? { f: `K${r}-L${r}` } : numero(l.total_liquido_base),
      numero(l.pensao_alimenticia),
      numero(primeiro(l, "incentivo", "auxilio_financeiro")),
      comFormulas ? { f: `SUM(H${r},J${r},O${r})` } : numero(l.valor_final),
    ];
  });
  return [[...COLUNAS_SAIDA_HMSDS], ...corpo];
}

export const HMSDS_SAUDE: ImportTemplateConfig = {
  id: "HMSDS_SAUDE",
  nome: "Saúde — H.M.S.D.S (contratados)",
  filePattern: /H\W*M\W*S\W*D\W*S/i,
  cabecalhosEsperados: [
    "NOME",
    "CPF",
    "LOTACAO",
    "CARGO",
    "PLANTOESOBREAVISO",
    "PENSAOALIMENTICIA",
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
    PLANTOESOBREAVISO: "plantao",
    PLANTAOESOBREAVISO: "plantao",
    PLANTAIESOBREAVISO: "plantao",
    BRUTO: "total_proventos",
    ISS: "iss",
    TOTAL: "total_liquido_base",
    PENSAOALIMENTICIA: "pensao_alimenticia",
    PENSAO: "pensao_alimenticia",
    INCENTIVO: "incentivo",
    LIQUIDO: "valor_liquido",
    CONTA: "conta_bancaria",
  },
  colunasSaida: [...COLUNAS_SAIDA_HMSDS],
  calculationRules: calcularHmsds,
  descricaoRegras: [
    "INSALUBRIDADE: enfermeiro(a) = R$ 517,20 fixo; técnico/auxiliar = BASE × 20%",
    "INCENTIVO: exclusivo de enfermeiro(a) = R$ 2.068,79",
    "BRUTO = BASE + INSALUBRIDADE + H.E. + AD.NOTURNO + PLANTÃO E SOBREAVISO",
    "ISS = BRUTO × 5% · TOTAL = BRUTO − ISS",
    "TOTAL (última coluna) = SOMA(H.E.; PLANTÃO E SOBREAVISO; INCENTIVO)",
    "Planilha exportada mantém as fórmulas vivas em G (técnicos), K, L, M e P",
    "NOME, LOTAÇÃO e CARGO em caixa alta; C.P.F. formatado 000.000.000-00",
  ],
};
