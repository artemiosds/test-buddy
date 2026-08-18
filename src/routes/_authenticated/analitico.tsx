import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { TrendingUp, BarChart3, PieChart as PieIcon, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PermissionGate } from "@/components/permission-gate";
import { DashboardAvisosWidget } from "@/components/dashboard/DashboardAvisosWidget";
import { useFrequencyRealtime } from "@/lib/realtime/frequency-realtime";

export const Route = createFileRoute("/_authenticated/analitico")({ errorComponent: ErrorComponent,
  component: DashboardAnalitico,
});

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const COLORS = [
  "#10b981", // Aprovadas
  "#f59e0b", // Em análise / Enviada
  "#94a3b8", // Rascunho
];

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const mapping: Record<string, string> = {
      "Jan": "Janeiro", "Feb": "Fevereiro", "Mar": "Março", "Apr": "Abril", "May": "Maio", "Jun": "Junho",
      "Jul": "Julho", "Aug": "Agosto", "Set": "Setembro", "Oct": "Outubro", "Nov": "Novembro", "Dec": "Dezembro"
    };
    const translatedLabel = mapping[label] || label;

    return (
      <div className="bg-white p-3 border rounded-lg shadow-sm">
        <p className="text-sm font-semibold mb-2">{translatedLabel}</p>
        <div className="space-y-1">
          {payload.map((item: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill || item.stroke }} />
                <span className="text-muted-foreground">{item.name}:</span>
              </div>
              <span className="font-medium">{item.value}{item.unit || ""}</span>
            </div>
          ))}
          {payload.length > 1 && (
            <div className="pt-1 mt-1 border-t flex items-center justify-between gap-4 text-xs font-semibold">
              <span>Total:</span>
              <span>{payload.reduce((acc: number, item: any) => acc + (item.value || 0), 0)}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}

function DashboardAnalitico() {
  const [ano, setAno] = useState(new Date().getFullYear());

  useFrequencyRealtime({}); // Contexto global (assina eventos de todas as frequências)

  // Evolução mensal: frequências enviadas / aprovadas por mês via RPC
  const { data: evolucao = [] } = useQuery({
    queryKey: ["analitico", "evolucao", ano],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_monthly_evolution", {
        p_ano: ano,
      });
      if (error) throw error;
      return (data || []) as Array<{
        mes: string;
        aprovadas: number;
        em_analise: number;
        rascunho: number;
        total: number;
        taxa_aprovacao: number;
      }>;
    },
  });

  // Distribuição por status (todas competências do ano)
  const { data: statusDist = [] } = useQuery({
    queryKey: ["analitico", "status-dist", ano],
    queryFn: async () => {
      const { data: comps } = await supabase
        .from("competencias")
        .select("id")
        .eq("ano", ano)
        .is("deleted_at", null);
      const ids = (comps ?? []).map((c: any) => c.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("frequencias")
        .select(`
          status, 
          competencia_unidades!inner(
            competencia_id,
            competencia:competencias(mes, ano)
          )
        `)
        .in("competencia_unidades.competencia_id", ids);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((f: any) => {
        let status = String(f.status || "").toLowerCase();
        // Normaliza "aprovada" -> "aprovadas" para a legenda do gráfico de pizza
        if (status === "aprovada") status = "aprovadas";
        counts[status] = (counts[status] ?? 0) + 1;
      });
      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },
  });

  // Top 10 unidades com mais profissionais
  const { data: topUnidades = [] } = useQuery({
    queryKey: ["analitico", "top-unidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidades")
        .select("id, nome, profissionais:profissionais(id)")
        .eq("status", "ativa")
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? [])
        .map((u: any) => ({
          nome: u.nome.length > 22 ? u.nome.slice(0, 20) + "…" : u.nome,
          total: (u.profissionais ?? []).length,
        }))
        .sort((a: any, b: any) => b.total - a.total)
        .slice(0, 10);
    },
  });

  // Taxa de aprovação mensal (usando valor pré-calculado da RPC)
  const taxaAprovacao = useMemo(() => {
    return evolucao.map((e) => ({
      mes: e.mes,
      taxa: e.taxa_aprovacao,
    }));
  }, [evolucao]);

  const anoAtual = new Date().getFullYear();
  const anos = [anoAtual - 2, anoAtual - 1, anoAtual, anoAtual + 1];

  return (
    <PermissionGate anyOf={["relatorio.visualizar", "relatorio.exportar"]}>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Dashboard Analítico
            </h1>
            <p className="text-sm text-muted-foreground">
              Evolução mensal, distribuição e indicadores da Secretaria Municipal de Saúde.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Ano:</label>
            <select
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="rounded-md border bg-background px-3 py-1.5 text-sm"
            >
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <Link to="/relatorios" className="text-sm text-primary hover:underline ml-4">
              → Relatórios detalhados
            </Link>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-lg border bg-card p-4 h-full">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Evolução mensal de folhas — {ano}</h2>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={evolucao}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                    <XAxis 
                      dataKey="mes" 
                      fontSize={12}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => {
                        const mapping: Record<string, string> = {
                          "Jan": "Jan", "Feb": "Fev", "Mar": "Mar", "Apr": "Abr", "May": "Mai", "Jun": "Jun",
                          "Jul": "Jul", "Aug": "Ago", "Set": "Set", "Oct": "Out", "Nov": "Nov", "Dec": "Dez"
                        };
                        return mapping[val] || val;
                      }}
                    />
                    <YAxis fontSize={12} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" />
                    <Bar dataKey="rascunho" name="Rascunho" fill="#cbd5e1" stackId="a" radius={[0, 0, 0, 0]} isAnimationActive={true} animationDuration={1000} />
                    <Bar dataKey="em_analise" name="Em análise" fill="#fbbf24" stackId="a" radius={[0, 0, 0, 0]} isAnimationActive={true} animationDuration={1000} />
                    <Bar dataKey="aprovadas" name="Aprovadas" fill="#10b981" stackId="a" radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={1000} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="lg:col-span-1">
            <DashboardAvisosWidget />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Taxa de aprovação */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Taxa de aprovação (%)</h2>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={taxaAprovacao} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTaxa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                  <XAxis 
                    dataKey="mes" 
                    fontSize={12} 
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => {
                      const mapping: Record<string, string> = {
                        "Jan": "Jan", "Feb": "Fev", "Mar": "Mar", "Apr": "Abr", "May": "Mai", "Jun": "Jun",
                        "Jul": "Jul", "Aug": "Ago", "Set": "Set", "Oct": "Out", "Nov": "Nov", "Dec": "Dez"
                      };
                      return mapping[val] || val;
                    }}
                  />
                  <YAxis fontSize={12} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="taxa"
                    name="Taxa de Aprovação"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorTaxa)"
                    unit="%"
                    isAnimationActive={true}
                    animationDuration={1000}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      return (
                        <circle key={`dot-${payload.mes}`} cx={cx} cy={cy} r={4} fill="#10b981" stroke="#fff" strokeWidth={2} />
                      );
                    }}
                    activeDot={{ r: 6, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Distribuição por status */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <PieIcon className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Distribuição por status — {ano}</h2>
            </div>
            <div className="h-72 relative">
              {statusDist.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Sem dados neste ano.
                </div>
              ) : (
                <>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-4">
                    <span className="text-2xl font-bold">
                      {statusDist.reduce((acc, curr) => acc + curr.value, 0)}
                    </span>
                    <span className="text-xs text-slate-500 uppercase tracking-wider">FOLHAS TOTAIS</span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDist}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={85}
                        paddingAngle={5}
                        isAnimationActive={true}
                        animationDuration={1000}
                      >
                        {statusDist.map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend 
                        verticalAlign="bottom" 
                        align="center"
                        iconType="circle"
                        formatter={(value, entry: any) => {
                          const { payload } = entry;
                          const total = statusDist.reduce((acc, curr) => acc + curr.value, 0);
                          const percentage = ((payload.value / total) * 100).toFixed(1);
                          const label = value.charAt(0).toUpperCase() + value.slice(1);
                          return (
                            <span className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{label}</span>: {payload.value} ({percentage}%)
                            </span>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Top unidades */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Top 10 unidades por nº de profissionais</h2>
          </div>
          <div className="h-96">
            {topUnidades.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sem unidades cadastradas.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topUnidades} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" fontSize={12} allowDecimals={false} />
                  <YAxis type="category" dataKey="nome" fontSize={11} width={150} />
                  <Tooltip />
                  <Bar dataKey="total" name="Profissionais" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </PermissionGate>
  );
}
