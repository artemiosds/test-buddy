// Tipos e rótulos da camada consolidada — client-safe (sem acesso a banco).

export type StatusConsolidacao =
  | "consolidado"
  | "parcial"
  | "pendente"
  | "divergente"
  | "sem_importacao"
  | "erro";

export const STATUS_CONSOLIDACAO_LABEL: Record<StatusConsolidacao, string> = {
  consolidado: "Consolidado",
  parcial: "Parcial",
  pendente: "Pendente",
  divergente: "Divergente",
  sem_importacao: "Sem Importação",
  erro: "Erro",
};

export const STATUS_CONSOLIDACAO_VARIANTE: Record<
  StatusConsolidacao,
  "default" | "secondary" | "destructive" | "outline"
> = {
  consolidado: "default",
  parcial: "secondary",
  pendente: "outline",
  divergente: "destructive",
  sem_importacao: "outline",
  erro: "destructive",
};

export type Inconsistencia = { tipo: string; detalhe: string };
