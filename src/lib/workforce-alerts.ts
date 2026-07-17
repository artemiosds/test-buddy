// Alertas de Força de Trabalho — somente leitura.
// Constrói a lista determinística de alertas (label + quantidade + rota de
// detalhes) a partir do payload já exposto por `useAnalytics.alertas` e do
// total de pendências vencidas apurado na página. Não faz IO, não altera
// regras de negócio e não expõe nada além do que o usuário já tem acesso via
// as telas de listagem existentes (o escopo por usuário é preservado porque
// a fonte é a mesma query filtrada por RLS).

export type WorkforceAlertsInput = {
  alertas: {
    semUnidade: number;
    semSetor: number;
    semCargo: number;
    semFuncao: number;
    unidadesSemGestor: number;
    setoresVazios: number;
  } | null | undefined;
  pendenciasVencidas: number;
};

export type WorkforceAlertTone = "warning" | "danger";

export type WorkforceAlertItem = {
  id: string;
  label: string;
  count: number;
  tone: WorkforceAlertTone;
  /** Rota da tela de detalhes já existente. */
  to: string;
  /** Search params a aplicar na navegação (filtro pré-selecionado). */
  search?: Record<string, string>;
};

export function buildWorkforceAlertItems(
  input: WorkforceAlertsInput,
): WorkforceAlertItem[] {
  const a = input.alertas;
  return [
    {
      id: "prof-sem-unidade",
      label: "Profissionais sem unidade",
      count: a?.semUnidade ?? 0,
      tone: "warning",
      to: "/profissionais",
      search: { integridade: "sem-unidade" },
    },
    {
      id: "prof-sem-setor",
      label: "Profissionais sem setor",
      count: a?.semSetor ?? 0,
      tone: "warning",
      to: "/profissionais",
      search: { integridade: "sem-setor" },
    },
    {
      id: "prof-sem-cargo",
      label: "Profissionais sem cargo",
      count: a?.semCargo ?? 0,
      tone: "warning",
      to: "/profissionais",
      search: { integridade: "sem-cargo" },
    },
    {
      id: "prof-sem-funcao",
      label: "Profissionais sem função",
      count: a?.semFuncao ?? 0,
      tone: "warning",
      to: "/profissionais",
      search: { integridade: "sem-funcao" },
    },
    {
      id: "uni-sem-gestor",
      label: "Unidades sem gestor",
      count: a?.unidadesSemGestor ?? 0,
      tone: "danger",
      to: "/unidades",
    },
    {
      id: "set-vazios",
      label: "Setores sem profissionais",
      count: a?.setoresVazios ?? 0,
      tone: "warning",
      to: "/setores",
    },
    {
      id: "pend-vencidas",
      label: "Pendências vencidas",
      count: input.pendenciasVencidas,
      tone: "danger",
      to: "/pendencias",
      search: { status: "aberta" },
    },
  ];
}