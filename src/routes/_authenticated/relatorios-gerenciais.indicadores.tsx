import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { KpiCard } from "@/components/shared/KpiCard";
import { getIndicadoresResumo } from "@/lib/relatorios-gerenciais";
import { IntelligencePanel } from "@/components/relatorios-gerenciais/intelligence-panel";

export const Route = createFileRoute("/_authenticated/relatorios-gerenciais/indicadores")({
  component: IndicadoresPage,
});

const COLORS = [
  "#6366F1",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#22D3EE",
];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="mb-2 text-sm font-semibold text-foreground">{title}</div>
      {children}
    </div>
  );
}

function IndicadoresPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["rel-ger-indicadores"],
    queryFn: getIndicadoresResumo,
    staleTime: 5 * 60_000,
  });

  if (isLoading || !data) {
    return <div className="p-6 text-center text-muted-foreground">Carregando indicadores…</div>;
  }

  return (
    <div className="space-y-4">
      <IntelligencePanel foco="geral" titulo="Indicadores Gerais" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Profissionais" value={data.totalProfissionais} />
        <KpiCard label="Unidades" value={data.totalUnidades} />
        <KpiCard label="Setores" value={data.totalSetores} />
        <KpiCard label="Cargos" value={data.totalCargos} />
        <KpiCard label="Funções" value={data.totalFuncoes} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Distribuição por Vínculo">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data.porVinculo} dataKey="qtd" nameKey="nome" outerRadius={90} label>
                {data.porVinculo.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Distribuição por Sexo">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data.porSexo} dataKey="qtd" nameKey="sexo" outerRadius={90} label>
                {data.porSexo.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Distribuição por Faixa Etária">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.porFaixaEtaria}>
              <XAxis dataKey="faixa" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="qtd" fill="#6366F1" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Distribuição por Status">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.porStatus}>
              <XAxis dataKey="status" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="qtd" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Top 20 Unidades (por nº de profissionais)">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={data.porUnidade} layout="vertical" margin={{ left: 100 }}>
              <XAxis type="number" />
              <YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="qtd" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Top 20 Cargos">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={data.porCargo} layout="vertical" margin={{ left: 100 }}>
              <XAxis type="number" />
              <YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="qtd" fill="#F59E0B" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Top 20 Funções">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={data.porFuncao} layout="vertical" margin={{ left: 100 }}>
              <XAxis type="number" />
              <YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="qtd" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Top 20 Setores">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={data.porSetor} layout="vertical" margin={{ left: 100 }}>
              <XAxis type="number" />
              <YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="qtd" fill="#EC4899" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
