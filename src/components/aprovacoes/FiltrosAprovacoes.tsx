import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterBar } from "@/components/shared/FilterBar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RotateCcw } from "lucide-react";
import type { FreqRow } from "./tipos";

export type FiltrosState = {
  q: string;
  unidade: string;
  tipo: string;
  status: string;
  de: string;
  ate: string;
};

export const STATUS_OPCOES: { value: string; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "pendentes", label: "Pendentes (enviada + em análise)" },
  { value: "enviada", label: "Enviadas" },
  { value: "em_analise", label: "Em análise" },
  { value: "aprovada", label: "Aprovadas" },
  { value: "rejeitada", label: "Rejeitadas" },
  { value: "com_pendencias", label: "Com pendências" },
];

/** Filtros da competência selecionada. Contadores calculados dos dados reais. */
export function FiltrosAprovacoes({
  valores,
  onChange,
  onLimpar,
  rows,
}: {
  valores: FiltrosState;
  onChange: (patch: Partial<FiltrosState>) => void;
  onLimpar: () => void;
  rows: FreqRow[];
}) {
  const unidades = Array.from(
    new Map(
      rows
        .map((r) => r.competencia_unidades?.unidades)
        .filter((u): u is { id: string; nome: string } => !!u)
        .map((u) => [u.id, u]),
    ).values(),
  ).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const contaStatus = (value: string) => {
    if (value === "todas") return rows.length;
    if (value === "pendentes")
      return rows.filter((r) => r.status === "enviada" || r.status === "em_analise").length;
    if (value === "com_pendencias")
      return rows.filter((r) => r.status === "com_pendencias" || r.status === "devolvida").length;
    return rows.filter((r) => r.status === value).length;
  };

  return (
    <FilterBar
      actions={
        <Button variant="outline" size="sm" onClick={onLimpar}>
          <RotateCcw className="mr-1 h-4 w-4" />
          Limpar filtros
        </Button>
      }
    >
      <FilterBar.Field label="Buscar unidade/setor">
        <Input
          value={valores.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="Ex.: Hospital, Enfermagem..."
        />
      </FilterBar.Field>

      <FilterBar.Field label="Unidade">
        <Select value={valores.unidade} onValueChange={(v) => onChange({ unidade: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as unidades</SelectItem>
            {unidades.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar.Field>

      <FilterBar.Field label="Tipo">
        <Select value={valores.tipo} onValueChange={(v) => onChange({ tipo: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="efetivos">Efetivos</SelectItem>
            <SelectItem value="contratados">Contratados</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar.Field>

      <FilterBar.Field label="Status">
        <Select value={valores.status} onValueChange={(v) => onChange({ status: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPCOES.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label} ({contaStatus(o.value)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar.Field>

      <FilterBar.Field label="Enviada de">
        <Input type="date" value={valores.de} onChange={(e) => onChange({ de: e.target.value })} />
      </FilterBar.Field>

      <FilterBar.Field label="Enviada até">
        <Input type="date" value={valores.ate} onChange={(e) => onChange({ ate: e.target.value })} />
      </FilterBar.Field>
    </FilterBar>
  );
}

export default FiltrosAprovacoes;
