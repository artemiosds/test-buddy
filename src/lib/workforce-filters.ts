import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";

/**
 * Filtros globais compartilhados entre os painéis executivos do módulo
 * Gestão de Pessoas (Dashboard, Sala de Situação, Controle da Força de
 * Trabalho). Persistidos como search params — todos strings vazias por
 * padrão, com sentinelas semânticas:
 *   - competencia === ""  → competência ativa
 *   - unidade    === ""  → todas as unidades permitidas ao usuário
 *   - status     === ""  → todos os status
 *
 * Só leitura: nada aqui grava no banco. O escopo por usuário continua sendo
 * imposto pelas RLS das tabelas consultadas por useAnalytics.
 */
export const workforceFiltersSchema = z.object({
  competencia: fallback(z.string(), "").default(""),
  unidade: fallback(z.string(), "").default(""),
  status: fallback(z.string(), "").default(""),
});

export type WorkforceFilters = z.infer<typeof workforceFiltersSchema>;

export const workforceFiltersValidator = zodValidator(workforceFiltersSchema);

/** Chaves preservadas por retainSearchParams ao navegar entre painéis. */
export const WORKFORCE_FILTER_KEYS = ["competencia", "unidade", "status"] as const;

export type ResolvedWorkforceFilters = {
  competenciaId: string | null;
  unidadeId: string | null;
  status: string | null;
};

/**
 * Converte os valores crus do search param em argumentos aceitos pelo
 * useAnalytics — nunca joga sentinelas ("__ativa__", "__all__") no hook.
 */
export function resolveWorkforceFilters(
  s: Partial<WorkforceFilters> | undefined,
  competenciaAtivaId: string | null | undefined,
): ResolvedWorkforceFilters {
  const compRaw = s?.competencia ?? "";
  const unidadeRaw = s?.unidade ?? "";
  const statusRaw = s?.status ?? "";
  return {
    competenciaId: compRaw === "" ? (competenciaAtivaId ?? null) : compRaw,
    unidadeId: unidadeRaw === "" ? null : unidadeRaw,
    status: statusRaw === "" ? null : statusRaw,
  };
}

/** Merge parcial preservando os demais filtros — usado nos onChange dos Selects. */
export function mergeWorkforceFilters(
  prev: Partial<WorkforceFilters>,
  patch: Partial<WorkforceFilters>,
): WorkforceFilters {
  return {
    competencia: patch.competencia ?? prev.competencia ?? "",
    unidade: patch.unidade ?? prev.unidade ?? "",
    status: patch.status ?? prev.status ?? "",
  };
}
