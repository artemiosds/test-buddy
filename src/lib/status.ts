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

import type { LucideIcon } from "lucide-react";
import {
  Archive,
  AlertCircle,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  FileEdit,
  FileText,
  Loader2,
  Lock,
  MessageSquare,
  Pause,
  RotateCcw,
  Search,
  Send,
  ShieldOff,
  Umbrella,
  Unlock,
  UserCheck,
  UserMinus,
  UserX,
  XCircle,
} from "lucide-react";

export type StatusVariant = "default" | "secondary" | "outline" | "destructive";

/** Token semântico de cor (independente de Tailwind classes). Uso opcional
 *  por consumidores customizados — StatusBadge continua respeitando `variant`. */
export type StatusColorToken =
  | "success"
  | "info"
  | "warning"
  | "danger"
  | "muted"
  | "neutral";

export type StatusMeta = {
  label: string;
  variant: StatusVariant;
  /** Classe utilitária opcional aplicada em cima do Badge (para semáforos coloridos). */
  className?: string;
  /** Ícone lucide-react opcional (para KPIs, timelines, listas ricas). */
  icon?: LucideIcon;
  /** Descrição curta do estado — texto humano longo (tooltip, ajuda). */
  description?: string;
  /** Token semântico de cor. Consumidores mapeiam para o seu design system. */
  colorToken?: StatusColorToken;
  /** Permissão sugerida para alterar/agir sobre este estado (informativo). */
  permission?: string;
  /** Visibilidade sugerida em listas/selects. `false` = estado interno. */
  visible?: boolean;
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
      rascunho:       { label: "Rascunho",       variant: "outline",     icon: FileEdit,      colorToken: "muted",   description: "Folha em edição, ainda não enviada." },
      enviada:        { label: "Enviada",        variant: "default",     icon: Send,          colorToken: "info",    description: "Enviada para análise da unidade responsável.", permission: "frequencia.enviar" },
      em_analise:     { label: "Em análise",     variant: "secondary",   icon: Search,        colorToken: "info",    description: "Em análise pela equipe de RH.",               permission: "frequencia.analisar" },
      com_pendencias: { label: "Com pendências", variant: "destructive", icon: AlertTriangle, colorToken: "warning", description: "Devolvida à unidade com pendências para correção." },
      aprovada:       { label: "Aprovada",       variant: "default",     icon: CheckCircle2,  colorToken: "success", description: "Folha aprovada pelo RH.",                     permission: "frequencia.aprovar" },
      rejeitada:      { label: "Rejeitada",      variant: "destructive", icon: XCircle,       colorToken: "danger",  description: "Folha rejeitada — não será processada.",       permission: "frequencia.rejeitar" },
      arquivada:      { label: "Arquivada",      variant: "outline",     icon: Archive,       colorToken: "muted",   description: "Encerrada e arquivada — somente consulta.",   visible: false },
    },
  },
  competencia: {
    order: ["aberta", "em_processamento", "encerrada", "arquivada"],
    map: {
      aberta:           { label: "Aberta",           variant: "default",     icon: Unlock,   colorToken: "success", description: "Competência aberta a envios das unidades." },
      em_processamento: { label: "Em processamento", variant: "secondary",   icon: Loader2,  colorToken: "info",    description: "Fechada para envios; sendo consolidada pelo RH." },
      encerrada:        { label: "Encerrada",        variant: "outline",     icon: Lock,     colorToken: "muted",   description: "Competência encerrada — sem novas alterações." },
      arquivada:        { label: "Arquivada",        variant: "destructive", icon: Archive,  colorToken: "danger",  description: "Arquivada — mantida apenas para histórico.", visible: false },
    },
  },
  profissional: {
    order: ["ativo", "afastado", "ferias", "licenca", "cedido", "desligado", "inativo"],
    map: {
      ativo:     { label: "Ativo",     variant: "default",     icon: UserCheck, colorToken: "success", description: "Em pleno exercício." },
      afastado:  { label: "Afastado",  variant: "secondary",   icon: UserMinus, colorToken: "warning", description: "Afastado temporariamente." },
      ferias:    { label: "Férias",    variant: "secondary",   icon: Umbrella,  colorToken: "info",    description: "Em período de férias." },
      licenca:   { label: "Licença",   variant: "outline",     icon: FileText,  colorToken: "info",    description: "Em licença (saúde, prêmio, etc.)." },
      cedido:    { label: "Cedido",    variant: "secondary",   icon: UserMinus, colorToken: "info",    description: "Cedido a outra unidade/órgão." },
      desligado: { label: "Desligado", variant: "destructive", icon: UserX,     colorToken: "danger",  description: "Desligado do quadro." },
      inativo:   { label: "Inativo",   variant: "secondary",   icon: UserMinus, colorToken: "muted",   description: "Inativo — não computa em folhas." },
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
      aberta:              { label: "Aberta",              variant: "default",     icon: AlertCircle,     colorToken: "info",    description: "Pendência aberta, aguardando triagem." },
      em_analise:          { label: "Em análise",          variant: "secondary",   icon: Search,          colorToken: "info",    description: "Pendência sendo analisada." },
      aguardando_resposta: { label: "Aguardando resposta", variant: "secondary",   icon: Clock,           colorToken: "warning", description: "Aguardando resposta do responsável." },
      respondida:          { label: "Respondida",          variant: "outline",     icon: MessageSquare,   colorToken: "info",    description: "Resposta recebida; aguardando conclusão." },
      resolvida:           { label: "Resolvida",           variant: "outline",     icon: CheckCircle2,    colorToken: "success", description: "Resolvida com sucesso." },
      reaberta:            { label: "Reaberta",            variant: "default",     icon: RotateCcw,       colorToken: "warning", description: "Pendência reaberta para nova análise." },
      cancelada:           { label: "Cancelada",           variant: "destructive", icon: Ban,             colorToken: "danger",  description: "Cancelada — não será tratada.", visible: false },
    },
  },
  unidade: {
    order: ["ativa", "inativa", "suspensa", "arquivada"],
    map: {
      ativa: {
        label: "Ativa", variant: "secondary", className: "bg-success-soft text-success-soft-foreground",
        icon: CheckCircle2, colorToken: "success", description: "Unidade em operação.",
      },
      inativa: {
        label: "Inativa", variant: "secondary", className: "bg-danger-soft text-danger-soft-foreground",
        icon: XCircle, colorToken: "danger", description: "Unidade sem operação.",
      },
      suspensa: {
        label: "Suspensa", variant: "secondary", className: "bg-warning-soft text-warning-soft-foreground",
        icon: Pause, colorToken: "warning", description: "Operação suspensa temporariamente.",
      },
      arquivada: {
        label: "Arquivada", variant: "secondary", className: "bg-muted text-muted-foreground",
        icon: Archive, colorToken: "muted", description: "Arquivada — histórica.", visible: false,
      },
    },
  },
  usuario: {
    order: ["ativo", "pendente", "suspenso", "bloqueado", "inativo"],
    map: {
      ativo: {
        label: "Ativo", variant: "secondary", className: "bg-success-soft text-success-soft-foreground",
        icon: UserCheck, colorToken: "success", description: "Usuário ativo — acesso liberado.",
      },
      pendente: {
        label: "Pendente", variant: "secondary", className: "bg-warning-soft text-warning-soft-foreground",
        icon: Clock, colorToken: "warning", description: "Cadastro pendente de confirmação.",
      },
      suspenso: {
        label: "Suspenso", variant: "secondary", className: "bg-warning-soft text-warning-soft-foreground",
        icon: Pause, colorToken: "warning", description: "Suspenso temporariamente.",
      },
      bloqueado: {
        label: "Bloqueado", variant: "secondary", className: "bg-danger-soft text-danger-soft-foreground",
        icon: ShieldOff, colorToken: "danger", description: "Acesso bloqueado por segurança.",
      },
      inativo: {
        label: "Inativo", variant: "secondary", className: "bg-muted text-muted-foreground",
        icon: UserMinus, colorToken: "muted", description: "Inativo — sem acesso.", visible: false,
      },
    },
  },
};

const FALLBACK: StatusMeta = { label: "—", variant: "outline" };

/** Retorna `true` quando o valor está registrado no domínio. */
export function hasStatus(
  domain: StatusDomain,
  value: string | null | undefined,
): boolean {
  if (value == null) return false;
  return Object.prototype.hasOwnProperty.call(REGISTRY[domain].map, value);
}

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