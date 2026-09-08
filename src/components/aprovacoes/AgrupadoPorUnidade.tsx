import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AcoesFrequencia } from "./AcoesFrequencia";
import { situacaoConjunto, type AcoesHandlers, type FreqRow } from "./tipos";

/** Visão agrupada: um bloco recolhível por unidade. */
export function AgrupadoPorUnidade({
  rows,
  handlers,
}: {
  rows: FreqRow[];
  handlers: AcoesHandlers;
}) {
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  const grupos = new Map<string, { nome: string; itens: FreqRow[] }>();
  for (const r of rows) {
    const u = r.competencia_unidades?.unidades;
    const id = u?.id ?? "sem-unidade";
    if (!grupos.has(id)) grupos.set(id, { nome: u?.nome ?? "Sem unidade", itens: [] });
    grupos.get(id)!.itens.push(r);
  }
  const lista = Array.from(grupos.entries()).sort((a, b) =>
    a[1].nome.localeCompare(b[1].nome, "pt-BR"),
  );

  return (
    <div className="space-y-3">
      {lista.map(([id, g]) => {
        const aberto = abertos[id] ?? false;
        const profissionais = g.itens.reduce((acc, r) => acc + (r.total_profissionais ?? 0), 0);
        const situacao = situacaoConjunto(g.itens);
        return (
          <div key={id} className="rounded-xl border bg-card shadow-sm">
            <button
              type="button"
              onClick={() => setAbertos((p) => ({ ...p, [id]: !aberto }))}
              className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left hover:bg-muted/30"
            >
              <div className="flex items-center gap-2">
                {aberto ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-medium">{g.nome}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {g.itens.length} envio{g.itens.length === 1 ? "" : "s"}
                </span>
                <span>· {profissionais} profissionais</span>
                <Badge variant="outline" className={`text-[11px] ${situacao.className}`}>
                  {situacao.label}
                </Badge>
              </div>
            </button>
            {aberto && (
              <div className="divide-y border-t">
                {g.itens.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {r.tipo}
                      </Badge>
                      {r.setores?.nome && (
                        <span className="text-xs text-muted-foreground">
                          Setor: {r.setores.nome}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {r.total_profissionais ?? 0} profissionais
                      </span>
                      <StatusBadge domain="frequencia" value={r.status} />
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

export default AgrupadoPorUnidade;
