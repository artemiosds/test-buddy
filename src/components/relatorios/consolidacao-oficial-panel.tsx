import { useMemo, useState } from "react";
import { CheckCircle2, Download, Info } from "lucide-react";
import { somarTotais, type ConsolidacaoOficial, type LinhaOficial, type TotaisTipo } from "@/lib/analytics-aggregations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { downloadCsv } from "@/lib/csv-export";

export type VisaoOficial = "consolidado" | "efetivos" | "contratados";

const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

type Metrica = { key: keyof TotaisTipo; label: string; campo?: keyof LinhaOficial; hint?: string };

const METRICAS: Record<VisaoOficial, Metrica[]> = {
  consolidado: [
    { key: "profissionais", label: "Profissionais (distintos)" },
    { key: "diasTrabalhados", label: "Dias trabalhados", campo: "diasTrabalhados" },
    { key: "faltas", label: "Faltas", campo: "faltas" },
    { key: "he50", label: "HE 50%", campo: "he50" },
    { key: "he100", label: "HE 100%", campo: "he100" },
    { key: "heTotal", label: "HE total", campo: "heTotal", hint: "HE 50% + HE 100% (horas)" },
    { key: "plantoes", label: "Plantões", campo: "plantoes" },
    { key: "sobreaviso", label: "Sobreaviso", campo: "sobreaviso" },
    { key: "atestado", label: "Atestado", campo: "atestado" },
    { key: "adn", label: "Adicional noturno (ADN)", campo: "adn" },
    { key: "incentivo", label: "Incentivo", campo: "incentivo" },
  ],
  efetivos: [
    { key: "profissionais", label: "Profissionais" },
    { key: "diasTrabalhados", label: "Dias trabalhados", campo: "diasTrabalhados" },
    { key: "faltasJustificadas", label: "Faltas justificadas", campo: "faltasJustificadas" },
    { key: "faltasInjustificadas", label: "Faltas injustificadas", campo: "faltasInjustificadas" },
    { key: "he50", label: "HE 50%", campo: "he50" },
    { key: "he100", label: "HE 100%", campo: "he100" },
    { key: "heTotal", label: "HE total", campo: "heTotal" },
    { key: "plantoes", label: "Plantões extras", campo: "plantoes" },
    { key: "sobreaviso", label: "Sobreaviso", campo: "sobreaviso" },
    { key: "atestado", label: "Atestado", campo: "atestado" },
    { key: "adn", label: "Adicional noturno (ADN)", campo: "adn" },
    { key: "incentivo", label: "Incentivo", campo: "incentivo" },
    { key: "ferias", label: "Férias", campo: "ferias" },
    { key: "feriasTerco", label: "Férias 1/3", campo: "feriasTerco" },
    { key: "feriasIntegral", label: "Férias integral", campo: "feriasIntegral" },
    { key: "licencas", label: "Licenças", campo: "licencas" },
    { key: "licencaPremio", label: "Licença-prêmio", campo: "licencaPremio" },
    { key: "afastamentos", label: "Afastamentos", campo: "afastamentos" },
    { key: "salSubH", label: "Sal. substituição (h)", campo: "salSubH" },
    { key: "aulasSuplementares", label: "Aulas suplementares", campo: "aulasSuplementares" },
  ],
  contratados: [
    { key: "profissionais", label: "Profissionais" },
    { key: "diasTrabalhados", label: "Dias trabalhados", campo: "diasTrabalhados" },
    { key: "faltas", label: "Dias de falta", campo: "faltas" },
    { key: "he50", label: "HE 50%", campo: "he50" },
    { key: "he100", label: "HE 100%", campo: "he100" },
    { key: "heTotal", label: "HE total", campo: "heTotal" },
    { key: "plantoes", label: "Plantões", campo: "plantoes" },
    { key: "sobreaviso", label: "Sobreaviso", campo: "sobreaviso" },
    { key: "atestado", label: "Atestado", campo: "atestado" },
    { key: "adn", label: "Adicional noturno (ADN)", campo: "adn" },
    { key: "incentivo", label: "Incentivo", campo: "incentivo" },
  ],
};

