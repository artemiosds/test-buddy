import { Paperclip } from "lucide-react";
import { StatusBadge, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/shared/Pagination";
import { AcoesFrequencia } from "./AcoesFrequencia";
import { chaveAnexo, competenciaCurta, type AcoesHandlers, type FreqRow } from "./tipos";

type Props = {
  rows: FreqRow[];
  total: number;
  pagina: number;
  pageSize: number;
  onPagina: (p: number) => void;
  anexos?: Record<string, number>;
  handlers: AcoesHandlers;
  loading?: boolean;
  onVerTodas: () => void;
};

function Anexos({ qtd }: { qtd: number }) {
  if (!qtd) return null;
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
      title={`${qtd} documento(s) de justificativa anexado(s)`}
    >
      <Paperclip className="h-3 w-3" />
      {qtd}
    </span>
  );
}

/** Tabela (desktop) + cards (mobile) das frequências, com paginação. */
export function TabelaAprovacoes({
  rows,
  total,
  pagina,
  pageSize,
  onPagina,
  anexos,
  handlers,
  loading,
  onVerTodas,
}: Props) {
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
        <EmptyState
          title="Nenhuma frequência encontrada"
          description="Nenhum envio corresponde aos filtros aplicados nesta competência."
        />
        <div className="mt-3 flex justify-center">
          <Button variant="outline" size="sm" onClick={onVerTodas}>
            Ver todas as frequências
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Desktop / notebook */}
      <div className="hidden rounded-lg border bg-card md:block">
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b bg-muted/95 backdrop-blur">
              <tr className="text-left">
                <th className="p-3">Unidade</th>
                <th className="p-3">Competência</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Prof.</th>
                <th className="p-3">Status</th>
                <th className="p-3">Enviada em</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cu = r.competencia_unidades;
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-foreground">
                          {cu?.unidades?.nome ?? "—"}
                        </span>
                        <span className="flex items-center gap-1.5">
                          {r.setores?.nome && (
                            <span className="w-fit rounded border border-primary/10 bg-primary/5 px-1.5 text-[11px] text-muted-foreground">
                              Setor: {r.setores.nome}
                            </span>
                          )}
                          <Anexos qtd={anexos?.[chaveAnexo(r)] ?? 0} />
                        </span>
                      </div>
                    </td>
                    <td className="p-3 tabular-nums">
                      {competenciaCurta(cu?.competencias?.mes, cu?.competencias?.ano)}
                    </td>
                    <td className="p-3 capitalize">{r.tipo}</td>
                    <td className="p-3 tabular-nums">{r.total_profissionais ?? 0}</td>
                    <td className="p-3">
                      <StatusBadge domain="frequencia" value={r.status} />
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {r.data_envio ? new Date(r.data_envio).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="p-3">
                      <AcoesFrequencia r={r} h={handlers} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tablet / celular */}
      <div className="space-y-3 md:hidden">
        {rows.map((r) => {
          const cu = r.competencia_unidades;
          return (
            <div key={r.id} className="rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{cu?.unidades?.nome ?? "—"}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="capitalize">{r.tipo}</span>
                    <span>·</span>
                    <span>{competenciaCurta(cu?.competencias?.mes, cu?.competencias?.ano)}</span>
                    <span>·</span>
                    <span>{r.total_profissionais ?? 0} prof.</span>
                    <Anexos qtd={anexos?.[chaveAnexo(r)] ?? 0} />
                  </div>
                  {r.setores?.nome && (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Setor: {r.setores.nome}
                    </div>
                  )}
                </div>
                <StatusBadge domain="frequencia" value={r.status} />
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">
                Enviada em {r.data_envio ? new Date(r.data_envio).toLocaleString("pt-BR") : "—"}
              </div>
              <div className="mt-2 border-t pt-2">
                <AcoesFrequencia r={r} h={handlers} />
              </div>
            </div>
          );
        })}
      </div>

      <Pagination
        page={pagina}
        pageSize={pageSize}
        total={total}
        onPageChange={onPagina}
      />
    </div>
  );
}

export default TabelaAprovacoes;
