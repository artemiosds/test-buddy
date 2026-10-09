import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseNumeroPtBr } from "@/lib/numero-ptbr";
import { parseFinanceiro, type EntradaCalculo, type ParametrosFinanceiros } from "@/lib/folha-financeira";

/** Parâmetros financeiros salvos na Configuração Municipal (somente leitura). */
export function useFolhaFinanceiraParams() {
  return useQuery({
    queryKey: ["folha-financeira", "params"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ParametrosFinanceiros> => {
      const { data } = await supabase
        .from("municipio_config")
        .select("parametros")
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      const p = (data?.parametros ?? {}) as Record<string, unknown>;
      const params = parseFinanceiro(p.financeiro);
      const { data: cg } = await supabase.from("cargos").select("id, nivel").is("deleted_at", null);
      params.nivelPorCargo = Object.fromEntries((cg ?? []).map((c) => [c.id, c.nivel ?? null]));
      return params;
    },
  });
}

export type DadosProfissionalFin = {
  cargo_id: string | null;
  cargo_nome: string | null;
  carga_cargo: number | null;
  salario_proprio: number | null;
  vinculo_nome: string | null;
};

/** Busca cargo/salário/vínculo de vários profissionais (em lotes). */
export async function buscarDadosProfissionais(ids: string[]): Promise<Map<string, DadosProfissionalFin>> {
  const out = new Map<string, DadosProfissionalFin>();
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  for (let i = 0; i < uniq.length; i += 150) {
    const lote = uniq.slice(i, i + 150);
    const { data, error } = await supabase
      .from("profissionais")
      .select("id, cargo_id, salario_base, cargo:cargos(nome, carga_horaria_semanal), vinculo:vinculos(nome)")
      .in("id", lote);
    if (error) throw error;
    for (const r of (data ?? []) as any[]) {
      const sal = parseNumeroPtBr(r.salario_base);
      out.set(r.id, {
        cargo_id: r.cargo_id ?? null,
        cargo_nome: r.cargo?.nome ?? null,
        carga_cargo: r.cargo?.carga_horaria_semanal ?? null,
        salario_proprio: sal > 0 ? sal : null,
        vinculo_nome: r.vinculo?.nome ?? null,
      });
    }
  }
  return out;
}

export type HistoricoCompetencia = {
  competencia: string; // "MM/AAAA"
  ordem: number;
  entrada: Omit<EntradaCalculo, "cargo_id" | "salario_proprio" | "carga_cargo" | "vinculo_nome">;
};

const n = (v: unknown) => parseNumeroPtBr(v);

/** Histórico OFICIAL (somente lançamentos aprovados) de um profissional. */
export function useHistoricoFinanceiroProfissional(profissionalId: string | null | undefined) {
  return useQuery({
    queryKey: ["folha-financeira", "historico", profissionalId],
    enabled: !!profissionalId,
    staleTime: 60_000,
    queryFn: async (): Promise<HistoricoCompetencia[]> => {
      const pid = profissionalId!;
      const mapa = new Map<string, HistoricoCompetencia>();
      const add = (ano: number, mes: number, tipo: "efetivos" | "contratados", e: HistoricoCompetencia["entrada"]) => {
        const key = `${tipo}|${ano}-${mes}`;
        mapa.set(key, { competencia: `${String(mes).padStart(2, "0")}/${ano}`, ordem: ano * 100 + mes, entrada: e });
      };

      // Efetivos
      const { data: ef } = await supabase
        .from("frequencia_profissional")
        .select("frequencia_id, updated_at, dias_trabalhados, faltas_justificadas, faltas_injustificadas, he_50, he_100, plantoes_extras, sobreaviso, atestado, adicional_noturno, incentivo")
        .eq("profissional_id", pid)
        .is("deleted_at", null)
        .order("updated_at", { ascending: true })
        .limit(200);
      const efRows = (ef ?? []) as any[];
      if (efRows.length) {
        const { data: folhas } = await supabase
          .from("frequencias")
          .select("id, status, competencia_unidade:competencia_unidades(competencia:competencias(ano, mes))")
          .in("id", Array.from(new Set(efRows.map((r) => r.frequencia_id))));
        const fm = new Map(((folhas ?? []) as any[]).map((f) => [f.id, f]));
        for (const r of efRows) {
          const f = fm.get(r.frequencia_id);
          if (!f || !["aprovada", "aprovadas", "arquivada"].includes(f.status)) continue;
          const c = f.competencia_unidade?.competencia;
          if (!c) continue;
          add(c.ano, c.mes, "efetivos", {
            tipo: "efetivos",
            diasTrabalhados: n(r.dias_trabalhados),
            faltasJustificadas: n(r.faltas_justificadas),
            faltasInjustificadas: n(r.faltas_injustificadas),
            atestado: n(r.atestado),
            he50: n(r.he_50), he100: n(r.he_100), adn: n(r.adicional_noturno),
            plantoes: n(r.plantoes_extras), sobreaviso: n(r.sobreaviso), incentivo: n(r.incentivo),
          });
        }
      }

      // Contratados
      const { data: ct } = await supabase
        .from("frequencias_contratados")
        .select("competencia_id, updated_at, dias_trabalhados, dias_falta, he_50, he_100, plantoes, sobreaviso, atestado, adn, incentivo")
        .eq("profissional_id", pid)
        .in("status", ["aprovada", "arquivada"] as any)
        .is("deleted_at", null)
        .order("updated_at", { ascending: true })
        .limit(200);
      const ctRows = (ct ?? []) as any[];
      if (ctRows.length) {
        const { data: comps } = await supabase
          .from("competencias")
          .select("id, ano, mes")
          .in("id", Array.from(new Set(ctRows.map((r) => r.competencia_id))));
        const cm = new Map(((comps ?? []) as any[]).map((c) => [c.id, c]));
        for (const r of ctRows) {
          const c = cm.get(r.competencia_id);
          if (!c) continue;
          add(c.ano, c.mes, "contratados", {
            tipo: "contratados",
            diasTrabalhados: n(r.dias_trabalhados),
            faltasJustificadas: 0,
            faltasInjustificadas: n(r.dias_falta),
            atestado: n(r.atestado),
            he50: n(r.he_50), he100: n(r.he_100), adn: n(r.adn),
            plantoes: n(r.plantoes), sobreaviso: n(r.sobreaviso), incentivo: n(r.incentivo),
          });
        }
      }
      return Array.from(mapa.values()).sort((a, b) => b.ordem - a.ordem).slice(0, 12);
    },
  });
}