export const SEM_SETOR = "__sem_setor__";
const setorLabel = (s: string | null) => s ?? "Sem setor (folha geral)";

export function linhasDaVisao(o: ConsolidacaoOficial | undefined, v: VisaoOficial, setor = "all") {
  if (!o) return [];
  let ls = v === "consolidado" ? o.linhas : o.linhas.filter((l) => l.tipo === v);
  if (setor !== "all") ls = ls.filter((l) => (setor === SEM_SETOR ? !l.setor_nome : l.setor_nome === setor));
  return ls;
}

/** Totais por unidade + setor (transparência). */
export function totaisPorSetor(linhas: LinhaOficial[]) {
  const g = new Map<string, { unidade: string; setor: string; linhas: LinhaOficial[] }>();
  for (const l of linhas) {
    const k = `${l.unidade_id}|${l.setor_nome ?? ""}`;
    const e = g.get(k) ?? { unidade: l.unidade_sigla ?? l.unidade_nome, setor: setorLabel(l.setor_nome), linhas: [] };
    e.linhas.push(l);
    g.set(k, e);
  }
  return Array.from(g.values())
    .map((e) => ({ unidade: e.unidade, setor: e.setor, t: somarTotais(e.linhas) }))
    .sort((a, b) => a.unidade.localeCompare(b.unidade) || a.setor.localeCompare(b.setor));
}

export function exportarDetalheCsv(nome: string, linhas: LinhaOficial[]) {
  downloadCsv(nome, linhas, [
    { header: "Tipo", value: (l) => (l.tipo === "efetivos" ? "Efetivos" : "Contratados") },
    { header: "Unidade", value: (l) => l.unidade_nome },
    { header: "Sigla", value: (l) => l.unidade_sigla },
    { header: "Setor", value: (l) => l.setor_nome },
    { header: "Profissional", value: (l) => l.profissional_nome },
    { header: "Matrícula", value: (l) => l.matricula },
    { header: "Dias trabalhados", value: (l) => l.diasTrabalhados },
    { header: "Faltas justificadas", value: (l) => l.faltasJustificadas },
    { header: "Faltas injustificadas", value: (l) => l.faltasInjustificadas },
    { header: "Faltas (total)", value: (l) => l.faltas },
    { header: "HE 50%", value: (l) => l.he50 },
    { header: "HE 100%", value: (l) => l.he100 },
    { header: "HE total", value: (l) => l.heTotal },
    { header: "Plantões", value: (l) => l.plantoes },
    { header: "Sobreaviso", value: (l) => l.sobreaviso },
    { header: "Atestado", value: (l) => l.atestado },
    { header: "ADN", value: (l) => l.adn },
    { header: "Incentivo", value: (l) => l.incentivo },
    { header: "Férias", value: (l) => l.ferias },
    { header: "Férias 1/3", value: (l) => l.feriasTerco },
    { header: "Férias integral", value: (l) => l.feriasIntegral },
    { header: "Licenças", value: (l) => l.licencas },
    { header: "Licença-prêmio", value: (l) => l.licencaPremio },
    { header: "Afastamentos", value: (l) => l.afastamentos },
    { header: "Sal. substituição (h)", value: (l) => l.salSubH },
    { header: "Aulas suplementares", value: (l) => l.aulasSuplementares },
    { header: "Situação", value: () => "Aprovada (consolidação oficial)" },
  ]);
}

