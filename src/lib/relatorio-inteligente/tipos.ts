/**
 * Tipos do Gerador Corporativo de Relatórios Gerenciais.
 * Puro (sem side-effects). Serializável — usado para modelos salvos.
 */
import type { GerencialAggregate } from "@/lib/relatorios-gerenciais-intelligence";

export type FieldValue = string | number | null;
export type Row = Record<string, FieldValue>;

export type FieldDef = {
  id: string;
  label: string;
  /** Marcado por padrão ao selecionar o bloco. */
  default?: boolean;
  /** "number" imprime alinhado à direita e permite estatísticas. */
  tipo?: "text" | "number";
  /** Sugerido para agrupamento. */
  groupable?: boolean;
};

export type BlockContext = {
  aggregate: GerencialAggregate;
  /** Fetch opcional para blocos de listas nominais (ex.: cadastro geral). */
  profissionais?: Array<Record<string, FieldValue>>;
};

export type BlockDef = {
  id: string;
  label: string;
  categoria: string;
  descricao?: string;
  fields: FieldDef[];
  /** Constrói as linhas do bloco a partir do contexto agregado. */
  build: (ctx: BlockContext) => Row[];
  /** Tipos de gráfico compatíveis. */
  graficos?: Array<"barra" | "pizza" | "linha" | "area" | "rosca" | "radar">;
};

export type SortSpec = { fieldId: string; dir: "asc" | "desc" } | null;

export type ChartTipo = "barra" | "pizza" | "linha" | "area" | "rosca";

export type ChartSpec = {
  id: string;
  tipo: ChartTipo;
  /** Campo categórico (eixo X ou fatias). */
  xField: string;
  /** Campo numérico (eixo Y ou tamanho da fatia). */
  yField: string;
  /** Limita para as N maiores categorias (default: 12). */
  top?: number;
  titulo?: string;
};

export type BlockConfig = {
  blockId: string;
  /** Ids dos campos selecionados; ordem preservada. */
  fields: string[];
  sort: SortSpec;
  /** Campos usados para agrupar em árvore (ordem = níveis). */
  groupBy?: string[];
  /** Gráficos configurados pelo usuário para este bloco. */
  charts?: ChartSpec[];
};

export type ReportConfig = {
  tipo: string;
  blocks: BlockConfig[];
};

export const emptyReport: ReportConfig = { tipo: "personalizado", blocks: [] };
