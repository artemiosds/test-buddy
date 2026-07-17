// Sublote 12A — thresholds do Centro de Inteligência Gerencial.
// Ajustes revisáveis sem alteração de regra de negócio.

export const INTELLIGENCE_THRESHOLDS = {
  // Semáforo Executivo
  pendenciasAtencao: 5,
  pendenciasCritico: 20,
  afastadosAtencaoPct: 10, // % do total de profissionais
  afastadosCriticoPct: 20,
  semLotacaoAtencao: 5,
  semLotacaoCritico: 20,
  unidadesSemGestorAtencao: 1,
  unidadesSemGestorCritico: 5,
  horasExtrasAtencao: 500,
  horasExtrasCritico: 2000,

  // Insights
  concentracaoRelevantePct: 30, // top 1 unidade/setor com >=30% concentra

  // Integridade
  integridadeAtencao: 90, // %
  integridadeCritico: 75,
} as const;
