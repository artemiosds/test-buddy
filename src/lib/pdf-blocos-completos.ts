/**
 * Blocos completos para todo "Imprimir PDF (ABNT)" de frequência oficial:
 * consolidação, alertas, comparativo, evolução, afastamentos,
 * dimensionamento e dossiê por unidade/regime. Somente leitura, só aprovadas.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AbntBloco } from "@/lib/relatorio-abnt";
import {
  getAggregatedFrequencies, somarTotais, type ConsolidacaoOficial, type LinhaOficial,
} from "@/lib/analytics-aggregations";
import { blocosPdfOficial, linhasDaVisao, type VisaoOficial } from "@/components/relatorios/consolidacao-oficial-panel";
import { blocoPdfAlertas } from "@/components/relatorios/alertas-comparativo-panel";

const fmt = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const R = "right" as const;
const L = "left" as const;

const METR: [string, (t: Record<string, number>) => number][] = [
  ["Profissionais", (t) => t.profissionais],
  ["Dias trab.", (t) => t.diasTrabalhados],
  ["HE 50%", (t) => t.he50],
  ["HE 100%", (t) => t.he100],
  ["HE total", (t) => t.heTotal],
  ["Plantões", (t) => t.plantoes],
  ["Sobreaviso", (t) => t.sobreaviso],
  ["Adic. Not.", (t) => t.adn],
  ["Incentivo", (t) => t.incentivo],
  ["Faltas just.", (t) => t.faltasJustificadas],
  ["Faltas injust.", (t) => t.faltasInjustificadas],
  ["Atestados", (t) => t.atestado],
  ["Férias", (t) => (t.ferias ?? 0) + (t.feriasTerco ?? 0) + (t.feriasIntegral ?? 0)],
  ["Licenças", (t) => t.licencas],
  ["Lic.-prêmio", (t) => t.licencaPremio],
  ["Afastam.", (t) => t.afastamentos],
  ["Sal. subst. (h)", (t) => t.salSubH],
  ["Aulas supl.", (t) => t.aulasSuplementares],
];
const val = (t: unknown, f: (t: Record<string, number>) => number) => Number(f((t ?? {}) as Record<string, number>)) || 0;

export async function blocosPdfCompletos(opts: {
  oficial: ConsolidacaoOficial | undefined;
  visao: VisaoOficial;
  competenciaId?: string | null;
  unidadeId?: string | null;
}): Promise<AbntBloco[]> {
  const { oficial, visao } = opts;
  if (!oficial) return [];
  const comp = opts.competenciaId && opts.competenciaId !== "all" ? opts.competenciaId : null;
  const uid = opts.unidadeId && opts.unidadeId !== "all" ? opts.unidadeId : null;
  const linhas = linhasDaVisao(oficial, visao);
  const blocos: AbntBloco[] = [...blocosPdfOficial(oficial, visao), ...blocoPdfAlertas(oficial, visao)];

  // Evolução (até 6 competências terminando na atual) + comparativo
  const { data: comps } = await supabase.from("competencias").select("id, mes, ano")
    .is("deleted_at", null).order("ano", { ascending: false }).order("mes", { ascending: false });
  if (comps?.length) {
    const i = comp ? Math.max(comps.findIndex((c) => c.id === comp), 0) : 0;
    const serie = comps.slice(i, i + 6).reverse();
    const dados = await Promise.all(serie.map((c) =>
      c.id === comp ? Promise.resolve({ oficial }) : getAggregatedFrequencies({ competenciaId: c.id, unidadeId: uid }).catch(() => null)));
    const rot = (c: { mes: number; ano: number }) => `${String(c.mes).padStart(2, "0")}/${c.ano}`;
    const tots = dados.map((d) => d?.oficial?.[visao]);
    blocos.push({
      titulo: "Evolução por competências (somente aprovadas)",
      head: ["Indicador", ...serie.map(rot)],
      body: METR.map(([lab, f]) => [lab, ...tots.map((t) => fmt(val(t, f)))]),
      align: [L, ...serie.map(() => R)],
      keepTogether: false,
    });
    if (comp && serie.length >= 2) {
      const a = tots[tots.length - 1], b = tots[tots.length - 2];
      blocos.push({
        titulo: `Comparativo ${rot(serie[serie.length - 2])} × ${rot(serie[serie.length - 1])}`,
        head: ["Indicador", rot(serie[serie.length - 2]), rot(serie[serie.length - 1]), "Variação"],
        body: METR.map(([lab, f]) => {
          const x = val(a, f), y = val(b, f);
          return [lab, fmt(y), fmt(x), y ? `${x - y > 0 ? "+" : ""}${(((x - y) / y) * 100).toFixed(1)}%` : x ? `+${fmt(x)}` : "—"];
        }),
        align: [L, R, R, R],
      });
    }
  }

  // Afastamentos e licenças (nominal)
  const afast = (l: LinhaOficial) => l.ferias + l.feriasTerco + l.feriasIntegral + l.licencas + l.licencaPremio + l.afastamentos + l.atestado + l.faltasJustificadas;
  const af = linhas.filter((l) => afast(l) > 0).sort((a, b) => a.unidade_nome.localeCompare(b.unidade_nome) || a.profissional_nome.localeCompare(b.profissional_nome));
  if (af.length) blocos.push({
    titulo: `Afastamentos, férias e licenças (${af.length} profissional(is))`,
    head: ["Profissional", "Matrícula", "Unidade / Setor", "Férias", "Licenças", "Lic.-prêmio", "Afast.", "Atest.", "F. just.", "Dias trab."],
    body: af.map((l) => [l.profissional_nome, l.matricula ?? "—", `${l.unidade_sigla ?? l.unidade_nome}${l.setor_nome ? ` / ${l.setor_nome}` : ""}`,
      fmt(l.ferias + l.feriasTerco + l.feriasIntegral), fmt(l.licencas), fmt(l.licencaPremio), fmt(l.afastamentos), fmt(l.atestado), fmt(l.faltasJustificadas), fmt(l.diasTrabalhados)]),
    align: [L, L, L, R, R, R, R, R, R, R],
    keepTogether: false,
  });

  // Dimensionamento: cadastro ativo × frequência aprovada
  const cad: { id: string; unidade_id: string | null; status: string }[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from("profissionais").select("id, unidade_id, status").is("deleted_at", null).range(from, from + 999);
    if (uid) q = q.eq("unidade_id", uid);
    const { data, error } = await q;
    if (error || !data) break;
    cad.push(...(data as typeof cad));
    if (data.length < 1000) break;
  }
  const nomes = new Map<string, string>();
  const freq = new Map<string, Set<string>>();
  for (const l of linhas) {
    nomes.set(l.unidade_id, l.unidade_sigla ?? l.unidade_nome);
    if (!freq.has(l.unidade_id)) freq.set(l.unidade_id, new Set());
    freq.get(l.unidade_id)!.add(l.profissional_id);
  }
  for (const c of oficial.cobertura.porUnidade) nomes.set(c.unidade_id, c.unidade_sigla ?? c.unidade_nome);
  const dim = [...nomes.entries()].map(([id, nome]) => {
    const ativos = cad.filter((p) => p.unidade_id === id && p.status !== "desligado" && p.status !== "inativo").length;
    const f = freq.get(id)?.size ?? 0;
    return [nome, ativos, f, ativos - f, ativos ? `${((f / ativos) * 100).toFixed(1)}%` : "—"] as (string | number)[];
  }).sort((a, b) => Number(b[3]) - Number(a[3]));
  if (dim.length) {
    const at = dim.reduce((s, d) => s + Number(d[1]), 0), fr = dim.reduce((s, d) => s + Number(d[2]), 0);
    blocos.push({
      titulo: "Dimensionamento: cadastro ativo × frequência aprovada",
      nota: "Na visão Consolidado, o cadastro inclui todos os regimes.",
      head: ["Unidade", "Ativos (cadastro)", "Com frequência", "Diferença", "Cobertura"],
      body: dim,
      foot: ["TOTAL", at, fr, at - fr, at ? `${((fr / at) * 100).toFixed(1)}%` : "—"],
      align: [L, R, R, R, R],
      keepTogether: false,
    });
  }

  // Dossiê por unidade e regime
  const g = new Map<string, { nome: string; tipo: string; l: LinhaOficial[] }>();
  for (const l of linhas) {
    const k = `${l.unidade_id}:${l.tipo}`;
    if (!g.has(k)) g.set(k, { nome: l.unidade_nome, tipo: l.tipo, l: [] });
    g.get(k)!.l.push(l);
  }
  const cols = ["Prof.", "Dias", "HE 50%", "HE 100%", "HE total", "Plantões", "Sobreav.", "ADN", "Incent.", "Faltas", "Atest.", "Férias", "Licenças", "Afast."];
  const row = (t: ReturnType<typeof somarTotais>) => [t.profissionais, fmt(t.diasTrabalhados), fmt(t.he50), fmt(t.he100), fmt(t.heTotal), fmt(t.plantoes), fmt(t.sobreaviso), fmt(t.adn), fmt(t.incentivo), fmt(t.faltas), fmt(t.atestado), fmt(t.ferias), fmt(t.licencas), fmt(t.afastamentos)];
  if (g.size) blocos.push({
    titulo: "Totais por unidade e regime (controle externo)",
    head: ["Unidade", "Regime", ...cols],
    body: [...g.values()].sort((a, b) => a.nome.localeCompare(b.nome)).map((x) => [x.nome, x.tipo, ...row(somarTotais(x.l))]),
    foot: ["TOTAL GERAL", "—", ...row(somarTotais(linhas))],
    align: [L, L, ...cols.map(() => R)],
    keepTogether: false,
  });

  return blocos;
}
