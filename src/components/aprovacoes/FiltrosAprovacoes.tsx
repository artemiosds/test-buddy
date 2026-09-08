import { Eraser, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterBar } from "@/components/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FiltrosValores = {
  q: string;
  unidade: string;
  tipo: string;
  status: string;
  de: string;
  ate: string;
};

type Props = {
  valores: FiltrosValores;
  unidades: { id: string; nome: string }[];
  contadores: Record<string, number>;
  onChange: (patch: Partial<FiltrosValores>) => void;
  onLimpar: () => void;
};

const STATUS_OPCOES: { value: string; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "pendentes", label: "Pendentes (enviada + em análise)" },
  { value: "enviada", label: "Enviadas" },
  { value: "em_analise", label: "Em análise" },
  { value: "aprovada", label: "Aprovadas" },
  { value: "rejeitada", label: "Rejeitadas" },
  { value: "com_pendencias", label: "Com pendências" },
  { value: "devolvida", label: "Devolvidas" },
];

/** Filtros da listagem de aprovações. Não faz fetch — apenas emite mudanças. */
export function FiltrosAprovacoes({ valores, unidades, contadores, onChange, onLimpar }: Props) {
  return (
    <FilterBar
      actions={
        <Button variant="outline" size="sm" onClick={onLimpar}>
          <Eraser className="mr-1 h-4 w-4" />
          Limpar filtros
        </Button>
      }
    >
      <FilterBar.Field label="Buscar unidade ou setor">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            value={valores.q}
            placeholder="Ex.: Hospital, Vigilância..."
            onChange={(e) => onChange({ q: e.target.value })}
          />
        </div>
      </FilterBar.Field>

      <FilterBar.Field label="Unidade">
        <Select value={valores.unidade || "todas"} onValueChange={(v) => onChange({ unidade: v === "todas" ? "" : v })}>
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
            <SelectItem value="todas">Todos os tipos</SelectItem>
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
                {o.label} ({contadores[o.value] ?? 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar.Field>

      <FilterBar.Field label="Enviada a partir de">
        <Input type="date" value={valores.de} onChange={(e) => onChange({ de: e.target.value })} />
      </FilterBar.Field>

      <FilterBar.Field label="Enviada até">
        <Input type="date" value={valores.ate} onChange={(e) => onChange({ ate: e.target.value })} />
      </FilterBar.Field>
    </FilterBar>
  );
}

export default FiltrosAprovacoes;
