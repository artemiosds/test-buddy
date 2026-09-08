import { Badge } from "@/components/ui/badge";
import { competenciaExtenso, situacaoConjunto, type FreqRow } from "./tipos";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CompetenciaOpcao = {
  id: string;
  ano: number;
  mes: number;
  envios: number;
};

/** Bloco de destaque: seletor de competência + situação + cards de resumo. */
export function ResumoCompetencia({
  competencias,
  competenciaId,
  onCompetencia,
  rows,
  statusAtivo,
  onStatus,
}: {
  competencias: CompetenciaOpcao[];
  competenciaId: string;
  onCompetencia: (id: string) => void;
  rows: FreqRow[];
  statusAtivo: string;
  onStatus: (status: string) => void;
}) {
  const conta = (s: string) => rows.filter((r) => r.status === s).length;
  const situacao = situacaoConjunto(rows);

  const cards: { key: string; label: string; valor: number; filtro?: string }[] = [
    { key: "todas", label: "Total enviadas", valor: rows.length, filtro: "todas" },
    {
      key: "em_analise",
      label: "Em análise",
      valor: conta("enviada") + conta("em_analise"),
      filtro: "pendentes",
    },
    { key: "aprovada", label: "Aprovadas", valor: conta("aprovada"), filtro: "aprovada" },
    { key: "rejeitada", label: "Rejeitadas", valor: conta("rejeitada"), filtro: "rejeitada" },
    {
      key: "com_pendencias",
      label: "Com pendências",
      valor: conta("com_pendencias") + conta("devolvida"),
      filtro: "com_pendencias",
    },
    {
      key: "profissionais",
      label: "Profissionais",
      valor: rows.reduce((acc, r) => acc + (r.total_profissionais ?? 0), 0),
    },
    {
      key: "unidades",
      label: "Unidades",
      valor: new Set(
        rows.map((r) => r.competencia_unidades?.unidade_id).filter(Boolean) as string[],
      ).size,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="min-w-[240px] flex-1">
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Competência
          </label>
          <Select value={competenciaId} onValueChange={onCompetencia}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Selecione a competência" />
            </SelectTrigger>
            <SelectContent>
              {competencias.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {competenciaExtenso(c.mes, c.ano)}
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({c.envios} envio{c.envios === 1 ? "" : "s"})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Badge variant="outline" className={`h-7 px-3 text-xs font-semibold ${situacao.className}`}>
          {situacao.label}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {cards.map((c) => {
          const ativo = !!c.filtro && c.filtro === statusAtivo;
          const clicavel = !!c.filtro;
          return (
            <button
              key={c.key}
              type="button"
              disabled={!clicavel}
              onClick={() => c.filtro && onStatus(c.filtro)}
              className={`rounded-xl border bg-card p-3 text-left shadow-sm transition-colors ${
                clicavel ? "hover:border-primary/40 hover:bg-muted/40" : "cursor-default"
              } ${ativo ? "border-primary/60 ring-1 ring-primary/30" : ""}`}
            >
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {c.label}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {c.valor}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ResumoCompetencia;
