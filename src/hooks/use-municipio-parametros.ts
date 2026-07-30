import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MunicipioParametros = {
  dias_aviso_prazo_fechamento: number;
  limite_he_50: number | null;
  limite_he_100: number | null;
  limite_plantoes: number | null;
  mensagem_topo: string;
  permitir_envio_fora_prazo: boolean;
};

export const DEFAULT_PARAMETROS: MunicipioParametros = {
  dias_aviso_prazo_fechamento: 5,
  limite_he_50: null,
  limite_he_100: null,
  limite_plantoes: null,
  mensagem_topo: "",
  permitir_envio_fora_prazo: false,
};

function parseParametros(raw: unknown): MunicipioParametros {
  const p = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    dias_aviso_prazo_fechamento: num(p.dias_aviso_prazo_fechamento) ?? 5,
    limite_he_50: num(p.limite_he_50),
    limite_he_100: num(p.limite_he_100),
    limite_plantoes: num(p.limite_plantoes),
    mensagem_topo: typeof p.mensagem_topo === "string" ? p.mensagem_topo : "",
    permitir_envio_fora_prazo: p.permitir_envio_fora_prazo === true,
  };
}

export function useMunicipioParametros() {
  return useQuery({
    queryKey: ["municipio-parametros"],
    staleTime: 60_000,
    queryFn: async (): Promise<MunicipioParametros> => {
      const { data, error } = await supabase
        .from("municipio_config")
        .select("parametros")
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) return DEFAULT_PARAMETROS;
      return parseParametros(data?.parametros);
    },
  });
}
