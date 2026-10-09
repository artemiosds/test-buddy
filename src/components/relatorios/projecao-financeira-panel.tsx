import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Download, Calculator, Settings2, FileText } from "lucide-react";
import { gerarRelatorioAbnt } from "@/lib/relatorio-abnt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompetenciasLookup } from "@/hooks/use-lookups";
import { useCompetenciaAtiva } from "@/hooks/use-competencia-ativa";
import { getAggregatedFrequencies } from "@/lib/analytics-aggregations";
import { buscarDadosProfissionais, useFolhaFinanceiraParams } from "@/hooks/use-folha-financeira";
import { brl, calcularFolha, type ResultadoCalculo } from "@/lib/folha-financeira";

type Linha = {
  unidade: string;
  setor: string;
  nome: string;
  matricula: string;
  regime: string;
  cargo: string;
  dias: number;
  faltasInj: number;
  atestado: number;
  r: ResultadoCalculo;
};

const COLS: { k: keyof ResultadoCalculo; h: string }[] = [
  { k: "baseProporcional", h: "Base devida" },
  { k: "vHe50", h: "HE 50%" },
  { k: "vHe100", h: "HE 100%" },
  { k: "vAdn", h: "Adic. noturno" },
  { k: "vPlantoes", h: "Plantões" },
  { k: "vSobreaviso", h: "Sobreaviso" },
  { k: "vIncentivo", h: "Incentivo" },
  { k: "vInsalubridade", h: "Insalubridade" },
  { k: "vGratificacao", h: "Grat. escolar." },
  { k: "bruto", h: "Bruto" },
  { k: "previdencia", h: "Previdência" },
  { k: "irrf", h: "IRRF" },
  { k: "iss", h: "ISS" },
  { k: "liquido", h: "Líquido" },
];

function somar(ls: Linha[]) {
  const t: Record<string, number> = {};
  for (const c of COLS) t[c.k] = ls.reduce((s, l) => s + (l.r[c.k] as number), 0);
  return t;
}

