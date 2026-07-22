// Heurísticas do módulo Piso Nacional da Enfermagem — puras, sem I/O.
// Detecção de modelo/competência pelo nome do arquivo, confiança do
// mapeamento por coluna e indicadores de qualidade das linhas cruas.

import { normalize, onlyDigits, suggestDestino, type PisoDestino } from "./piso-mapping";

export type ModeloDetectado = "Efetivos" | "Contratados" | "Ministério" | null;

const MESES: Record<string, number> = {
  janeiro: 1,
  jan: 1,
  fevereiro: 2,
  fev: 2,
  marco: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  maio: 5,
  mai: 5,
  junho: 6,
  jun: 6,
  julho: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  setembro: 9,
  set: 9,
  outubro: 10,
  out: 10,
  novembro: 11,
  nov: 11,
  dezembro: 12,
  dez: 12,
};

const MES_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** Detecta modelo pelo nome do arquivo (Efetivos/Contratados/Ministério). */
export function detectarModelo(nomeArquivo: string): ModeloDetectado {
  const n = normalize(nomeArquivo);
  if (/\bcontrat/.test(n)) return "Contratados";
  if (/\befetiv|fopag|folha efetiv/.test(n)) return "Efetivos";
  if (/\bministeri|\bms\b/.test(n)) return "Ministério";
  return null;
}

