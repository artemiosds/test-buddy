import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import {
  getAggregatedFrequencies, somarTotais, type ConsolidacaoOficial, type LinhaOficial,
} from "@/lib/analytics-aggregations";
import { useCompetenciasLookup } from "@/hooks/use-lookups";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { linhasDaVisao, type VisaoOficial } from "./consolidacao-oficial-panel";
import { loadPdfKit } from "@/lib/lazy-exports";
import { finalizarPdf } from "@/lib/pdf-pipeline";

const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function baixarCsv(nome: string, header: string[], rows: (string | number | null)[][]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "\uFEFF" + [header, ...rows].map((r) => r.map(esc).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = `${nome}.csv`; a.click();
  URL.revokeObjectURL(url);
}

const afastTotal = (l: LinhaOficial) =>
  l.ferias + l.feriasTerco + l.feriasIntegral + l.licencas + l.licencaPremio + l.afastamentos + l.atestado + l.faltasJustificadas;

type MetricaKey = "profissionais" | "diasTrabalhados" | "he50" | "he100" | "heTotal" | "plantoes" | "sobreaviso" | "adn" | "incentivo"
  | "faltas" | "faltasJustificadas" | "faltasInjustificadas" | "atestado" | "ferias" | "licencas" | "licencaPremio" | "afastamentos" | "salSubH" | "aulasSuplementares";
const METRICAS: { key: MetricaKey; label: string; cor: string }[] = [
  { key: "profissionais", label: "Profissionais", cor: "#3B82F6" },
  { key: "diasTrabalhados", label: "Dias trabalhados", cor: "#14B8A6" },
  { key: "he50", label: "HE 50%", cor: "#F59E0B" },
  { key: "he100", label: "HE 100%", cor: "#EF4444" },
  { key: "heTotal", label: "HE total", cor: "#A855F7" },
  { key: "plantoes", label: "Plantões", cor: "#22C55E" },
  { key: "sobreaviso", label: "Sobreaviso", cor: "#0EA5E9" },
  { key: "adn", label: "Adic. Not.", cor: "#6366F1" },
  { key: "incentivo", label: "Incentivo", cor: "#EC4899" },
  { key: "faltas", label: "Faltas", cor: "#64748B" },
  { key: "faltasJustificadas", label: "Faltas justif.", cor: "#94A3B8" },
  { key: "faltasInjustificadas", label: "Faltas injust.", cor: "#B91C1C" },
  { key: "atestado", label: "Atestados", cor: "#D97706" },
  { key: "ferias", label: "Férias", cor: "#65A30D" },
  { key: "licencas", label: "Licenças", cor: "#0D9488" },
  { key: "licencaPremio", label: "Licença-prêmio", cor: "#7C3AED" },
  { key: "afastamentos", label: "Afastamentos", cor: "#BE185D" },
  { key: "salSubH", label: "Sal. substituição (h)", cor: "#475569" },
  { key: "aulasSuplementares", label: "Aulas suplem.", cor: "#C2410C" },
];
type PeriodoModo = "3" | "6" | "todas" | "livre";

export function AnalisesAvancadasPanel({
  oficial, visao, competenciaId, unidadeId, arquivoBase,
}: {
  oficial: ConsolidacaoOficial | undefined;
  visao: VisaoOficial;
  competenciaId?: string | null;
  unidadeId?: string | null;
  arquivoBase: string;
}) {
  const linhas = useMemo(() => linhasDaVisao(oficial, visao), [oficial, visao]);
  const uid = unidadeId && unidadeId !== "all" ? unidadeId : null;

  // ---------- Afastamentos ----------
  const afast = useMemo(
    () => linhas.filter((l) => afastTotal(l) > 0).sort((a, b) => afastTotal(b) - afastTotal(a)),
    [linhas],
  );

  // ---------- Evolução 6 meses ----------
  const [metricas, setMetricas] = useState<MetricaKey[]>(["he50", "he100", "plantoes", "sobreaviso", "adn", "incentivo"]);
  const [modo, setModo] = useState<PeriodoModo>("6");
  const [livres, setLivres] = useState<string[]>([]);
  const [evoVisao, setEvoVisao] = useState<VisaoOficial | null>(null);
  const visaoEvo = evoVisao ?? visao;
  const { data: comps } = useCompetenciasLookup();
  const serie = useMemo(() => {
    if (!comps?.length) return [];
    if (modo === "livre") return comps.filter((c) => livres.includes(c.id)).reverse();
    if (modo === "todas") return [...comps].reverse();
    const n = Number(modo);
    const i = competenciaId ? comps.findIndex((c) => c.id === competenciaId) : 0;
    return comps.slice(Math.max(i, 0), Math.max(i, 0) + n).reverse();
  }, [comps, competenciaId, modo, livres]);
  const evoQ = useQueries({
    queries: serie.map((c) => ({
      queryKey: ["evolucao-oficial", c.id, uid],
      staleTime: 120_000,
      queryFn: () => getAggregatedFrequencies({ competenciaId: c.id, unidadeId: uid }),
    })),
  });
  const evolucao = serie.map((c, i) => {
    const t = evoQ[i]?.data?.oficial[visaoEvo] as unknown as Record<string, number> | undefined;
    const row = { comp: `${String(c.mes).padStart(2, "0")}/${c.ano}` } as { comp: string } & Record<MetricaKey, number>;
    for (const m of METRICAS) {
      row[m.key] = m.key === "ferias" ? (t?.ferias ?? 0) + (t?.feriasTerco ?? 0) + (t?.feriasIntegral ?? 0) : (t?.[m.key] ?? 0);
    }
    return row;
  });
  const evoLoading = evoQ.some((q) => q.isLoading);

  // ---------- Dimensionamento ----------
  const { data: cadastro } = useQuery({
    queryKey: ["dimensionamento-cadastro", uid],
    staleTime: 120_000,
    queryFn: async () => {
      const out: { id: string; unidade_id: string | null; status: string; nome_completo: string | null; matricula: string | null; cargo_id: string | null }[] = [];
      for (let from = 0; ; from += 1000) {
        let q = supabase.from("profissionais").select("id, unidade_id, status, nome_completo, matricula, cargo_id").is("deleted_at", null).range(from, from + 999);
        if (uid) q = q.eq("unidade_id", uid);
        const { data, error } = await q;
        if (error) throw error;
        out.push(...((data ?? []) as typeof out));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
  });
  const { data: cargos } = useQuery({
    queryKey: ["analises-cargos"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("cargos").select("id, nome");
      if (error) throw error;
      return new Map((data ?? []).map((c: { id: string; nome: string }) => [c.id, c.nome]));
    },
  });
  const cargoDe = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of cadastro ?? []) if (p.cargo_id && cargos?.get(p.cargo_id)) m.set(p.id, cargos.get(p.cargo_id)!);
    return m;
  }, [cadastro, cargos]);
  const [busca, setBusca] = useState("");
  const [dimSel, setDimSel] = useState<string | null>(null);
  const afastFiltrado = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return afast;
    return afast.filter((l) => [l.profissional_nome, l.matricula, l.unidade_nome, l.unidade_sigla, l.setor_nome, cargoDe.get(l.profissional_id)]
      .some((v) => v && String(v).toLowerCase().includes(q)));
  }, [afast, busca, cargoDe]);
  const afastResumo = useMemo(() => ({
    total: afast.length,
    ferias: afast.filter((l) => l.ferias + l.feriasTerco + l.feriasIntegral > 0).length,
    licMed: afast.filter((l) => l.licencas + l.atestado + l.afastamentos > 0).length,
    premio: afast.filter((l) => l.licencaPremio > 0).length,
  }), [afast]);

  const { data: unidadesNomes } = useQuery({
    queryKey: ["analises-unidades"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("unidades").select("id, nome, sigla");
      if (error) throw error;
      return new Map((data ?? []).map((u: { id: string; nome: string; sigla: string | null }) => [u.id, u.sigla ?? u.nome]));
    },
  });
  const dimens = useMemo(() => {
    const nomes = new Map<string, string>();
    const comFreq = new Map<string, Set<string>>();
    for (const l of linhas) {
      nomes.set(l.unidade_id, l.unidade_sigla ?? l.unidade_nome);
      if (!comFreq.has(l.unidade_id)) comFreq.set(l.unidade_id, new Set());
      comFreq.get(l.unidade_id)!.add(l.profissional_id);
    }
    for (const c of oficial?.cobertura.porUnidade ?? []) nomes.set(c.unidade_id, c.unidade_sigla ?? c.unidade_nome);
    for (const [id, n] of unidadesNomes ?? []) if (!nomes.has(id) && (cadastro ?? []).some((p) => p.unidade_id === id)) nomes.set(id, n);
    const cad = new Map<string, { ativos: number; total: number }>();
    for (const p of cadastro ?? []) {
      if (!p.unidade_id || !nomes.has(p.unidade_id)) continue;
      const cur = cad.get(p.unidade_id) ?? { ativos: 0, total: 0 };
      cur.total++;
      if (p.status !== "desligado" && p.status !== "inativo") cur.ativos++;
      cad.set(p.unidade_id, cur);
    }
    return [...nomes.entries()].map(([id, nome]) => {
      const ativos = cad.get(id)?.ativos ?? 0;
      const freq = comFreq.get(id)?.size ?? 0;
      const ids = comFreq.get(id) ?? new Set<string>();
      const faltando = (cadastro ?? []).filter((p) => p.unidade_id === id && p.status !== "desligado" && p.status !== "inativo" && !ids.has(p.id));
      return { id, nome, ativos, freq, dif: ativos - freq, cobertura: ativos ? (freq / ativos) * 100 : 0, faltando };
    }).sort((a, b) => b.dif - a.dif);
  }, [linhas, cadastro, oficial, unidadesNomes]);
  const dimGeral = useMemo(() => {
    const ativos = dimens.reduce((s, d) => s + d.ativos, 0);
    const freq = dimens.reduce((s, d) => s + Math.min(d.freq, d.ativos), 0);
    return { ativos, freq, cob: ativos ? (freq / ativos) * 100 : 0, semFolha: dimens.filter((d) => d.freq === 0).length };
  }, [dimens]);
  const dimAtual = dimens.find((d) => d.id === dimSel);

  // ---------- Dossiê controle externo ----------
  const porUnidade = useMemo(() => {
    const m = new Map<string, { nome: string; tipo: string; linhas: LinhaOficial[] }>();
    for (const l of linhas) {
      const k = `${l.unidade_id}:${l.tipo}`;
      if (!m.has(k)) m.set(k, { nome: l.unidade_nome, tipo: l.tipo, linhas: [] });
      m.get(k)!.linhas.push(l);
    }
    return [...m.values()].map((g) => ({ ...g, t: somarTotais(g.linhas) })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [linhas]);

  const totalGeral = useMemo(() => somarTotais(linhas), [linhas]);
  const linhaTotal = (t: typeof totalGeral) => ["TOTAL GERAL", "—", t.profissionais, fmt(t.diasTrabalhados), fmt(t.he50), fmt(t.he100), fmt(t.heTotal), fmt(t.plantoes), fmt(t.sobreaviso), fmt(t.adn), fmt(t.faltas), fmt(t.atestado), fmt(t.ferias), fmt(t.licencas)];

  async function dossiePdf() {
    const { jsPDF, autoTable, drawInstitutionalHeader, loadMunicipioInfo } = await loadPdfKit();
    const doc = new jsPDF({ orientation: "landscape" });
    const mun = await loadMunicipioInfo();
    const y = drawInstitutionalHeader(doc, mun, "Dossiê de Frequência — Controle Externo (TCM/TCE/Folha)");
    doc.setFontSize(9);
    doc.text(`Somente folhas aprovadas. Gerado em ${new Date().toLocaleString("pt-BR")}.`, 14, y + 4);
    autoTable(doc, {
      startY: y + 8,
      head: [["Unidade", "Regime", "Prof.", "Dias", "HE 50%", "HE 100%", "HE total", "Plantões", "Sobreav.", "ADN", "Faltas", "Atest.", "Férias", "Licenças"]],
      body: porUnidade.map((g) => [g.nome, g.tipo, g.t.profissionais, fmt(g.t.diasTrabalhados), fmt(g.t.he50), fmt(g.t.he100), fmt(g.t.heTotal), fmt(g.t.plantoes), fmt(g.t.sobreaviso), fmt(g.t.adn), fmt(g.t.faltas), fmt(g.t.atestado), fmt(g.t.ferias), fmt(g.t.licencas)]),
      foot: [linhaTotal(totalGeral)],
      footStyles: { fillColor: [226, 232, 240], textColor: [0, 0, 0], fontStyle: "bold" },
      styles: { fontSize: 7 },
      headStyles: { fillColor: [30, 58, 138] },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const y2 = (doc as any).lastAutoTable.finalY + 20;
    doc.text("______________________________", 30, y2); doc.text("______________________________", 180, y2);
    doc.text("Responsável RH / SMS", 40, y2 + 5); doc.text("Secretário(a) Municipal de Saúde", 185, y2 + 5);
    await finalizarPdf(doc, { filename: `${arquivoBase}-dossie-controle.pdf`, tipo: "relatorio" });
  }

  return (
    <section className="mt-6 rounded-lg border bg-card p-4">
      <h3 className="mb-3 font-semibold">Análises avançadas (somente folhas aprovadas)</h3>
      <Tabs defaultValue="afast">
        <TabsList className="flex-wrap">
          <TabsTrigger value="afast">Afastamentos e licenças</TabsTrigger>
          <TabsTrigger value="evo">Evolução por competências</TabsTrigger>
          <TabsTrigger value="dim">Dimensionamento</TabsTrigger>
          <TabsTrigger value="dossie">Dossiê controle externo</TabsTrigger>
        </TabsList>

        <TabsContent value="afast" className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[["Total afastados", afastResumo.total], ["Em férias", afastResumo.ferias], ["Licença médica/atestado/afast.", afastResumo.licMed], ["Licença-prêmio", afastResumo.premio]].map(([k, v]) => (
              <div key={k as string} className="rounded-md border p-2"><div className="text-xs text-muted-foreground">{k}</div><div className="text-lg font-semibold">{v}</div></div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <Input className="h-8 max-w-xs" placeholder="Buscar nome, matrícula, unidade, cargo…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <span>{afastFiltrado.length} de {afast.length} profissional(is)</span>
            <Button size="sm" variant="outline" disabled={!afastFiltrado.length} onClick={() => baixarCsv(`${arquivoBase}-afastamentos`,
              ["Unidade", "Setor", "Regime", "Profissional", "Matrícula", "Cargo", "Férias", "Férias 1/3", "Férias integral", "Licenças", "Licença-prêmio", "Afastamentos", "Atestados", "Faltas justif.", "Dias trabalhados"],
              afastFiltrado.map((l) => [l.unidade_nome, l.setor_nome, l.tipo, l.profissional_nome, l.matricula, cargoDe.get(l.profissional_id) ?? "", l.ferias, l.feriasTerco, l.feriasIntegral, l.licencas, l.licencaPremio, l.afastamentos, l.atestado, l.faltasJustificadas, l.diasTrabalhados]))}>
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card text-left"><tr>
                {["Profissional", "Matrícula", "Cargo", "Unidade", "Setor", "Férias", "Licenças", "L.-prêmio", "Afast.", "Atest.", "F. just.", "Dias trab."].map((h) => <th key={h} className="p-1">{h}</th>)}
              </tr></thead>
              <tbody>
                {afastFiltrado.map((l) => (
                  <tr key={`${l.tipo}${l.unidade_id}${l.profissional_id}`} className="border-t">
                    <td className="p-1">{l.profissional_nome}</td><td className="p-1">{l.matricula ?? "—"}</td><td className="p-1">{cargoDe.get(l.profissional_id) ?? "—"}</td>
                    <td className="p-1">{l.unidade_sigla ?? l.unidade_nome}</td><td className="p-1">{l.setor_nome ?? "—"}</td>
                    <td className="p-1">{fmt(l.ferias + l.feriasTerco + l.feriasIntegral)}</td><td className="p-1">{fmt(l.licencas)}</td><td className="p-1">{fmt(l.licencaPremio)}</td>
                    <td className="p-1">{fmt(l.afastamentos)}</td><td className="p-1">{fmt(l.atestado)}</td><td className="p-1">{fmt(l.faltasJustificadas)}</td><td className="p-1">{fmt(l.diasTrabalhados)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="evo" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Período:</span>
            {([["3", "Últimos 3"], ["6", "Últimos 6"], ["todas", "Todas"], ["livre", "Escolher competências"]] as [PeriodoModo, string][]).map(([k, l]) => (
              <Button key={k} size="sm" variant={modo === k ? "default" : "outline"} className="h-7 text-xs" onClick={() => setModo(k)}>{l}</Button>
            ))}
            <span className="ml-3 text-muted-foreground">Regime:</span>
            {([["consolidado", "Consolidado"], ["efetivos", "Efetivos"], ["contratados", "Contratados"]] as [VisaoOficial, string][]).map(([k, l]) => (
              <Button key={k} size="sm" variant={visaoEvo === k ? "default" : "outline"} className="h-7 text-xs" onClick={() => setEvoVisao(k)}>{l}</Button>
            ))}
          </div>
          {modo === "livre" && (
            <div className="flex flex-wrap gap-1 rounded-md border p-2">
              {(comps ?? []).map((c) => {
                const on = livres.includes(c.id);
                return <Button key={c.id} size="sm" variant={on ? "default" : "outline"} className="h-7 text-xs"
                  onClick={() => setLivres((cur) => on ? cur.filter((x) => x !== c.id) : [...cur, c.id])}>{String(c.mes).padStart(2, "0")}/{c.ano}</Button>;
              })}
              {!livres.length && <span className="text-xs text-muted-foreground">Clique nas competências que deseja comparar.</span>}
            </div>
          )}
          {evoLoading ? <p className="text-sm text-muted-foreground">Carregando competências…</p> : (
            <>
              <p className="text-xs text-muted-foreground">Histórico disponível: {evolucao.length} competência(s) cadastrada(s) ({evolucao.map((e) => e.comp).join(", ") || "—"}). Somente folhas aprovadas de cada mês.</p>
              <div className="flex flex-wrap gap-1">
                {METRICAS.map((m) => (
                  <Button key={m.key} size="sm" variant={metricas.includes(m.key) ? "default" : "outline"} className="h-7 text-xs"
                    onClick={() => setMetricas((cur) => cur.includes(m.key) ? cur.filter((k) => k !== m.key) : [...cur, m.key])}>{m.label}</Button>
                ))}
              </div>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolucao}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="comp" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend />
                    {METRICAS.filter((m) => metricas.includes(m.key)).map((m) => (
                      <Line key={m.key} type="monotone" dataKey={m.key} name={m.label} stroke={m.cor} strokeWidth={2} dot={{ r: 3 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead className="text-left"><tr><th className="p-1">Competência</th>{METRICAS.map((m) => <th key={m.key} className="p-1">{m.label}</th>)}</tr></thead>
                  <tbody>{evolucao.map((e, i) => (
                    <tr key={e.comp} className="border-t"><td className="p-1 font-medium">{e.comp}</td>
                      {METRICAS.map((m) => {
                        const v = e[m.key]; const ant = i > 0 ? evolucao[i - 1][m.key] : null;
                        const pct = ant ? ((v - ant) / ant) * 100 : null;
                        return <td key={m.key} className="p-1">{fmt(v)}{pct !== null && <span className={`ml-1 ${pct > 0 ? "text-destructive" : "text-muted-foreground"}`}>({pct > 0 ? "+" : ""}{pct.toFixed(0)}%)</span>}</td>;
                      })}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <Button size="sm" variant="outline" onClick={() => baixarCsv(`${arquivoBase}-evolucao`,
                ["Competência", ...METRICAS.map((m) => m.label)],
                evolucao.map((e) => [e.comp, ...METRICAS.map((m) => e[m.key])]))}>
                <Download className="mr-1 h-4 w-4" /> CSV
              </Button>
            </>
          )}
        </TabsContent>

        <TabsContent value="dim" className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[["Cobertura da rede", `${dimGeral.cob.toFixed(1)}%`], ["Lacuna", `${(100 - dimGeral.cob).toFixed(1)}%`], ["Ativos / com frequência", `${dimGeral.ativos} / ${dimGeral.freq}`], ["Unidades sem folha aprovada", dimGeral.semFolha]].map(([k, v]) => (
              <div key={k as string} className="rounded-md border p-2"><div className="text-xs text-muted-foreground">{k}</div><div className="text-lg font-semibold">{v}</div></div>
            ))}
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Clique na diferença para ver os nomes sem frequência aprovada.</span>
            <Button size="sm" variant="outline" disabled={!dimens.length} onClick={() => baixarCsv(`${arquivoBase}-dimensionamento`,
              ["Unidade", "Ativos no cadastro", "Com frequência aprovada", "Diferença", "Cobertura %"],
              dimens.map((d) => [d.nome, d.ativos, d.freq, d.dif, d.cobertura.toFixed(1)]))}>
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
          </div>
          <table className="w-full text-xs">
            <thead className="text-left"><tr>{["Unidade", "Ativos (cadastro)", "Com frequência", "Diferença", "Cobertura"].map((h) => <th key={h} className="p-1">{h}</th>)}</tr></thead>
            <tbody>{dimens.map((d) => (
              <tr key={d.id} className={`border-t ${d.freq === 0 ? "bg-destructive/10" : ""}`}>
                <td className="p-1">{d.nome}</td><td className="p-1">{d.ativos}</td><td className="p-1">{d.freq}</td>
                <td className="p-1">{d.faltando.length > 0 ? <button type="button" className="text-destructive underline" onClick={() => setDimSel(dimSel === d.id ? null : d.id)}>{d.dif}</button> : d.dif}</td>
                <td className="p-1">{d.cobertura.toFixed(1)}%</td>
              </tr>
            ))}</tbody>
          </table>
          {dimAtual && (
            <div className="rounded-md border p-2">
              <div className="mb-1 flex items-center justify-between text-sm font-medium">
                <span>{dimAtual.nome}: {dimAtual.faltando.length} cadastrado(s) sem frequência aprovada</span>
                <Button size="sm" variant="outline" onClick={() => baixarCsv(`${arquivoBase}-sem-frequencia-${dimAtual.nome}`, ["Profissional", "Matrícula", "Cargo", "Situação"],
                  dimAtual.faltando.map((p) => [p.nome_completo, p.matricula, p.cargo_id ? cargos?.get(p.cargo_id) ?? "" : "", p.status]))}><Download className="mr-1 h-4 w-4" /> CSV</Button>
              </div>
              <div className="max-h-64 overflow-auto"><table className="w-full text-xs"><tbody>
                {dimAtual.faltando.map((p) => <tr key={p.id} className="border-t"><td className="p-1">{p.nome_completo}</td><td className="p-1">{p.matricula ?? "—"}</td><td className="p-1">{p.cargo_id ? cargos?.get(p.cargo_id) ?? "—" : "—"}</td><td className="p-1">{p.status}</td></tr>)}
              </tbody></table></div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Na visão Consolidado, o cadastro inclui todos os regimes. Unidades destacadas não têm nenhuma folha aprovada.</p>
        </TabsContent>

        <TabsContent value="dossie" className="space-y-3">
          <p className="text-sm text-muted-foreground">Modelo para TCM/TCE/Folha Central: totais por unidade e regime, com campos de assinatura.</p>
          <div className="flex gap-2">
            <Button size="sm" disabled={!porUnidade.length} onClick={dossiePdf}><FileText className="mr-1 h-4 w-4" /> PDF do dossiê</Button>
            <Button size="sm" variant="outline" disabled={!porUnidade.length} onClick={() => baixarCsv(`${arquivoBase}-dossie-controle`,
              ["Unidade", "Regime", "Profissionais", "Dias", "HE 50%", "HE 100%", "HE total", "Plantões", "Sobreaviso", "ADN", "Incentivo", "Faltas", "Atestados", "Férias", "Licenças", "Afastamentos"],
              [...porUnidade.map((g) => [g.nome, g.tipo, g.t.profissionais, g.t.diasTrabalhados, g.t.he50, g.t.he100, g.t.heTotal, g.t.plantoes, g.t.sobreaviso, g.t.adn, g.t.incentivo, g.t.faltas, g.t.atestado, g.t.ferias, g.t.licencas, g.t.afastamentos]),
               ["TOTAL GERAL", "", totalGeral.profissionais, totalGeral.diasTrabalhados, totalGeral.he50, totalGeral.he100, totalGeral.heTotal, totalGeral.plantoes, totalGeral.sobreaviso, totalGeral.adn, totalGeral.incentivo, totalGeral.faltas, totalGeral.atestado, totalGeral.ferias, totalGeral.licencas, totalGeral.afastamentos]])}>
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card text-left"><tr>{["Unidade", "Regime", "Prof.", "Dias", "HE 50%", "HE 100%", "HE total", "Plantões", "Sobreav.", "ADN", "Faltas", "Atest.", "Férias", "Licenças"].map((h) => <th key={h} className="p-1">{h}</th>)}</tr></thead>
              <tbody>{porUnidade.map((g) => (
                <tr key={`${g.nome}${g.tipo}`} className="border-t">{[g.nome, g.tipo, g.t.profissionais, fmt(g.t.diasTrabalhados), fmt(g.t.he50), fmt(g.t.he100), fmt(g.t.heTotal), fmt(g.t.plantoes), fmt(g.t.sobreaviso), fmt(g.t.adn), fmt(g.t.faltas), fmt(g.t.atestado), fmt(g.t.ferias), fmt(g.t.licencas)].map((v, i) => <td key={i} className="p-1">{v}</td>)}</tr>
              ))}</tbody>
              <tfoot className="sticky bottom-0 bg-muted font-semibold"><tr>{linhaTotal(totalGeral).map((v, i) => <td key={i} className="p-1">{v}</td>)}</tr></tfoot>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
