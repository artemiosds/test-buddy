/**
 * Valores da Folha Financeira (folhas APROVADAS da competência ativa) por
 * profissional, para alimentar HE / ADN / Gratificação / Venc. Líquido nos
 * relatórios. Somente leitura — mesma lógica do painel de Projeção Financeira.
 */
import { useQuery } from "@tanstack/react-query";
import { useCompetenciaAtiva } from "@/hooks/use-competencia-ativa";
import { getAggregatedFrequencies } from "@/lib/analytics-aggregations";
import { buscarDadosProfissionais, buscarSnapshotsFinanceiros, salarioDoSnapshot, useFolhaFinanceiraParams } from "@/hooks/use-folha-financeira";
import { calcularFolha } from "@/lib/folha-financeira";

export type FolhaProf = { horas_extras: number; he_50: number; he_100: number; plantoes: number; sobreaviso: number; adicional_noturno: number; gratificacao_incentivo: number; bruto: number; liquido: number };

export function useFolhaCompetenciaAtiva(enabled: boolean) {
  const { data: ativa } = useCompetenciaAtiva();
  const { data: params } = useFolhaFinanceiraParams();
  return useQuery({
    queryKey: ["folha-financeira", "por-profissional", ativa?.id, !!params],
    enabled: enabled && !!ativa?.id && !!params,
    staleTime: 60_000,
    queryFn: async () => {
      const agg = await getAggregatedFrequencies({ competenciaId: ativa!.id });
      const ls = agg.oficial.linhas;
      const dados = await buscarDadosProfissionais(ls.map((l) => l.profissional_id));
      const snaps = await buscarSnapshotsFinanceiros(ls.map((l) => l.registro_id ?? ""));
      const out = new Map<string, FolhaProf>();
      for (const l of ls) {
        const d = dados.get(l.profissional_id);
        const snap = l.registro_id ? snaps.get(l.registro_id) : undefined;
        const sal = salarioDoSnapshot(snap, l.profissional_id);
        const r = calcularFolha(
          {
            tipo: l.tipo,
            cargo_id: sal ? sal.cargo_id : d?.cargo_id ?? null,
            salario_proprio: sal ? sal.salario_base : d?.salario_proprio ?? null,
            carga_cargo: sal ? sal.carga : d?.carga_cargo ?? null,
            vinculo_nome: d?.vinculo_nome ?? null,
            esf: d?.esf ?? false,
            diasTrabalhados: l.diasTrabalhados,
            faltasInjustificadas: l.faltasInjustificadas,
            faltasJustificadas: l.faltasJustificadas,
            atestado: l.atestado,
            he50: l.he50, he100: l.he100, adn: l.adn,
            plantoes: l.plantoes, sobreaviso: l.sobreaviso, incentivo: l.incentivo,
          },
          snap?.params ?? params!,
        );
        const prev = out.get(l.profissional_id);
        const v: FolhaProf = {
          horas_extras: r.vHe50 + r.vHe100,
          he_50: r.vHe50,
          he_100: r.vHe100,
          plantoes: r.vPlantoes,
          sobreaviso: r.vSobreaviso,
          adicional_noturno: r.vAdn,
          gratificacao_incentivo: r.vIncentivo + r.vGratificacao,
          bruto: r.bruto,
          liquido: r.liquido,
        };
        if (prev) for (const k of Object.keys(v) as (keyof FolhaProf)[]) v[k] += prev[k];
        out.set(l.profissional_id, v);
      }
      return out;
    },
  });
}
