import { useMemo } from "react";
import type { useAnalytics } from "@/hooks/use-analytics";
import {
  classifySemaforo,
  computeIntegridade,
  computeTendencia,
  generateInsights,
  type Insight,
  type SemaforoResult,
  type TendenciaValor,
  type IntegridadeResult,
} from "@/lib/intelligence";
import {
  countByStatus,
  STATUS_APROVADAS,
  STATUS_ENVIADAS,
  STATUS_PENDENTES,
  sumField,
  buildRanking,
} from "@/lib/analytics-aggregations";

const CAMPO_LABELS: Record<string, string> = {
  cargo: "Sem cargo",
  funcao: "Sem função",
  setor: "Sem setor",
  unidade: "Sem unidade",
  vinculo: "Sem vínculo",
  matricula: "Sem matrícula",
  telefone: "Sem telefone",
  email: "Sem e-mail",
  banco: "Sem dados bancários",
};

export type IntelligenceResult = {
  semaforo: SemaforoResult;
  integridade: IntegridadeResult;
  tendencias: {
    horasExtras: TendenciaValor;
    faltas: TendenciaValor;
    aprovadas: TendenciaValor;
    pendentes: TendenciaValor;
    pendencias: TendenciaValor;
  };
  insights: Insight[];
  isLoading: boolean;
};

export function useIntelligence(a: ReturnType<typeof useAnalytics>): IntelligenceResult {
  return useMemo(() => {
    const total = a.totalProfessionals.data ?? 0;
    const sb = a.statusBreakdown.data ?? {};
    const afastados = sb["afastado"] ?? 0;
    const alertas = a.alertas.data;
    const semLotacao = Math.max(
      alertas?.semUnidade ?? 0,
      alertas?.semSetor ?? 0,
      alertas?.semCargo ?? 0,
      alertas?.semFuncao ?? 0,
    );

    const semaforo = classifySemaforo({
      totalProfessionals: total,
      afastados,
      pendencias: a.pendencias.data ?? 0,
      semLotacao,
      unidadesSemGestor: alertas?.unidadesSemGestor ?? 0,
      horasExtras: a.totals.horasExtras,
      frequenciasPendentes: a.totals.folhasPendentes,
    });

    const integ = a.integridade.data;
    const integridade = computeIntegridade({
      total: integ?.total ?? 0,
      faltas: integ?.faltas ?? {},
      labels: CAMPO_LABELS,
      cadastrosIncompletos: integ?.cadastrosIncompletos,
    });

    const prev = a.frequenciasAnterior.data ?? [];
    const prevHoras = sumField(prev, "total_horas_extras");
    const prevFaltas = sumField(prev, "total_faltas");
    const prevAprovadas = countByStatus(prev, STATUS_APROVADAS);
    const prevPendentes = countByStatus(prev, STATUS_PENDENTES);

    const tendencias = {
      horasExtras: computeTendencia(a.totals.horasExtras, prevHoras),
      faltas: computeTendencia(a.totals.faltas, prevFaltas),
      aprovadas: computeTendencia(a.totals.folhasAprovadas, prevAprovadas),
      pendentes: computeTendencia(a.totals.folhasPendentes, prevPendentes),
      pendencias: computeTendencia(a.pendencias.data ?? 0, a.pendenciasAnterior.data ?? 0),
    };

    const rankingHe = [...buildRanking(a.frequencias)]
      .sort((x, y) => y.total_horas_extras - x.total_horas_extras)
      .slice(0, 5);

    const distribuicaoSetorRaw = a.distribuicaoSetor.data;
    const distribuicaoSetorArray = (distribuicaoSetorRaw as any)?.unidades ?? [];

    const insights = generateInsights({
      totalProfessionals: total,
      distribuicaoUnidade: a.distribuicaoUnidade.data ?? [],
      distribuicaoSetor: distribuicaoSetorArray,
      distribuicaoCargo: a.distribuicaoCargo.data ?? [],
      rankingHe,
      totalHorasExtras: a.totals.horasExtras,
      afastados,
      tendenciaPendencias: tendencias.pendencias,
      tendenciaHoras: tendencias.horasExtras,
      alertas: alertas
        ? {
            semUnidade: alertas.semUnidade,
            semSetor: alertas.semSetor,
            unidadesSemGestor: alertas.unidadesSemGestor,
            setoresSemResponsavel: alertas.setoresSemResponsavel,
          }
        : undefined,
    });

    const isLoading =
      a.totalProfessionals.isLoading ||
      a.statusBreakdown.isLoading ||
      a.alertas.isLoading ||
      a.integridade.isLoading;

    return { semaforo, integridade, tendencias, insights, isLoading };
  }, [
    a.totalProfessionals.data,
    a.totalProfessionals.isLoading,
    a.statusBreakdown.data,
    a.statusBreakdown.isLoading,
    a.alertas.data,
    a.alertas.isLoading,
    a.pendencias.data,
    a.pendenciasAnterior.data,
    a.totals,
    a.frequencias,
    a.frequenciasAnterior.data,
    a.distribuicaoUnidade.data,
    a.distribuicaoSetor.data,
    a.distribuicaoCargo.data,
    a.integridade.data,
    a.integridade.isLoading,
  ]);
}
