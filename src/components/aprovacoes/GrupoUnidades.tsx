import { useState } from "react";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { StatusBadge, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { AcoesFrequencia } from "./AcoesFrequencia";
import { situacaoConjunto, type AcoesHandlers, type FreqRow } from "./tipos";

type Props = {
  rows: FreqRow[];
  handlers: AcoesHandlers;
  loading?: boolean;
  onVerTodas: () => void;
};

/** Visão agrupada por unidade: cada unidade é um bloco recolhível. */
export function GrupoUnidades({ rows, handlers, loading, onVerTodas }: Props) {
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <EmptyState title="Nenhuma frequência encontrada" />
        <div className="mt-3 flex justify-center">
          <Button variant="outline" size="sm" onClick={onVerTodas}>
            Ver todas as frequências
          </Button>
        </div>
      </div>
    );
  }

  const grupos = new Map<string, { nome: string; itens: FreqRow[] }>();
  for (const r of rows) {
    const id = r.competencia_unidades?.unidade_id ?? "sem-unidade";
    const nome = r.competencia_unidades?.unidades?.nome ?? "Sem unidade";
    if (!grupos.has(id)) grupos.set(id, { nome, itens: [] });
    grupos.get(id)!.itens.push(r);
  }
  const lista = [...grupos.entries()].sort((a, b) => a[1].nome.localeCompare(b[1].nome, "pt-BR"));

  return (
    <div className="space-y-3">
      {lista.map(([id, g]) => {
        const aberto = abertos[id] ?? false;
        const profissionais = g.itens.reduce((s, r) => s + (r.total_profissionais ?? 0), 0);
        const sit = situacaoConjunto(g.itens);
        return (
          <div key={id} className="rounded-lg border bg-card">
            <button
              type="button"
              onClick={() => setAbertos((p) => ({ ...p, [id]: !aberto }))}
              className="flex w-full flex-wrap items-center justify-between gap-3 p-3 text-left transition hover:bg-accent/40"
            >
              <span className="flex min-w-0 items-center gap-2">
                {aberto ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
                <span className="truncate font-medium">{g.nome}</span>
              </span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{g.itens.length} envio(s)</span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {profissionais}
                </span>
                <span className={"rounded-full border px-2 py-0.5 font-medium " + sit.className}>
                  {sit.label}
                </span>
              </span>
            </button>
            {aberto && (
              <div className="divide-y border-t">
                {g.itens.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3"
                  >
                    <div className="min-w-0 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="capitalize font-medium">{r.tipo}</span>
                        <StatusBadge domain="frequencia" value={r.status} />
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {r.setores?.nome ? `Setor: ${r.setores.nome} · ` : ""}
                        {r.total_profissionais ?? 0} profissional(is)
                      </div>
                    </div>
                    <AcoesFrequencia r={r} h={handlers} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default GrupoUnidades;
