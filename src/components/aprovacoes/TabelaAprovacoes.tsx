import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared";
import { Paperclip } from "lucide-react";
import { AcoesFrequencia } from "./AcoesFrequencia";
import { competenciaCurta, type AcoesHandlers, type FreqRow } from "./tipos";

export const POR_PAGINA = 20;

function chaveAnexo(r: FreqRow) {
  const subtipo = r.tipo === "contratados" ? "contratados" : "efetivos";
  return r.setor_id
    ? `${r.competencia_unidade_id}:${subtipo}:${r.setor_id}`
    : `${r.competencia_unidade_id}:${subtipo}`;
}

function LinhaUnidade({ r, anexos }: { r: FreqRow; anexos: Record<string, number> | undefined }) {
  const qtd = anexos?.[chaveAnexo(r)] ?? 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="font-medium text-foreground">
          {r.competencia_unidades?.unidades?.nome ?? "—"}
        </span>
        {qtd > 0 && (
          <span
            className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
            title={`${qtd} documento(s) de justificativa anexado(s)`}
          >
            <Paperclip className="h-3 w-3" />
            {qtd}
          </span>
        )}
      </div>
      {r.setores?.nome && (
        <span className="w-fit rounded border border-primary/10 bg-primary/5 px-1.5 text-[11px] text-muted-foreground">
          Setor: {r.setores.nome}
        </span>
      )}
    </div>
  );
}

/** Tabela (desktop) + cards (tablet/celular) com paginação de 20 em 20. */
export function TabelaAprovacoes({
  rows,
  pagina,
  onPagina,
  anexos,
  handlers,
}: {
  rows: FreqRow[];
  pagina: number;
  onPagina: (p: number) => void;
  anexos: Record<string, number> | undefined;
  handlers: AcoesHandlers;
}) {
  const total = rows.length;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const paginaAtual = Math.min(Math.max(1, pagina), totalPaginas);
  const inicio = (paginaAtual - 1) * POR_PAGINA;
  const visiveis = rows.slice(inicio, inicio + POR_PAGINA);

  return (
    <div className="space-y-3">
      {/* Desktop */}
      <div className="hidden max-h-[70vh] overflow-auto rounded-xl border bg-card lg:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b bg-muted/90 backdrop-blur-sm">
            <tr className="text-left">
              <th className="p-3">Unidade</th>
              <th className="p-3">Competência</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Profissionais</th>
              <th className="p-3">Status</th>
              <th className="p-3">Enviada em</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3">
                  <LinhaUnidade r={r} anexos={anexos} />
                </td>
                <td className="p-3">
                  {competenciaCurta(
                    r.competencia_unidades?.competencias?.mes,
                    r.competencia_unidades?.competencias?.ano,
                  )}
                </td>
                <td className="p-3 capitalize">{r.tipo}</td>
                <td className="p-3 tabular-nums">{r.total_profissionais ?? 0}</td>
                <td className="p-3">
                  <StatusBadge domain="frequencia" value={r.status} />
                </td>
                <td className="p-3">
                  {r.data_envio ? new Date(r.data_envio).toLocaleString("pt-BR") : "—"}
                </td>
                <td className="p-3">
                  <AcoesFrequencia r={r} h={handlers} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tablet / celular */}
      <div className="grid gap-3 lg:hidden">
        {visiveis.map((r) => (
          <div key={r.id} className="rounded-xl border bg-card p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <LinhaUnidade r={r} anexos={anexos} />
              <StatusBadge domain="frequencia" value={r.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="capitalize">
                {r.tipo}
              </Badge>
              <span>
                {competenciaCurta(
                  r.competencia_unidades?.competencias?.mes,
                  r.competencia_unidades?.competencias?.ano,
                )}
              </span>
              <span>· {r.total_profissionais ?? 0} profissionais</span>
              {r.data_envio && <span>· {new Date(r.data_envio).toLocaleDateString("pt-BR")}</span>}
            </div>
            <div className="mt-3">
              <AcoesFrequencia r={r} h={handlers} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {total === 0 ? "0 registros" : `${inicio + 1}–${Math.min(inicio + POR_PAGINA, total)} de ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={paginaAtual <= 1}
            onClick={() => onPagina(paginaAtual - 1)}
          >
            Anterior
          </Button>
          <span className="text-xs">
            Página {paginaAtual} de {totalPaginas}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={paginaAtual >= totalPaginas}
            onClick={() => onPagina(paginaAtual + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TabelaAprovacoes;
