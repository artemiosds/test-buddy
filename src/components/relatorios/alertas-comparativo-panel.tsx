import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Download, Minus, TrendingUp } from "lucide-react";
import {
  getAggregatedFrequencies,
  somarTotais,
  type ConsolidacaoOficial,
  type LinhaOficial,
  type TotaisTipo,
} from "@/lib/analytics-aggregations";
import { useCompetenciasLookup } from "@/hooks/use-lookups";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { exportarDetalheCsv, linhasDaVisao, type VisaoOficial } from "./consolidacao-oficial-panel";

const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Regras de alerta (somente leitura, sobre lançamentos aprovados). */
export const REGRAS_ALERTA: {
  key: string;
  label: string;
  descricao: string;
  nivel: "critico" | "atencao";
  teste: (l: LinhaOficial) => boolean;
  valor: (l: LinhaOficial) => number;
}[] = [
  { key: "he60", label: "HE acima de 60h", descricao: "Risco de passivo trabalhista e de jornada excessiva.", nivel: "critico", teste: (l) => l.heTotal > 60, valor: (l) => l.heTotal },
  { key: "he40", label: "HE entre 40h e 60h", descricao: "Volume elevado de horas extras no mês.", nivel: "atencao", teste: (l) => l.heTotal > 40 && l.heTotal <= 60, valor: (l) => l.heTotal },
  { key: "faltasInj", label: "3+ faltas injustificadas", descricao: "Avaliar desconto e eventual procedimento administrativo.", nivel: "critico", teste: (l) => l.faltasInjustificadas >= 3, valor: (l) => l.faltasInjustificadas },
  { key: "plantoes", label: "Mais de 10 plantões", descricao: "Escala possivelmente sobrecarregada.", nivel: "atencao", teste: (l) => l.plantoes > 10, valor: (l) => l.plantoes },
  { key: "sobreaviso", label: "Sobreaviso acima de 15", descricao: "Volume atípico de sobreavisos.", nivel: "atencao", teste: (l) => l.sobreaviso > 15, valor: (l) => l.sobreaviso },
  { key: "semDias", label: "Sem dias trabalhados e sem afastamento", descricao: "Lançamento aprovado zerado — conferir com a unidade.", nivel: "atencao", teste: (l) => l.diasTrabalhados === 0 && l.ferias + l.licencas + l.afastamentos + l.atestado + l.licencaPremio === 0, valor: () => 0 },
];

export function calcularAlertas(linhas: LinhaOficial[]) {
  return REGRAS_ALERTA.map((r) => ({ regra: r, linhas: linhas.filter(r.teste).sort((a, b) => r.valor(b) - r.valor(a)) }));
}

const INDICADORES: { key: keyof TotaisTipo; label: string; maiorPior: boolean }[] = [
  { key: "profissionais", label: "Profissionais", maiorPior: false },
  { key: "diasTrabalhados", label: "Dias trabalhados", maiorPior: false },
  { key: "he50", label: "HE 50%", maiorPior: true },
  { key: "he100", label: "HE 100%", maiorPior: true },
  { key: "heTotal", label: "HE total", maiorPior: true },
  { key: "plantoes", label: "Plantões", maiorPior: true },
  { key: "sobreaviso", label: "Sobreaviso", maiorPior: true },
  { key: "adn", label: "ADN", maiorPior: true },
  { key: "faltas", label: "Faltas", maiorPior: true },
  { key: "atestado", label: "Atestados", maiorPior: true },
];

