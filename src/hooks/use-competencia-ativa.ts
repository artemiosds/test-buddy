import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export type CompetenciaAtiva = {
  id: string;
  mes: number;
  ano: number;
  status: string;
  label: string;
};

export function useCompetenciaAtiva() {
  return useQuery({
    queryKey: ["competencia-ativa"],
    staleTime: 60_000,
    queryFn: async (): Promise<CompetenciaAtiva | null> => {
      const { data, error } = await supabase
        .from("competencias")
        .select("id, mes, ano, status")
        .in("status", ["aberta", "em_processamento"])
        .order("ano", { ascending: false })
        .order("mes", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      if (!data) return null;
      return {
        ...data,
        label: `${MESES[(data.mes ?? 1) - 1]}/${data.ano}`,
      };
    },
  });
}
