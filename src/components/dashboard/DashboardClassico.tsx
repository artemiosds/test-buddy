import React from "react";
import { useAnalytics } from "@/hooks/use-analytics";
import { KpiCard, PageHeader } from "@/components/shared";
import { 
  Users, 
  UserCheck, 
  UserMinus, 
  Calendar,
  Wallet,
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

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export function DashboardClassico() {
  const a = useAnalytics({});
  
  const status = a.statusBreakdown.data ?? {};
  const vinc = a.vinculoBreakdown.data;

  const n = (v: number | undefined | null) => (v ?? 0).toLocaleString("pt-BR");
  
  const pieData = React.useMemo(() => {
    if (!vinc) return [];
    return [
      { name: "Efetivos", value: vinc.efetivos },
      { name: "Temporários", value: vinc.temporarios },
    ].filter(i => i.value > 0);
  }, [vinc]);

  // Simulando dados de evolução de gastos baseados no total (visão simplificada)
  const gastosData = React.useMemo(() => {
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
    return meses.map(m => ({
      mes: m,
      valor: (a.totalProfessionals.data ?? 0) * 2500 + (Math.random() * 50000)
    }));
  }, [a.totalProfessionals.data]);

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
          label="Estimativa de Folha"
          value={`R$ ${n((a.totalProfessionals.data ?? 0) * 2850)}`}
          loading={a.totalProfessionals.isLoading}
          tone="info"
          icon={<Wallet className="h-4 w-4" />}
        />
      </div>

      {/* Gráficos Principais */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Gráfico de Gastos Mensais */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Evolução de Gastos (Estimativa)</h3>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gastosData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="mes" axisLine={false} tickLine={false} fontSize={12} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  fontSize={12} 
                  tickFormatter={(v) => `R$ ${v/1000}k`}
                />
                <Tooltip 
                  formatter={(v: any) => [`R$ ${v.toLocaleString("pt-BR")}`, "Valor"]}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
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
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
