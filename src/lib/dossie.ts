/**
 * Dossiê Funcional — helpers puros de agregação/apresentação.
 *
 * Não faz nenhuma consulta: recebe dados já carregados pelos hooks/queries
 * existentes (`profissional_historico_funcional`, `frequencia_profissional`,
 * `frequencia_pendencias`) e devolve derivações prontas para render.
 *
 * Nada aqui altera cálculo de folha, competência, ou permissão. Apenas
 * apresentação.
 */

export type HistoricoEvento = {
  id: string;
  tipo_evento: string;
  data_inicio: string;
  data_fim: string | null;
  motivo: string | null;
  observacoes: string | null;
  documento_referencia: string | null;
  unidade_novo_id: string | null;
  unidade_anterior_id: string | null;
  setor_novo_id: string | null;
  setor_anterior_id: string | null;
  cargo_novo_id: string | null;
  cargo_anterior_id: string | null;
  funcao_novo_id: string | null;
  funcao_anterior_id: string | null;
  vinculo_novo_id: string | null;
  vinculo_anterior_id: string | null;
};

export type LinhaFrequenciaMin = {
  status_linha: string;
  faltas_injustificadas: number | null;
  faltas_justificadas: number | null;
  he_50: number | null;
  he_100: number | null;
  competencia_key: string | null;
  unidade_id: string | null;
};

export type DossieResumo = {
  totalCompetencias: number;
  totalFrequencias: number;
  totalHorasExtras: number;
  totalFaltas: number;
  pendenciasAbertas: number;
  pendenciasResolvidas: number;
  frequenciasAprovadas: number;
  percentualAprovadas: number;
  unidadesDistintas: number;
  setoresDistintos: number;
  cargosDistintos: number;
  funcoesDistintas: number;
  diasDesdeUltimaMovimentacao: number | null;
};

const MOVIMENTACAO_TIPOS = new Set([
  "admissao",
  "transferencia",
  "promocao",
  "mudanca_cargo",
  "mudanca_funcao",
  "mudanca_vinculo",
  "desligamento",
]);

/** Anos+meses+dias entre `admissao` e `ref` (default: hoje). */
export function formatTempoServico(
  admissao: string | Date | null | undefined,
  ref: Date = new Date(),
): string {
  if (!admissao) return "—";
  const d = admissao instanceof Date ? admissao : new Date(admissao);
  if (Number.isNaN(d.getTime())) return "—";
  if (d > ref) return "—";
  let anos = ref.getFullYear() - d.getFullYear();
  let meses = ref.getMonth() - d.getMonth();
  let dias = ref.getDate() - d.getDate();
  if (dias < 0) {
    meses -= 1;
    const prevMonth = new Date(ref.getFullYear(), ref.getMonth(), 0);
    dias += prevMonth.getDate();
  }
  if (meses < 0) {
    anos -= 1;
    meses += 12;
  }
  const partes: string[] = [];
  if (anos > 0) partes.push(`${anos}a`);
  if (meses > 0) partes.push(`${meses}m`);
  if (!partes.length) partes.push(`${dias}d`);
  return partes.join(" ");
}

export function diasDesde(iso: string | null | undefined, ref: Date = new Date()): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((ref.getTime() - d.getTime()) / 86_400_000));
}

/** Extrai lotações (eventos que trocam unidade/setor/cargo/função) ordenadas do
 *  mais recente para o mais antigo. `data_fim` é o `data_inicio` do próximo
 *  evento quando ausente. */
export function deriveLotacoes(historico: HistoricoEvento[]): Array<
  HistoricoEvento & { data_fim_efetiva: string | null }
> {
  const relevantes = historico.filter(
    (e) =>
      e.unidade_novo_id ||
      e.setor_novo_id ||
      e.cargo_novo_id ||
      e.funcao_novo_id ||
      e.tipo_evento === "admissao",
  );
  const asc = relevantes.slice().sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
  const withFim = asc.map((ev, i) => ({
    ...ev,
    data_fim_efetiva: ev.data_fim ?? asc[i + 1]?.data_inicio ?? null,
  }));
  return withFim.reverse();
}

export function deriveMovimentacoes(historico: HistoricoEvento[]): HistoricoEvento[] {
  return historico
    .filter((e) => MOVIMENTACAO_TIPOS.has(e.tipo_evento))
    .sort((a, b) => b.data_inicio.localeCompare(a.data_inicio));
}

export function computeDossieResumo(input: {
  historico: HistoricoEvento[];
  linhas: LinhaFrequenciaMin[];
  pendenciasAbertas: number;
  pendenciasResolvidas: number;
  ref?: Date;
}): DossieResumo {
  const { historico, linhas } = input;
  const ref = input.ref ?? new Date();

  const unidades = new Set<string>();
  const setores = new Set<string>();
  const cargos = new Set<string>();
  const funcoes = new Set<string>();
  for (const ev of historico) {
    if (ev.unidade_novo_id) unidades.add(ev.unidade_novo_id);
    if (ev.setor_novo_id) setores.add(ev.setor_novo_id);
    if (ev.cargo_novo_id) cargos.add(ev.cargo_novo_id);
    if (ev.funcao_novo_id) funcoes.add(ev.funcao_novo_id);
  }

  const competenciaSet = new Set<string>();
  let totalHe = 0;
  let totalFaltas = 0;
  let aprovadas = 0;
  for (const l of linhas) {
    if (l.competencia_key) competenciaSet.add(l.competencia_key);
    totalHe += Number(l.he_50 ?? 0) + Number(l.he_100 ?? 0);
    totalFaltas +=
      Number(l.faltas_injustificadas ?? 0) + Number(l.faltas_justificadas ?? 0);
    if (l.status_linha === "aprovada") aprovadas += 1;
  }

  const movs = deriveMovimentacoes(historico);
  const ultima = movs[0]?.data_inicio ?? null;

  const totalFreq = linhas.length;
  return {
    totalCompetencias: competenciaSet.size,
    totalFrequencias: totalFreq,
    totalHorasExtras: totalHe,
    totalFaltas,
    pendenciasAbertas: input.pendenciasAbertas,
    pendenciasResolvidas: input.pendenciasResolvidas,
    frequenciasAprovadas: aprovadas,
    percentualAprovadas: totalFreq ? Math.round((aprovadas / totalFreq) * 100) : 0,
    unidadesDistintas: unidades.size,
    setoresDistintos: setores.size,
    cargosDistintos: cargos.size,
    funcoesDistintas: funcoes.size,
    diasDesdeUltimaMovimentacao: diasDesde(ultima, ref),
  };
}

export const EVENTO_LABELS: Record<string, string> = {
  admissao: "Admissão",
  transferencia: "Transferência",
  promocao: "Promoção",
  mudanca_cargo: "Mudança de cargo",
  mudanca_funcao: "Mudança de função",
  mudanca_vinculo: "Mudança de vínculo",
  afastamento: "Afastamento",
  retorno: "Retorno",
  ferias: "Férias",
  licenca: "Licença",
  desligamento: "Desligamento",
  outro: "Outro",
};