import type { ReactNode } from "react";
import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle, CheckCircle2, MinusCircle, XCircle, Info as InfoIcon, Users, User,
  ExternalLink, Filter as FilterIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/shared";
import { cn } from "@/lib/utils";
import {
  ALERTA_LABEL, SITUACAO_LABEL, SITUACAO_ORDER,
  contarSituacoes, derivarAlertas, derivarElegibilidadePiso,
  derivarSituacao,
  type Elegibilidade, type ProfConferencia, type ResumoSituacao,
  type SituacaoFuncional,
} from "@/lib/situacao-funcional";

/* ---------------------------------------------------------------------- */
/* SituacaoBadge — reutiliza o registry central `status.ts` domínio       */
/* `profissional`, mantendo padrão visual do sistema.                     */
/* ---------------------------------------------------------------------- */
export function SituacaoBadge({
  prof, className,
}: { prof: ProfConferencia; className?: string }) {
  const s = derivarSituacao(prof);
  return <StatusBadge domain="profissional" value={s} className={className} />;
}

/* ---------------------------------------------------------------------- */
/* SituacaoResumo — KPIs de topo por situação funcional.                  */
/* ---------------------------------------------------------------------- */
function KpiChip({
  label, value, tone,
}: { label: string; value: number; tone: "ok" | "warn" | "info" | "danger" | "muted" }) {
  const toneMap: Record<string, string> = {
    ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    warn: "bg-amber-50 text-amber-700 ring-amber-200",
    info: "bg-sky-50 text-sky-700 ring-sky-200",
    danger: "bg-red-50 text-red-700 ring-red-200",
    muted: "bg-slate-50 text-slate-700 ring-slate-200",
  };
  return (
    <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm ring-1", toneMap[tone])}>
      <span className="tabular-nums text-lg font-semibold">{value}</span>
      <span className="text-xs opacity-80">{label}</span>
    </div>
  );
}

