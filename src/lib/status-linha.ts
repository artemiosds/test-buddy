/**
 * Cores e rótulos do status POR PROFISSIONAL (linha) nas folhas e nas Linhas de
 * Aprovações. Fonte única — não crie mapas locais em rotas/componentes.
 */

export type StatusLinhaToken =
  | "pendente"
  | "aprovada"
  | "rejeitada"
  | "devolvida"
  | "com_pendencias";

export type StatusLinhaMeta = {
  label: string;
  /** Classe utilitária completa (usar com <Badge variant="outline">). */
  className: string;
};

const MAP: Record<string, StatusLinhaMeta> = {
  pendente: {
    label: "Pendente",
    className:
      "border-slate-300 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
  aprovada: {
    label: "Aprovada",
    className:
      "border-emerald-300 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  },
  rejeitada: {
    label: "Rejeitada",
    className:
      "border-rose-300 bg-rose-100 text-rose-800 font-semibold dark:bg-rose-900/40 dark:text-rose-200",
  },
  devolvida: {
    label: "Devolvida",
    className:
      "border-amber-300 bg-amber-100 text-amber-900 font-semibold dark:bg-amber-900/40 dark:text-amber-200",
  },
  com_pendencias: {
    label: "Com pendências",
    className:
      "border-amber-300 bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  },
  rascunho: {
    label: "Rascunho",
    className:
      "border-slate-300 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
  enviada: {
    label: "Enviada",
    className:
      "border-sky-300 bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  },
  em_analise: {
    label: "Em análise",
    className:
      "border-sky-300 bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  },
};

const FALLBACK: StatusLinhaMeta = {
  label: "—",
  className: "border-slate-300 bg-slate-100 text-slate-700",
};

export function statusLinhaMeta(value?: string | null): StatusLinhaMeta {
  const key = String(value ?? "pendente").trim();
  const hit = MAP[key];
  if (hit) return hit;
  return { ...FALLBACK, label: key.replace(/_/g, " ") };
}

export function statusLinhaLabel(value?: string | null): string {
  return statusLinhaMeta(value).label;
}

export function statusLinhaClass(value?: string | null): string {
  return statusLinhaMeta(value).className;
}
