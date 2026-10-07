import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
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
  const { data: comps } = useCompetenciasLookup();
  const serie = useMemo(() => {
    if (!comps?.length) return [];
    const i = competenciaId ? comps.findIndex((c) => c.id === competenciaId) : 0;
    return comps.slice(Math.max(i, 0), Math.max(i, 0) + 6).reverse();
  }, [comps, competenciaId]);
  const evoQ = useQueries({
    queries: serie.map((c) => ({
      queryKey: ["evolucao-oficial", c.id, uid],
      staleTime: 120_000,
      queryFn: () => getAggregatedFrequencies({ competenciaId: c.id, unidadeId: uid }),
    })),
  });
  const evolucao = serie.map((c, i) => {
    const t = evoQ[i]?.data?.oficial[visao];
    return {
      comp: `${String(c.mes).padStart(2, "0")}/${c.ano}`,
      profissionais: t?.profissionais ?? 0,
      he50: t?.he50 ?? 0, he100: t?.he100 ?? 0, heTotal: t?.heTotal ?? 0,
      plantoes: t?.plantoes ?? 0, faltas: t?.faltas ?? 0, diasTrabalhados: t?.diasTrabalhados ?? 0,
    };
  });
  const evoLoading = evoQ.some((q) => q.isLoading);

  // ---------- Dimensionamento ----------
  const { data: cadastro } = useQuery({
    queryKey: ["dimensionamento-cadastro", uid],
    staleTime: 120_000,
    queryFn: async () => {
      const out: { id: string; unidade_id: string | null; status: string }[] = [];
      for (let from = 0; ; from += 1000) {
        let q = supabase.from("profissionais").select("id, unidade_id, status").is("deleted_at", null).range(from, from + 999);
        if (uid) q = q.eq("unidade_id", uid);
        const { data, error } = await q;
        if (error) throw error;
        out.push(...((data ?? []) as typeof out));
        if (!data || data.length < 1000) break;
      }
      return out;
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
      return { id, nome, ativos, freq, dif: ativos - freq, cobertura: ativos ? (freq / ativos) * 100 : 0 };
    }).sort((a, b) => b.dif - a.dif);
  }, [linhas, cadastro, oficial]);

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
          <TabsTrigger value="evo">Evolução 6 meses</TabsTrigger>
          <TabsTrigger value="dim">Dimensionamento</TabsTrigger>
          <TabsTrigger value="dossie">Dossiê controle externo</TabsTrigger>
        </TabsList>

        <TabsContent value="afast" className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{afast.length} profissional(is) com férias, licenças, atestados, afastamentos ou faltas justificadas.</span>
            <Button size="sm" variant="outline" disabled={!afast.length} onClick={() => baixarCsv(`${arquivoBase}-afastamentos`,
              ["Unidade", "Setor", "Regime", "Profissional", "Matrícula", "Férias", "Férias 1/3", "Férias integral", "Licenças", "Licença-prêmio", "Afastamentos", "Atestados", "Faltas justif.", "Dias trabalhados"],
              afast.map((l) => [l.unidade_nome, l.setor_nome, l.tipo, l.profissional_nome, l.matricula, l.ferias, l.feriasTerco, l.feriasIntegral, l.licencas, l.licencaPremio, l.afastamentos, l.atestado, l.faltasJustificadas, l.diasTrabalhados]))}>
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card text-left"><tr>
                {["Profissional", "Unidade", "Setor", "Férias", "Licenças", "Afast.", "Atest.", "F. just.", "Dias trab."].map((h) => <th key={h} className="p-1">{h}</th>)}
              </tr></thead>
              <tbody>
                {afast.map((l) => (
                  <tr key={`${l.tipo}${l.unidade_id}${l.profissional_id}`} className="border-t">
                    <td className="p-1">{l.profissional_nome}</td><td className="p-1">{l.unidade_sigla ?? l.unidade_nome}</td><td className="p-1">{l.setor_nome ?? "—"}</td>
                    <td className="p-1">{fmt(l.ferias + l.feriasTerco + l.feriasIntegral)}</td><td className="p-1">{fmt(l.licencas + l.licencaPremio)}</td>
                    <td className="p-1">{fmt(l.afastamentos)}</td><td className="p-1">{fmt(l.atestado)}</td><td className="p-1">{fmt(l.faltasJustificadas)}</td><td className="p-1">{fmt(l.diasTrabalhados)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="evo">
          {evoLoading ? <p className="text-sm text-muted-foreground">Carregando competências…</p> : (
            <>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolucao}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="comp" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend />
                    <Line dataKey="he50" name="HE 50%" stroke="hsl(var(--primary))" />
                    <Line dataKey="he100" name="HE 100%" stroke="hsl(var(--destructive))" />
                    <Line dataKey="plantoes" name="Plantões" stroke="hsl(var(--chart-3, var(--secondary-foreground)))" />
                    <Line dataKey="faltas" name="Faltas" stroke="hsl(var(--muted-foreground))" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => baixarCsv(`${arquivoBase}-evolucao`,
                ["Competência", "Profissionais", "Dias trabalhados", "HE 50%", "HE 100%", "HE total", "Plantões", "Faltas"],
                evolucao.map((e) => [e.comp, e.profissionais, e.diasTrabalhados, e.he50, e.he100, e.heTotal, e.plantoes, e.faltas]))}>
                <Download className="mr-1 h-4 w-4" /> CSV
              </Button>
            </>
          )}
        </TabsContent>

        <TabsContent value="dim" className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Profissionais ativos no cadastro × profissionais com frequência aprovada.</span>
            <Button size="sm" variant="outline" disabled={!dimens.length} onClick={() => baixarCsv(`${arquivoBase}-dimensionamento`,
              ["Unidade", "Ativos no cadastro", "Com frequência aprovada", "Diferença", "Cobertura %"],
              dimens.map((d) => [d.nome, d.ativos, d.freq, d.dif, d.cobertura.toFixed(1)]))}>
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
          </div>
          <table className="w-full text-xs">
            <thead className="text-left"><tr>{["Unidade", "Ativos (cadastro)", "Com frequência", "Diferença", "Cobertura"].map((h) => <th key={h} className="p-1">{h}</th>)}</tr></thead>
            <tbody>{dimens.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="p-1">{d.nome}</td><td className="p-1">{d.ativos}</td><td className="p-1">{d.freq}</td>
                <td className={`p-1 ${d.dif > 0 ? "text-destructive" : ""}`}>{d.dif}</td><td className="p-1">{d.cobertura.toFixed(1)}%</td>
              </tr>
            ))}</tbody>
          </table>
          <p className="text-xs text-muted-foreground">Na visão Consolidado, o cadastro inclui todos os regimes. Diferença positiva = cadastrados sem frequência aprovada.</p>
        </TabsContent>

        <TabsContent value="dossie" className="space-y-2">
          <p className="text-sm text-muted-foreground">Modelo para TCM/TCE/Folha Central: totais por unidade e regime, com campos de assinatura.</p>
          <div className="flex gap-2">
            <Button size="sm" disabled={!porUnidade.length} onClick={dossiePdf}><FileText className="mr-1 h-4 w-4" /> PDF do dossiê</Button>
            <Button size="sm" variant="outline" disabled={!porUnidade.length} onClick={() => baixarCsv(`${arquivoBase}-dossie-controle`,
              ["Unidade", "Regime", "Profissionais", "Dias", "HE 50%", "HE 100%", "HE total", "Plantões", "Sobreaviso", "ADN", "Incentivo", "Faltas", "Atestados", "Férias", "Licenças", "Afastamentos"],
              porUnidade.map((g) => [g.nome, g.tipo, g.t.profissionais, g.t.diasTrabalhados, g.t.he50, g.t.he100, g.t.heTotal, g.t.plantoes, g.t.sobreaviso, g.t.adn, g.t.incentivo, g.t.faltas, g.t.atestado, g.t.ferias, g.t.licencas, g.t.afastamentos]))}>
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
