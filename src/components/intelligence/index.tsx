// Sublote 12A — Componentes visuais do Centro de Inteligência Gerencial.
// Todos são wrappers finos sobre o Design System existente.

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Minus,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type {
  IntegridadeResult,
  Insight,
  SemaforoResult,
  TendenciaValor,
} from "@/lib/intelligence";

// ----------------- Semáforo -----------------

const NIVEL_LABEL = {
  ok: "Regular",
  atencao: "Atenção",
  critico: "Crítico",
} as const;

const NIVEL_STYLE = {
  ok: {
    icon: <CheckCircle2 className="h-6 w-6" />,
    box: "border-success-soft-foreground/40 bg-success-soft/40 text-success-soft-foreground",
    dot: "bg-success",
  },
  atencao: {
    icon: <AlertTriangle className="h-6 w-6" />,
    box: "border-warning-soft-foreground/40 bg-warning-soft/40 text-warning-soft-foreground",
    dot: "bg-warning",
  },
  critico: {
    icon: <ShieldAlert className="h-6 w-6" />,
    box: "border-destructive/40 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
} as const;

export function SemaforoCard({
  semaforo,
  loading,
  lastUpdated,
  onRefresh,
}: {
  semaforo: SemaforoResult;
  loading?: boolean;
  lastUpdated?: number;
  onRefresh?: () => void;
}) {
  const style = NIVEL_STYLE[semaforo.nivel];
  return (
    <Card className={"border-2 " + style.box.replace(/text-\S+/g, "")}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <span className={"flex h-10 w-10 items-center justify-center rounded-full " + style.box}>
            {style.icon}
          </span>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status da Força de Trabalho
            </div>
            <CardTitle className="text-lg">{NIVEL_LABEL[semaforo.nivel]}</CardTitle>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={semaforo.nivel === "ok" ? "outline" : "secondary"}>
            {semaforo.contagemAlertas} alerta(s)
          </Badge>
          {onRefresh && (
            <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} />
              <span className="sr-only">Atualizar</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {semaforo.motivos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todos os indicadores dentro do padrão operacional.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {semaforo.motivos.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={"mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full " + style.dot} />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        )}
        {lastUpdated && (
          <div className="mt-3 text-xs text-muted-foreground">
            Atualizado{" "}
            {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true, locale: ptBR })}.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ----------------- Tendência KPI -----------------

export function TendenciaKpi({
  label,
  tendencia,
  formatter,
  invertBad,
}: {
  label: string;
  tendencia: TendenciaValor;
  formatter?: (v: number) => string;
  /** true = crescimento é ruim (ex: pendências, HE). */
  invertBad?: boolean;
}) {
  const fmt = formatter ?? ((v: number) => v.toLocaleString("pt-BR"));
  const sobe = tendencia.direcao === "sobe";
  const cai = tendencia.direcao === "cai";
  const isBad = invertBad ? sobe : cai;
  const isGood = invertBad ? cai : sobe;
  const tone =
    tendencia.direcao === "estavel"
      ? "text-muted-foreground"
      : isBad
        ? "text-destructive"
        : isGood
          ? "text-success-soft-foreground"
          : "text-muted-foreground";
  const Icon = sobe ? TrendingUp : cai ? TrendingDown : Minus;
  const pctText =
    tendencia.variacaoPct === null
      ? tendencia.anterior === 0 && tendencia.atual === 0
        ? "—"
        : "novo"
      : `${tendencia.variacaoPct > 0 ? "+" : ""}${tendencia.variacaoPct.toFixed(1)}%`;

  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <div className="text-2xl font-semibold tabular-nums">{fmt(tendencia.atual)}</div>
        <div className={"flex items-center gap-1 text-xs font-medium " + tone}>
          <Icon className="h-3.5 w-3.5" />
          {pctText}
        </div>
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        Anterior: {fmt(tendencia.anterior)}
        {tendencia.variacaoAbs !== 0 && (
          <span className="ml-1">
            ({tendencia.variacaoAbs > 0 ? "+" : ""}
            {tendencia.variacaoAbs.toLocaleString("pt-BR")})
          </span>
        )}
      </div>
    </div>
  );
}

// ----------------- Integridade -----------------

export function IntegridadeCard({
  integridade,
  onCampoClick,
}: {
  integridade: IntegridadeResult;
  onCampoClick?: (chave: string) => void;
}) {
  const tone =
    integridade.nivel === "ok"
      ? "text-success-soft-foreground"
      : integridade.nivel === "atencao"
        ? "text-warning-soft-foreground"
        : "text-destructive";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" /> Integridade Cadastral
          </CardTitle>
          <div className={"text-2xl font-bold tabular-nums " + tone}>{integridade.percentual}%</div>
        </div>
      </CardHeader>
      <CardContent>
        <Progress value={integridade.percentual} className="mb-3 h-2" />
        <div className="mb-3 flex justify-between text-xs text-muted-foreground">
          <span>{integridade.cadastrosCompletos.toLocaleString("pt-BR")} completos</span>
          <span>
            {(integridade.total - integridade.cadastrosCompletos).toLocaleString("pt-BR")}{" "}
            incompletos
          </span>
        </div>
        {integridade.camposFaltantes.filter((c) => c.faltantes > 0).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum campo crítico com pendências.</p>
        ) : (
          <ul className="grid gap-1.5 md:grid-cols-2">
            {integridade.camposFaltantes
              .filter((c) => c.faltantes > 0)
              .map((c) => (
                <li key={c.chave}>
                  <button
                    type="button"
                    onClick={() => onCampoClick?.(c.chave)}
                    disabled={!onCampoClick}
                    className="flex w-full items-center justify-between rounded-md border px-3 py-1.5 text-left text-sm transition hover:border-primary/40 hover:bg-accent/40 disabled:cursor-default disabled:hover:border-border disabled:hover:bg-transparent"
                  >
                    <span>{c.label}</span>
                    <Badge variant="outline" className="tabular-nums">
                      {c.faltantes.toLocaleString("pt-BR")}
                    </Badge>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ----------------- Insights -----------------

const INSIGHT_STYLE = {
  concentracao: { icon: <Info className="h-4 w-4" />, tone: "border-primary/40 bg-primary/5" },
  risco: {
    icon: <AlertTriangle className="h-4 w-4" />,
    tone: "border-destructive/40 bg-destructive/5",
  },
  melhoria: {
    icon: <TrendingDown className="h-4 w-4" />,
    tone: "border-success-soft-foreground/40 bg-success-soft/40",
  },
  informativo: { icon: <Info className="h-4 w-4" />, tone: "border-border" },
} as const;

export function InsightsCard({ insights }: { insights: Insight[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4" /> Inteligência Gerencial
        </CardTitle>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum insight relevante identificado no momento.
          </p>
        ) : (
          <ul className="space-y-2">
            {insights.map((i) => {
              const s = INSIGHT_STYLE[i.tipo];
              return (
                <li
                  key={i.id}
                  className={"flex items-start gap-2 rounded-md border p-3 text-sm " + s.tone}
                >
                  <span className="mt-0.5 shrink-0">{s.icon}</span>
                  <span>{i.texto}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ----------------- Alerta gerencial -----------------

export type AlertaGerencial = {
  id: string;
  prioridade: "alta" | "media" | "baixa";
  origem: string;
  descricao: string;
  responsavel?: string;
  data?: string;
  linkVisualizar?: string;
  linkResolver?: string;
};

export function AlertaItem({ alerta }: { alerta: AlertaGerencial }) {
  const tone =
    alerta.prioridade === "alta"
      ? "border-destructive/40 bg-destructive/5"
      : alerta.prioridade === "media"
        ? "border-warning-soft-foreground/40 bg-warning-soft/30"
        : "border-border";
  const priorBadge =
    alerta.prioridade === "alta"
      ? "destructive"
      : alerta.prioridade === "media"
        ? "secondary"
        : "outline";
  return (
    <div className={"flex items-start justify-between gap-3 rounded-md border p-3 text-sm " + tone}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant={priorBadge as React.ComponentProps<typeof Badge>["variant"]}>
            {alerta.prioridade.toUpperCase()}
          </Badge>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {alerta.origem}
          </span>
          {alerta.data && (
            <span className="text-xs text-muted-foreground">
              · {formatDistanceToNow(new Date(alerta.data), { addSuffix: true, locale: ptBR })}
            </span>
          )}
        </div>
        <div className="mt-1 text-foreground">{alerta.descricao}</div>
        {alerta.responsavel && (
          <div className="mt-0.5 text-xs text-muted-foreground">
            Responsável: {alerta.responsavel}
          </div>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        {alerta.linkVisualizar && (
          <Button asChild size="sm" variant="ghost">
            <a href={alerta.linkVisualizar}>Visualizar</a>
          </Button>
        )}
        {alerta.linkResolver && (
          <Button asChild size="sm" variant="outline">
            <a href={alerta.linkResolver}>Resolver</a>
          </Button>
        )}
      </div>
    </div>
  );
}
