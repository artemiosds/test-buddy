/**
 * Fonte única de verdade para status do domínio.
 *
 * Todos os componentes visuais (StatusBadge, selects, filtros, etc.) DEVEM
 * consumir os helpers deste módulo. Não crie STATUS_LABEL, STATUS_VARIANT
 * ou statusColor locais em rotas/componentes.
 *
 * Domínios cobertos (alinhados com os enums em `public` do Supabase):
 *  - frequencia   → status_frequencia
 *  - competencia  → status_competencia
 *  - profissional → status_profissional
 *  - pendencia    → pendencia_status
 *  - unidade      → status_entidade
 *  - usuario      → status_usuario
 *
 * Valores desconhecidos caem em `FALLBACK` (variante neutra "outline").
 */

export type StatusVariant = "default" | "secondary" | "outline" | "destructive";

export type StatusMeta = {
  label: string;
  variant: StatusVariant;
  /** Classe utilitária opcional aplicada em cima do Badge (para semáforos coloridos). */
  className?: string;
};

export type StatusDomain =
  | "frequencia"
  | "competencia"
  | "profissional"
  | "pendencia"
  | "unidade"
  | "usuario";

type Registry = Record<
  StatusDomain,
  { order: readonly string[]; map: Record<string, StatusMeta> }
>;

const REGISTRY: Registry = {
  frequencia: {
    order: [
      "rascunho",
      "enviada",
      "em_analise",
      "com_pendencias",
      "aprovada",
      "rejeitada",
      "arquivada",
    ],
    map: {
      rascunho: { label: "Rascunho", variant: "outline" },
      enviada: { label: "Enviada", variant: "default" },
      em_analise: { label: "Em análise", variant: "secondary" },
      com_pendencias: { label: "Com pendências", variant: "destructive" },
      aprovada: { label: "Aprovada", variant: "default" },
      rejeitada: { label: "Rejeitada", variant: "destructive" },
      arquivada: { label: "Arquivada", variant: "outline" },
    },
  },
  competencia: {
    order: ["aberta", "em_processamento", "encerrada", "arquivada"],
    map: {
      aberta: { label: "Aberta", variant: "default" },
      em_processamento: { label: "Em processamento", variant: "secondary" },
      encerrada: { label: "Encerrada", variant: "outline" },
      arquivada: { label: "Arquivada", variant: "destructive" },
    },
  },
  profissional: {
    order: ["ativo", "afastado", "ferias", "licenca", "desligado", "inativo"],
    map: {
      ativo: { label: "Ativo", variant: "default" },
      afastado: { label: "Afastado", variant: "secondary" },
      ferias: { label: "Férias", variant: "secondary" },
      licenca: { label: "Licença", variant: "outline" },
      desligado: { label: "Desligado", variant: "destructive" },
      inativo: { label: "Inativo", variant: "secondary" },
    },
  },
  pendencia: {
    order: [
      "aberta",
      "em_analise",
      "aguardando_resposta",
      "respondida",
      "resolvida",
      "reaberta",
      "cancelada",
    ],
    map: {
      aberta: { label: "Aberta", variant: "default" },
      em_analise: { label: "Em análise", variant: "secondary" },
      aguardando_resposta: { label: "Aguardando resposta", variant: "secondary" },
      respondida: { label: "Respondida", variant: "outline" },
      resolvida: { label: "Resolvida", variant: "outline" },
      reaberta: { label: "Reaberta", variant: "default" },
      cancelada: { label: "Cancelada", variant: "destructive" },
    },
  },
  unidade: {
    order: ["ativa", "inativa", "suspensa", "arquivada"],
    map: {
      ativa: {
        label: "Ativa",
        variant: "secondary",
        className: "bg-emerald-100 text-emerald-700",
      },
      inativa: {
        label: "Inativa",
        variant: "secondary",
        className: "bg-rose-100 text-rose-700",
      },
      suspensa: {
        label: "Suspensa",
        variant: "secondary",
        className: "bg-amber-100 text-amber-700",
      },
      arquivada: {
        label: "Arquivada",
        variant: "secondary",
        className: "bg-slate-100 text-slate-700",
      },
    },
  },
  usuario: {
    order: ["ativo", "pendente", "suspenso", "bloqueado", "inativo"],
    map: {
      ativo: {
        label: "Ativo",
        variant: "secondary",
        className: "bg-emerald-100 text-emerald-700",
      },
      pendente: {
        label: "Pendente",
        variant: "secondary",
        className: "bg-amber-100 text-amber-700",
      },
      suspenso: {
        label: "Suspenso",
        variant: "secondary",
        className: "bg-amber-100 text-amber-700",
      },
      bloqueado: {
        label: "Bloqueado",
        variant: "secondary",
        className: "bg-rose-100 text-rose-700",
      },
      inativo: {
        label: "Inativo",
        variant: "secondary",
        className: "bg-slate-100 text-slate-700",
      },
    },
  },
};

const FALLBACK: StatusMeta = { label: "—", variant: "outline" };

export function statusMeta(
  domain: StatusDomain,
  value: string | null | undefined,
): StatusMeta {
  if (value == null) return FALLBACK;
  const hit = REGISTRY[domain].map[value];
  if (hit) return hit;
  // Fallback neutro para valores desconhecidos: preserva o texto original.
  return { ...FALLBACK, label: String(value) };
}

export function statusLabel(
  domain: StatusDomain,
  value: string | null | undefined,
): string {
  return statusMeta(domain, value).label;
}

export function statusVariant(
  domain: StatusDomain,
  value: string | null | undefined,
): StatusVariant {
  return statusMeta(domain, value).variant;
}

export function statusOptions(
  domain: StatusDomain,
): Array<{ value: string; label: string }> {
  return REGISTRY[domain].order.map((v) => ({
    value: v,
    label: REGISTRY[domain].map[v].label,
  }));
}

export function statusValues(domain: StatusDomain): readonly string[] {
  return REGISTRY[domain].order;
}