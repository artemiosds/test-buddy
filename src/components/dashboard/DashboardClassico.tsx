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

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export function DashboardClassico() {
  const a = useAnalytics({});
  
  const status = a.statusBreakdown.data ?? {};
  const vinc = a.vinculoBreakdown.data;
  const unidadesTop = a.distribuicaoUnidade.data ?? [];

  const n = (v: number | undefined | null) => (v ?? 0).toLocaleString("pt-BR");
  
  const pieData = React.useMemo(() => {
    if (!vinc) return [];
    return [
      { name: "Efetivos", value: vinc.efetivos },
      { name: "Temporários", value: vinc.temporarios },
    ].filter(i => i.value > 0);
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
              <BarChart data={barData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.2} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="nome" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  fontSize={11}
                  width={100}
                />
                <Tooltip 
                  formatter={(v: any) => [v, "Profissionais"]}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={32} />
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
