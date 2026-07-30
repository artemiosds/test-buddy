import type { CategoriaPiso } from "./piso-categorias";

export type RefPiso = { valor: number; jornada: number };
export type MapaReferencias = Map<CategoriaPiso, RefPiso>;

/**
 * Carrega a tabela parametrizável de referência do Piso para a competência.
 * Faz fallback para a competência mais recente já cadastrada; se nada existir,
 * retorna vazio (o cálculo usa os valores padrão do código).
 */
export async function carregarReferencias(
  supabase: any,
  competencia: string | null,
): Promise<MapaReferencias> {
  const mapa: MapaReferencias = new Map();
  const { data, error } = await supabase
    .from("piso_referencia")
    .select("competencia, categoria, valor_referencia, jornada_base")
    .order("competencia", { ascending: false })
    .limit(1000);
  if (error || !data) return mapa;

  const alvo =
    (competencia && data.find((r: any) => r.competencia === competencia)?.competencia) ||
    (data.find((r: any) => !competencia || r.competencia <= competencia)?.competencia ?? null);
  if (!alvo) return mapa;

  for (const r of data.filter((x: any) => x.competencia === alvo)) {
    mapa.set(r.categoria as CategoriaPiso, {
      valor: Number(r.valor_referencia) || 0,
      jornada: Number(r.jornada_base) || 44,
    });
  }
  return mapa;
}

export function refDe(mapa: MapaReferencias, categoria: CategoriaPiso | null) {
  const r = categoria ? mapa.get(categoria) : undefined;
  return { valorReferenciaBase: r?.valor ?? null, jornadaBase: r?.jornada ?? null };
}