export function AlertasComparativoPanel({
  oficial,
  visao,
  competenciaId,
  unidadeId,
  arquivoBase,
}: {
  oficial: ConsolidacaoOficial | undefined;
  visao: VisaoOficial;
  competenciaId?: string | null;
  unidadeId?: string | null;
  arquivoBase: string;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const linhas = useMemo(() => linhasDaVisao(oficial, visao), [oficial, visao]);
  const alertas = useMemo(() => calcularAlertas(linhas), [linhas]);
  const ativo = alertas.find((a) => a.regra.key === aberto);
  const totalAlertas = new Set(alertas.flatMap((a) => a.linhas.map((l) => `${l.tipo}:${l.unidade_id}:${l.profissional_id}`))).size;

  const { data: comps } = useCompetenciasLookup();
  const anterior = useMemo(() => {
    if (!comps || !competenciaId || competenciaId === "all") return null;
    const i = comps.findIndex((c) => c.id === competenciaId);
    return i >= 0 ? comps[i + 1] ?? null : null;
  }, [comps, competenciaId]);

  const { data: prev, isLoading: loadingPrev } = useQuery({
    queryKey: ["comparativo-oficial", anterior?.id, unidadeId ?? null],
    enabled: !!anterior,
    staleTime: 60_000,
    queryFn: () => getAggregatedFrequencies({ competenciaId: anterior!.id, unidadeId: unidadeId && unidadeId !== "all" ? unidadeId : null }),
  });

  const atual = useMemo(() => somarTotais(linhas), [linhas]);
  const antes = useMemo(() => (prev ? prev.oficial[visao] : undefined), [prev, visao]);
  const rotulo = anterior ? `${String(anterior.mes).padStart(2, "0")}/${anterior.ano}` : "";

  return (
    <section className="mt-6 grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-5 w-5 text-destructive" /> Alertas de conformidade
          </h3>
          <Badge variant={totalAlertas ? "destructive" : "secondary"}>{totalAlertas} profissional(is)</Badge>
        </div>
        <p className="text-xs text-muted-foreground">Somente folhas aprovadas. Clique para ver os profissionais.</p>
        <ul className="space-y-2">
          {alertas.map((a) => (
            <li key={a.regra.key}>
              <button
                type="button"
                disabled={!a.linhas.length}
                onClick={() => setAberto(a.regra.key)}
                className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50 disabled:hover:bg-transparent"
              >
                <span>
                  <span className="font-medium">{a.regra.label}</span>
                  <span className="block text-xs text-muted-foreground">{a.regra.descricao}</span>
                </span>
                <Badge variant={a.linhas.length ? (a.regra.nivel === "critico" ? "destructive" : "default") : "outline"}>{a.linhas.length}</Badge>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-4">
        <h3 className="flex items-center gap-2 font-semibold">
          <TrendingUp className="h-5 w-5 text-primary" /> Comparativo com a competência anterior
        </h3>
        {!competenciaId || competenciaId === "all" ? (
          <p className="text-sm text-muted-foreground">Selecione uma competência para comparar.</p>
        ) : !anterior ? (
          <p className="text-sm text-muted-foreground">Não há competência anterior cadastrada.</p>
        ) : loadingPrev ? (
          <p className="text-sm text-muted-foreground">Carregando {rotulo}…</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr><th className="text-left">Indicador</th><th className="text-right">{rotulo}</th><th className="text-right">Atual</th><th className="text-right">Variação</th></tr>
            </thead>
            <tbody>
              {INDICADORES.map((ind) => {
                const a = Number(atual[ind.key]) || 0;
                const b = Number(antes?.[ind.key]) || 0;
                const diff = a - b;
                const pct = b ? (diff / b) * 100 : null;
                const piora = ind.maiorPior ? diff > 0 : diff < 0;
                const Icon = diff === 0 ? Minus : diff > 0 ? ArrowUpRight : ArrowDownRight;
                return (
                  <tr key={ind.key} className="border-t">
                    <td className="py-1">{ind.label}</td>
                    <td className="text-right tabular-nums">{fmt(b)}</td>
                    <td className="text-right tabular-nums">{fmt(a)}</td>
                    <td className={`text-right tabular-nums ${diff === 0 ? "text-muted-foreground" : piora ? "text-destructive" : "text-primary"}`}>
                      <span className="inline-flex items-center gap-1">
                        <Icon className="h-3 w-3" />
                        {pct === null ? (diff ? `${diff > 0 ? "+" : ""}${fmt(diff)}` : "—") : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {anterior && !loadingPrev && (
          <p className="text-xs text-muted-foreground">Ambas as competências consideram somente folhas aprovadas e a mesma unidade filtrada.</p>
        )}
      </div>

      <Dialog open={!!ativo} onOpenChange={(o) => !o && setAberto(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{ativo?.regra.label}</DialogTitle>
            <DialogDescription>{ativo?.regra.descricao} ({ativo?.linhas.length ?? 0})</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => ativo && exportarDetalheCsv(`${arquivoBase}-alerta-${ativo.regra.key}`, ativo.linhas)}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background text-xs text-muted-foreground">
                <tr><th className="text-left">Profissional</th><th className="text-left">Unidade / Setor</th><th className="text-right">HE total</th><th className="text-right">Faltas inj.</th><th className="text-right">Plantões</th><th className="text-right">Sobreaviso</th><th className="text-right">Dias</th></tr>
              </thead>
              <tbody>
                {ativo?.linhas.map((l) => (
                  <tr key={`${l.tipo}-${l.unidade_id}-${l.profissional_id}`} className="border-t">
                    <td className="py-1">{l.profissional_nome}{l.matricula ? <span className="text-xs text-muted-foreground"> · {l.matricula}</span> : null}</td>
                    <td className="text-xs">{l.unidade_sigla ?? l.unidade_nome}{l.setor_nome ? ` / ${l.setor_nome}` : ""}</td>
                    <td className="text-right tabular-nums">{fmt(l.heTotal)}</td>
                    <td className="text-right tabular-nums">{fmt(l.faltasInjustificadas)}</td>
                    <td className="text-right tabular-nums">{fmt(l.plantoes)}</td>
                    <td className="text-right tabular-nums">{fmt(l.sobreaviso)}</td>
                    <td className="text-right tabular-nums">{fmt(l.diasTrabalhados)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Bloco de alertas para o PDF ABNT. */
export function blocoPdfAlertas(o: ConsolidacaoOficial | undefined, visao: VisaoOficial) {
  if (!o) return [];
  const al = calcularAlertas(linhasDaVisao(o, visao)).filter((a) => a.linhas.length);
  if (!al.length) return [];
  return [{
    titulo: "Alertas de conformidade (somente aprovadas)",
    head: ["Alerta", "Profissional", "Unidade / Setor", "Valor"],
    body: al.flatMap((a) => a.linhas.map((l) => [
      a.regra.label, l.profissional_nome, `${l.unidade_sigla ?? l.unidade_nome}${l.setor_nome ? ` / ${l.setor_nome}` : ""}`, fmt(a.regra.valor(l)),
    ])),
    align: ["left", "left", "left", "right"] as ("left" | "right")[],
    keepTogether: false,
  }];
}
