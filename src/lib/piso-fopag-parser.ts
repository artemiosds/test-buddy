/**
 * Parser do contracheque/FOPAG em PDF (Piso Nacional da Enfermagem — Efetivos).
 *
 * Puro (sem I/O): recebe o texto já extraído do PDF (pdfjs) ou o JSON devolvido
 * pela IA de Visão e devolve blocos por funcionário já normalizados.
 *
 * O resultado é convertido em AOA (cabeçalho + linhas) para alimentar EXATAMENTE
 * o mesmo pipeline do Excel: Motor de Layouts → AutoMap → Match → Validação →
 * Histórico → Consolidação → Motor de Cálculo.
 */

import { normalizarCategoriaPiso, normalizarTexto, type CategoriaPiso } from "./piso-categorias";

export type RubricaKey =
  | "salario_base"
  | "dias_trabalhados"
  | "tempo_servico"
  | "insalubridade"
  | "adicional_noturno"
  | "hora_extra_100"
  | "hora_extra_50"
  | "plantao"
  | "sobreaviso"
  | "vale_transporte"
  | "aux_financeiro"
  | "grat_funcao_vr"
  | "grat_funcao_pct"
  | "grat_nivel_superior"
  | "incentivos"
  | "inss"
  | "irrf"
  | "outros_descontos"
  | "total_positivos"
  | "total_desconto"
  | "total_proventos_folha"
  | "total_descontos_folha"
  | "valor_liquido_folha"
  | "adn_informativo";

type RubricaDef = {
  key: RubricaKey;
  /** Cabeçalho gerado no AOA — reconhecido pelos aliases já existentes. */
  header: string;
  /** Códigos da folha (quando existirem). */
  codigos: string[];
  re: RegExp;
  /** Quando true, soma todas as ocorrências encontradas no bloco. */
  soma?: boolean;
};

/** Rubricas extraídas do contracheque, sempre pela coluna "Integral". */
export const RUBRICAS_FOPAG: RubricaDef[] = [
  { key: "salario_base", header: "SALARIO BASE", codigos: ["1"], re: /SALARIO BASE/ },
  { key: "dias_trabalhados", header: "DIAS TRABALHADOS", codigos: [], re: /DIAS|REFERENCIA/ },
  {
    key: "tempo_servico",
    header: "TEMPO DE SERVICO",
    codigos: ["81"],
    re: /GRATIFICACAO TEMPO (DE )?SERVICO|TEMPO DE SERVICO|ANUENIO|TRIENIO|QUINQUENIO|ADIC. TEMPO/,
  },
  { key: "insalubridade", header: "INSALUBRIDADE", codigos: ["207"], re: /INSALUBRIDADE/ },
  {
    key: "adicional_noturno",
    header: "ADICIONAL NOTURNO",
    codigos: ["109"],
    re: /ADIC\w* NOTURNO|ADICIONAL NOTURNO|AD. NOT./,
  },
  { key: "hora_extra_100", header: "HORA EXTRA 100", codigos: ["4010"], re: /HORA EXTRA 100/ },
  { key: "hora_extra_50", header: "HORA EXTRA 50", codigos: ["4020"], re: /HORA EXTRA 50/ },
  { key: "plantao", header: "PLANTAO", codigos: ["285"], re: /PLANTAO/ },
  { key: "sobreaviso", header: "SOBREAVISO", codigos: ["299"], re: /SOBREAVISO/ },
  {
    key: "vale_transporte",
    header: "VALE TRANSPORTE",
    codigos: ["310"],
    re: /AUXILIO TRANSPORTE|VALE TRANSPORTE|VT/,
  },
  {
    key: "aux_financeiro",
    header: "AUX.FINANC.",
    codigos: ["61"],
    re: /COMPLEMENTO FINANCEIRO PISO|COMPLEMENTO PISO|COMPL\w* PISO ENFERMAGEM|AUX FINANC PISO/,
  },
  {
    key: "grat_funcao_vr",
    header: "GRAT.FUNCAO VR",
    codigos: [],
    re: /GRATIFICACAO FUNCAO \(VR\)/,
  },
  {
    key: "grat_nivel_superior",
    header: "GRAT.NIVEL SUP.",
    codigos: ["283"],
    re: /GRATIF\w* DE NIVEL SUPERIOR|GRATIF\w* NIVEL SUPERIOR|GRAT NIVEL SUP/,
  },
  {
    key: "incentivos",
    header: "INCENTIVOS",
    codigos: ["412", "413", "417"],
    re: /INCENTIVO/,
    soma: true,
  },
  { key: "inss", header: "INSS", codigos: [], re: /\bINSS\b|I.N.S.S/ },
  { key: "irrf", header: "IRRF", codigos: [], re: /\bIRRF\b|IMPOSTO DE RENDA|\bIRPF\b|I.R.R.F/ },
  {
    key: "outros_descontos",
    header: "OUTROS DESCONTOS",
    codigos: [],
    re: /CONVENIO|CONSIGNADO|EMPRESTIMO|SINDICATO/,
    soma: true,
  },
  {
    key: "total_proventos_folha",
    header: "TOTAL PROVENTOS FOLHA",
    codigos: [],
    re: /TOTAL (DE )?PROVENTOS|TOTAL (DE )?VANTAGENS|BRUTO/,
  },
  {
    key: "total_descontos_folha",
    header: "TOTAL DESCONTOS FOLHA",
    codigos: [],
    re: /TOTAL (DE )?DESCONTOS/,
  },
  {
    key: "valor_liquido_folha",
    header: "VALOR LIQUIDO FOLHA",
    codigos: [],
    re: /TOTAL LIQUIDO|LIQUIDO A RECEBER|VALOR LIQUIDO|\bLIQUIDO\b/,
  },
  {
    key: "adn_informativo",
    header: "ADN INFORMATIVO",
    codigos: [],
    re: /BASE PATRONAL RGPS|ADN/,
  },
];