export function ProjecaoFinanceiraPanel() {
  const [open, setOpen] = useState(false);
  const [compId, setCompId] = useState("");
  const [regime, setRegime] = useState<"all" | "efetivos" | "contratados">("all");
  const [busca, setBusca] = useState("");
  const [unidadeSel, setUnidadeSel] = useState("all");
  const [verNominal, setVerNominal] = useState(false);
  const { data: comps = [] } = useCompetenciasLookup();
  const { data: ativa } = useCompetenciaAtiva();
  const { data: params } = useFolhaFinanceiraParams();

  useEffect(() => {
    if (!compId && ativa?.id) setCompId(ativa.id);
  }, [ativa?.id, compId]);

  const { data, isFetching, error } = useQuery({
    queryKey: ["folha-financeira", "projecao", compId],
    enabled: open && !!compId,
    staleTime: 60_000,
    queryFn: async () => {
      const agg = await getAggregatedFrequencies({ competenciaId: compId });
      const dados = await buscarDadosProfissionais(agg.oficial.linhas.map((l) => l.profissional_id));
      return { linhas: agg.oficial.linhas, dados };
    },
  });

  const linhas: Linha[] = useMemo(() => {
    if (!data || !params) return [];
    return data.linhas.map((l) => {
      const d = data.dados.get(l.profissional_id);
      const r = calcularFolha(
        {
          tipo: l.tipo,
          cargo_id: d?.cargo_id ?? null,
          salario_proprio: d?.salario_proprio ?? null,
          carga_cargo: d?.carga_cargo ?? null,
          vinculo_nome: d?.vinculo_nome ?? null,
          diasTrabalhados: l.diasTrabalhados,
          faltasInjustificadas: l.faltasInjustificadas,
          faltasJustificadas: l.faltasJustificadas,
          atestado: l.atestado,
          he50: l.he50, he100: l.he100, adn: l.adn,
          plantoes: l.plantoes, sobreaviso: l.sobreaviso, incentivo: l.incentivo,
        },
        params,
      );
      return {
        unidade: l.unidade_sigla || l.unidade_nome,
        setor: l.setor_nome ?? "—",
        nome: l.profissional_nome,
        matricula: l.matricula ?? "",
        regime: l.tipo === "efetivos" ? "Efetivo" : "Contratado",
        cargo: d?.cargo_nome ?? "—",
        dias: l.diasTrabalhados,
        faltasInj: l.faltasInjustificadas,
        atestado: l.atestado,
        r,
      };
    });
  }, [data, params]);

  const filtradas = useMemo(
    () => linhas.filter((l) =>
      (unidadeSel === "all" || l.unidade === unidadeSel) &&
      (regime === "all" || (regime === "efetivos" ? l.regime === "Efetivo" : l.regime === "Contratado"))),
    [linhas, regime, unidadeSel],
  );
  const unidadesOpc = useMemo(() => [...new Set(linhas.map((l) => l.unidade))].sort((a, b) => a.localeCompare(b, "pt-BR")), [linhas]);
  const semBase = filtradas.filter((l) => l.r.origemBase === "sem_base").length;

  const porUnidade = useMemo(() => {
    const m = new Map<string, Linha[]>();
    for (const l of filtradas) m.set(l.unidade, [...(m.get(l.unidade) ?? []), l]);
    return Array.from(m.entries())
      .map(([u, ls]) => ({ u, qtd: ls.length, t: somar(ls) }))
      .sort((a, b) => b.t.bruto - a.t.bruto);
  }, [filtradas]);
  const total = useMemo(() => somar(filtradas), [filtradas]);

  const nominal = useMemo(() => {
    const t = busca.trim().toLocaleLowerCase("pt-BR");
    return (t ? filtradas.filter((l) => l.nome.toLocaleLowerCase("pt-BR").includes(t) || l.matricula.includes(t)) : filtradas)
      .slice()
      .sort((a, b) => a.unidade.localeCompare(b.unidade) || a.nome.localeCompare(b.nome));
  }, [filtradas, busca]);

  const comp = comps.find((c) => c.id === compId);
  const compLabel = comp ? `${String(comp.mes).padStart(2, "0")}/${comp.ano}` : "";

  function exportarCsv() {
    const fmt = (v: number) => v.toFixed(2).replace(".", ",");
    const head = ["Unidade", "Setor", "Profissional", "Matrícula", "Regime", "Cargo", "Origem salário", "Salário base", "Dias trab.", "Faltas injust.", "Atestados", "Desc. faltas", ...COLS.map((c) => c.h)];
    const rows = nominal.map((l) => [
      l.unidade, l.setor, l.nome, l.matricula, l.regime, l.cargo,
      l.r.origemBase === "profissional" ? "Próprio" : l.r.origemBase === "cargo" ? "Cargo" : l.r.origemBase === "nivel" ? "Nível escolaridade" : "Sem salário",
      fmt(l.r.salarioBase), String(l.dias), String(l.faltasInj), String(l.atestado), fmt(l.r.descontoFaltas),
      ...COLS.map((c) => fmt(l.r[c.k] as number)),
    ]);
    rows.push(["TOTAL", "", "", "", "", "", "", "", "", "", "", "", ...COLS.map((c) => fmt(total[c.k]))]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `projecao-financeira-${compLabel.replace("/", "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function exportarPdf() {
    const regLabel = regime === "all" ? "Consolidado" : regime === "efetivos" ? "Efetivos" : "Contratados";
    const desc = (total.previdencia ?? 0) + (total.irrf ?? 0) + (total.iss ?? 0);
    const porRegime = ["Efetivo", "Contratado"].map((rg) => {
      const ls = filtradas.filter((l) => l.regime === rg);
      return { rg, qtd: ls.length, t: somar(ls) };
    }).filter((x) => x.qtd > 0);
    const m = (v: number) => brl(v ?? 0);
    await gerarRelatorioAbnt<Linha>({
      arquivo: `projecao-financeira-${compLabel.replace("/", "-")}.pdf`,
      titulo: "Projeção Financeira da Folha",
      subtitulo: `Competência ${compLabel} — ${regLabel}${unidadeSel === "all" ? "" : ` — ${unidadeSel}`}`,
      orientacao: "landscape",
      filtros: [{ label: "Competência", valor: compLabel }, { label: "Regime", valor: regLabel }, { label: "Unidade", valor: unidadeSel === "all" ? "Todas as unidades" : unidadeSel }],
      kpis: [
        { label: "Profissionais", valor: filtradas.length },
        { label: "Bruto", valor: m(total.bruto) },
        { label: "Descontos", valor: m(desc) },
        { label: "Líquido", valor: m(total.liquido) },
      ],
      blocos: [
        {
          titulo: "Consolidado por regime",
          head: ["Regime", "Qtd", "Bruto", "Previdência", "IRRF", "ISS", "Líquido"],
          body: porRegime.map((x) => [x.rg, x.qtd, m(x.t.bruto), m(x.t.previdencia), m(x.t.irrf), m(x.t.iss), m(x.t.liquido)]),
          keepTogether: true,
        },
        {
          titulo: "Consolidado por unidade",
          head: ["Unidade", "Qtd", ...COLS.map((c) => c.h)],
          body: porUnidade.map((u) => [u.u, u.qtd, ...COLS.map((c) => m(u.t[c.k]))]),
          foot: ["TOTAL", filtradas.length, ...COLS.map((c) => m(total[c.k]))],
        },
        {
          titulo: "Memória nominal",
          head: ["Unidade", "Profissional", "Matrícula", "Regime", "Cargo", "Sal. base", "Dias", "F. inj.", "Bruto", "Descontos", "Líquido"],
          body: nominal.map((l) => [l.unidade, l.nome, l.matricula, l.regime, l.cargo, m(l.r.salarioBase), l.dias, l.faltasInj, m(l.r.bruto), m(l.r.previdencia + l.r.irrf + l.r.iss), m(l.r.liquido)]),
          align: ["left", "left", "left", "left", "left", "right", "right", "right", "right", "right", "right"],
        },
      ],
      colunas: [],
      linhas: [],
      registros: filtradas.length,
      notas: [
        "Projeção gerencial calculada sobre folhas de frequência APROVADAS e regras da Configuração Municipal. Não substitui a folha oficial.",
        semBase > 0 ? `${semBase} profissional(is) sem salário definido (próprio ou do cargo) — valores zerados.` : "Todos os profissionais possuem salário base definido.",
      ],
      fechamentoUnico: true,
    });
  }

  return (
    <div className="rounded-lg border bg-card">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Calculator className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Projeção financeira automática</span>
        <span className="text-xs text-muted-foreground">— folhas aprovadas × regras da Configuração Municipal</span>
      </button>
      {open && (
        <div className="space-y-3 border-t p-4">
          <div className="flex flex-wrap items-center gap-2">
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={compId} onChange={(e) => setCompId(e.target.value)} aria-label="Competência">
              {comps.map((c) => (
                <option key={c.id} value={c.id}>{String(c.mes).padStart(2, "0")}/{c.ano}</option>
              ))}
            </select>
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={regime} onChange={(e) => setRegime(e.target.value as typeof regime)} aria-label="Regime">
              <option value="all">Consolidado</option>
              <option value="efetivos">Efetivos</option>
              <option value="contratados">Contratados</option>
            </select>
            <select className="h-9 max-w-56 rounded-md border border-input bg-background px-2 text-sm" value={unidadeSel} onChange={(e) => setUnidadeSel(e.target.value)} aria-label="Unidade">
              <option value="all">Todas as unidades</option>
              {unidadesOpc.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <Button size="sm" variant="outline" onClick={exportarCsv} disabled={!filtradas.length}><Download className="mr-1 h-4 w-4" />CSV</Button>
            <Button size="sm" variant="outline" onClick={() => void exportarPdf()} disabled={!filtradas.length}><FileText className="mr-1 h-4 w-4" />Imprimir PDF (ABNT)</Button>
            <Button size="sm" variant="ghost" asChild><Link to="/configuracao"><Settings2 className="mr-1 h-4 w-4" />Regras</Link></Button>
            {isFetching && <span className="text-xs text-muted-foreground">Calculando…</span>}
          </div>
          {error && <p className="text-sm text-destructive">Não foi possível calcular: {(error as Error).message}</p>}
          {semBase > 0 && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {semBase} profissional(is) sem salário (nem próprio, nem do cargo). Defina o salário por nível de escolaridade ou por cargo em Configuração ➔ Folha financeira.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[["Profissionais", String(filtradas.length)], ["Bruto", brl(total.bruto ?? 0)], ["Descontos", brl((total.previdencia ?? 0) + (total.irrf ?? 0) + (total.iss ?? 0))], ["Líquido", brl(total.liquido ?? 0)]].map(([k, v]) => (
              <div key={k} className="rounded-md border p-2">
                <div className="text-[11px] uppercase text-muted-foreground">{k}</div>
                <div className="text-sm font-semibold">{v}</div>
              </div>
            ))}
          </div>

          <div className="max-h-96 overflow-auto rounded-md border">
            <table className="w-full whitespace-nowrap text-xs">
              <thead className="sticky top-0 bg-muted text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left">Unidade</th>
                  <th className="px-2 py-2 text-right">Qtd</th>
                  {COLS.map((c) => <th key={c.k} className="px-2 py-2 text-right">{c.h}</th>)}
                </tr>
              </thead>
              <tbody>
                {porUnidade.map((u) => (
                  <tr key={u.u} className="border-t">
                    <td className="px-2 py-1">{u.u}</td>
                    <td className="px-2 py-1 text-right">{u.qtd}</td>
                    {COLS.map((c) => <td key={c.k} className="px-2 py-1 text-right">{brl(u.t[c.k])}</td>)}
                  </tr>
                ))}
                {porUnidade.length > 0 && (
                  <tr className="border-t bg-muted/50 font-semibold">
                    <td className="px-2 py-1">TOTAL GERAL</td>
                    <td className="px-2 py-1 text-right">{filtradas.length}</td>
                    {COLS.map((c) => <td key={c.k} className="px-2 py-1 text-right">{brl(total[c.k])}</td>)}
                  </tr>
                )}
                {!isFetching && porUnidade.length === 0 && (
                  <tr><td colSpan={COLS.length + 2} className="px-2 py-6 text-center text-muted-foreground">Nenhuma folha aprovada nesta competência.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <button type="button" className="flex items-center gap-1 text-xs font-medium text-primary" onClick={() => setVerNominal((v) => !v)}>
            {verNominal ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} Memória de cálculo por profissional
          </button>
          {verNominal && (
            <div className="space-y-2">
              <Input className="h-8 sm:w-72" placeholder="Buscar nome ou matrícula" value={busca} onChange={(e) => setBusca(e.target.value)} />
              <div className="max-h-96 overflow-auto rounded-md border">
                <table className="w-full whitespace-nowrap text-xs">
                  <thead className="sticky top-0 bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 text-left">Profissional</th>
                      <th className="px-2 py-2 text-left">Unid.</th>
                      <th className="px-2 py-2 text-left">Cargo</th>
                      <th className="px-2 py-2 text-right">Salário</th>
                      <th className="px-2 py-2 text-right">Dias/Faltas/Atest.</th>
                      {COLS.map((c) => <th key={c.k} className="px-2 py-2 text-right">{c.h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {nominal.slice(0, 500).map((l, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{l.nome} <span className="text-muted-foreground">({l.regime})</span></td>
                        <td className="px-2 py-1">{l.unidade}</td>
                        <td className="px-2 py-1">{l.cargo}</td>
                        <td className="px-2 py-1 text-right">{l.r.origemBase === "sem_base" ? "—" : brl(l.r.salarioBase)}</td>
                        <td className="px-2 py-1 text-right">{l.dias} / {l.faltasInj} / {l.atestado}</td>
                        {COLS.map((c) => <td key={c.k} className="px-2 py-1 text-right">{brl(l.r[c.k] as number)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {nominal.length > 500 && <p className="text-[11px] text-muted-foreground">Mostrando 500 de {nominal.length}. Use a busca ou o CSV para a lista completa.</p>}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Projeção gerencial: não altera a folha de frequência nem substitui a folha de pagamento oficial da Prefeitura.
          </p>
        </div>
      )}
    </div>
  );
}
