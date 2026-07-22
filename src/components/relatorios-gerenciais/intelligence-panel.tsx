/**
 * Painel de Inteligência reutilizado por todos os relatórios gerenciais.
 * Compõe: Resumo Executivo → Alertas → KPIs → Indicadores/Qualidade →
 * Gráficos → Comparativos → Rankings. Cada foco escolhe destaques diferentes.
 */
import { useGerencial } from "@/hooks/use-gerencial";
import { KpiCardSkeleton } from "@/components/shared/Skeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Section,
  ExecutiveSummary,
  SmartAlerts,
  QualityIndex,
  QualityBreakdown,
  SemaphoreCard,
  ChartCard,
  BarChartH,
  BarChartV,
  PieChartCard,
  LineChartCard,
  RadarQuality,
  ComparativeCard,
  RankingList,
  KpiGrid,
  type KpiSpec,
} from "./sections";
import type { GerencialAggregate } from "@/lib/relatorios-gerenciais-intelligence";

export type FocoGerencial =
  | "geral"
  | "profissionais"
  | "unidades"
  | "setores"
  | "cargos"
  | "funcoes"
  | "estrutura"
  | "piso"
  | "auditoria";

function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 1000) / 10 : 0;
}

function buildKpis(a: GerencialAggregate, foco: FocoGerencial): KpiSpec[] {
  const t = a.totais;
  const s = a.status;
  const p = a.pendencias;
  const u = a.unidadesPend;
  const st = a.setoresPend;
  const cad = a.qualidade.integridadeCadastral.toFixed(1) + "%";

  if (foco === "profissionais") {
    return [
      { label: "Total", value: t.profissionais },
      { label: "Ativos", value: s["ativo"] ?? 0, tone: "success" },
      { label: "Afastados", value: s["afastado"] ?? 0, tone: "warning" },
      { label: "Em Férias", value: s["ferias"] ?? 0 },
      { label: "Licença", value: s["licenciado"] ?? 0 },
      { label: "Inativos", value: (s["inativo"] ?? 0) + (s["desligado"] ?? 0) },
      { label: "Sem Unidade", value: p.semUnidade, tone: p.semUnidade ? "danger" : "success" },
      { label: "Sem Setor", value: p.semSetor, tone: p.semSetor ? "warning" : "success" },
      { label: "Sem Cargo", value: p.semCargo, tone: p.semCargo ? "warning" : "success" },
      { label: "Sem Função", value: p.semFuncao },
      {
        label: "Sem Matrícula",
        value: p.semMatricula,
        tone: p.semMatricula ? "warning" : "success",
      },
      { label: "Sem CPF", value: p.semCpf, tone: p.semCpf ? "danger" : "success" },
      { label: "Sem Telefone", value: p.semTelefone },
      { label: "Sem E-mail", value: p.semEmail },
      {
        label: "Cadastro Completo",
        value: cad,
        tone:
          a.qualidade.integridadeCadastral >= 90
            ? "success"
            : a.qualidade.integridadeCadastral >= 75
              ? "warning"
              : "danger",
      },
    ];
  }
  if (foco === "unidades") {
    const maior = a.rankings.maioresUnidades[0];
    const menor = a.rankings.menoresUnidades[0];
    return [
      { label: "Total", value: t.unidades },
      { label: "Ativas", value: t.unidadesAtivas, tone: "success" },
      { label: "Inativas", value: t.unidadesInativas },
      { label: "Sem Diretor", value: u.semDiretor, tone: u.semDiretor ? "danger" : "success" },
      {
        label: "Sem Coordenador (setores)",
        value: st.semCoordenador,
        tone: st.semCoordenador ? "warning" : "success",
      },
      { label: "Sem CNES", value: u.semCnes, tone: u.semCnes ? "danger" : "success" },
      { label: "Sem CNPJ", value: u.semCnpj, tone: u.semCnpj ? "warning" : "success" },
      { label: "Sem E-mail", value: u.semEmail },
      { label: "Sem Telefone", value: u.semTelefone },
      { label: "Sem Tipo", value: u.semTipo },
      {
        label: "Sem Profissionais",
        value: u.semProfissionais,
        tone: u.semProfissionais ? "warning" : "success",
      },
      { label: "Profissionais Lotados", value: t.profissionais - p.semUnidade },
      { label: "Cobertura Diretores", value: pct(t.unidades - u.semDiretor, t.unidades) + "%" },
      { label: "Maior Lotação", value: maior ? `${maior.nome} (${maior.valor})` : "—" },
      { label: "Menor Lotação", value: menor ? `${menor.nome} (${menor.valor})` : "—" },
    ];
  }
  if (foco === "setores") {
    const media = t.setores
      ? Math.round(((t.profissionais - p.semSetor) / t.setores) * 10) / 10
      : 0;
    const maior = a.rankings.maioresSetores[0];
    const menor = a.rankings.menoresSetores[0];
    return [
      { label: "Total", value: t.setores },
      { label: "Ativos", value: t.setoresAtivos, tone: "success" },
      {
        label: "Sem Coordenador",
        value: st.semCoordenador,
        tone: st.semCoordenador ? "warning" : "success",
      },
      {
        label: "Sem Profissionais",
        value: st.semProfissionais,
        tone: st.semProfissionais ? "warning" : "success",
      },
      { label: "Apenas 1 Servidor", value: st.umServidor },
      { label: "Lotação Média", value: media },
      { label: "Maior Setor", value: maior ? `${maior.nome} (${maior.valor})` : "—" },
      { label: "Menor Setor", value: menor ? `${menor.nome} (${menor.valor})` : "—" },
      { label: "Profissionais Alocados", value: t.profissionais - p.semSetor },
      { label: "Cobertura Coord.", value: pct(t.setores - st.semCoordenador, t.setores) + "%" },
      {
        label: "Setores por Unidade (média)",
        value: t.unidades ? Math.round((t.setores / t.unidades) * 10) / 10 : 0,
      },
      { label: "Estrutura Organizacional", value: a.qualidade.estruturaOrganizacional + "%" },
      {
        label: "Profissionais sem Setor",
        value: p.semSetor,
        tone: p.semSetor ? "warning" : "success",
      },
      { label: "Unidades c/ Setores", value: t.unidades - u.semProfissionais },
      { label: "Qualidade Geral", value: a.qualidade.geral + "%" },
    ];
  }
  if (foco === "cargos") {
    const top = a.rankings.cargosMaisUtilizados[0];
    const ocupados = a.distribuicoes.porCargo.filter(
      (r) => r.nome !== "Sem cargo" && r.qtd > 0,
    ).length;
    return [
      { label: "Total de Cargos", value: t.cargos },
      { label: "Ocupados", value: ocupados, tone: "success" },
      { label: "Vagos (sem ocupantes)", value: Math.max(0, t.cargos - ocupados) },
      { label: "Cargo mais utilizado", value: top ? top.nome : "—" },
      { label: "Ocupação do topo", value: top ? top.valor : 0 },
      {
        label: "Média por cargo",
        value: t.cargos ? Math.round((t.profissionais / t.cargos) * 10) / 10 : 0,
      },
      {
        label: "Profissionais sem cargo",
        value: p.semCargo,
        tone: p.semCargo ? "warning" : "success",
      },
      {
        label: "Concentração top-1 (%)",
        value: t.profissionais && top ? pct(top.valor, t.profissionais) + "%" : "—",
      },
      {
        label: "Top-5 concentração (%)",
        value:
          pct(
            a.rankings.cargosMaisUtilizados.slice(0, 5).reduce((s, r) => s + r.valor, 0),
            t.profissionais,
          ) + "%",
      },
      { label: "Cargos distintos ativos", value: ocupados },
      {
        label: "Ativos ocupando cargos",
        value:
          (s["ativo"] ?? 0) - p.semCargo > 0 ? (s["ativo"] ?? 0) - p.semCargo : (s["ativo"] ?? 0),
      },
      { label: "Integridade Cadastral", value: cad },
      { label: "Qualidade Geral", value: a.qualidade.geral + "%" },
      { label: "Unidades cobertas", value: t.unidades - u.semProfissionais },
      { label: "Setores cobertos", value: t.setores - st.semProfissionais },
    ];
  }
  if (foco === "funcoes") {
    const top = a.rankings.funcoesMaisUtilizadas[0];
    const ocupadas = a.distribuicoes.porFuncao.filter(
      (r) => r.nome !== "Sem função" && r.qtd > 0,
    ).length;
    return [
      { label: "Total de Funções", value: t.funcoes },
      { label: "Ocupadas", value: ocupadas, tone: "success" },
      { label: "Vagas", value: Math.max(0, t.funcoes - ocupadas) },
      { label: "Função mais utilizada", value: top ? top.nome : "—" },
      { label: "Ocupação do topo", value: top ? top.valor : 0 },
      {
        label: "Média por função",
        value: t.funcoes ? Math.round((t.profissionais / t.funcoes) * 10) / 10 : 0,
      },
      { label: "Sem função", value: p.semFuncao },
      {
        label: "Concentração top-1 (%)",
        value: t.profissionais && top ? pct(top.valor, t.profissionais) + "%" : "—",
      },
      {
        label: "Top-5 concentração (%)",
        value:
          pct(
            a.rankings.funcoesMaisUtilizadas.slice(0, 5).reduce((s, r) => s + r.valor, 0),
            t.profissionais,
          ) + "%",
      },
      {
        label: "Ativos com função",
        value:
          (s["ativo"] ?? 0) - p.semFuncao > 0 ? (s["ativo"] ?? 0) - p.semFuncao : (s["ativo"] ?? 0),
      },
      { label: "Cobertura Diretores", value: pct(t.unidades - u.semDiretor, t.unidades) + "%" },
      { label: "Cobertura Coord.", value: pct(t.setores - st.semCoordenador, t.setores) + "%" },
      { label: "Integridade Cadastral", value: cad },
      { label: "Qualidade Geral", value: a.qualidade.geral + "%" },
      { label: "Unidades ativas", value: t.unidadesAtivas },
    ];
  }
  if (foco === "estrutura") {
    return [
      { label: "Unidades", value: t.unidades },
      { label: "Setores", value: t.setores },
      { label: "Profissionais", value: t.profissionais },
      {
        label: "Cobertura Diretores",
        value: pct(t.unidades - u.semDiretor, t.unidades) + "%",
        tone: "success",
      },
      {
        label: "Cobertura Coordenadores",
        value: pct(t.setores - st.semCoordenador, t.setores) + "%",
        tone: "success",
      },
      {
        label: "Unidades sem Diretor",
        value: u.semDiretor,
        tone: u.semDiretor ? "danger" : "success",
      },
      {
        label: "Setores sem Coordenador",
        value: st.semCoordenador,
        tone: st.semCoordenador ? "warning" : "success",
      },
      { label: "Profissionais sem Unidade", value: p.semUnidade },
      { label: "Profissionais sem Setor", value: p.semSetor },
      { label: "Unidades sem Profissionais", value: u.semProfissionais },
      { label: "Setores sem Profissionais", value: st.semProfissionais },
      {
        label: "Setores por Unidade (média)",
        value: t.unidades ? Math.round((t.setores / t.unidades) * 10) / 10 : 0,
      },
      {
        label: "Profissionais por Setor (média)",
        value: t.setores ? Math.round(((t.profissionais - p.semSetor) / t.setores) * 10) / 10 : 0,
      },
      { label: "Estrutura Organizacional", value: a.qualidade.estruturaOrganizacional + "%" },
      { label: "Qualidade Geral", value: a.qualidade.geral + "%" },
    ];
  }
  if (foco === "auditoria") {
    const au = a.auditoria;
    const compAudit = a.comparativos.find((c) => c.chave === "audit-30d");
    const topUser = au.porUsuario[0];
    const topTable = au.porTabela[0];
    return [
      { label: "Eventos (30d)", value: au.totalEventos },
      {
        label: "Δ vs 30d anteriores",
        value: compAudit ? (compAudit.delta >= 0 ? "+" : "") + compAudit.delta : 0,
      },
      { label: "Operações distintas", value: au.porOperacao.length },
      { label: "Tabelas alteradas", value: au.porTabela.length },
      { label: "Usuários ativos", value: au.porUsuario.length },
      { label: "Dias com atividade", value: au.porDia.length },
      { label: "Usuário mais ativo", value: topUser ? `${topUser.nome} (${topUser.qtd})` : "—" },
      {
        label: "Tabela mais alterada",
        value: topTable ? `${topTable.nome} (${topTable.qtd})` : "—",
      },
      {
        label: "Média por dia",
        value: au.porDia.length ? Math.round((au.totalEventos / au.porDia.length) * 10) / 10 : 0,
      },
      {
        label: "Pico horário",
        value:
          au.porHora.reduce((m, x) => (x.qtd > (m?.qtd ?? 0) ? x : m), au.porHora[0])?.hora ?? "—",
      },
      { label: "Inserções", value: au.porOperacao.find((o) => o.nome === "insert")?.qtd ?? 0 },
      { label: "Atualizações", value: au.porOperacao.find((o) => o.nome === "update")?.qtd ?? 0 },
      {
        label: "Exclusões",
        value: au.porOperacao.find((o) => o.nome === "delete")?.qtd ?? 0,
        tone: "danger",
      },
      { label: "Logins", value: au.porOperacao.find((o) => o.nome === "login")?.qtd ?? 0 },
      {
        label: "Ações customizadas",
        value: au.porOperacao.find((o) => o.nome === "custom")?.qtd ?? 0,
      },
    ];
  }
  // geral
  return [
    { label: "Profissionais", value: t.profissionais },
    { label: "Unidades", value: t.unidades },
    { label: "Setores", value: t.setores },
    { label: "Cargos", value: t.cargos },
    { label: "Funções", value: t.funcoes },
    { label: "Ativos", value: s["ativo"] ?? 0, tone: "success" },
    { label: "Afastados", value: s["afastado"] ?? 0, tone: "warning" },
    { label: "Férias", value: s["ferias"] ?? 0 },
    { label: "Sem Lotação", value: p.semUnidade, tone: p.semUnidade ? "warning" : "success" },
    { label: "Sem Diretor", value: u.semDiretor, tone: u.semDiretor ? "danger" : "success" },
    { label: "Sem CNES", value: u.semCnes, tone: u.semCnes ? "danger" : "success" },
    { label: "Cobertura Resp.", value: a.qualidade.coberturaResponsaveis + "%" },
    { label: "Integridade Cadastral", value: a.qualidade.integridadeCadastral + "%" },
    { label: "Estrutura Organizacional", value: a.qualidade.estruturaOrganizacional + "%" },
    { label: "Qualidade Geral", value: a.qualidade.geral + "%" },
  ];
}

