/**
 * Motor da Folha Financeira (projeção salarial).
 * Módulo PURO: não lê nem grava no banco. Recebe parâmetros (Configuração
 * Municipal) + quantidades da folha de frequência aprovada e devolve a
 * memória de cálculo. A folha de frequência continua sendo a única fonte
 * de quantidades; este módulo só traduz quantidades em R$.
 */
import { parseNumeroPtBr } from "@/lib/numero-ptbr";

export type FaixaInss = { ate: number; pct: number };
export type FaixaIrrf = { ate: number | null; pct: number; deducao: number };
export type CargoFinanceiro = {
  salario_base?: number | null;
  carga_semanal?: number | null;
  insalubridade_pct?: number | null;
  valor_plantao?: number | null;
};

export const NIVEIS_ESCOLARIDADE = [
  { k: "fundamental", h: "Fundamental" },
  { k: "medio", h: "Médio" },
  { k: "tecnico", h: "Técnico" },
  { k: "superior", h: "Superior" },
  { k: "pos_graduacao", h: "Pós-graduação" },
] as const;
export type NivelEscolaridade = (typeof NIVEIS_ESCOLARIDADE)[number]["k"];

/** Regras por nível de escolaridade do cargo. Campos vazios herdam a regra geral. */
export type NivelFinanceiro = {
  salario_base?: number | null;
  gratificacao_pct?: number | null;
  carga_semanal?: number | null;
  he50_fator?: number | null;
  he100_fator?: number | null;
  adn_pct?: number | null;
  valor_plantao?: number | null;
  valor_sobreaviso?: number | null;
  insalubridade_pct?: number | null;
};

export type ParametrosFinanceiros = {
  niveis: Partial<Record<NivelEscolaridade, NivelFinanceiro>>;
  /** Preenchido em tempo de leitura (cadastro de cargos); não é salvo. */
  nivelPorCargo?: Record<string, string | null>;
  salario_minimo: number;
  rpps_pct: number;
  he50_fator: number;
  he100_fator: number;
  adn_pct: number;
  valor_plantao: number;
  valor_sobreaviso: number;
  iss_pct: number;
  inss_faixas: FaixaInss[];
  irrf_faixas: FaixaIrrf[];
  cargos: Record<string, CargoFinanceiro>;
  /** Base da insalubridade: salário mínimo (padrão) ou salário base do servidor. */
  insalubridade_base?: "minimo" | "salario_base";
  /** Divisor da hora: carga semanal × 5 (padrão) ou fixo (ex.: 220). */
  divisor_modo?: "carga" | "fixo";
  divisor_fixo?: number;
};

/** Valores de partida (editáveis). Conferir tabelas oficiais vigentes. */
export const DEFAULT_FINANCEIRO: ParametrosFinanceiros = {
  salario_minimo: 1518,
  rpps_pct: 14,
  he50_fator: 1.5,
  he100_fator: 2,
  adn_pct: 20,
  valor_plantao: 0,
  valor_sobreaviso: 0,
  iss_pct: 0,
  inss_faixas: [
    { ate: 1518, pct: 7.5 },
    { ate: 2793.88, pct: 9 },
    { ate: 4190.83, pct: 12 },
    { ate: 8157.41, pct: 14 },
  ],
  irrf_faixas: [
    { ate: 2428.8, pct: 0, deducao: 0 },
    { ate: 2826.65, pct: 7.5, deducao: 182.16 },
    { ate: 3751.05, pct: 15, deducao: 394.16 },
    { ate: 4664.68, pct: 22.5, deducao: 675.49 },
    { ate: null, pct: 27.5, deducao: 908.73 },
  ],
  cargos: {},
  niveis: {},
};

