// Parser + helpers para importação de folha CER (Centro Especializado em Reabilitação).
// 100% puro (sem I/O) — coberto em cer-import.test.ts.

import { normalize } from "./piso-mapping";
import { bestFuzzy, similarity, type FuzzyCandidate } from "./piso-fuzzy";

// ---------- CONTA ---------------------------------------------------------

/** Bancos reconhecíveis por palavra no texto livre da coluna CONTA. */
export const BANCOS_CONHECIDOS = [
  "NU PAGAMENTOS",
  "NUBANK",
  "BRADESCO",
  "BANPARÁ",
  "BANPARA",
  "SANTANDER",
  "CAIXA",
  "ITAÚ",
  "ITAU",
  "SICOOB",
  "SICREDI",
  "INTER",
  "BB",
] as const;

export type ContaParsed = {
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  /**
   *  - `vazio`     → texto ausente
   *  - `ok`        → agência e conta reconhecidas
   *  - `parcial`   → só agência ou só conta reconhecida
   *  - `revisar`   → padrão não reconhecido; texto original em `conta`
   */
  status: "vazio" | "ok" | "parcial" | "revisar";
};

const TOKEN = "([0-9][0-9.\\-]*)";
const AG_RE = new RegExp(`AG\\s*[:;]\\s*${TOKEN}`, "i");
const CC_RE = new RegExp(`CC\\s*[:;]\\s*${TOKEN}`, "i");

/** Extrai banco / agência / conta do texto livre da coluna CONTA. */
export function parseConta(raw: unknown): ContaParsed {
  if (raw == null) return { banco: null, agencia: null, conta: null, status: "vazio" };
  const text = String(raw).trim();
  if (!text) return { banco: null, agencia: null, conta: null, status: "vazio" };

  const upper = text.toUpperCase();
  const ag = AG_RE.exec(upper)?.[1] ?? null;
  const cc = CC_RE.exec(upper)?.[1] ?? null;

  let banco: string | null = null;
  for (const b of BANCOS_CONHECIDOS) {
    // usa word-boundary manual para não pegar "BBB" dentro de outro token
    const re = new RegExp(`(^|[^A-Z])${b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Z]|$)`, "i");
    if (re.test(upper)) {
      banco = b;
      break;
    }
  }

  if (!ag && !cc) {
    return { banco, agencia: null, conta: text, status: "revisar" };
  }
  return {
    banco,
    agencia: ag,
    conta: cc,
    status: ag && cc ? "ok" : "parcial",
  };
}

// ---------- CABEÇALHO -----------------------------------------------------

const HEADER_KEYS = ["nome", "cpf", "lotacao", "cargo", "conta"];

/**
 * Devolve o índice (0-based) da linha de cabeçalho na matriz.
 * Requer que a linha contenha `nome` + `cpf` + `lotacao` + `cargo` (após normalizar).
 * Retorna -1 se não encontrar nas primeiras `limit` linhas.
 */
export function detectHeaderRow(aoa: unknown[][], limit = 10): number {
  const scan = Math.min(limit, aoa.length);
  for (let i = 0; i < scan; i++) {
    const row = aoa[i] ?? [];
    const cells = row.map((c) => normalize(String(c ?? "")).replace(/[.\s]+/g, ""));
    const has = (needle: string) => cells.some((c) => c.includes(needle));
    if (has("nome") && has("cpf") && has("lotacao") && has("cargo")) return i;
  }
  return -1;
}

// ---------- FUZZY MATCH ---------------------------------------------------

export type UnidadeCand = FuzzyCandidate & { sigla?: string | null };
export type CargoCand = FuzzyCandidate;

export type MatchResult = {
  id: string | null;
  nome: string | null;
  score: number;
  ambiguo: boolean;
  /** candidatos empatados quando `ambiguo=true`, ou vazio */
  candidatos: { id: string; nome: string; score: number }[];
};

const NO_MATCH: MatchResult = { id: null, nome: null, score: 0, ambiguo: false, candidatos: [] };

/** Match contra unidades — usa nome e sigla. Ambíguo quando o 2º está a <=0.05 do 1º. */
export function fuzzyMatchUnidade(termo: string, cands: UnidadeCand[]): MatchResult {
  if (!termo?.trim() || cands.length === 0) return NO_MATCH;
  const T = normalize(termo);
  // sigla exata é ganho seguro (evita ambiguidade)
  const exataSigla = cands.find((c) => c.sigla && normalize(c.sigla) === T);
  if (exataSigla) return { id: exataSigla.id, nome: exataSigla.nome, score: 1, ambiguo: false, candidatos: [] };
  return matchScored(termo, cands);
}

/** Match contra cargos — apenas nome. */
export function fuzzyMatchCargo(termo: string, cands: CargoCand[]): MatchResult {
  if (!termo?.trim() || cands.length === 0) return NO_MATCH;
  return matchScored(termo, cands);
}

