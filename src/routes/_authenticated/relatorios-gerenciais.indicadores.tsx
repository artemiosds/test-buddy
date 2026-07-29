import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { KpiCard } from "@/components/shared/KpiCard";
import { getIndicadoresResumo } from "@/lib/relatorios-gerenciais";
import { IntelligencePanel } from "@/components/relatorios-gerenciais/intelligence-panel";
import {
  ChartCard,
  BarChartH,
  BarChartV,
  PieChartCard,
} from "@/components/relatorios-gerenciais/sections";

export const Route = createFileRoute("/_authenticated/relatorios-gerenciais/indicadores")({
  component: IndicadoresPage,
});

function IndicadoresPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["rel-ger-indicadores"],
    queryFn: getIndicadoresResumo,
    staleTime: 5 * 60_000,
  });

  if (isLoading || !data) {
    return <div className="p-6 text-center text-muted-foreground">Carregando indicadores…</div>;
  }

  const porSexo = (data.porSexo ?? []).map((s: { sexo: string; qtd: number }) => ({
    nome: s.sexo || "Não informado",
    qtd: s.qtd,
  }));
  const porFaixa = (data.porFaixaEtaria ?? []).map((f: { faixa: string; qtd: number }) => ({
    nome: f.faixa,
    qtd: f.qtd,
  }));
  const porStatus = (data.porStatus ?? []).map((s: { status: string; qtd: number }) => ({
    nome: s.status || "Não informado",
    qtd: s.qtd,
  }));

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

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <ChartCard title="Distribuição por Vínculo" subtitle="Participação sobre o total ativo">
          <PieChartCard data={data.porVinculo} />
        </ChartCard>

        <ChartCard title="Distribuição por Sexo">
          <PieChartCard data={porSexo} />
        </ChartCard>

        <ChartCard title="Distribuição por Faixa Etária">
          <BarChartV data={porFaixa} color="#6366F1" />
        </ChartCard>

        <ChartCard title="Distribuição por Status">
          <BarChartV data={porStatus} color="#10B981" />
        </ChartCard>

        <ChartCard title="Top 20 Unidades" subtitle="Por número de profissionais">
          <BarChartH data={data.porUnidade} color="#3B82F6" />
        </ChartCard>

        <ChartCard title="Top 20 Cargos">
          <BarChartH data={data.porCargo} color="#F59E0B" />
        </ChartCard>

        <ChartCard title="Top 20 Funções">
          <BarChartH data={data.porFuncao} color="#8B5CF6" />
        </ChartCard>

        <ChartCard title="Top 20 Setores">
          <BarChartH data={data.porSetor} color="#EC4899" />
        </ChartCard>
      </div>
    </div>
  );
}