/** Extrai competência ("Mês AAAA") do nome do arquivo, quando possível. */
export function detectarCompetencia(nomeArquivo: string): string | null {
  const n = normalize(nomeArquivo);
  // padrão "MM AAAA" ou "MM-AAAA" ou "AAAA MM"
  const num = n.match(/(?:(\d{1,2})[\s\-_/](\d{4}))|(?:(\d{4})[\s\-_/](\d{1,2}))/);
  if (num) {
    const mes = Number(num[1] ?? num[4]);
    const ano = Number(num[2] ?? num[3]);
    if (mes >= 1 && mes <= 12 && ano >= 2000 && ano <= 2100) {
      return `${MES_LABELS[mes - 1]} ${ano}`;
    }
  }
  // padrão "janeiro 2026", "jan 2026"
  const nome = n.match(
    /(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[\s\-_/]?(\d{4})/,
  );
  if (nome) {
    const mes = MESES[nome[1]];
    const ano = Number(nome[2]);
    if (mes && ano >= 2000 && ano <= 2100) return `${MES_LABELS[mes - 1]} ${ano}`;
  }
  return null;
}

/** Competência atual no formato "Mês AAAA". */
export function competenciaAtual(now: Date = new Date()): string {
  return `${MES_LABELS[now.getMonth()]} ${now.getFullYear()}`;
}

// -------------------- Confiança do mapeamento --------------------

export type ConfidenceTone = "high" | "medium" | "low" | "none";

export type HeaderConfidence = {
  destino: PisoDestino | null;
  score: number; // 0..1
  tone: ConfidenceTone;
};

/**
 * Estima confiança de um header→destino baseado na força do match:
 *  - alias exato → 0.95
 *  - alias por inclusão → 0.75
 *  - sem sugestão → 0.
 */
export function headerConfidence(header: string): HeaderConfidence {
  const destino = suggestDestino(header);
  if (!destino) return { destino: null, score: 0, tone: "none" };
  const norm = normalize(header);
  const strong = norm.length <= 24 && /^[a-z0-9 %]+$/.test(norm);
  const exact = norm.split(" ").length <= 3;
  const score = strong && exact ? 0.95 : 0.75;
  return { destino, score, tone: toneFor(score) };
}

export function toneFor(score: number): ConfidenceTone {
  if (score >= 0.9) return "high";
  if (score >= 0.7) return "medium";
  if (score > 0) return "low";
  return "none";
}

// -------------------- Qualidade das linhas cruas --------------------

export type QualityReport = {
  total: number;
  cpfValidos: number;
  cpfPct: number;
  matriculaPreenchida: number;
  matriculaPct: number;
  nomePreenchido: number;
  nomePct: number;
  overall: ConfidenceTone;
};

/** Um CPF é "válido" para o quality check quando tem 11 dígitos. */
export function isCpfValido(v: unknown): boolean {
  const d = onlyDigits(v);
  return d.length === 11;
}

export function computeQuality(
  rows: Record<string, unknown>[],
  mapeamento: Record<string, PisoDestino | null>,
): QualityReport {
  const cpfCol = colDe(mapeamento, "cpf");
  const matCol = colDe(mapeamento, "matricula");
  const nomeCol = colDe(mapeamento, "nome");
  const total = rows.length;

  let cpfValidos = 0,
    matriculaPreenchida = 0,
    nomePreenchido = 0;
  for (const r of rows) {
    if (cpfCol && isCpfValido(r[cpfCol])) cpfValidos++;
    if (matCol && String(r[matCol] ?? "").trim()) matriculaPreenchida++;
    if (nomeCol && String(r[nomeCol] ?? "").trim()) nomePreenchido++;
  }
  const pct = (n: number) => (total === 0 ? 0 : n / total);
  const cpfPct = pct(cpfValidos);
  const matriculaPct = pct(matriculaPreenchida);
  const nomePct = pct(nomePreenchido);
  const media = (cpfPct + nomePct) / 2;
  return {
    total,
    cpfValidos,
    cpfPct,
    matriculaPreenchida,
    matriculaPct,
    nomePreenchido,
    nomePct,
    overall: toneFor(media),
  };
}

function colDe(m: Record<string, PisoDestino | null>, dest: PisoDestino): string | null {
  const hit = Object.entries(m).find(([, d]) => d === dest);
  return hit ? hit[0] : null;
}

// -------------------- Modo rápido: assinatura do arquivo --------------------

/** Assinatura estável para comparar dois arquivos pelo conjunto de colunas. */
export function fingerprint(headers: string[]): string {
  return headers
    .map((h) => normalize(h))
    .sort()
    .join("|");
}

// -------------------- Detecção inteligente de cabeçalho --------------------

/** Palavras-chave que caracterizam uma linha de cabeçalho de folha do Piso. */
const HEADER_KEYWORDS = [
  "cpf",
  "nome",
  "matricula",
  "mat",
  "cargo",
  "funcao",
  "unidade",
  "setor",
  "vinculo",
  "regime",
  "competencia",
  "referencia",
  "salario",
  "vencimento",
  "base",
  "piso",
  "complementacao",
  "compl",
  "insalubridade",
  "insalub",
  "gratificacao",
  "gratif",
  "grat fun",
  "hora extra",
  "he 50",
  "he 100",
  "he50",
  "he100",
  "hr ex",
  "hr extra",
  "adicional noturno",
  "adic noturno",
  "adn",
  "ad noturno",
  "auxilio",
  "financ",
  "aux financ",
  "ferias",
  "1 3",
  "terco",
  "inss",
  "irrf",
  "ir",
  "liquido",
  "total",
  "valor",
  "vale transp",
  "tempo serv",
  "tempo de serv",
];

function nonEmptyCells(row: unknown[]): number {
  let n = 0;
  for (const c of row) {
    if (c == null) continue;
    if (typeof c === "string" && c.trim() === "") continue;
    n++;
  }
  return n;
}

/** Conta quantas palavras-chave batem nos rótulos da linha. */
function keywordHits(row: unknown[]): number {
  let hits = 0;
  for (const cell of row) {
    if (cell == null) continue;
    const s = normalize(String(cell));
    if (!s) continue;
    for (const kw of HEADER_KEYWORDS) {
      if (s === kw || s.includes(kw)) {
        hits++;
        break;
      }
    }
  }
  return hits;
}

/**
 * Detecta em qual linha (0-indexed) estão os cabeçalhos reais do arquivo.
 * Estratégia:
 *  - percorre as primeiras `maxScan` linhas
 *  - descarta linhas com ≤1 célula preenchida (títulos como "CALCULO PISO ENFERMAGEM")
 *  - escolhe a linha com maior número de palavras-chave conhecidas
 *  - empate: prefere a que tem mais colunas preenchidas
 *  - fallback: primeira linha com ≥3 células preenchidas; senão, 0.
 */
export function detectHeaderRow(aoa: unknown[][], maxScan = 10): number {
  const limit = Math.min(aoa.length, maxScan);
  let bestIdx = -1;
  let bestHits = 0;
  let bestCols = 0;
  for (let i = 0; i < limit; i++) {
    const row = aoa[i] ?? [];
    const cols = nonEmptyCells(row);
    if (cols <= 1) continue; // título ou linha vazia
    const hits = keywordHits(row);
    if (hits > bestHits || (hits === bestHits && cols > bestCols)) {
      bestHits = hits;
      bestCols = cols;
      bestIdx = i;
    }
  }
  if (bestIdx >= 0 && bestHits >= 2) return bestIdx;
  // Fallback: primeira linha com ≥3 células preenchidas
  for (let i = 0; i < limit; i++) {
    if (nonEmptyCells(aoa[i] ?? []) >= 3) return i;
  }
  return 0;
}

/** Normaliza um rótulo de cabeçalho, gerando nome sintético para células vazias/duplicadas. */
function labelHeaders(row: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Map<string, number>();
  for (let i = 0; i < row.length; i++) {
    const raw = row[i];
    let label = raw == null ? "" : String(raw).trim();
    if (!label) label = `Coluna ${i + 1}`;
    const count = seen.get(label) ?? 0;
    seen.set(label, count + 1);
    out.push(count === 0 ? label : `${label} (${count + 1})`);
  }
  return out;
}

/**
 * Constrói `{ headers, rows }` a partir de um AOA e do índice da linha de cabeçalho.
 *  - pula linhas totalmente vazias após o cabeçalho
 *  - descarta linhas onde a coluna de CPF (se identificável) não parece um CPF —
 *    isto elimina sub-cabeçalhos repetidos tipo "NOME. CPF".
 */
export function buildRowsFromAoa(
  aoa: unknown[][],
  headerRowIndex: number,
): { headers: string[]; rows: Record<string, unknown>[] } {
  const headers = labelHeaders(aoa[headerRowIndex] ?? []);
  const cpfColIdx = headers.findIndex((h) => normalize(h).includes("cpf"));
  const rows: Record<string, unknown>[] = [];
  for (let i = headerRowIndex + 1; i < aoa.length; i++) {
    const raw = aoa[i] ?? [];
    if (nonEmptyCells(raw) === 0) continue;
    if (cpfColIdx >= 0) {
      const cell = String(raw[cpfColIdx] ?? "").trim();
      // linha de rótulo se a "célula de CPF" é a própria palavra "CPF"
      if (cell && normalize(cell) === "cpf") continue;
    }
    const obj: Record<string, unknown> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = raw[c] ?? "";
    }
    rows.push(obj);
  }
  return { headers, rows };
}