export type FopagFuncionario = {
  nome: string | null;
  cargo: string | null;
  categoria: CategoriaPiso | null;
  cpf: string | null;
  matricula: string | null;
  rubricas: Record<RubricaKey, number>;
  /** 0..1 — proporção de campos-chave localizados no bloco. */
  confianca: number;
  /** 0..1 por campo (IA de Visão devolve confiança individual). */
  confiancaCampos: Record<string, number>;
  /** Inconsistências financeiras detectadas (viram pendência). */
  divergencias: string[];
  /** Correções automáticas aplicadas (totais derivados, normalizações). */
  correcoes: string[];
  /** Linhas com aparência de rubrica que nenhum alias reconheceu. */
  rubricasNaoReconhecidas: string[];
  pagina: number | null;
  confidence_extraction: number | null;
  confidence_validation: number | null;
  validation_status: "READY" | "REVIEW_REQUIRED" | "ERROR" | null;
};

export type FopagExtracao = {
  competencia: string | null;
  funcionarios: FopagFuncionario[];
  /** Blocos descartados por não serem da enfermagem. */
  ignorados: number;
  cargosIgnorados: string[];
  /** Rubricas que não apareceram em nenhum funcionário. */
  rubricasAusentes: string[];
  confiancaMedia: number;
  /** Funcionários com divergência financeira ou CPF inválido. */
  comDivergencia: number;
  cpfInvalido: number;
  /** Menor confiança individual encontrada (0..1). */
  confiancaMinima: number;
  /** Confiança média por página do documento. */
  confiancaPorPagina: { pagina: number; confianca: number; funcionarios: number }[];
  /** Rubricas efetivamente reconhecidas/normalizadas no documento. */
  rubricasNormalizadas: string[];
  /** Linhas de rubrica que nenhum alias reconheceu (para evoluir o dicionário). */
  rubricasNaoReconhecidas: string[];
  /** Quantidade de correções automáticas aplicadas. */
  correcoesAutomaticas: number;
};


const MESES_MAP: Record<string, string> = {
  JANEIRO: "01",
  FEVEREIRO: "02",
  MARCO: "03",
  ABRIL: "04",
  MAIO: "05",
  JUNHO: "06",
  JULHO: "07",
  AGOSTO: "08",
  SETEMBRO: "09",
  OUTUBRO: "10",
  NOVEMBRO: "11",
  DEZEMBRO: "12",
};