const num = (v: unknown, d = 0) => {
  if (v === null || v === undefined || v === "") return d;
  const n = typeof v === "number" ? v : parseNumeroPtBr(v);
  return Number.isFinite(n) ? n : d;
};
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseNumeroPtBr(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function parseFinanceiro(raw: unknown): ParametrosFinanceiros {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_FINANCEIRO;
  const inss = Array.isArray(p.inss_faixas)
    ? (p.inss_faixas as Record<string, unknown>[]).map((f) => ({ ate: num(f.ate), pct: num(f.pct) })).filter((f) => f.ate > 0)
    : d.inss_faixas;
  const irrf = Array.isArray(p.irrf_faixas)
    ? (p.irrf_faixas as Record<string, unknown>[]).map((f) => ({
        ate: numOrNull(f.ate),
        pct: num(f.pct),
        deducao: num(f.deducao),
      }))
    : d.irrf_faixas;
  const cargosRaw = (p.cargos && typeof p.cargos === "object" ? p.cargos : {}) as Record<string, Record<string, unknown>>;
  const cargos: Record<string, CargoFinanceiro> = {};
  for (const [id, c] of Object.entries(cargosRaw)) {
    cargos[id] = {
      salario_base: numOrNull(c?.salario_base),
      carga_semanal: numOrNull(c?.carga_semanal),
      insalubridade_pct: numOrNull(c?.insalubridade_pct),
      valor_plantao: numOrNull(c?.valor_plantao),
    };
  }
  const niveisRaw = (p.niveis && typeof p.niveis === "object" ? p.niveis : {}) as Record<string, Record<string, unknown>>;
  const niveis: ParametrosFinanceiros["niveis"] = {};
  for (const { k } of NIVEIS_ESCOLARIDADE) {
    const n = niveisRaw[k];
    if (!n) continue;
    niveis[k] = {
      salario_base: numOrNull(n.salario_base),
      gratificacao_pct: numOrNull(n.gratificacao_pct),
      carga_semanal: numOrNull(n.carga_semanal),
      he50_fator: numOrNull(n.he50_fator),
      he100_fator: numOrNull(n.he100_fator),
      adn_pct: numOrNull(n.adn_pct),
      valor_plantao: numOrNull(n.valor_plantao),
      valor_sobreaviso: numOrNull(n.valor_sobreaviso),
      insalubridade_pct: numOrNull(n.insalubridade_pct),
    };
  }
  return {
    niveis,
    salario_minimo: num(p.salario_minimo, d.salario_minimo),
    rpps_pct: num(p.rpps_pct, d.rpps_pct),
    he50_fator: num(p.he50_fator, d.he50_fator),
    he100_fator: num(p.he100_fator, d.he100_fator),
    adn_pct: num(p.adn_pct, d.adn_pct),
    valor_plantao: num(p.valor_plantao, d.valor_plantao),
    valor_sobreaviso: num(p.valor_sobreaviso, d.valor_sobreaviso),
    iss_pct: num(p.iss_pct, d.iss_pct),
    inss_faixas: inss.length ? inss : d.inss_faixas,
    irrf_faixas: irrf.length ? irrf : d.irrf_faixas,
    cargos,
    insalubridade_base: p.insalubridade_base === "salario_base" ? "salario_base" : "minimo",
    divisor_modo: p.divisor_modo === "fixo" ? "fixo" : "carga",
    divisor_fixo: num(p.divisor_fixo, 220),
  };
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function calcularInss(base: number, faixas: FaixaInss[]): number {
  let total = 0;
  let anterior = 0;
  const ordenadas = [...faixas].sort((a, b) => a.ate - b.ate);
  for (const f of ordenadas) {
    if (base <= anterior) break;
    const topo = Math.min(base, f.ate);
    total += (topo - anterior) * (f.pct / 100);
    anterior = f.ate;
  }
  return r2(total); // acima do teto não incide
}

export function calcularIrrf(base: number, faixas: FaixaIrrf[]): number {
  if (base <= 0) return 0;
  const ordenadas = [...faixas].sort((a, b) => (a.ate ?? Infinity) - (b.ate ?? Infinity));
  const f = ordenadas.find((x) => x.ate === null || base <= x.ate) ?? ordenadas[ordenadas.length - 1];
  if (!f) return 0;
  return r2(Math.max(0, base * (f.pct / 100) - f.deducao));
}

export type EntradaCalculo = {
  tipo: "efetivos" | "contratados";
  cargo_id: string | null;
  /** Salário próprio do profissional (exceção). Se vazio, usa o do cargo. */
  salario_proprio: number | null;
  carga_cargo: number | null;
  /** Nível de escolaridade do cargo; se ausente, busca em p.nivelPorCargo. */
  nivel_cargo?: string | null;
  vinculo_nome?: string | null;
  diasTrabalhados: number;
  faltasInjustificadas: number;
  faltasJustificadas: number;
  atestado: number;
  he50: number;
  he100: number;
  adn: number;
  plantoes: number;
  sobreaviso: number;
  incentivo: number;
};

export type ResultadoCalculo = {
  origemBase: "profissional" | "cargo" | "nivel" | "sem_base";
  salarioBase: number;
  valorHora: number;
  descontoFaltas: number;
  baseProporcional: number;
  vHe50: number;
  vHe100: number;
  vAdn: number;
  vPlantoes: number;
  vSobreaviso: number;
  vIncentivo: number;
  vInsalubridade: number;
  vGratificacao: number;
  nivel: string | null;
  bruto: number;
  previdencia: number;
  previdenciaTipo: "RPPS" | "INSS";
  irrf: number;
  iss: number;
  descontos: number;
  liquido: number;
};

const RE_AUTONOMO = /(rpa|aut[oô]nomo|prestador)/i;

export function calcularFolha(e: EntradaCalculo, p: ParametrosFinanceiros): ResultadoCalculo {
  const cargo = (e.cargo_id && p.cargos[e.cargo_id]) || {};
  const nivel = e.nivel_cargo ?? (e.cargo_id ? p.nivelPorCargo?.[e.cargo_id] ?? null : null);
  const nv: NivelFinanceiro = (nivel && p.niveis?.[nivel as NivelEscolaridade]) || {};
  // Prioridade: próprio do profissional > cargo > nível de escolaridade.
  const salCargo = cargo.salario_base ?? null;
  const salNivel = nv.salario_base ?? null;
  const origemBase: ResultadoCalculo["origemBase"] =
    e.salario_proprio && e.salario_proprio > 0 ? "profissional" : salCargo ? "cargo" : salNivel ? "nivel" : "sem_base";
  const salarioBase =
    origemBase === "profissional" ? e.salario_proprio! : origemBase === "cargo" ? salCargo! : origemBase === "nivel" ? salNivel! : 0;
  const carga = cargo.carga_semanal || nv.carga_semanal || e.carga_cargo || 40;
  const divisor = p.divisor_modo === "fixo" && (p.divisor_fixo ?? 0) > 0 ? p.divisor_fixo! : carga * 5;
  const valorHora = divisor > 0 ? salarioBase / divisor : 0;
  // Atestado e falta justificada não descontam; só falta injustificada (1/30 por dia).
  const descontoFaltas = Math.min(salarioBase, (salarioBase / 30) * Math.max(0, e.faltasInjustificadas));
  const baseProporcional = salarioBase - descontoFaltas;
  const vGratificacao = baseProporcional * ((nv.gratificacao_pct ?? 0) / 100);
  const vHe50 = e.he50 * valorHora * (nv.he50_fator ?? p.he50_fator);
  const vHe100 = e.he100 * valorHora * (nv.he100_fator ?? p.he100_fator);
  const vAdn = e.adn * valorHora * ((nv.adn_pct ?? p.adn_pct) / 100);
  const vPlantoes = e.plantoes * (cargo.valor_plantao ?? nv.valor_plantao ?? p.valor_plantao);
  const vSobreaviso = e.sobreaviso * (nv.valor_sobreaviso ?? p.valor_sobreaviso);
  const vIncentivo = e.incentivo;
  const insalPct = cargo.insalubridade_pct ?? nv.insalubridade_pct ?? 0;
  const vInsalubridade = insalPct ? (p.insalubridade_base === "salario_base" ? salarioBase : p.salario_minimo) * (insalPct / 100) : 0;
  const bruto = baseProporcional + vGratificacao + vHe50 + vHe100 + vAdn + vPlantoes + vSobreaviso + vIncentivo + vInsalubridade;
  const autonomo = !!e.vinculo_nome && RE_AUTONOMO.test(e.vinculo_nome);
  const previdenciaTipo = e.tipo === "efetivos" ? "RPPS" : "INSS";
  const previdencia = autonomo
    ? 0
    : previdenciaTipo === "RPPS"
      ? r2(bruto * (p.rpps_pct / 100))
      : calcularInss(bruto, p.inss_faixas);
  const irrf = calcularIrrf(bruto - previdencia, p.irrf_faixas);
  const iss = autonomo ? r2(bruto * (p.iss_pct / 100)) : 0;
  const descontos = previdencia + irrf + iss;
  return {
    origemBase,
    salarioBase: r2(salarioBase),
    vGratificacao: r2(vGratificacao),
    nivel,
    valorHora: r2(valorHora),
    descontoFaltas: r2(descontoFaltas),
    baseProporcional: r2(baseProporcional),
    vHe50: r2(vHe50),
    vHe100: r2(vHe100),
    vAdn: r2(vAdn),
    vPlantoes: r2(vPlantoes),
    vSobreaviso: r2(vSobreaviso),
    vIncentivo: r2(vIncentivo),
    vInsalubridade: r2(vInsalubridade),
    bruto: r2(bruto),
    previdencia,
    previdenciaTipo,
    irrf,
    iss,
    descontos: r2(descontos),
    liquido: r2(bruto - descontos),
  };
}

export const brl = (v: number) =>
  (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