export function ConsolidacaoOficialPanel({
  oficial,
  loading,
  visao,
  onVisaoChange,
  arquivoBase,
}: {
  oficial: ConsolidacaoOficial | undefined;
  loading?: boolean;
  visao: VisaoOficial;
  onVisaoChange: (v: VisaoOficial) => void;
  arquivoBase: string;
}) {
  const [detalhe, setDetalhe] = useState<Metrica | null>(null);
  const [busca, setBusca] = useState("");
  const [setor, setSetor] = useState("all");
  const setores = useMemo(() => {
    const set = new Set<string>();
    let semSetor = false;
    for (const l of linhasDaVisao(oficial, visao)) l.setor_nome ? set.add(l.setor_nome) : (semSetor = true);
    return { lista: Array.from(set).sort((a, b) => a.localeCompare(b)), semSetor };
  }, [oficial, visao]);
  const linhasVisao = useMemo(() => linhasDaVisao(oficial, visao, setor), [oficial, visao, setor]);
  const totaisVisao = useMemo<Record<VisaoOficial, TotaisTipo | undefined>>(() => {
    if (!oficial) return { consolidado: undefined, efetivos: undefined, contratados: undefined };
    if (setor === "all") return { consolidado: oficial.consolidado, efetivos: oficial.efetivos, contratados: oficial.contratados };
    const calc = (v: VisaoOficial) => {
      const ls = linhasDaVisao(oficial, v, setor);
      const t = somarTotais(ls);
      if (v === "consolidado") t.profissionais = new Set(ls.map((l) => l.profissional_id)).size;
      return t;
    };
    return { consolidado: calc("consolidado"), efetivos: calc("efetivos"), contratados: calc("contratados") };
  }, [oficial, setor]);
  const porSetor = useMemo(() => totaisPorSetor(linhasVisao), [linhasVisao]);
  const cob = oficial?.cobertura;
  const pct = cob && cob.totalFolhas ? Math.round((cob.aprovadas / cob.totalFolhas) * 100) : 0;
  const pendentes = cob?.porUnidade.filter((u) => !u.completa) ?? [];

  const linhasDetalhe = useMemo(() => {
    const base = linhasVisao;
    const filtradas = detalhe?.campo ? base.filter((l) => Number(l[detalhe.campo!]) > 0) : base;
    const b = busca.trim().toLowerCase();
    const res = b
      ? filtradas.filter((l) =>
          `${l.profissional_nome} ${l.unidade_nome} ${l.setor_nome ?? ""} ${l.matricula ?? ""}`.toLowerCase().includes(b),
        )
      : filtradas;
    return detalhe?.campo ? [...res].sort((a, c) => Number(c[detalhe.campo!]) - Number(a[detalhe.campo!])) : res;
  }, [linhasVisao, detalhe, busca]);

  return (
    <section className="mt-6 space-y-4 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CheckCircle2 className="h-5 w-5 text-primary" /> Consolidação oficial — somente folhas aprovadas
          </h2>
          <p className="text-xs text-muted-foreground">
            Calculado a partir dos lançamentos aprovados, contando cada profissional uma única vez por unidade.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={loading || !oficial?.linhas.length}
          onClick={() => exportarDetalheCsv(`${arquivoBase}-${visao}${setor !== "all" ? "-setor" : ""}-detalhado`, linhasVisao)}
        >
          <Download className="mr-2 h-4 w-4" /> CSV detalhado ({visao})
        </Button>
      </div>

      {/* Cobertura */}
      <div className="rounded-md border p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium">
            Cobertura da aprovação: {cob?.aprovadas ?? 0} de {cob?.totalFolhas ?? 0} folhas ({pct}%)
          </span>
          <span className="text-muted-foreground">
            Unidades completas: {cob?.unidadesCompletas ?? 0}/{cob?.unidades ?? 0} · Em análise: {cob?.enviadas ?? 0} ·
            Devolvidas: {cob?.devolvidas ?? 0} · Rascunho: {cob?.rascunho ?? 0}
          </span>
        </div>
        <Progress value={pct} />
        {pct < 100 && cob && cob.totalFolhas > 0 && (
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Info className="h-3 w-3" /> Consolidado parcial: os números abaixo ainda não incluem as folhas não aprovadas.
          </p>
        )}
        {pendentes.length > 0 && (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              Ver {pendentes.length} unidade(s) com folhas ainda não aprovadas
            </summary>
            <div className="mt-2 max-h-64 overflow-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr><th className="text-left">Unidade</th><th className="text-right">Aprovadas</th><th className="text-right">Em análise</th><th className="text-right">Devolvidas</th><th className="text-right">Rascunho</th></tr>
                </thead>
                <tbody>
                  {pendentes.map((u) => (
                    <tr key={u.unidade_id} className="border-t">
                      <td className="py-1">{u.unidade_sigla ? `${u.unidade_sigla} — ${u.unidade_nome}` : u.unidade_nome}</td>
                      <td className="text-right tabular-nums">{u.aprovadas}/{u.totalFolhas}</td>
                      <td className="text-right tabular-nums">{u.enviadas}</td>
                      <td className="text-right tabular-nums">{u.devolvidas}</td>
                      <td className="text-right tabular-nums">{u.rascunho}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>

      <Tabs value={visao} onValueChange={(v) => { setSetor("all"); onVisaoChange(v as VisaoOficial); }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="consolidado">Consolidado</TabsTrigger>
          <TabsTrigger value="efetivos">Efetivos</TabsTrigger>
          <TabsTrigger value="contratados">Contratados</TabsTrigger>
        </TabsList>
        <Select value={setor} onValueChange={setSetor}>
          <SelectTrigger className="w-[260px]"><SelectValue placeholder="Setor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {setores.semSetor && <SelectItem value={SEM_SETOR}>Sem setor (folha geral)</SelectItem>}
            {setores.lista.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        </div>
        {(["consolidado", "efetivos", "contratados"] as VisaoOficial[]).map((v) => (
          <TabsContent key={v} value={v}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {METRICAS[v].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => { setBusca(""); setDetalhe(m); }}
                  className="rounded-md border bg-background p-3 text-left transition-colors hover:border-primary"
                  title="Clique para ver os profissionais que compõem este total"
                >
                  <div className="text-xs text-muted-foreground">{m.label}</div>
                  <div className="text-xl font-semibold tabular-nums">
                    {loading ? "…" : fmt(totaisVisao[v]?.[m.key] ?? 0)}
                  </div>
                  {m.hint && <div className="text-[10px] text-muted-foreground">{m.hint}</div>}
                </button>
              ))}
            </div>
            {porSetor.length > 0 && (
              <details className="mt-3 rounded-md border p-2 text-sm" open={setor !== "all"}>
                <summary className="cursor-pointer font-medium">Detalhamento por unidade e setor ({porSetor.length})</summary>
                <div className="mt-2 max-h-96 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card text-muted-foreground">
                      <tr>
                        <th className="text-left">Unidade</th><th className="text-left">Setor</th>
                        {METRICAS[v].map((m) => <th key={m.key} className="px-1 text-right">{m.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {porSetor.map((r) => (
                        <tr key={`${r.unidade}-${r.setor}`} className="border-t">
                          <td className="py-1">{r.unidade}</td><td>{r.setor}</td>
                          {METRICAS[v].map((m) => <td key={m.key} className="px-1 text-right tabular-nums">{fmt(r.t[m.key])}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </TabsContent>
        ))}
      </Tabs>
      {!!oficial?.duplicidadesIgnoradas && (
        <p className="text-xs text-muted-foreground">
          Atenção: {oficial.duplicidadesIgnoradas} lançamento(s) duplicado(s) do mesmo profissional na mesma unidade foram
          desconsiderados (mantido o mais recente). Os dados das folhas não foram alterados.
        </p>
      )}

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{detalhe?.label} — {visao === "consolidado" ? "Consolidado" : visao === "efetivos" ? "Efetivos" : "Contratados"}</DialogTitle>
            <DialogDescription>
              Profissionais com lançamento aprovado que compõem este total ({linhasDetalhe.length}).
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input placeholder="Buscar profissional, unidade, setor ou matrícula" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <Button variant="outline" onClick={() => exportarDetalheCsv(`${arquivoBase}-${visao}-${String(detalhe?.key)}`, linhasDetalhe)}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background text-xs text-muted-foreground">
                <tr>
                  <th className="text-left">Profissional</th><th className="text-left">Unidade / Setor</th><th className="text-left">Tipo</th>
                  <th className="text-right">Dias</th><th className="text-right">Faltas</th><th className="text-right">HE 50%</th><th className="text-right">HE 100%</th><th className="text-right">HE total</th>
                  <th className="text-right">Plantões</th><th className="text-right">Sobreaviso</th><th className="text-right">ADN</th><th className="text-right">Incentivo</th>
                  {detalhe?.campo && !["diasTrabalhados","faltas","he50","he100","heTotal","plantoes","sobreaviso","adn","incentivo"].includes(String(detalhe.campo)) && <th className="text-right">{detalhe.label}</th>}
                </tr>
              </thead>
              <tbody>
                {linhasDetalhe.slice(0, 1000).map((l) => (
                  <tr key={`${l.tipo}-${l.unidade_id}-${l.profissional_id}`} className="border-t">
                    <td className="py-1">{l.profissional_nome}{l.matricula ? <span className="text-xs text-muted-foreground"> · {l.matricula}</span> : null}</td>
                    <td className="text-xs">{l.unidade_sigla ?? l.unidade_nome}{l.setor_nome ? ` / ${l.setor_nome}` : ""}</td>
                    <td><Badge variant="outline">{l.tipo === "efetivos" ? "Efetivo" : "Contratado"}</Badge></td>
                    <td className="text-right tabular-nums">{fmt(l.diasTrabalhados)}</td>
                    <td className="text-right tabular-nums">{fmt(l.faltas)}</td>
                    <td className="text-right tabular-nums">{fmt(l.he50)}</td>
                    <td className="text-right tabular-nums">{fmt(l.he100)}</td>
                    <td className="text-right tabular-nums">{fmt(l.heTotal)}</td>
                    <td className="text-right tabular-nums">{fmt(l.plantoes)}</td>
                    <td className="text-right tabular-nums">{fmt(l.sobreaviso)}</td>
                    <td className="text-right tabular-nums">{fmt(l.adn)}</td>
                    <td className="text-right tabular-nums">{fmt(l.incentivo)}</td>
                    {detalhe?.campo && !["diasTrabalhados","faltas","he50","he100","heTotal","plantoes","sobreaviso","adn","incentivo"].includes(String(detalhe.campo)) && <td className="text-right tabular-nums">{fmt(Number(l[detalhe.campo]))}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {linhasDetalhe.length > 1000 && <p className="p-2 text-xs text-muted-foreground">Mostrando 1000 de {linhasDetalhe.length}. Use o CSV para a lista completa.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Linhas para PDF ABNT a partir de uma visão. */
export function blocosPdfOficial(o: ConsolidacaoOficial | undefined, visao: VisaoOficial) {
  if (!o) return [];
  const t = o[visao];
  return [
    {
      titulo: `Consolidação oficial (somente aprovadas) — ${visao === "consolidado" ? "Consolidado" : visao === "efetivos" ? "Efetivos" : "Contratados"}`,
      head: ["Indicador", "Valor"],
      body: METRICAS[visao].map((m) => [m.label, fmt(t[m.key])]),
      align: ["left", "right"] as ("left" | "right")[],
      keepTogether: true,
    },
    {
      titulo: "Cobertura da aprovação por unidade",
      head: ["Unidade", "Aprovadas", "Em análise", "Devolvidas", "Rascunho"],
      body: o.cobertura.porUnidade.map((u) => [
        u.unidade_sigla ? `${u.unidade_sigla} — ${u.unidade_nome}` : u.unidade_nome,
        `${u.aprovadas}/${u.totalFolhas}`, u.enviadas, u.devolvidas, u.rascunho,
      ]),
      align: ["left", "right", "right", "right", "right"] as ("left" | "right")[],
      keepTogether: false,
    },
    {
      titulo: "Detalhamento por unidade e setor (somente aprovadas)",
      head: ["Unidade", "Setor", "Prof.", "Dias", "Faltas", "HE 50%", "HE 100%", "HE total", "Plantões", "Sobreav.", "ADN", "Incent."],
      body: totaisPorSetor(linhasDaVisao(o, visao)).map((r) => [
        r.unidade, r.setor, r.t.profissionais, fmt(r.t.diasTrabalhados), fmt(r.t.faltas), fmt(r.t.he50), fmt(r.t.he100),
        fmt(r.t.heTotal), fmt(r.t.plantoes), fmt(r.t.sobreaviso), fmt(r.t.adn), fmt(r.t.incentivo),
      ]),
      align: ["left", "left", "right", "right", "right", "right", "right", "right", "right", "right", "right", "right"] as ("left" | "right")[],
      keepTogether: false,
    },
  ];
}
