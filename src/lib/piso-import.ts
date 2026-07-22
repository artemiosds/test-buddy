// Motor de resolução de linhas do módulo Piso Nacional da Enfermagem.
// Puro: recebe linhas cruas + mapeamento + mapas de match e devolve linhas
// normalizadas prontas para gravação. Testado em piso-import.test.ts.

import { onlyDigits, parseNumeric, type PisoDestino } from "./piso-mapping";

export type Mapeamento = Record<string, PisoDestino | null>;

export type RawRow = Record<string, unknown>;

export type ResolvedRow = {
  cpf: string | null;
  nome: string | null;
  matricula: string | null;
  cargo: string | null;
  unidade: string | null;
  setor: string | null;
  vinculo: string | null;
  competencia: string | null;
  salario_base: number | null;
  piso_complementacao: number | null;
  insalubridade: number | null;
  gratificacao: number | null;
  hora_extra_50: number | null;
  hora_extra_100: number | null;
  adicional_noturno: number | null;
  auxilio_financeiro: number | null;
  ferias_1_3: number | null;
  ferias: number | null;
  inss: number | null;
  irrf: number | null;
  valor_liquido: number | null;
  valor_final: number | null;
  profissional_id: string | null;
  status_match: "cpf" | "matricula" | "nome" | "nao_localizado";
};

const NUMERIC_KEYS: PisoDestino[] = [
  "salario_base",
  "piso_complementacao",
  "insalubridade",
  "gratificacao",
  "hora_extra_50",
  "hora_extra_100",
  "adicional_noturno",
  "auxilio_financeiro",
  "ferias_1_3",
  "ferias",
  "inss",
  "irrf",
  "valor_liquido",
  "valor_final",
];

function isNumericKey(k: PisoDestino): boolean {
  return NUMERIC_KEYS.includes(k);
}

function applyMap(row: RawRow, mapeamento: Mapeamento): Partial<ResolvedRow> {
  const out: Record<string, unknown> = {};
  for (const [header, dest] of Object.entries(mapeamento)) {
    if (!dest) continue;
    const raw = row[header];
    if (isNumericKey(dest)) {
      out[dest] = parseNumeric(raw);
    } else if (dest === "cpf") {
      const d = onlyDigits(raw);
      out[dest] = d ? d : null;
    } else {
      out[dest] = raw == null || raw === "" ? null : String(raw).trim();
    }
  }
  return out as Partial<ResolvedRow>;
}

function empty(): ResolvedRow {
  return {
    cpf: null,
    nome: null,
    matricula: null,
    cargo: null,
    unidade: null,
    setor: null,
    vinculo: null,
    competencia: null,
    salario_base: null,
    piso_complementacao: null,
    insalubridade: null,
    gratificacao: null,
    hora_extra_50: null,
    hora_extra_100: null,
    adicional_noturno: null,
    auxilio_financeiro: null,
    ferias_1_3: null,
    ferias: null,
    inss: null,
    irrf: null,
    valor_liquido: null,
    valor_final: null,
    profissional_id: null,
    status_match: "nao_localizado",
  };
}

export type MatchMaps = {
  byCpf: Record<string, string>; // cpf(11 dig) -> profissional_id
  byMatricula: Record<string, string>; // matricula   -> profissional_id
};

/**
 * Resolve profissional_id + status_match segundo a ordem: CPF → matrícula → nao_localizado.
 * Fuzzy nome fica para fase 2.
 */
export function resolveMatch(
  row: Pick<ResolvedRow, "cpf" | "matricula">,
  maps: MatchMaps,
): {
  profissional_id: string | null;
  status_match: ResolvedRow["status_match"];
} {
  if (row.cpf) {
    const id = maps.byCpf[row.cpf];
    if (id) return { profissional_id: id, status_match: "cpf" };
  }
  if (row.matricula) {
    const id = maps.byMatricula[row.matricula];
    if (id) return { profissional_id: id, status_match: "matricula" };
  }
  return { profissional_id: null, status_match: "nao_localizado" };
}

/** Aplica mapa + resolve match para todas as linhas cruas. */
export function resolveRows(
  rows: RawRow[],
  mapeamento: Mapeamento,
  maps: MatchMaps,
): ResolvedRow[] {
  return rows.map((raw) => {
    const partial = applyMap(raw, mapeamento);
    const base = { ...empty(), ...partial };
    const m = resolveMatch(base, maps);
    return { ...base, ...m };
  });
}

export type ImportStats = {
  total: number;
  importados: number;
  divergentes: number;
  nao_localizados: number;
};

export function statsFrom(rows: ResolvedRow[]): ImportStats {
  let importados = 0,
    divergentes = 0,
    nao_localizados = 0;
  for (const r of rows) {
    if (r.status_match === "nao_localizado") {
      nao_localizados++;
      continue;
    }
    if (!r.cpf && !r.matricula) {
      divergentes++;
      continue;
    }
    importados++;
  }
  return { total: rows.length, importados, divergentes, nao_localizados };
}
