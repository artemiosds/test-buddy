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
} from "recharts";
import { TrendingUp, BarChart3, PieChart as PieIcon, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PermissionGate } from "@/components/permission-gate";

export const Route = createFileRoute("/_authenticated/analitico")({
  component: DashboardAnalitico,
});

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const COLORS = [
  "hsl(var(--primary))",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

function DashboardAnalitico() {
  const [ano, setAno] = useState(new Date().getFullYear());

  // Evolução mensal: frequências enviadas / aprovadas por mês
  const { data: evolucao = [] } = useQuery({
    queryKey: ["analitico", "evolucao", ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competencias")
        .select("id, mes, ano, frequencias:frequencias(id, status)")
        .eq("ano", ano)
        .is("deleted_at", null);
      if (error) throw error;
      const map: Record<number, { enviadas: number; aprovadas: number; rascunho: number }> = {};
      for (let m = 1; m <= 12; m++) map[m] = { enviadas: 0, aprovadas: 0, rascunho: 0 };
      (data ?? []).forEach((c: any) => {
        (c.frequencias ?? []).forEach((f: any) => {
          if (f.status === "aprovada" || f.status === "arquivada") map[c.mes].aprovadas++;
          else if (["enviada", "em_analise"].includes(f.status)) map[c.mes].enviadas++;
          else if (f.status === "rascunho") map[c.mes].rascunho++;
        });
      });
      return MESES.map((label, i) => ({ mes: label, ...map[i + 1] }));
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
        .select("status, competencia_unidades!inner(competencia_id)")
        .in("competencia_unidades.competencia_id", ids);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((f: any) => {
        counts[f.status] = (counts[f.status] ?? 0) + 1;
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

  // Taxa de aprovação mensal
  const taxaAprovacao = useMemo(() => {
    return evolucao.map((e: any) => {
      const total = e.enviadas + e.aprovadas + e.rascunho;
      return {
        mes: e.mes,
        taxa: total > 0 ? Math.round((e.aprovadas / total) * 100) : 0,
      };
    });
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

        {/* Evolução mensal */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Evolução mensal de folhas — {ano}</h2>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="mes" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="rascunho" name="Rascunho" fill="#94a3b8" stackId="a" />
                <Bar dataKey="enviadas" name="Em análise" fill="#f59e0b" stackId="a" />
                <Bar dataKey="aprovadas" name="Aprovadas" fill="#10b981" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
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
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={taxaAprovacao}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="mes" fontSize={12} />
                  <YAxis fontSize={12} domain={[0, 100]} unit="%" />
                  <Tooltip formatter={(v: any) => `${v}%`} />
                  <Line
                    type="monotone"
                    dataKey="taxa"
                    name="Aprovadas / Total"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Distribuição por status */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <PieIcon className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Distribuição por status — {ano}</h2>
            </div>
            <div className="h-72">
              {statusDist.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Sem dados neste ano.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDist}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={(e: any) => `${e.name}: ${e.value}`}
                    >
                      {statusDist.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
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
