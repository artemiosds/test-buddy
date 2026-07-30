import type { BreakerSnapshot } from "./circuit-breaker";

export type AlertSeverity = "critical" | "warn" | "info";
export type SaudeAlert = {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
};

export type AlertInputs = {
  eventos?: {
    por_status?: Record<string, number>;
    retry_alto?: number;
    mais_antigo_pendente?: string | null;
  } | null;
  sla?: {
    vencidas?: number;
    proximas_24h?: number;
  } | null;
  cron?: {
    disponivel?: boolean;
    falhas_24h?: Array<unknown>;
  } | null;
  travados?: { rows?: Array<unknown> } | null;
  breakers?: BreakerSnapshot[];
  now?: number;
};

const RANK: Record<AlertSeverity, number> = { critical: 0, warn: 1, info: 2 };

/**
 * Deriva alertas proativos a partir dos snapshots já carregados no /saude.
 * Puro: sem I/O, testável isoladamente.
 */
export function computeSaudeAlerts(input: AlertInputs): SaudeAlert[] {
  const out: SaudeAlert[] = [];
  const now = input.now ?? Date.now();

  const falhou = input.eventos?.por_status?.["falhou"] ?? 0;
  const pendentes =
    (input.eventos?.por_status?.["pendente"] ?? 0) +
    (input.eventos?.por_status?.["falhou_retry"] ?? 0);
  const retryAlto = input.eventos?.retry_alto ?? 0;

  if (falhou > 0) {
    out.push({
      id: "eventos.falhou",
      severity: "critical",
      title: `${falhou} evento(s) em falha definitiva`,
      detail: "Revise a seção Eventos travados e reprocesse ou descarte com motivo.",
    });
  }
  if (retryAlto > 0) {
    out.push({
      id: "eventos.retry_alto",
      severity: "warn",
      title: `${retryAlto} evento(s) com ≥5 tentativas`,
      detail: "Consumidor pode estar degradado; verifique últimos erros.",
    });
  }
  if (pendentes > 50) {
    out.push({
      id: "eventos.pendentes_altos",
      severity: "warn",
      title: `Fila alta: ${pendentes} eventos pendentes`,
      detail: "Backlog acima de 50. Confira workers e taxa de processamento.",
    });
  }
  if (input.eventos?.mais_antigo_pendente) {
    const ageMs = now - Date.parse(input.eventos.mais_antigo_pendente);
    if (Number.isFinite(ageMs) && ageMs > 60 * 60 * 1000) {
      const horas = Math.floor(ageMs / (60 * 60 * 1000));
      out.push({
        id: "eventos.mais_antigo",
        severity: horas >= 6 ? "critical" : "warn",
        title: `Evento pendente há ${horas}h sem processar`,
        detail: "Nenhum worker vem consumindo há bastante tempo.",
      });
    }
  }

  const vencidas = input.sla?.vencidas ?? 0;
  const prox = input.sla?.proximas_24h ?? 0;
  if (vencidas > 0) {
    out.push({
      id: "sla.vencidas",
      severity: "critical",
      title: `${vencidas} pendência(s) com SLA vencido`,
      detail: "Escalonamento automático já rodou; ação humana recomendada.",
    });
  }
  if (prox > 0) {
    out.push({
      id: "sla.proximas",
      severity: "warn",
      title: `${prox} pendência(s) vencem em até 24h`,
      detail: "Priorize respostas para evitar novo escalonamento.",
    });
  }

  if (input.cron && input.cron.disponivel !== false) {
    const falhas = input.cron.falhas_24h?.length ?? 0;
    if (falhas > 0) {
      out.push({
        id: "cron.falhas_24h",
        severity: "warn",
        title: `${falhas} execução(ões) de job com falha em 24h`,
        detail: "Verifique a seção Jobs agendados para detalhes do erro.",
      });
    }
  }

  const travados = input.travados?.rows?.length ?? 0;
  if (travados > 0) {
    out.push({
      id: "eventos.travados",
      severity: "warn",
      title: `${travados} evento(s) travado(s) na fila`,
      detail: "Use as ações de reprocessar/descartar no painel abaixo.",
    });
  }

  const abertos = (input.breakers ?? []).filter((b) => b.state === "open");
  if (abertos.length > 0) {
    out.push({
      id: "breakers.abertos",
      severity: "critical",
      title: `${abertos.length} disjuntor(es) abertos`,
      detail: abertos.map((b) => b.key).join(", "),
    });
  }
  const halfOpen = (input.breakers ?? []).filter((b) => b.state === "half_open");
  if (halfOpen.length > 0) {
    out.push({
      id: "breakers.half_open",
      severity: "warn",
      title: `${halfOpen.length} disjuntor(es) em meia-abertura`,
      detail: halfOpen.map((b) => b.key).join(", "),
    });
  }

  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}
