// Regras de cálculo do modelo "SAUDE - UBS'S" (folha de contratados das UBS).
// Isolado de propósito: novos modelos criam o seu próprio calculador e não
// alteram este arquivo.
//
// Engenharia reversa do arquivo institucional `SAUDE - UBS'S (4).xlsx`:
//  • cabeçalho na linha 1, 16 colunas (A..P), última coluna chamada "TOTAL";
//  • INSALUBRIDADE: enfermeiro(a) = valor fixo 517,20; técnico/auxiliar = BASE × 20%;
//  • INCENTIVO: exclusivo de enfermeiro(a) = 2.068,79 (técnico fica vazio);
//  • BRUTO/ISS/TOTAL/TOTAL final são FÓRMULAS vivas na planilha gerada.

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
/** Insalubridade fixa dos enfermeiros no modelo institucional. */
export const INSALUBRIDADE_ENFERMEIRO = 517.2;
/** Percentual de insalubridade dos técnicos/auxiliares (sobre a BASE). */
export const INSALUBRIDADE_TECNICO_PCT = 0.2;
/** Incentivo exclusivo dos enfermeiros no modelo institucional. */
export const INCENTIVO_ENFERMEIRO = 2068.79;

export type CategoriaUbs = "enfermeiro" | "tecnico" | "outro";

/** Primeiro valor não vazio entre as chaves informadas. */
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

function norm(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * Classifica o cargo do modelo UBS. "TEC. EM ENFERMAGEM", "TECNICO EM
 * ENFERMAGEM", "TEC.EMFERMAGEM" e variações caem em `tecnico`;
 * "ENFERMEIRA"/"ENFERMEIRO" em `enfermeiro`.
 */
export function categoriaUbs(cargo: unknown): CategoriaUbs {
  const c = norm(cargo);
  if (!c) return "outro";
  if (/\b(TEC|TECN|TECNICO|TECNICA|AUX|AUXILIAR)/.test(c)) return "tecnico";
  if (/ENFERMEIR|EMFERMEIR/.test(c)) return "enfermeiro";
  return "outro";
}

/**
 * BRUTO = BASE + INSALUBRIDADE + H.E. + AD. NOTURNO
 * ISS = BRUTO × 5%
 * TOTAL = BRUTO − ISS
 * TOTAL (última coluna) = H.E. + GRAT.INCENTIVO + AUX. TRANSP. + INCENTIVO
 * INSALUBRIDADE e INCENTIVO seguem a categoria do cargo (ver topo do arquivo).
 */
export function calcularUbs(linha: LinhaCalculavel): LinhaCalculavel {
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

  const bruto = moeda(base + insalubridade + horaExtra + noturno);
  const iss = moeda(bruto * ISS_ALIQUOTA);
  const total = moeda(bruto - iss);

  const gratIncentivo = numero(primeiro(linha, "gratificacao_incentivo", "gratificacao"));
  const auxTransporte = numero(primeiro(linha, "auxilio_transporte", "vale_transporte"));
  const incentivoInformado = temValor(linha, "incentivo", "auxilio_financeiro");
  const incentivo = incentivoInformado
    ? numero(primeiro(linha, "incentivo", "auxilio_financeiro"))
    : categoria === "enfermeiro"
      ? INCENTIVO_ENFERMEIRO
      : 0;

  const totalFinal = moeda(horaExtra + gratIncentivo + auxTransporte + incentivo);
  const dias = numero(primeiro(linha, "dias_trabalhados", "tempo_servico"));

  return {
    ...linha,
    categoria_ubs: categoria,
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
  "TOTAL",
] as const;

/**
 * Monta a matriz (AOA) da planilha final com as 16 colunas do modelo.
 * Por padrão grava FÓRMULAS vivas (idênticas ao modelo institucional):
 *   J=F+G+H+I · K=J*5% · L=J-K · P=SUM(H,M,N,O) · G=F*20% (técnicos)
 * Use `{ formulas: false }` para exportar somente valores calculados.
 * As linhas já devem ter passado por `calcularUbs`.
 */
export function montarPlanilhaUbs(
  linhas: LinhaCalculavel[],
  opts?: { formulas?: boolean },
): unknown[][] {
  const comFormulas = opts?.formulas !== false;
  const corpo = linhas.map((l, i) => {
    const r = i + 2; // linha 1 = cabeçalho
    const categoria = (l.categoria_ubs as CategoriaUbs) ?? categoriaUbs(l.cargo);
    const insalubridade =
      comFormulas && categoria === "tecnico"
        ? { f: `F${r}*20%` }
        : numero(l.insalubridade);
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
      comFormulas
        ? { f: `J${r}-K${r}` }
        : numero(primeiro(l, "total_liquido_base", "valor_liquido")),
      numero(primeiro(l, "gratificacao_incentivo", "gratificacao")),
      numero(primeiro(l, "auxilio_transporte", "vale_transporte")),
      numero(primeiro(l, "incentivo", "auxilio_financeiro")),
      comFormulas ? { f: `SUM(H${r},M${r},N${r},O${r})` } : numero(l.valor_final),
    ];
  });
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
    "INSALUBRIDADE: enfermeiro(a) = R$ 517,20 fixo; técnico/auxiliar = BASE × 20%",
    "INCENTIVO: exclusivo de enfermeiro(a) = R$ 2.068,79 (técnico fica zerado)",
    "BRUTO = BASE + INSALUBRIDADE + H.E. + AD. NOTURNO",
    "ISS = BRUTO × 5%",
    "TOTAL = BRUTO − ISS",
    "TOTAL (última coluna) = SOMA(H.E.; GRAT.INCENTIVO; AUX. TRANSP.; INCENTIVO)",
    "Planilha exportada mantém as fórmulas vivas nas colunas G (técnicos), J, K, L e P",
    "NOME, LOTAÇÃO e CARGO em caixa alta; C.P.F. formatado 000.000.000-00",
  ],
};
