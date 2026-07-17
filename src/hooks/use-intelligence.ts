// Sublote 12A — Orquestração do Centro de Inteligência Gerencial.
// Não faz novas requisições HTTP: consome o resultado de `useAnalytics` e
// devolve derivações (semáforo, tendências, integridade, insights).

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
    // "Sem lotação" = união aproximada de unidade/setor/cargo/função.
    // Usamos o maior valor para evitar contagem duplicada (o mesmo profissional
    // pode faltar mais de um campo). Reflete a regra do card.
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
      horasExtras: a.totalHorasExtras,
      frequenciasPendentes: a.frequenciasPendentes,
    });

    const integ = a.integridade.data;
    const integridade = computeIntegridade({
      total: integ?.total ?? 0,
      faltas: integ?.faltas ?? {},
      labels: CAMPO_LABELS,
      cadastrosIncompletos: integ?.cadastrosIncompletos,
    });

    // Tendências: comparar competência atual vs anterior.
    const prev = a.frequenciasAnterior.data ?? [];
    const prevHoras = sumField(prev, "total_horas_extras");
    const prevFaltas = sumField(prev, "total_faltas");
    const prevAprovadas = countByStatus(prev, STATUS_APROVADAS);
    const prevPendentes = countByStatus(prev, STATUS_PENDENTES);
    const prevEnviadas = countByStatus(prev, STATUS_ENVIADAS);
    void prevEnviadas;

    const tendencias = {
      horasExtras: computeTendencia(a.totalHorasExtras, prevHoras),
      faltas: computeTendencia(a.totalFaltas, prevFaltas),
      aprovadas: computeTendencia(a.frequenciasAprovadas, prevAprovadas),
      pendentes: computeTendencia(a.frequenciasPendentes, prevPendentes),
      pendencias: computeTendencia(a.pendencias.data ?? 0, a.pendenciasAnterior.data ?? 0),
    };

    const rankingHe = [...buildRanking(a.frequencias.data ?? [])]
      .sort((x, y) => y.total_horas_extras - x.total_horas_extras)
      .slice(0, 5);

    const insights = generateInsights({
      totalProfessionals: total,
      distribuicaoUnidade: a.distribuicaoUnidade.data ?? [],
      distribuicaoSetor: a.distribuicaoSetor.data ?? [],
      distribuicaoCargo: a.distribuicaoCargo.data ?? [],
      rankingHe,
      totalHorasExtras: a.totalHorasExtras,
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
    a.totalHorasExtras,
    a.totalFaltas,
    a.frequenciasAprovadas,
    a.frequenciasPendentes,
    a.frequencias.data,
    a.frequenciasAnterior.data,
    a.distribuicaoUnidade.data,
    a.distribuicaoSetor.data,
    a.distribuicaoCargo.data,
    a.integridade.data,
    a.integridade.isLoading,
  ]);
}
