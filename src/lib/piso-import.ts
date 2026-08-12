// Motor de resolução de linhas do módulo Piso Nacional da Enfermagem.
// Puro: recebe linhas cruas + mapeamento + mapas de match e devolve linhas
// normalizadas prontas para gravação. Testado em piso-import.test.ts.

import { onlyDigits, parseNumeric, type PisoDestino } from "./piso-mapping";
import { normCpf, normMatricula } from "./piso-match";

/**
 * Destino de cada coluna. Aceita os campos do sistema e também chaves livres de
 * campos personalizados criados pelo usuário (prefixo `extra_`).
 */
export type Mapeamento = Record<string, PisoDestino | (string & {}) | null>;

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
  dias_trabalhados: number | null;
  piso_complementacao: number | null;
  insalubridade: number | null;
  gratificacao: number | null;
  grat_funcao_vr: number | null;
  grat_funcao_pct: number | null;
  grat_nivel_superior: number | null;
  incentivos: number | null;
  hora_extra_50: number | null;
  hora_extra_100: number | null;
  adicional_noturno: number | null;
  auxilio_financeiro: number | null;
  aux_financeiro: number | null;
  ferias_1_3: number | null;
  ferias: number | null;
  ferias_normais: number | null;
  inss: number | null;
  irrf: number | null;
  iss: number | null;
  outros_descontos: number | null;
  valor_liquido: number | null;
  valor_final: number | null;
  total_positivos: number | null;
  total_desconto: number | null;
  tempo_servico: number | null;
  plantao: number | null;
  sobreaviso: number | null;
  vale_transporte: number | null;
  total_descontos: number | null;
  total_proventos: number | null;
  total_proventos_folha: number | null;
  total_descontos_folha: number | null;
  valor_liquido_folha: number | null;
  adn_informativo: number | null;
  profissional_id: string | null;
  status_match: "cpf" | "matricula" | "nome" | "nao_localizado";
  confidence_extraction: number | null;
  confidence_validation: number | null;
  validation_status: "READY" | "REVIEW_REQUIRED" | "ERROR" | null;
};

const NUMERIC_KEYS: PisoDestino[] = [
  "salario_base",
  "dias_trabalhados",
  "piso_complementacao",
  "insalubridade",
  "gratificacao",
  "grat_funcao_vr",
  "grat_funcao_pct",
  "grat_nivel_superior",
  "incentivos",
  "hora_extra_50",
  "hora_extra_100",
  "adicional_noturno",
  "auxilio_financeiro",
  "aux_financeiro",
  "ferias_1_3",
  "ferias",
  "ferias_normais",
  "inss",
  "irrf",
  "iss",
  "outros_descontos",
  "valor_liquido",
  "valor_final",
  "total_positivos",
  "total_desconto",
  "tempo_servico",
  "plantao",
  "sobreaviso",
  "vale_transporte",
  "total_descontos",
  "total_proventos",
  "total_proventos_folha",
  "total_descontos_folha",
  "valor_liquido_folha",
  "adn_informativo",
];

function isNumericKey(k: PisoDestino): boolean {
  return NUMERIC_KEYS.includes(k);
}

/**
 * `numericos` recebe chaves de campos personalizados criados pelo usuário que
 * devem ser lidos como valor monetário (ex.: extra_grat_incentivo).
 */
function applyMap(
  row: RawRow,
  mapeamento: Mapeamento,
  numericos?: ReadonlySet<string>,
): Partial<ResolvedRow> {
  const out: Record<string, unknown> = {};
  for (const [header, dest] of Object.entries(mapeamento)) {
    if (!dest) continue;
    const raw = row[header];
    if (isNumericKey(dest as PisoDestino) || numericos?.has(dest)) {
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
    dias_trabalhados: null,
    piso_complementacao: null,
    insalubridade: null,
    gratificacao: null,
    grat_funcao_vr: null,
    grat_funcao_pct: null,
    grat_nivel_superior: null,
    incentivos: null,
    hora_extra_50: null,
    hora_extra_100: null,
    adicional_noturno: null,
    auxilio_financeiro: null,
    aux_financeiro: null,
    ferias_1_3: null,
    ferias: null,
    ferias_normais: null,
    inss: null,
    irrf: null,
    iss: null,
    outros_descontos: null,
    valor_liquido: null,
    valor_final: null,
    total_positivos: null,
    total_desconto: null,
    tempo_servico: null,
    plantao: null,
    sobreaviso: null,
    vale_transporte: null,
    total_descontos: null,
    total_proventos: null,
    total_proventos_folha: null,
    total_descontos_folha: null,
    valor_liquido_folha: null,
    adn_informativo: null,
    profissional_id: null,
    status_match: "nao_localizado",
    confidence_extraction: null,
    confidence_validation: null,
    validation_status: null,
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
  const cpf = normCpf(row.cpf);
  if (cpf) {
    const id = maps.byCpf[cpf];
    if (id) return { profissional_id: id, status_match: "cpf" };
  }
  const mat = normMatricula(row.matricula);
  if (mat) {
    const id = maps.byMatricula[mat];
    if (id) return { profissional_id: id, status_match: "matricula" };
  }
  return { profissional_id: null, status_match: "nao_localizado" };
}

/** Aplica mapa + resolve match para todas as linhas cruas. */
export function resolveRows(
  rows: RawRow[],
  mapeamento: Mapeamento,
  maps: MatchMaps,
  opts?: { numericos?: readonly string[] },
): ResolvedRow[] {
  const numericos = opts?.numericos?.length ? new Set(opts.numericos) : undefined;
  return rows.map((raw) => {
    const partial = applyMap(raw, mapeamento, numericos);
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