export function IntelligencePanel({
  foco = "geral",
  titulo,
}: {
  foco?: FocoGerencial;
  titulo?: string;
}) {
  const { data: a, isLoading, isError, error } = useGerencial();
  if (isLoading || !a) {
    return (
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }
  if (isError)
    return (
      <EmptyState
        title="Falha ao carregar inteligência"
        description={String((error as Error)?.message ?? "")}
      />
    );

  const kpis = buildKpis(a, foco);
  const d = a.distribuicoes;
  const r = a.rankings;
  const au = a.auditoria;

  return (
    <div className="space-y-4">
      <Section title="Resumo Executivo">
        <ExecutiveSummary frases={a.resumoExecutivo} />
      </Section>

      <Section title="Alertas Inteligentes">
        <SmartAlerts alertas={a.alertas} />
      </Section>

      <Section title={`KPIs — ${titulo ?? foco}`}>
        <KpiGrid kpis={kpis} cols={5} />
      </Section>

      <Section title="Índice de Qualidade e Integridade">
        <div className="grid gap-3 lg:grid-cols-3">
          <QualityIndex q={a.qualidade} />
          <SemaphoreCard semaforo={a.semaforo} />
          <ChartCard title="Radar da Qualidade" height={260}>
            <RadarQuality q={a.qualidade} />
          </ChartCard>
        </div>
        <QualityBreakdown metricas={a.qualidade.metricas} />
      </Section>

      <Section title="Gráficos">
        <div className="grid gap-3 lg:grid-cols-2">
          <ChartCard title="Profissionais por Unidade (top 20)" height={340}>
            <BarChartH data={d.porUnidade} color="#3B82F6" height={340} />
          </ChartCard>
          <ChartCard title="Profissionais por Setor (top 20)" height={340}>
            <BarChartH data={d.porSetor} color="#EC4899" height={340} />
          </ChartCard>
          <ChartCard title="Profissionais por Cargo (top 20)" height={340}>
            <BarChartH data={d.porCargo} color="#F59E0B" height={340} />
          </ChartCard>
          <ChartCard title="Profissionais por Função (top 20)" height={340}>
            <BarChartH data={d.porFuncao} color="#8B5CF6" height={340} />
          </ChartCard>
          <ChartCard title="Distribuição por Vínculo">
            <PieChartCard data={d.porVinculo} />
          </ChartCard>
          <ChartCard title="Distribuição por Sexo">
            <PieChartCard data={d.porSexo} />
          </ChartCard>
          <ChartCard title="Faixa Etária">
            <BarChartV data={d.porFaixaEtaria} color="#10B981" />
          </ChartCard>
          <ChartCard title="Status Funcional">
            <BarChartV data={d.porStatus} color="#6366F1" />
          </ChartCard>
          <ChartCard title="Tempo de Serviço">
            <BarChartV data={d.porTempoServico} color="#14B8A6" />
          </ChartCard>
          <ChartCard title="Distribuição por Secretaria">
            <PieChartCard data={d.porSecretaria} />
          </ChartCard>
          <ChartCard title="Unidades por Tipo">
            <PieChartCard data={d.porTipoUnidade} />
          </ChartCard>
          <ChartCard title="Unidades por Porte">
            <BarChartV data={d.porPorte} color="#F97316" />
          </ChartCard>
          {foco === "auditoria" && (
            <>
              <ChartCard title="Auditoria — operações por dia (30d)">
                <LineChartCard
                  data={au.porDia as unknown as Record<string, string | number>[]}
                  nameKey="dia"
                  dataKey="qtd"
                  color="#EF4444"
                />
              </ChartCard>
              <ChartCard title="Auditoria — horário de maior atividade">
                <BarChartV
                  data={au.porHora.map((h) => ({ nome: h.hora, qtd: h.qtd }))}
                  color="#EF4444"
                />
              </ChartCard>
            </>
          )}
        </div>
      </Section>

      <Section title="Comparativos">
        <ComparativeCard comparativos={a.comparativos} />
      </Section>

      <Section title="Rankings">
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          <RankingList titulo="Maiores unidades (por lotação)" itens={r.maioresUnidades} />
          <RankingList titulo="Menores unidades (com lotação)" itens={r.menoresUnidades} />
          <RankingList titulo="Setores com mais profissionais" itens={r.maioresSetores} />
          <RankingList titulo="Setores com menos profissionais" itens={r.menoresSetores} />
          <RankingList titulo="Cargos mais utilizados" itens={r.cargosMaisUtilizados} />
          <RankingList titulo="Funções mais utilizadas" itens={r.funcoesMaisUtilizadas} />
          <RankingList titulo="Unidades com mais afastados" itens={r.unidadesMaisAfastados} />
          <RankingList titulo="Unidades com mais férias" itens={r.unidadesMaisFerias} />
          {foco === "auditoria" && (
            <RankingList
              titulo="Usuários mais ativos (auditoria 30d)"
              itens={au.porUsuario.map((u) => ({ nome: u.nome, valor: u.qtd }))}
            />
          )}
        </div>
      </Section>
    </div>
  );
}
