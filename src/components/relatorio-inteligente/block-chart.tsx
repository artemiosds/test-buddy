/**
 * Renderiza um ChartSpec usando recharts.
 * Suporta barra, pizza, rosca, linha e área.
 */
import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend,
} from "recharts";
import type { ChartSpec, Row } from "@/lib/relatorio-inteligente/tipos";

const PALETTE = [
  "#5C4020", "#B7873B", "#D4A24C", "#7B5A2A", "#E4C57A",
  "#8C6D3F", "#A87F45", "#C8A55A", "#66492A", "#DDB86A",
  "#4E361A", "#EBD79A",
];

export function BlockChart({ spec, rows }: { spec: ChartSpec; rows: Row[] }) {
  const data = useMemo(() => {
    const top = spec.top ?? 12;
    const list = rows
      .map((r) => ({
        name: r[spec.xField] == null || r[spec.xField] === "" ? "—" : String(r[spec.xField]),
        value: typeof r[spec.yField] === "number" ? (r[spec.yField] as number) : 0,
      }))
      .filter((d) => d.value !== 0 || spec.tipo === "linha" || spec.tipo === "area");
    list.sort((a, b) => b.value - a.value);
    if (list.length > top) {
      const head = list.slice(0, top);
      const tail = list.slice(top);
      const outros = tail.reduce((s, d) => s + d.value, 0);
      if (outros > 0) head.push({ name: "Outros", value: outros });
      return head;
    }
    return list;
  }, [rows, spec]);

  if (!data.length) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
        Sem dados numéricos para o gráfico.
      </div>
    );
  }

  const height = 240;
  const content = (() => {
    switch (spec.tipo) {
      case "pizza":
      case "rosca":
        return (
          <PieChart>
            <Pie
              data={data} dataKey="value" nameKey="name"
              innerRadius={spec.tipo === "rosca" ? 40 : 0}
              outerRadius={80} label={(d) => `${d.name}`}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => v.toLocaleString("pt-BR")} />
            <Legend />
          </PieChart>
        );
      case "linha":
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" fontSize={10} />
            <YAxis fontSize={10} />
            <Tooltip formatter={(v: number) => v.toLocaleString("pt-BR")} />
            <Line type="monotone" dataKey="value" stroke={PALETTE[0]} strokeWidth={2} />
          </LineChart>
        );
      case "area":
        return (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" fontSize={10} />
            <YAxis fontSize={10} />
            <Tooltip formatter={(v: number) => v.toLocaleString("pt-BR")} />
            <Area type="monotone" dataKey="value" stroke={PALETTE[0]} fill={PALETTE[2]} />
          </AreaChart>
        );
      default:
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" fontSize={10} interval={0} angle={-25} textAnchor="end" height={60} />
            <YAxis fontSize={10} />
            <Tooltip formatter={(v: number) => v.toLocaleString("pt-BR")} />
            <Bar dataKey="value" fill={PALETTE[0]} />
          </BarChart>
        );
    }
  })();

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>{content}</ResponsiveContainer>
    </div>
  );
}