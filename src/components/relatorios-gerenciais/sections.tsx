/**
 * Sublote 13 — componentes visuais compartilhados dos Relatórios Gerenciais.
 * Todos são puros (recebem dados prontos), sem consultas.
 */
import type { ReactNode } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/shared/KpiCard";
import type {
  Alerta,
  Comparativo,
  GerencialAggregate,
  QualityMetric,
  Semaforo,
} from "@/lib/relatorios-gerenciais-intelligence";
import { CHART_COLORS } from "@/lib/relatorios-gerenciais-intelligence";

export function Section({
  title,
  description,
  children,
  right,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function ChartCard({
  title,
  subtitle,
  children,
  height,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Altura fixa opcional. Se omitida, o gráfico define a própria altura. */
  height?: number;
}) {
  return (
    <div className="flex flex-col rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 min-w-0">
        <div className="truncate text-sm font-semibold text-foreground" title={title}>
          {title}
        </div>
        {subtitle && <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>}
      </div>
      <div className="min-w-0 flex-1" style={height ? { height } : undefined}>
        {children}
      </div>
    </div>
  );
}


const SEM_COLOR: Record<Semaforo, string> = {
  verde: "bg-emerald-500 text-white",
  amarelo: "bg-amber-400 text-amber-950",
  vermelho: "bg-red-600 text-white",
};
const SEM_TEXT: Record<Semaforo, string> = {
  verde: "VERDE",
  amarelo: "AMARELO",
  vermelho: "VERMELHO",
};

export function SemaphoreCard({ semaforo }: { semaforo: GerencialAggregate["semaforo"] }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          Semáforo Executivo
        </div>
        <span
          className={"rounded-full px-3 py-0.5 text-xs font-bold " + SEM_COLOR[semaforo.global]}
        >
          {SEM_TEXT[semaforo.global]}
        </span>
      </div>
      <ul className="space-y-1 text-xs">
        {semaforo.itens.map((i) => (
          <li key={i.chave} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span
                className={
                  "inline-block h-2 w-2 rounded-full " +
                  (i.nivel === "verde"
                    ? "bg-emerald-500"
                    : i.nivel === "amarelo"
                      ? "bg-amber-400"
                      : "bg-red-600")
                }
              />
              {i.rotulo}
            </span>
            <span className="text-muted-foreground">{i.motivo}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ExecutiveSummary({ frases }: { frases: string[] }) {
  return (
    <div className="rounded-md border-l-4 border-primary/70 bg-primary/5 p-3">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
        Resumo Executivo (automático)
      </div>
      <ul className="space-y-1 text-sm text-foreground">
        {frases.map((f, i) => (
          <li key={i}>• {f}</li>
        ))}
      </ul>
    </div>
  );
}

export function SmartAlerts({ alertas, limit = 6 }: { alertas: Alerta[]; limit?: number }) {
  const list = alertas.slice(0, limit);
  if (list.length === 0) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        <CheckCircle2 className="mr-1 inline h-4 w-4" /> Nenhum alerta detectado neste momento.
      </div>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((a) => (
        <div
          key={a.id}
          className={
            "rounded-md border p-2 text-sm " +
            (a.gravidade === "vermelho"
              ? "border-red-300 bg-red-50"
              : a.gravidade === "amarelo"
                ? "border-amber-300 bg-amber-50"
                : "border-emerald-300 bg-emerald-50")
          }
        >
          <div className="mb-0.5 flex items-center gap-1 text-xs font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" /> {a.titulo}
            {a.quantidade != null && (
              <span className="ml-auto rounded-full bg-card/70 px-2 text-[10px]">
                {a.quantidade}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{a.detalhe}</div>
        </div>
      ))}
    </div>
  );
}

export function QualityIndex({ q }: { q: GerencialAggregate["qualidade"] }) {
  const bar = (label: string, val: number, key: string) => (
    <div key={key}>
      <div className="mb-0.5 flex justify-between text-xs">
        <span>{label}</span>
        <span className="tabular-nums">{val.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div
          className={
            "h-1.5 rounded-full " +
            (val >= 90 ? "bg-emerald-500" : val >= 75 ? "bg-amber-400" : "bg-red-500")
          }
          style={{ width: `${Math.min(100, val)}%` }}
        />
      </div>
    </div>
  );
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          Índice de Qualidade
        </div>
        <div
          className={
            "rounded-md px-2 py-0.5 text-xs font-bold " +
            (q.geral >= 90
              ? "bg-emerald-100 text-emerald-700"
              : q.geral >= 75
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700")
          }
        >
          Geral {q.geral}%
        </div>
      </div>
      <div className="space-y-2">
        {bar("Integridade Cadastral", q.integridadeCadastral, "ic")}
        {bar("Lotação", q.lotacao, "lot")}
        {bar("Cobertura de Responsáveis", q.coberturaResponsaveis, "cr")}
        {bar("Estrutura Organizacional", q.estruturaOrganizacional, "eo")}
      </div>
    </div>
  );
}

export function QualityBreakdown({ metricas }: { metricas: QualityMetric[] }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
        Cartões de Integridade
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {metricas.map((m) => (
          <div key={m.chave} className="rounded border p-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{m.rotulo}</span>
              <span
                className={
                  "tabular-nums " +
                  (m.percentual >= 90
                    ? "text-emerald-700"
                    : m.percentual >= 75
                      ? "text-amber-700"
                      : "text-red-700")
                }
              >
                {m.percentual}%
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {m.ok.toLocaleString("pt-BR")} de {m.total.toLocaleString("pt-BR")} preenchidos
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ComparativeCard({ comparativos }: { comparativos: Comparativo[] }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Comparativos</div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {comparativos.map((c) => {
          const up = c.delta > 0;
          return (
            <div key={c.chave} className="rounded border p-2">
              <div className="text-xs font-medium">{c.rotulo}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-lg font-semibold tabular-nums">
                  {c.atual.toLocaleString("pt-BR")}
                </span>
                <span className="text-xs text-muted-foreground">
                  vs {c.anterior.toLocaleString("pt-BR")}
                </span>
              </div>
              <div
                className={
                  "flex items-center gap-1 text-xs " +
                  (up ? "text-emerald-700" : c.delta < 0 ? "text-red-700" : "text-muted-foreground")
                }
              >
                {up ? (
                  <TrendingUp className="h-3 w-3" />
                ) : c.delta < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
                {c.delta >= 0 ? "+" : ""}
                {c.delta.toLocaleString("pt-BR")}
                {c.deltaPct != null && ` (${c.deltaPct >= 0 ? "+" : ""}${c.deltaPct.toFixed(1)}%)`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RankingList({
  titulo,
  itens,
  unidade = "",
}: {
  titulo: string;
  itens: { nome: string; valor: number; extra?: string }[];
  unidade?: string;
}) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{titulo}</div>
      {itens.length === 0 ? (
        <div className="py-4 text-center text-xs text-muted-foreground">Sem dados</div>
      ) : (
        <ol className="space-y-1 text-xs">
          {itens.map((i, idx) => (
            <li key={i.nome + idx} className="flex items-center gap-2">
              <span className="w-4 text-right text-muted-foreground">{idx + 1}.</span>
              <span className="flex-1 truncate" title={i.nome}>
                {i.nome}
              </span>
              <div className="hidden h-1.5 w-20 rounded-full bg-muted md:block">
                <div
                  className="h-1.5 rounded-full bg-primary"
                  style={{ width: `${(i.valor / max) * 100}%` }}
                />
              </div>
              <span className="w-14 text-right font-mono tabular-nums">
                {i.valor.toLocaleString("pt-BR")}
                {unidade}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function ExportBar({
  onCsv,
  onXlsx,
  onPdf,
  onPrint,
  disabled,
}: {
  onCsv?: () => void;
  onXlsx?: () => void;
  onPdf?: () => void;
  onPrint?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {onCsv && (
        <Button size="sm" variant="outline" onClick={onCsv} disabled={disabled}>
          <Download className="mr-1 h-4 w-4" /> CSV
        </Button>
      )}
      {onXlsx && (
        <Button size="sm" variant="outline" onClick={onXlsx} disabled={disabled}>
          <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
        </Button>
      )}
      {onPdf && (
        <Button size="sm" variant="outline" onClick={onPdf} disabled={disabled}>
          <FileText className="mr-1 h-4 w-4" /> PDF
        </Button>
      )}
      {onPrint && (
        <Button size="sm" variant="ghost" onClick={onPrint}>
          <Printer className="mr-1 h-4 w-4" /> Imprimir
        </Button>
      )}
    </div>
  );
}

/* ---------- Blocos de charts pré-configurados ---------- */

const TOOLTIP_STYLE = {
  contentStyle: {
    fontSize: 12,
    borderRadius: 8,
    border: "1px solid hsl(var(--border))",
    background: "hsl(var(--card))",
    color: "hsl(var(--card-foreground))",
    boxShadow: "0 4px 16px rgb(0 0 0 / 0.08)",
  },
  labelStyle: { fontSize: 11, fontWeight: 600 },
  itemStyle: { fontSize: 12 },
} as const;

const nf = (v: number | string) =>
  typeof v === "number" ? v.toLocaleString("pt-BR") : String(v ?? "");

function truncar(txt: string, max: number) {
  const s = String(txt ?? "");
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

function SemDados({ height }: { height?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground"
      style={{ height: height ?? 180 }}
    >
      Sem dados para exibir
    </div>
  );
}

/**
 * Barras horizontais com altura proporcional à quantidade de itens
 * (evita rótulos sobrepostos) e nomes truncados com tooltip completo.
 */
export function BarChartH({
  data,
  dataKey = "qtd",
  nameKey = "nome",
  color = "#6366F1",
  height,
  maxItens = 20,
}: {
  data: { nome: string; qtd: number }[];
  dataKey?: string;
  nameKey?: string;
  color?: string;
  height?: number;
  maxItens?: number;
}) {
  const itens = (data ?? []).slice(0, maxItens);
  if (itens.length === 0) return <SemDados height={height} />;

  // 26px por barra garante espaço vertical suficiente para cada rótulo.
  const alturaCalculada = Math.max(160, itens.length * 26 + 32);
  const h = height ?? alturaCalculada;

  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart
        data={itens}
        layout="vertical"
        margin={{ top: 4, right: 44, bottom: 4, left: 4 }}
        barCategoryGap="18%"
      >
        <CartesianGrid horizontal={false} strokeOpacity={0.25} />
        <XAxis
          type="number"
          tick={{ fontSize: 11 }}
          allowDecimals={false}
          tickFormatter={(v) => nf(v as number)}
        />
        <YAxis
          type="category"
          dataKey={nameKey}
          width={168}
          tick={{ fontSize: 11 }}
          interval={0}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => truncar(v as string, 24)}
        />
        <Tooltip
          {...TOOLTIP_STYLE}
          cursor={{ fillOpacity: 0.06 }}
          formatter={(v) => [nf(v as number), "Total"]}
        />
        <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} maxBarSize={18}>
          <LabelList
            dataKey={dataKey}
            position="right"
            style={{ fontSize: 11, fill: "currentColor" }}
            formatter={(v: unknown) => nf(v as number)}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Barras verticais com rótulos inclinados, truncados e sem sobreposição. */
export function BarChartV({
  data,
  dataKey = "qtd",
  nameKey = "nome",
  color = "#10B981",
  height = 260,
  maxItens = 14,
}: {
  data: { nome: string; qtd: number }[];
  dataKey?: string;
  nameKey?: string;
  color?: string;
  height?: number;
  maxItens?: number;
}) {
  const itens = (data ?? []).slice(0, maxItens);
  if (itens.length === 0) return <SemDados height={height} />;

  const maiorRotulo = Math.max(...itens.map((i) => String(i.nome ?? "").length));
  const precisaInclinar = itens.length > 4 || maiorRotulo > 8;
  const alturaEixo = precisaInclinar ? Math.min(96, 30 + Math.min(maiorRotulo, 18) * 4) : 28;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={itens}
        margin={{ top: 18, right: 12, bottom: 4, left: 0 }}
        barCategoryGap="22%"
      >
        <CartesianGrid vertical={false} strokeOpacity={0.25} />
        <XAxis
          dataKey={nameKey}
          tick={{ fontSize: 11 }}
          interval={0}
          angle={precisaInclinar ? -35 : 0}
          textAnchor={precisaInclinar ? "end" : "middle"}
          height={alturaEixo}
          tickLine={false}
          tickFormatter={(v) => truncar(v as string, 18)}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          width={44}
          allowDecimals={false}
          tickFormatter={(v) => nf(v as number)}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          {...TOOLTIP_STYLE}
          cursor={{ fillOpacity: 0.06 }}
          formatter={(v) => [nf(v as number), "Total"]}
        />
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={46}>
          <LabelList
            dataKey={dataKey}
            position="top"
            style={{ fontSize: 10, fill: "currentColor" }}
            formatter={(v: unknown) => nf(v as number)}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Rosca com percentuais internos e legenda enxuta (sem textos sobrepostos). */
export function PieChartCard({
  data,
  nameKey = "nome",
  dataKey = "qtd",
  height = 260,
  maxItens = 8,
}: {
  data: { nome: string; qtd: number }[];
  nameKey?: string;
  dataKey?: string;
  height?: number;
  maxItens?: number;
}) {
  const brutos = (data ?? []).filter((d) => Number(d.qtd) > 0);
  if (brutos.length === 0) return <SemDados height={height} />;

  const ordenados = [...brutos].sort((a, b) => b.qtd - a.qtd);
  const principais = ordenados.slice(0, maxItens);
  const resto = ordenados.slice(maxItens);
  const itens =
    resto.length > 0
      ? [...principais, { nome: "Outros", qtd: resto.reduce((s, i) => s + i.qtd, 0) }]
      : principais;

  const total = itens.reduce((s, i) => s + i.qtd, 0) || 1;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <Pie
          data={itens}
          nameKey={nameKey}
          dataKey={dataKey}
          cx="50%"
          cy="45%"
          innerRadius="45%"
          outerRadius="72%"
          paddingAngle={1}
          labelLine={false}
          label={({ percent }: { percent?: number }) =>
            (percent ?? 0) >= 0.07 ? `${Math.round((percent ?? 0) * 100)}%` : ""
          }
          style={{ fontSize: 11 }}
        >
          {itens.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="none" />
          ))}
        </Pie>
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(v, n) => [
            `${nf(v as number)} (${(((v as number) / total) * 100).toFixed(1)}%)`,
            truncar(String(n), 32),
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, lineHeight: "16px", paddingTop: 6 }}
          layout="horizontal"
          verticalAlign="bottom"
          align="center"
          iconSize={8}
          formatter={(value) => (
            <span title={String(value)} className="text-muted-foreground">
              {truncar(String(value), 20)}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function LineChartCard({
  data,
  nameKey = "dia",
  dataKey = "qtd",
  color = "#6366F1",
  height = 260,
}: {
  data: Record<string, string | number>[];
  nameKey?: string;
  dataKey?: string;
  color?: string;
  height?: number;
}) {
  if (!data || data.length === 0) return <SemDados height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.25} />
        <XAxis
          dataKey={nameKey}
          tick={{ fontSize: 10 }}
          interval="preserveStartEnd"
          minTickGap={24}
          height={28}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          width={44}
          allowDecimals={false}
          tickFormatter={(v) => nf(v as number)}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [nf(v as number), "Total"]} />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function RadarQuality({ q }: { q: GerencialAggregate["qualidade"] }) {
  const data = [
    { area: "Cadastro", valor: q.integridadeCadastral },
    { area: "Lotação", valor: q.lotacao },
    { area: "Responsáveis", valor: q.coberturaResponsaveis },
    { area: "Estrutura", valor: q.estruturaOrganizacional },
    { area: "Geral", valor: q.geral },
  ];
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={data} outerRadius="70%" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
        <PolarGrid strokeOpacity={0.35} />
        <PolarAngleAxis dataKey="area" tick={{ fontSize: 11 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} tickCount={5} />
        <Radar
          name="Qualidade"
          dataKey="valor"
          stroke="#6366F1"
          fill="#6366F1"
          fillOpacity={0.35}
        />
        <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`${nf(v as number)}%`, "Qualidade"]} />
      </RadarChart>
    </ResponsiveContainer>
  );
}


/* ---------- Helper de KPIs em grid ---------- */

export type KpiSpec = {
  label: string;
  value: string | number;
  tone?: "success" | "danger" | "warning" | "default";
  hint?: string;
};

export function KpiGrid({ kpis, cols = 5 }: { kpis: KpiSpec[]; cols?: 3 | 4 | 5 }) {
  const grid =
    cols === 3
      ? "sm:grid-cols-2 lg:grid-cols-3"
      : cols === 4
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5";
  return (
    <div className={"grid gap-2 " + grid}>
      {kpis.map((k) => (
        <KpiCard
          key={k.label}
          label={k.label}
          value={typeof k.value === "number" ? k.value.toLocaleString("pt-BR") : k.value}
          tone={k.tone}
          hint={k.hint}
        />
      ))}
    </div>
  );
}
