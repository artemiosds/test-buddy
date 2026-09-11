import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute } from "@tanstack/react-router";
import { UserCheck, UserMinus, Umbrella, FileText, UserX, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

import { useUnitScope } from "@/hooks/use-unit-scope";
import { EmptyState, KpiCard, PageHeader, StatusBadge } from "@/components/shared";
import { PermissionGate } from "@/components/permission-gate";
import { kpisDeProfissionais } from "@/lib/kpis-forca-trabalho";
import { BotaoRelatorioAbnt } from "@/components/relatorios-gerenciais/botao-relatorio-abnt";
import {
  blocoSituacoes,
  detalharSituacoes,
  kpisAbnt,
  relatorioPainelAbnt,
} from "@/lib/painel-abnt";

export const Route = createFileRoute("/_authenticated/gestao-pessoas/situacao-funcional")({ errorComponent: ErrorComponent,
  head: () => ({
    meta: [
      { title: "Situação Funcional — Gestão da Saúde" },
      { name: "description", content: "Distribuição dos profissionais por situação funcional." },
    ],
  }),
  component: () => (
    <PermissionGate
      permission="profissional.visualizar"
      fallback={
        <div className="p-6 text-sm text-muted-foreground">
          Sem permissão para visualizar este painel.
        </div>
      }
    >
      <SituacaoFuncional />
    </PermissionGate>
  ),
});


function SituacaoFuncional() {
  const { unidadePadraoId, selectedUnitId, isMaster, isGlobal } = useUnitScope();
  // O Administrador Master sempre enxerga a rede inteira nesta página, como
  // na listagem de Profissionais. Outros perfis globais podem filtrar unidade.
  const escopoUnidadeId = isMaster ? null : isGlobal ? selectedUnitId : unidadePadraoId;
  const { data: professionals, isLoading } = useQuery({
    queryKey: ["profissionais-status-direct", escopoUnidadeId],
    queryFn: async () => {
      let q = supabase
        .from("profissionais")
        .select("status, situacao_funcional, unidade_id")
        .is("deleted_at", null)
        .limit(10000);

      if (escopoUnidadeId) {
        q = q.eq("unidade_id", escopoUnidadeId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as { status: string | null; situacao_funcional: string | null }[];
    },
  });

  // Regra institucional única — a mesma da tela de Profissionais e do
  // Relatório Geral de Cargos (src/lib/kpis-forca-trabalho.ts).
  const kpis = useMemo(() => kpisDeProfissionais(professionals), [professionals]);

  // Detalhamento com TODAS as situações do cadastro (inclusive as zeradas),
  // para que nenhuma situação — como "Afastado por Laudo" — fique invisível.
  const detalhe = useMemo(() => detalharSituacoes(professionals), [professionals]);

  const escopoTexto = escopoUnidadeId ? "Unidade selecionada" : "Rede completa";

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Situação Funcional"
        description="Distribuição dos profissionais por situação funcional atual."
        actions={
          <BotaoRelatorioAbnt
            label="Imprimir PDF (ABNT)"
            variant="outline"
            disabled={isLoading}
            relatorio={() =>
              relatorioPainelAbnt({
                arquivo: "situacao-funcional",
                titulo: "Situação Funcional",
                subtitulo: "Distribuição dos profissionais por situação funcional atual",
                filtros: [
                  { label: "Escopo", valor: escopoTexto },
                  { label: "Base", valor: "Cadastros ativos no sistema (não excluídos)" },
                ],
                kpis: kpisAbnt(kpis),
                registros: kpis.total,
                blocos: [blocoSituacoes(detalhe)],
                graficos: [
                  {
                    tipo: "rosca",
                    titulo: "Composição do quadro por grupo",
                    dados: [
                      { label: "Disponível p/ escala", valor: kpis.disponiveis },
                      { label: "Férias / Licença Prêmio", valor: kpis.feriasLicencaPremio },
                      { label: "Afastados", valor: kpis.afastados },
                      { label: "Desligados", valor: kpis.desligados },
                    ],
                  },
                  {
                    tipo: "barras",
                    titulo: "Situações com registros",
                    dados: detalhe
                      .filter((l) => l.total > 0)
                      .map((l) => ({ label: l.label, valor: l.total })),
                    limite: 12,
                  },
                ],
                notas: [
                  "Ativos = em exercício + férias + licença prêmio (vínculo vigente).",
                  "Disponível para escala = apenas profissionais em exercício pleno.",
                  "Afastados reúnem afastamentos e licenças legais, incluindo Afastado por Laudo, INSS e cedidos.",
                ],
              })
            }
          />
        }
      />


      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Total"
          value={kpis.total.toLocaleString("pt-BR")}
          loading={isLoading}
          icon={<Users className="h-4 w-4" />}
        />
        <KpiCard
          label="Ativos"
          value={kpis.ativos.toLocaleString("pt-BR")}
          hint="Em exercício + férias + licença prêmio"
          loading={isLoading}
          tone="success"
          icon={<UserCheck className="h-4 w-4" />}
        />
        <KpiCard
          label="Disponível p/ Escala"
          value={kpis.disponiveis.toLocaleString("pt-BR")}
          hint="Em exercício pleno hoje"
          loading={isLoading}
          icon={<UserCheck className="h-4 w-4" />}
        />
        <KpiCard
          label="Férias / Licença Prêmio"
          value={kpis.feriasLicencaPremio.toLocaleString("pt-BR")}
          hint="Ativos fora da escala"
          loading={isLoading}
          icon={<Umbrella className="h-4 w-4" />}
        />
        <KpiCard
          label="Afastados"
          value={kpis.afastados.toLocaleString("pt-BR")}
          hint="Inclui afastado por laudo, INSS, licenças legais e cedidos"
          loading={isLoading}
          tone="warning"
          icon={<UserMinus className="h-4 w-4" />}
        />
        <KpiCard
          label="Desligados"
          value={kpis.desligados.toLocaleString("pt-BR")}
          loading={isLoading}
          tone="danger"
          icon={<UserX className="h-4 w-4" />}
        />
      </div>

      <section className="mt-6 rounded-md border">
        <header className="flex items-center gap-2 border-b p-4">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Detalhamento por situação</h2>
          <span className="ml-auto text-xs text-muted-foreground">
            Todas as situações do cadastro
          </span>
        </header>
        <ul className="divide-y">
          {detalhe.map((r) => (
            <li
              key={r.key}
              className={`flex items-center justify-between gap-3 px-4 py-2 text-sm ${
                r.total === 0 ? "opacity-50" : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <StatusBadge domain="profissional" value={r.key} />
                <span className="truncate text-xs text-muted-foreground">{r.grupo}</span>
              </div>
              <div className="flex shrink-0 items-baseline gap-2">
                <span className="font-medium">{r.total.toLocaleString("pt-BR")}</span>
                <span className="w-14 text-right text-xs text-muted-foreground">
                  {r.percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>


      <div className="mt-6 rounded-md border p-4 text-sm text-muted-foreground">
        Total considerado:{" "}
        <span className="font-medium text-foreground">{kpis.total.toLocaleString("pt-BR")}</span>{" "}
        profissionais (não deletados). Ativos = em exercício + férias + licença prêmio; Disponível
        para escala = apenas em exercício pleno.
      </div>

      {!isLoading && kpis.total === 0 && (
        <EmptyState
          className="mt-6"
          title="Sem profissionais cadastrados"
          description="Nenhum registro disponível para o escopo atual."
        />
      )}
    </div>
  );
}
