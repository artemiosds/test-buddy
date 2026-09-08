import type { Database } from "@/integrations/supabase/types";

export type StatusFreq = Database["public"]["Enums"]["status_frequencia"];

export type FreqRow = {
  id: string;
  tipo: string;
  status: StatusFreq;
  data_envio: string | null;
  data_aprovacao?: string | null;
  total_profissionais: number | null;
  competencia_unidade_id: string | null;
  setor_id: string | null;
  competencia_unidades: {
    unidade_id: string | null;
    competencia_id: string | null;
    unidades: { id: string; nome: string } | null;
    competencias: { ano: number; mes: number } | null;
  } | null;
  setores?: { id: string; nome: string } | null;
};

export type AcaoTipo = "em_analise" | "aprovar" | "rejeitar" | "retornar";

export type AcoesHandlers = {
  canAnalisar: boolean;
  canAprovar: boolean;
  canRejeitar: boolean;
  onAnexos: (r: FreqRow) => void;
  onTrilha: (r: FreqRow) => void;
  onLinhas: (r: FreqRow) => void;
  onAcao: (freqId: string, tipo: AcaoTipo) => void;
};

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** "Setembro/2026" — mês por extenso. */
export function competenciaExtenso(mes: number | null | undefined, ano: number | null | undefined) {
  if (!mes || !ano) return "—";
  return `${MESES[mes - 1] ?? mes}/${ano}`;
}

export function competenciaCurta(mes: number | null | undefined, ano: number | null | undefined) {
  if (!mes || !ano) return "—";
  return `${String(mes).padStart(2, "0")}/${ano}`;
}

/** Situação predominante de um conjunto de frequências. */
export function situacaoConjunto(rows: FreqRow[]): {
  label: string;
  className: string;
} {
  if (!rows.length)
    return {
      label: "Sem frequências enviadas",
      className: "bg-muted text-muted-foreground border-border",
    };
  const tem = (s: string) => rows.some((r) => r.status === s);
  if (tem("rejeitada"))
    return { label: "Com rejeições", className: "border-red-200 bg-red-50 text-red-700" };
  if (tem("com_pendencias") || tem("devolvida" as StatusFreq))
    return { label: "Com pendências", className: "border-amber-200 bg-amber-50 text-amber-800" };
  if (tem("enviada") || tem("em_analise"))
    return { label: "Em análise", className: "border-sky-200 bg-sky-50 text-sky-800" };
  return {
    label: "Processada",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
}