export function SituacaoResumo({ rows }: { rows: ProfConferencia[] }) {
  const r: ResumoSituacao = useMemo(() => contarSituacoes(rows), [rows]);
  return (
    <div className="flex flex-wrap gap-2">
      <KpiChip label="Total" value={r.total} tone="muted" />
      <KpiChip label="Ativos" value={r.ativos} tone="ok" />
      <KpiChip label="Férias" value={r.ferias} tone="info" />
      <KpiChip label="Licença" value={r.licenca} tone="warn" />
      <KpiChip label="Afastados" value={r.afastados} tone="warn" />
      <KpiChip label="Desligados" value={r.desligados} tone="danger" />
      <KpiChip label="Com pendência" value={r.pendencias} tone="warn" />
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* SituacaoFilter — filtro rápido por situação funcional.                 */
/* ---------------------------------------------------------------------- */
export type SituacaoFilterValue = "todas" | SituacaoFuncional;

export function SituacaoFilter({
  value, onChange, className,
}: {
  value: SituacaoFilterValue;
  onChange: (v: SituacaoFilterValue) => void;
  className?: string;
}) {
  const opts: Array<{ id: SituacaoFilterValue; label: string }> = [
    { id: "todas", label: "Todas as situações" },
    ...SITUACAO_ORDER.map((s) => ({ id: s, label: SITUACAO_LABEL[s] })),
  ];
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <FilterIcon className="mr-0.5 h-3.5 w-3.5 text-muted-foreground" />
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs ring-1 transition",
            value === o.id
              ? "bg-primary text-primary-foreground ring-primary"
              : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* ElegibilidadePisoBadge                                                 */
/* ---------------------------------------------------------------------- */
export function ElegibilidadePisoBadge({ prof }: { prof: ProfConferencia }) {
  const e = derivarElegibilidadePiso(prof);
  const meta: Record<Elegibilidade, { label: string; className: string; icon: ReactNode; tip: string }> = {
    elegivel: {
      label: "Elegível",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      icon: <CheckCircle2 className="h-3 w-3" />,
      tip: "Cargo de enfermagem, sem pendências cadastrais que impeçam a complementação.",
    },
    revisar: {
      label: "Revisar",
      className: "bg-amber-50 text-amber-700 ring-amber-200",
      icon: <AlertTriangle className="h-3 w-3" />,
      tip: "Elegível pelo cargo, mas requer conferência (situação funcional ou pendência cadastral).",
    },
    nao_elegivel: {
      label: "Não elegível",
      className: "bg-slate-50 text-slate-600 ring-slate-200",
      icon: <MinusCircle className="h-3 w-3" />,
      tip: "Cargo fora do escopo do Piso Nacional da Enfermagem.",
    },
  };
  const m = meta[e];
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1",
              m.className,
            )}
          >
            {m.icon}
            {m.label}
          </span>
        </TooltipTrigger>
        <TooltipContent>{m.tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ---------------------------------------------------------------------- */
/* ProfissionalNomeCell — nome com tooltip rico e clique → drawer dossiê. */
/* ---------------------------------------------------------------------- */
export function ProfissionalNomeCell({
  prof, onOpenDossie, secondary,
}: {
  prof: ProfConferencia;
  onOpenDossie?: (p: ProfConferencia) => void;
  secondary?: ReactNode;
}) {
  const alertas = derivarAlertas(prof);
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onOpenDossie?.(prof)}
            className="text-left"
          >
            <div className="font-medium text-slate-900 hover:text-primary">
              {prof.nome ?? "—"}
            </div>
            {secondary && (
              <div className="text-[11px] text-muted-foreground">{secondary}</div>
            )}
            {alertas.length > 0 && (
              <div className="mt-1 inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                <AlertTriangle className="h-3 w-3" />
                {alertas.length} pendência{alertas.length > 1 ? "s" : ""} cadastral{alertas.length > 1 ? "is" : ""}
              </div>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1 text-xs">
            <div><strong>{prof.nome ?? "—"}</strong></div>
            {prof.matricula && <div>Matrícula: {prof.matricula}</div>}
            {prof.cpf && <div>CPF: {prof.cpf}</div>}
            {prof.cargo && <div>Cargo: {prof.cargo}</div>}
            {prof.setor && <div>Setor: {prof.setor}</div>}
            <div>Situação: {SITUACAO_LABEL[derivarSituacao(prof)]}</div>
            {alertas.length > 0 && (
              <div className="mt-1 border-t pt-1 text-amber-600">
                {alertas.map((a) => (
                  <div key={a}>• {ALERTA_LABEL[a]}</div>
                ))}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ---------------------------------------------------------------------- */
/* DossieDrawer — painel lateral com resumo funcional + link cadastro.    */
/* ---------------------------------------------------------------------- */
export function DossieDrawer({
  prof, open, onOpenChange,
}: {
  prof: ProfConferencia | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!prof) return null;
  const alertas = derivarAlertas(prof);
  const eleg = derivarElegibilidadePiso(prof);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-4 w-4" /> {prof.nome ?? "Profissional"}
          </SheetTitle>
          <SheetDescription>Dossiê funcional resumido</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <Info label="Matrícula" value={prof.matricula ?? "—"} mono />
            <Info label="CPF" value={prof.cpf ?? "—"} mono />
            <Info label="Cargo" value={prof.cargo ?? "—"} />
            <Info label="Função" value={prof.funcao ?? "—"} />
            <Info label="Setor" value={prof.setor ?? "—"} />
            <Info label="Vínculo" value={prof.vinculo ?? "—"} />
          </div>

          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
              Situação
            </div>
            <div className="flex items-center gap-2">
              <SituacaoBadge prof={prof} />
              <ElegibilidadePisoBadge prof={prof} />
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
              Dados bancários
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Info label="Banco" value={prof.banco ?? "—"} />
              <Info label="Agência" value={prof.agencia ?? "—"} mono />
              <Info label="Conta" value={prof.conta_corrente ?? "—"} mono />
            </div>
          </div>

          {alertas.length > 0 && (
            <div className="rounded-md border border-amber-300/60 bg-amber-50 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                Pendências cadastrais
              </div>
              <ul className="space-y-0.5 text-xs text-amber-800">
                {alertas.map((a) => (
                  <li key={a}>• {ALERTA_LABEL[a]}</li>
                ))}
              </ul>
            </div>
          )}

          {eleg === "revisar" && (
            <div className="rounded-md border border-sky-300/60 bg-sky-50 p-3 text-xs text-sky-800">
              <InfoIcon className="mr-1 inline h-3 w-3" />
              Cargo elegível ao Piso da Enfermagem, mas requer conferência antes do repasse.
            </div>
          )}

          <div className="pt-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/profissionais/$id" params={{ id: prof.id }}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Abrir cadastro completo
              </Link>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Info({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-sm text-slate-900", mono && "font-mono")}>{value}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* AlertasDrawer — consolidação de alertas de todas as linhas visíveis.   */
/* ---------------------------------------------------------------------- */
export function AlertasBotao({
  rows, onSelectProfissional,
}: {
  rows: ProfConferencia[];
  onSelectProfissional?: (p: ProfConferencia) => void;
}) {
  const [open, setOpen] = useState(false);
  const items = useMemo(
    () =>
      rows
        .map((p) => ({ p, alertas: derivarAlertas(p) }))
        .filter((x) => x.alertas.length > 0)
        .sort((a, b) => b.alertas.length - a.alertas.length),
    [rows],
  );

  const total = items.reduce((acc, it) => acc + it.alertas.length, 0);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn(
          items.length > 0 && "border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100",
        )}
      >
        <AlertTriangle className="mr-1.5 h-4 w-4" />
        {items.length === 0 ? "Sem alertas" : `${items.length} profissional${items.length > 1 ? "is" : ""} com alertas`}
        {total > 0 && (
          <Badge variant="outline" className="ml-2 bg-white/70">
            {total}
          </Badge>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Alertas gerenciais
            </SheetTitle>
            <SheetDescription>
              {items.length === 0
                ? "Nenhum profissional com pendências cadastrais nesta tela."
                : `${items.length} profissional${items.length > 1 ? "is" : ""} com ${total} alerta${total > 1 ? "s" : ""}.`}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            {items.map(({ p, alertas }) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSelectProfissional?.(p);
                }}
                className="block w-full rounded-md border p-3 text-left hover:bg-accent/50"
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-slate-900">{p.nome ?? "—"}</div>
                  <SituacaoBadge prof={p} />
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {p.matricula ? `Mat. ${p.matricula} · ` : ""}
                  {p.cargo ?? "sem cargo"}
                </div>
                <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
                  {alertas.map((a) => (
                    <li key={a}>• {ALERTA_LABEL[a]}</li>
                  ))}
                </ul>
              </button>
            ))}
            {items.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                Todos os cadastros conferidos.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// Suppress unused-import warnings by exporting used utilities.
export { Users, XCircle };