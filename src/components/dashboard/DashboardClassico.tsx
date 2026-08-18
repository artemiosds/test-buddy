import React from "react";
import { useAnalytics } from "@/hooks/use-analytics";
import { KpiCard, PageHeader } from "@/components/shared";
import { 
  Users, 
  UserCheck, 
  UserMinus, 
  Calendar,
  Building2,
  BarChart3,
  PieChart as PieIcon
} from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = [
  "#2563eb", // Royal Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#6366f1", // Indigo
  "#ec4899", // Rose
  "#8b5cf6", // Violet
];

export function DashboardClassico() {
  const a = useAnalytics({});
  
  const status = a.statusBreakdown.data ?? {};
  const vinc = a.vinculoBreakdown.data;
  const unidadesTop = a.distribuicaoUnidade.data ?? [];

  const n = (v: number | undefined | null) => (v ?? 0).toLocaleString("pt-BR");
  
  const pieData = React.useMemo(() => {
    if (!vinc) return [];
    return Object.entries(vinc)
      .map(([name, value]) => ({ name, value }))
      .filter(i => i.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [vinc]);

  const barData = React.useMemo(() => {
    return unidadesTop.map(u => ({
      nome: u.sigla || u.nome.substring(0, 15),
      total: u.total
    }));
  }, [unidadesTop]);

  return (
    <div className="space-y-8 p-4 md:p-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Visão Geral do Sistema" 
        description="Resumo simplificado dos principais indicadores de gestão."
      />

      {/* Cards de Indicadores no Topo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Total de Profissionais"
          value={n(a.totalProfessionals.data)}
          loading={a.totalProfessionals.isLoading}
          icon={<Users className="h-4 w-4" />}
        />
        <KpiCard
          label="Ativos"
          value={n(status["ativo"])}
          loading={a.statusBreakdown.isLoading}
          tone="success"
          icon={<UserCheck className="h-4 w-4" />}
        />
        <KpiCard
          label="Afastados"
          value={n(status["afastado"])}
          loading={a.statusBreakdown.isLoading}
          tone="warning"
          icon={<UserMinus className="h-4 w-4" />}
        />
        <KpiCard
          label="Férias"
          value={n(status["ferias"])}
          loading={a.statusBreakdown.isLoading}
          icon={<Calendar className="h-4 w-4" />}
        />
        <KpiCard
          label="Unidades Ativas"
          value={n(a.totalUnidades.data)}
          loading={a.totalUnidades.isLoading}
          iconTone="info"
          icon={<Building2 className="h-4 w-4" />}
          onClick={() => window.location.href = "/unidades"}
        />
      </div>

      {/* Gráficos Principais */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Gráfico de Profissionais por Unidade */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Building2 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Top 5 Unidades (Profissionais)</h3>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 20, right: 30, top: 10, bottom: 10 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.1} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="nome" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  fontSize={12}
                  width={110}
                  tick={{ fill: 'var(--color-text-secondary)', fontWeight: 500 }}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                  formatter={(v: any) => [v, "Profissionais"]}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: '1px solid var(--color-border)', 
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    backgroundColor: 'var(--color-card)',
                    color: 'var(--color-foreground)'
                  }}
                  itemStyle={{ color: 'var(--color-primary)', fontWeight: 600 }}
                />
                <Bar 
                  dataKey="total" 
                  fill="url(#barGradient)" 
                  radius={[0, 8, 8, 0]} 
                  barSize={24}
                  animationDuration={1500}
                  label={{ 
                    position: 'right', 
                    fill: 'var(--color-primary)', 
                    fontSize: 12, 
                    fontWeight: 700,
                    offset: 8
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Distribuição por Vínculo */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <PieIcon className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Distribuição por Vínculo</h3>
          </div>
          <div className="h-80 w-full">
            {pieData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Carregando dados...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie
                    data={pieData}
                    cx="35%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                    animationBegin={200}
                    animationDuration={1200}
                    labelLine={false}
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, value, name }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      
                      // Only show label inside if it's large enough (optional, but let's show value)
                      return (
                        <text 
                          x={x} 
                          y={y} 
                          fill="white" 
                          textAnchor={x > cx ? 'start' : 'end'} 
                          dominantBaseline="central"
                          fontSize={10}
                          fontWeight="bold"
                        >
                          {value}
                        </text>
                      );
                    }}
                  >
                    {pieData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]} 
                        stroke="var(--color-card)" 
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [value, "Profissionais"]}
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: '1px solid var(--color-border)', 
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                      backgroundColor: 'var(--color-card)',
                      color: 'var(--color-foreground)'
                    }}
                  />
                  <Legend 
                    layout="vertical" 
                    verticalAlign="middle" 
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ paddingLeft: "10px", right: 0 }}
                    formatter={(value, entry: any) => {
                      const { payload } = entry;
                      const total = pieData.reduce((acc, curr) => acc + curr.value, 0);
                      const percent = ((payload.value / total) * 100).toFixed(1);
                      return (
                        <span className="text-[11px] font-medium text-text-secondary leading-relaxed">
                          <span className="text-foreground font-bold">{value}:</span> {payload.value} ({percent}%)
                        </span>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
