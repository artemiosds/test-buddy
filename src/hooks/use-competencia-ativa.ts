import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async (): Promise<CompetenciaAtiva | null> => {
      // Tenta buscar a competência aberta mais recente
      const { data, error } = await supabase
        .from("competencias")
        .select("id, mes, ano, status")
        .eq("status", "aberta")
        .order("ano", { ascending: false })
        .order("mes", { ascending: false })
        .limit(1);
      
      if (error) {
        console.error("Erro ao buscar competência ativa:", error);
        return null;
      }
      
      // Fallback: se não houver aberta, tenta buscar em_processamento
      if (!data?.[0]) {
        const { data: procData } = await supabase
          .from("competencias")
          .select("id, mes, ano, status")
          .eq("status", "em_processamento")
          .order("ano", { ascending: false })
          .order("mes", { ascending: false })
          .limit(1);
        
        if (procData?.[0]) {
          const item = procData[0];
          return {
            id: item.id,
            mes: item.mes,
            ano: item.ano,
            status: item.status,
            label: `${MESES[(item.mes ?? 1) - 1]}/${item.ano}`,
          };
        }
      } else {
        const item = data[0];
        return {
          id: item.id,
          mes: item.mes,
          ano: item.ano,
          status: item.status,
          label: `${MESES[(item.mes ?? 1) - 1]}/${item.ano}`,
        };
      }

      // Último fallback: buscar a última encerrada para não travar o dashboard
      const { data: lastData } = await supabase
        .from("competencias")
        .select("id, mes, ano, status")
        .eq("status", "encerrada")
        .order("ano", { ascending: false })
        .order("mes", { ascending: false })
        .limit(1);
      
      if (lastData?.[0]) {
        const item = lastData[0];
        return {
          id: item.id,
          mes: item.mes,
          ano: item.ano,
          status: item.status,
          label: `${MESES[(item.mes ?? 1) - 1]}/${item.ano}`,
        };
      }
      
      return null;
    },
  });
}