/** "R$ 2.544,02" | "2544.02" | 2544.02 → 2544.02 (0 quando ausente/ inválido). */
export function normalizarValor(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v)
    .replace(/[R$\s\u00a0]/g, "")
    .replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  const temVirgula = s.includes(",");
  if (temVirgula) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Validação dos dígitos verificadores do CPF. */
export function cpfValido(cpf: string | null | undefined): boolean {
  const d = String(cpf ?? "").replace(/\D+/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dig = (base: number) => {
    let soma = 0;
    for (let i = 0; i < base; i++) soma += Number(d[i]) * (base + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dig(9) === Number(d[9]) && dig(10) === Number(d[10]);
}

/** "031.067.932-01" → "03106793201" */
export function normalizarCpf(v: unknown): string | null {
  const d = String(v ?? "").replace(/\D+/g, "");
  return d.length === 11 ? d : null;
}

export function normalizarMatricula(v: unknown): string | null {
  const s = String(v ?? "")
    .replace(/[\s\u00a0]+/g, "")
    .replace(/^0+(?=\d)/, "")
    .trim();
  return s || null;
}

/** Remove caracteres invisíveis e normaliza espaços, preservando acentos. */
export function limparTexto(v: unknown): string {
  return String(v ?? "")
    .replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, "")
    .replace(/[\s\u00a0]+/g, " ")
    .trim();
}

const RE_MOEDA = /-?\d{1,3}(?:\.\d{3})+,\d{2}|-?\d+,\d{2}|-?\d+\.\d{2}\b/g;

/** Último valor monetário da linha = coluna "Integral" do contracheque. */
function valorIntegralDaLinha(linha: string): number {
  const achados = linha.match(RE_MOEDA);
  if (!achados || achados.length === 0) return 0;
  return normalizarValor(achados[achados.length - 1]);
}

function rubricasVazias(): Record<RubricaKey, number> {
  const out = {} as Record<RubricaKey, number>;
  for (const r of RUBRICAS_FOPAG) out[r.key] = 0;
  return out;
}

/** Detecta a competência (YYYY-MM) em qualquer trecho do documento. */
export function detectarCompetenciaFopag(texto: string): string | null {
  const t = normalizarTexto(texto);
  const mNome = t.match(
    /\b(JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\D{0,12}(\d{4})\b/,
  );
  if (mNome) return `${mNome[2]}-${MESES_MAP[mNome[1]]}`;
  const mNum = texto.match(/\b(0[1-9]|1[0-2])[/\-.](20\d{2})\b/);
  if (mNum) return `${mNum[2]}-${mNum[1]}`;
  const mIso = texto.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
  if (mIso) return `${mIso[1]}-${mIso[2]}`;
  return null;
}

const RE_INICIO_BLOCO = /Funcion[áa]rio(?:\s*\(a\))?/i;

/** Divide o texto do PDF em blocos independentes por funcionário. */
export function separarBlocos(texto: string): string[] {
  const linhas = texto.split(/\r?\n/);
  const blocos: string[] = [];
  let atual: string[] | null = null;
  for (const l of linhas) {
    if (RE_INICIO_BLOCO.test(l)) {
      if (atual && atual.length) blocos.push(atual.join("\n"));
      atual = [l];
    } else if (atual) {
      atual.push(l);
    }
  }
  if (atual && atual.length) blocos.push(atual.join("\n"));
  return blocos;
}

/** true quando a página inicia um novo bloco de funcionário (texto pesquisável). */
export function paginaIniciaBloco(textoPagina: string): boolean {
  return RE_INICIO_BLOCO.test(textoPagina ?? "");
}

/**
 * Divide o documento em janelas de páginas que NUNCA cortam um funcionário ao
 * meio: o corte só acontece numa página que comprovadamente inicia um novo
 * bloco. Quando não há indício de início de bloco (PDF totalmente escaneado),
 * a janela cresce até o limite técnico e o corte carrega a página anterior por
 * sobreposição, preservando a continuidade lógica.
 */
export function janelasContinuas(
  numPages: number,
  paginasTexto: string[],
  maxPaginas = 12,
): number[][] {
  if (numPages <= 0) return [];
  if (numPages <= maxPaginas) return [Array.from({ length: numPages }, (_, i) => i + 1)];

  const inicia = (n: number) => paginaIniciaBloco(paginasTexto[n - 1] ?? "");
  const janelas: number[][] = [];
  let inicio = 1;

  while (inicio <= numPages) {
    let fim = Math.min(inicio + maxPaginas - 1, numPages);
    if (fim < numPages) {
      // Recua até a última página que começa um novo bloco (corte seguro).
      let corte = fim + 1;
      while (corte > inicio + 1 && !inicia(corte)) corte--;
      fim = inicia(corte) ? corte - 1 : fim;
    }
    janelas.push(Array.from({ length: fim - inicio + 1 }, (_, i) => inicio + i));
    // Sem corte seguro comprovado: repete a última página na janela seguinte.
    inicio = fim + 1 <= numPages && !inicia(fim + 1) ? fim : fim + 1;
  }
  return janelas;
}

function extrairNome(bloco: string): string | null {
  const m =
    bloco.match(/Funcion[áa]rio(?:\s*\(a\))?\s*[:\-]?\s*(?:\d{1,10}\s+)?([A-Za-zÀ-ÿ' .]{5,80})/i) ??
    null;
  if (m) {
    const nome = limparTexto(m[1])
      .replace(/\b(CPF|CARGO|MATRICULA|MATRÍCULA|ADMISS[ÃA]O|LOTA[ÇC][ÃA]O).*$/i, "")
      .trim();
    if (nome.split(/\s+/).length >= 2) return nome.toUpperCase();
  }
  return null;
}

function extrairCargo(bloco: string): string | null {
  const m = bloco.match(/Cargo\s*[:\-]?\s*([A-Za-zÀ-ÿ0-9'.\-/ ]{3,60})/i);
  if (m) {
    const cargo = limparTexto(m[1])
      .replace(/\b(CBO|ADMISS[ÃA]O|LOTA[ÇC][ÃA]O|SETOR|VINCULO|V[ÍI]NCULO).*$/i, "")
      .trim();
    if (cargo) return cargo.toUpperCase();
  }
  // Fallback: procura em qualquer linha um texto que resolva para categoria da enfermagem
  for (const linha of bloco.split(/\r?\n/).slice(0, 12)) {
    const limpa = limparTexto(linha);
    if (!limpa) continue;
    if (normalizarCategoriaPiso(limpa)) return limpa.toUpperCase();
  }
  return null;
}

function extrairMatricula(bloco: string): string | null {
  const m = bloco.match(/Matr[íi]cula\s*[:\-]?\s*([0-9][0-9.\-/]{0,14})/i);
  if (m) return normalizarMatricula(m[1]);
  const m2 = bloco.match(/Funcion[áa]rio(?:\s*\(a\))?\s*[:\-]?\s*(\d{2,10})\b/i);
  return m2 ? normalizarMatricula(m2[1]) : null;
}

function extrairCpf(bloco: string): string | null {
  const m = bloco.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  if (m) return normalizarCpf(m[0]);
  const m2 = bloco.match(/CPF\s*[:\-]?\s*(\d{11})\b/i);
  return m2 ? normalizarCpf(m2[1]) : null;
}

/** Lê as rubricas do bloco sempre pela coluna Integral (último valor da linha). */
export function extrairRubricas(bloco: string): Record<RubricaKey, number> {
  const rubricas = rubricasVazias();
  const linhas = bloco.split(/\r?\n/);
  for (const linhaBruta of linhas) {
    const linha = limparTexto(linhaBruta);
    if (!linha) continue;
    const norm = normalizarTexto(linha);
    if (!norm) continue;
    for (const def of RUBRICAS_FOPAG) {
      if (!def.re.test(norm)) continue;
      const valor = valorIntegralDaLinha(linha);
      if (valor === 0 && rubricas[def.key] !== 0) continue;
      if (def.soma) rubricas[def.key] += valor;
      else if (rubricas[def.key] === 0) rubricas[def.key] = valor;
      break;
    }
  }
  return rubricas;
}

/** Linhas que parecem rubrica (código + descrição + valor) mas nenhum alias cobriu. */
export function rubricasNaoReconhecidasDoBloco(bloco: string): string[] {
  const out: string[] = [];
  for (const linhaBruta of bloco.split(/\r?\n/)) {
    const linha = limparTexto(linhaBruta);
    const norm = normalizarTexto(linha);
    if (!norm || norm.length < 6) continue;
    if (!RE_MOEDA.test(linha)) {
      RE_MOEDA.lastIndex = 0;
      continue;
    }
    RE_MOEDA.lastIndex = 0;
    if (!/[A-Z]{4,}/.test(norm)) continue;
    if (/(CPF|CARGO|LOTACAO|MATRICULA|FUNCIONARIO|SERVIDOR|ADMISSAO|BANCO|AGENCIA|CONTA|PREFEITURA|FOLHA)/.test(norm))
      continue;
    if (RUBRICAS_FOPAG.some((d) => d.re.test(norm))) continue;
    const desc = norm.replace(RE_MOEDA, "").replace(/\s+/g, " ").trim();
    RE_MOEDA.lastIndex = 0;
    if (desc && !out.includes(desc)) out.push(desc.slice(0, 60));
  }
  return out.slice(0, 10);
}

type FuncionarioBase = Omit<
  FopagFuncionario,
  "confianca" | "divergencias" | "confiancaCampos" | "correcoes"
>;

function calcularConfianca(f: FuncionarioBase): number {
  const checks = [
    Boolean(f.nome),
    Boolean(f.cpf),
    Boolean(f.cargo),
    Boolean(f.matricula),
    f.rubricas.salario_base > 0,
    f.rubricas.total_proventos_folha > 0 || f.rubricas.valor_liquido_folha > 0,
  ];
  return checks.filter(Boolean).length / checks.length;
}

/** Rubricas que compõem o Total de Proventos. */
const CHAVES_PROVENTOS: RubricaKey[] = [
  "salario_base",
  "tempo_servico",
  "insalubridade",
  "adicional_noturno",
  "hora_extra_100",
  "hora_extra_50",
  "plantao",
  "sobreaviso",
  "vale_transporte",
  "aux_financeiro",
  "grat_funcao_vr",
  "grat_nivel_superior",
  "incentivos",
];

const TOLERANCIA = 0.05;

/** Validações financeiras cruzadas — divergência vira pendência, nunca silêncio. */
export function validarFinanceiro(r: Record<RubricaKey, number>): string[] {
  const out: string[] = [];
  const somaProventos = CHAVES_PROVENTOS.reduce((s, k) => s + (r[k] || 0), 0);
  if (r.total_proventos_folha > 0 && Math.abs(somaProventos - r.total_proventos_folha) > TOLERANCIA) {
    out.push(
      `Total de proventos (${r.total_proventos_folha.toFixed(2)}) difere da soma das rubricas (${somaProventos.toFixed(2)}).`,
    );
  }
  const somaDescontos = (r.inss || 0) + (r.irrf || 0);
  if (r.total_descontos_folha > 0 && somaDescontos - r.total_descontos_folha > TOLERANCIA) {
    out.push(
      `Total de descontos (${r.total_descontos_folha.toFixed(2)}) menor que INSS + IRRF (${somaDescontos.toFixed(2)}).`,
    );
  }
  if (r.valor_liquido_folha > 0 && r.total_proventos_folha > 0) {
    const esperado = r.total_proventos_folha - r.total_descontos_folha;
    if (Math.abs(esperado - r.valor_liquido_folha) > TOLERANCIA) {
      out.push(
        `Líquido (${r.valor_liquido_folha.toFixed(2)}) difere de proventos - descontos (${esperado.toFixed(2)}).`,
      );
    }
  }
  return out;
}

/**
 * Correções automáticas conservadoras: só preenche totais AUSENTES a partir das
 * rubricas já lidas. Nunca sobrescreve um valor impresso na folha.
 */
function autocorrigir(r: Record<RubricaKey, number>): string[] {
  const feitas: string[] = [];
  const somaProventos = CHAVES_PROVENTOS.reduce((s, k) => s + (r[k] || 0), 0);
  if (r.total_proventos_folha === 0 && somaProventos > 0) {
    r.total_proventos_folha = Number(somaProventos.toFixed(2));
    feitas.push("Total de proventos calculado pela soma das rubricas.");
  }
  if (r.total_descontos_folha === 0 && r.inss + r.irrf > 0) {
    r.total_descontos_folha = Number((r.inss + r.irrf).toFixed(2));
    feitas.push("Total de descontos calculado por INSS + IRRF.");
  }
  if (r.valor_liquido_folha === 0 && r.total_proventos_folha > 0) {
    r.valor_liquido_folha = Number((r.total_proventos_folha - r.total_descontos_folha).toFixed(2));
    feitas.push("Líquido calculado por proventos - descontos.");
  }
  return feitas;
}

function montar(parcial: FuncionarioBase, confiancaCampos: Record<string, number> = {}): FopagFuncionario {
  const confIA = Object.values(confiancaCampos);
  const confianca = confIA.length
    ? (calcularConfianca(parcial) + confIA.reduce((s, v) => s + v, 0) / confIA.length) / 2
    : calcularConfianca(parcial);
  
  const correcoes = autocorrigir(parcial.rubricas);
  const divergencias = validarFinanceiro(parcial.rubricas);
  
  if (parcial.cpf && !cpfValido(parcial.cpf)) {
    divergencias.push(`CPF inválido (dígitos verificadores): ${parcial.cpf}.`);
  }

  // Regra Crítica: Validação Semântica de Dias
  let confValidacao = 1;
  let statusValidacao: "READY" | "REVIEW_REQUIRED" | "ERROR" = "READY";
  
  // Se dias_trabalhados for estranho (muito alto ou tempo de serviço vazando)
  if (parcial.rubricas.dias_trabalhados > 31 || parcial.rubricas.dias_trabalhados === parcial.rubricas.tempo_servico) {
    confValidacao = 0;
    statusValidacao = "REVIEW_REQUIRED";
    divergencias.push(`Alerta Semântico: Dias Trabalhados (${parcial.rubricas.dias_trabalhados}) parece incorreto (vazamento de Tempo de Serviço ou valor > 31).`);
  }

  return { 
    ...parcial, 
    confiancaCampos, 
    confianca, 
    divergencias, 
    correcoes,
    // Novos campos de confiança e status
    confidence_extraction: confianca,
    confidence_validation: confValidacao,
    validation_status: statusValidacao
  };
}

/** Converte um bloco textual em funcionário normalizado (sem filtro de cargo). */
export function parseBloco(bloco: string, pagina: number | null = null): FopagFuncionario {
  return montar({
    nome: extrairNome(bloco),
    cargo: extrairCargo(bloco),
    categoria: normalizarCategoriaPiso(extrairCargo(bloco)),
    cpf: extrairCpf(bloco),
    matricula: extrairMatricula(bloco),
    rubricas: extrairRubricas(bloco),
    rubricasNaoReconhecidas: rubricasNaoReconhecidasDoBloco(bloco),
    pagina,
    confidence_extraction: null,
    confidence_validation: null,
    validation_status: null,
  });
}

/** Chave de identidade para deduplicar blocos repetidos (sobreposição de lotes). */
function chaveIdentidade(f: FopagFuncionario): string {
  return f.cpf ?? f.matricula ?? f.nome ?? "";
}

function deduplicar(brutos: FopagFuncionario[]): FopagFuncionario[] {
  const mapa = new Map<string, FopagFuncionario>();
  const semChave: FopagFuncionario[] = [];
  for (const f of brutos) {
    const k = chaveIdentidade(f);
    if (!k) {
      semChave.push(f);
      continue;
    }
    const atual = mapa.get(k);
    if (!atual) {
      mapa.set(k, f);
      continue;
    }
    const peso = (x: FopagFuncionario) =>
      Object.values(x.rubricas).filter((v) => v !== 0).length + x.confianca;
    if (peso(f) > peso(atual)) mapa.set(k, f);
  }
  return [...mapa.values(), ...semChave];
}

function finalizar(
  brutos: FopagFuncionario[],
  competencia: string | null,
): FopagExtracao {
  const funcionarios: FopagFuncionario[] = [];
  const cargosIgnorados: string[] = [];
  let ignorados = 0;

  for (const f of deduplicar(brutos)) {
    if (!f.categoria) {
      ignorados++;
      const c = f.cargo ?? "(cargo não identificado)";
      if (!cargosIgnorados.includes(c)) cargosIgnorados.push(c);
      continue;
    }
    funcionarios.push(f);
  }

  const rubricasAusentes = RUBRICAS_FOPAG.filter(
    (r) => !funcionarios.some((f) => f.rubricas[r.key] !== 0),
  ).map((r) => r.header);

  const confiancaMedia = funcionarios.length
    ? funcionarios.reduce((s, f) => s + f.confianca, 0) / funcionarios.length
    : 0;

  const porPagina = new Map<number, { soma: number; n: number }>();
  for (const f of funcionarios) {
    const p = f.pagina ?? 0;
    const acc = porPagina.get(p) ?? { soma: 0, n: 0 };
    porPagina.set(p, { soma: acc.soma + f.confianca, n: acc.n + 1 });
  }

  const naoReconhecidas: string[] = [];
  for (const f of funcionarios) {
    for (const r of f.rubricasNaoReconhecidas) if (!naoReconhecidas.includes(r)) naoReconhecidas.push(r);
  }

  return {
    competencia,
    funcionarios,
    ignorados,
    cargosIgnorados: cargosIgnorados.slice(0, 30),
    rubricasAusentes,
    confiancaMedia,
    comDivergencia: funcionarios.filter((f) => f.divergencias.length > 0).length,
    cpfInvalido: funcionarios.filter((f) => !f.cpf || !cpfValido(f.cpf)).length,
    confiancaMinima: funcionarios.length
      ? Math.min(...funcionarios.map((f) => f.confianca))
      : 0,
    confiancaPorPagina: [...porPagina.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([pagina, v]) => ({ pagina, confianca: v.soma / v.n, funcionarios: v.n })),
    rubricasNormalizadas: RUBRICAS_FOPAG.filter((r) =>
      funcionarios.some((f) => f.rubricas[r.key] !== 0),
    ).map((r) => r.header),
    rubricasNaoReconhecidas: naoReconhecidas.slice(0, 40),
    correcoesAutomaticas: funcionarios.reduce((s, f) => s + f.correcoes.length, 0),
  };
}

/**
 * Extração completa a partir do texto de todas as páginas (PDF pesquisável).
 * Os blocos atravessam a fronteira de páginas: um funcionário iniciado na
 * página N e continuado na N+1 permanece íntegro.
 */
export function parseFopagTexto(paginas: string[]): FopagExtracao {
  const brutos: FopagFuncionario[] = [];
  let atual: string[] | null = null;
  let paginaBloco = 1;

  const fechar = () => {
    if (atual && atual.length) {
      const f = parseBloco(atual.join("\n"), paginaBloco);
      // Blocos sem nenhum indício de pessoa são cabeçalhos/rodapés — descartar.
      if (f.nome || f.cpf) brutos.push(f);
    }
    atual = null;
  };

  paginas.forEach((texto, idx) => {
    for (const linha of texto.split(/\r?\n/)) {
      if (RE_INICIO_BLOCO.test(linha)) {
        fechar();
        atual = [linha];
        paginaBloco = idx + 1;
      } else if (atual) {
        atual.push(linha);
      }
    }
  });
  fechar();

  return finalizar(brutos, detectarCompetenciaFopag(paginas.join("\n")));
}

/** Aceita tanto `campo: valor` quanto `campo: { valor, confidence }`. */
function valorCampo(v: unknown): unknown {
  if (v && typeof v === "object" && !Array.isArray(v) && "valor" in (v as object)) {
    return (v as { valor: unknown }).valor;
  }
  return v;
}

function confiancaCampo(v: unknown): number | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const c = (v as { confidence?: unknown }).confidence;
    if (typeof c === "number" && Number.isFinite(c)) return Math.min(Math.max(c, 0), 1);
  }
  return null;
}

/** Normaliza o JSON devolvido pela IA de Visão para o mesmo formato interno. */
export function parseFopagIA(
  payloads: { competencia?: string | null; funcionarios?: unknown[] }[],
): FopagExtracao {
  const brutos: FopagFuncionario[] = [];
  let competencia: string | null = null;

  for (const p of payloads) {
    if (!competencia && p.competencia) {
      const bruta = String(valorCampo(p.competencia));
      competencia = detectarCompetenciaFopag(bruta) ?? bruta;
    }
    for (const item of p.funcionarios ?? []) {
      const o = (item ?? {}) as Record<string, unknown>;
      const conf: Record<string, number> = {};
      const rub = rubricasVazias();
      const fonte = (o.rubricas ?? o) as Record<string, unknown>;
      for (const def of RUBRICAS_FOPAG) {
        rub[def.key] = normalizarValor(valorCampo(fonte[def.key]));
        const c = confiancaCampo(fonte[def.key]);
        if (c != null) conf[def.key] = c;
      }
      for (const campo of ["nome", "cargo", "cpf", "matricula"]) {
        const c = confiancaCampo(o[campo]);
        if (c != null) conf[campo] = c;
      }
      const cargoBruto = valorCampo(o.cargo);
      const cargo = cargoBruto ? limparTexto(cargoBruto).toUpperCase() : null;
      const nomeBruto = valorCampo(o.nome);
      const pagina = valorCampo(o.pagina);
      const parcial: FuncionarioBase = {
        nome: nomeBruto ? limparTexto(nomeBruto).toUpperCase() : null,
        cargo,
        categoria: normalizarCategoriaPiso(cargo),
        cpf: normalizarCpf(valorCampo(o.cpf)),
        matricula: normalizarMatricula(valorCampo(o.matricula)),
        rubricas: rub,
        rubricasNaoReconhecidas: [],
        pagina: typeof pagina === "number" ? pagina : null,
        confidence_extraction: null,
        confidence_validation: null,
        validation_status: null,
      };
      if (!parcial.nome && !parcial.cpf) continue;
      brutos.push(montar(parcial, conf));
    }
  }
  return finalizar(brutos, competencia);
}


/**
 * Converte a extração em AOA (cabeçalho + linhas) usando cabeçalhos que os
 * aliases já existentes reconhecem — o Motor de Layouts/AutoMap segue igual.
 */
export function fopagParaAoa(extracao: FopagExtracao): unknown[][] {
  const headers = [
    "CPF",
    "NOME",
    "MATRICULA",
    "CARGO",
    "COMPETENCIA",
    ...RUBRICAS_FOPAG.map((r) => r.header),
  ];
  const linhas = extracao.funcionarios.map((f) => [
    f.cpf ?? "",
    f.nome ?? "",
    f.matricula ?? "",
    f.cargo ?? "",
    extracao.competencia ?? "",
    ...RUBRICAS_FOPAG.map((r) => f.rubricas[r.key]),
  ]);
  return [headers, ...linhas];
}

/** Contagem por categoria para o resumo pré-importação. */
export function resumoCategorias(extracao: FopagExtracao) {
  const conta = (c: CategoriaPiso) =>
    extracao.funcionarios.filter((f) => f.categoria === c).length;
  return {
    total: extracao.funcionarios.length,
    enfermeiros: conta("ENFERMEIRO"),
    tecnicos: conta("TECNICO_ENFERMAGEM"),
    auxiliares: conta("AUXILIAR_ENFERMAGEM"),
    ignorados: extracao.ignorados,
    confiancaMedia: extracao.confiancaMedia,
    confiancaMinima: extracao.confiancaMinima,
    correcoesAutomaticas: extracao.correcoesAutomaticas,
    rubricasNaoReconhecidas: extracao.rubricasNaoReconhecidas,
    rubricasAusentes: extracao.rubricasAusentes,
    comDivergencia: extracao.comDivergencia,
    cpfInvalido: extracao.cpfInvalido,
  };

}