function matchScored(termo: string, cands: FuzzyCandidate[]): MatchResult {
  const scored = cands
    .map((c) => ({ id: c.id, nome: c.nome, score: similarity(termo, c.nome) }))
    .sort((a, b) => b.score - a.score);
  const top = scored[0];
  if (!top || top.score < 0.7) {
    // fallback: usa bestFuzzy só para respeitar o limiar interno
    const fb = bestFuzzy(termo, cands);
    if (!fb) return NO_MATCH;
    return { id: fb.id, nome: fb.nome, score: fb.score, ambiguo: false, candidatos: [] };
  }
  const second = scored[1];
  const ambiguo = !!second && top.score - second.score <= 0.05 && second.score >= 0.7;
  if (ambiguo) {
    return { id: null, nome: null, score: top.score, ambiguo: true, candidatos: scored.slice(0, 3) };
  }
  return { id: top.id, nome: top.nome, score: top.score, ambiguo: false, candidatos: [] };
}

// ---------- DEDUP POR CPF -------------------------------------------------

export type DedupMode = "merge-vazios" | "pular";

export type ExistingProfissional = {
  id: string;
  nome_completo: string;
  banco: string | null;
  agencia: string | null;
  conta_corrente: string | null;
  unidade_id: string | null;
  cargo_id: string | null;
};

export type IncomingProfissional = {
  nome_completo: string;
  cpf: string;
  unidade_id: string | null;
  cargo_id: string | null;
  banco: string | null;
  agencia: string | null;
  conta_corrente: string | null;
};

/**
 * Devolve o `patch` que deve ser aplicado em `existing`, ou `null` para pular.
 * Modo `merge-vazios`: preenche apenas campos hoje nulos/vazios.
 * Modo `pular`: sempre null.
 */
export function resolveDuplicate(
  incoming: IncomingProfissional,
  existing: ExistingProfissional,
  mode: DedupMode,
): Partial<ExistingProfissional> | null {
  if (mode === "pular") return null;
  const patch: Partial<ExistingProfissional> = {};
  const empty = (v: unknown) => v == null || String(v).trim() === "";
  if (empty(existing.banco) && !empty(incoming.banco)) patch.banco = incoming.banco;
  if (empty(existing.agencia) && !empty(incoming.agencia)) patch.agencia = incoming.agencia;
  if (empty(existing.conta_corrente) && !empty(incoming.conta_corrente))
    patch.conta_corrente = incoming.conta_corrente;
  if (empty(existing.unidade_id) && !empty(incoming.unidade_id)) patch.unidade_id = incoming.unidade_id;
  if (empty(existing.cargo_id) && !empty(incoming.cargo_id)) patch.cargo_id = incoming.cargo_id;
  return Object.keys(patch).length ? patch : null;
}

// ---------- CPF -----------------------------------------------------------

/** Só dígitos. */
export const cpfDigits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

// ---------- LINHAS --------------------------------------------------------

export type CerRowRaw = {
  linha: number;
  nome: string;
  cpf_original: string;
  cpf: string; // só dígitos
  lotacao: string;
  cargo: string;
  data_admissao: string | null;
  conta_raw: string;
};

/** Colunas SEMPRE ignoradas — retornadas para uso na UI (nem mostradas no mapeamento). */
export const COLUNAS_IGNORADAS = [
  "N°", "Nº", "N.", "DIAS", "BASE", "INSALUBRIDADE", "H.E.", "H.E", "HE",
  "AD.NOTURNO", "AD NOTURNO", "BRUTO", "ISS", "V.LÍQUIDO", "V.LIQUIDO", "LIQUIDO",
];

/** Retorna as linhas de dados a partir da AOA e do índice do cabeçalho. */
export function extractCerRows(aoa: unknown[][], headerIdx: number): CerRowRaw[] {
  if (headerIdx < 0) return [];
  const header = (aoa[headerIdx] ?? []).map((c) =>
    normalize(String(c ?? "")).replace(/[.\s]+/g, ""),
  );
  const col = (needle: string) => header.findIndex((c) => c.includes(needle));
  const iNome = col("nome");
  const iCpf = col("cpf");
  const iLot = col("lotacao");
  const iCargo = col("cargo");
  const iConta = col("conta");
  const iAdm = col("dataadmissao");

  const out: CerRowRaw[] = [];
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const row = aoa[i] ?? [];
    const nome = String(row[iNome] ?? "").trim();
    if (!nome) continue;
    if (/^total/i.test(nome)) break; // linha "TOTAL"
    const cpfOrig = String(row[iCpf] ?? "").trim();
    const admRaw = iAdm >= 0 ? row[iAdm] : null;
    out.push({
      linha: i + 1, // 1-based p/ humanos
      nome,
      cpf_original: cpfOrig,
      cpf: cpfDigits(cpfOrig),
      lotacao: String(row[iLot] ?? "").trim(),
      cargo: String(row[iCargo] ?? "").trim(),
      data_admissao: parseAdmissao(admRaw),
      conta_raw: String(row[iConta] ?? "").trim(),
    });
  }
  return out;
}

function parseAdmissao(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const dot = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dot) return `${dot[3]}-${dot[2]}-${dot[1]}`;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return s;
  return null;
}