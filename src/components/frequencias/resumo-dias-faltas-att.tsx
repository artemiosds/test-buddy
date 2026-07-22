import { Link } from "@tanstack/react-router";
import { ChevronRight, CalendarCheck, CalendarX, Stethoscope, Home } from "lucide-react";
import { useEffect, useState } from "react";

/** Breadcrumb de ações rápidas para as telas de folha. */
export function FolhaBreadcrumb({ current }: { current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12.5px] text-slate-500">
      <Link
        to="/"
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-slate-100 hover:text-slate-800"
      >
        <Home className="h-3.5 w-3.5" />
        Dashboard
      </Link>
      <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
      <Link
        to="/frequencias"
        className="rounded px-1.5 py-0.5 hover:bg-slate-100 hover:text-slate-800"
      >
        Gestão de Pessoas
      </Link>
      <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
      <span className="rounded px-1.5 py-0.5 font-medium text-slate-800">{current}</span>
    </nav>
  );
}

type Val = { dias: number; faltas: number; att: number };

export function ResumoDiasFaltasAtt({
  totais,
  selecionado,
}: {
  totais: Val;
  selecionado?: { nome: string; valores: Val } | null;
}) {
  const mostraDetalhe = !!selecionado;
  const src = selecionado?.valores ?? totais;

  const cards = [
    {
      key: "dias",
      label: "Dias trabalhados",
      value: src.dias,
      icon: CalendarCheck,
      tone: "text-emerald-700 bg-emerald-50 ring-emerald-100",
      dark: "dark:text-emerald-300 dark:bg-emerald-500/10 dark:ring-emerald-500/20",
    },
    {
      key: "faltas",
      label: "Faltas",
      value: src.faltas,
      icon: CalendarX,
      tone: "text-rose-700 bg-rose-50 ring-rose-100",
      dark: "dark:text-rose-300 dark:bg-rose-500/10 dark:ring-rose-500/20",
    },
    {
      key: "att",
      label: "Atestados (ATT)",
      value: src.att,
      icon: Stethoscope,
      tone: "text-sky-700 bg-sky-50 ring-sky-100",
      dark: "dark:text-sky-300 dark:bg-sky-500/10 dark:ring-sky-500/20",
    },
  ] as const;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {mostraDetalhe ? "Resumo do profissional" : "Totais da competência"}
        </span>
        {mostraDetalhe && (
          <span className="max-w-[220px] truncate text-[12px] font-medium text-slate-700 dark:text-slate-200">
            {selecionado.nome}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.key}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 ring-1 ring-inset ${c.tone} ${c.dark}`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
              <div className="min-w-0 leading-tight">
                <div className="text-[10.5px] font-medium uppercase tracking-wider opacity-80">
                  {c.label}
                </div>
                <div className="text-lg font-bold tabular-nums">{c.value ?? 0}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Hook que ouve cliques em linhas da .erp-grid e devolve o rowId selecionado. */
export function useSelectedErpRow() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const tr = (e.target as HTMLElement | null)?.closest?.(".erp-grid tr[data-row-id]");
      if (tr) {
        const rid = (tr as HTMLElement).getAttribute("data-row-id");
        if (rid) setId((cur) => (cur === rid ? null : rid));
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return [id, setId] as const;
}
