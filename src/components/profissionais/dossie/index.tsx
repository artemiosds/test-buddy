/**
 * Dossiê Funcional — componentes de apresentação.
 *
 * Todos os componentes deste arquivo são "burros": recebem dados prontos
 * (ver `src/lib/dossie.ts`) e reutilizam shared components. Nenhuma consulta,
 * cálculo de folha, ou permissão nova. Apenas apresentação.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DataTable,
  EmptyState,
  KpiCard,
  StatusBadge,
  type DataTableColumn,
} from "@/components/shared";
import {
  formatCPF,
  formatDate,
  formatInteger,
  formatNumber,
} from "@/lib/formatters";
import {
  EVENTO_LABELS,
  deriveLotacoes,
  deriveMovimentacoes,
  formatTempoServico,
  type DossieResumo,
  type HistoricoEvento,
} from "@/lib/dossie";
import { Download, FileText, Search } from "lucide-react";

/* --------------------------- Cabeçalho Executivo -------------------------- */

export type ProfHeaderData = {
  nome_completo: string;
  nome_social: string | null;
  matricula: string | null;
  cpf: string | null;
  status: string | null;
  situacao_funcional: string | null;
  data_admissao: string | null;
  cargo: { nome: string } | null;
  funcao: { nome: string } | null;
  unidade: { id: string; nome: string; sigla: string | null } | null;
  setor: { id: string; nome: string } | null;
  vinculo: { nome: string; natureza: string | null } | null;
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function ProfissionalHeader({ p }: { p: ProfHeaderData }) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="text-lg font-semibold">
            {initials(p.nome_social || p.nome_completo || "?")}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold">
              {p.nome_social || p.nome_completo}
            </h2>
            {p.status && <StatusBadge domain="profissional" value={p.status} />}
            {p.situacao_funcional && (
              <Badge variant="outline" className="capitalize">
                {p.situacao_funcional}
              </Badge>
            )}
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground md:grid-cols-4">
            {p.matricula && <span>Mat.: {p.matricula}</span>}
            {p.cpf && <span>CPF: {formatCPF(p.cpf)}</span>}
            {p.cargo?.nome && <span>Cargo: {p.cargo.nome}</span>}
            {p.funcao?.nome && <span>Função: {p.funcao.nome}</span>}
            {p.unidade && (
              <span>
                Unidade:{" "}
                <Link
                  to="/unidades/$id"
                  params={{ id: p.unidade.id }}
                  className="text-primary hover:underline"
                >
                  {p.unidade.sigla ?? p.unidade.nome}
                </Link>
              </span>
            )}
            {p.setor && (
              <span>
                Setor:{" "}
                <Link
                  to="/setores/$id"
                  params={{ id: p.setor.id }}
                  className="text-primary hover:underline"
                >
                  {p.setor.nome}
                </Link>
              </span>
            )}
            {p.vinculo?.nome && <span>Vínculo: {p.vinculo.nome}</span>}
            <span>Admissão: {formatDate(p.data_admissao)}</span>
            <span>Tempo de serviço: {formatTempoServico(p.data_admissao)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* --------------------------- Resumo Executivo ---------------------------- */

export function ResumoExecutivoGrid({ resumo }: { resumo: DossieResumo }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
      <KpiCard
        label="Competências"
        value={formatInteger(resumo.totalCompetencias)}
        hint={`${formatInteger(resumo.totalFrequencias)} lançamentos`}
      />
      <KpiCard
        label="Aprovadas"
        value={`${resumo.percentualAprovadas}%`}
        tone={
          resumo.percentualAprovadas >= 90
            ? "success"
            : resumo.percentualAprovadas >= 70
              ? "warning"
              : "danger"
        }
        hint={`${formatInteger(resumo.frequenciasAprovadas)} linhas`}
      />
      <KpiCard
        label="Horas extras"
        value={formatNumber(resumo.totalHorasExtras)}
        hint="Acumulado histórico"
      />
      <KpiCard
        label="Faltas"
        value={formatInteger(resumo.totalFaltas)}
        tone={resumo.totalFaltas > 0 ? "warning" : "default"}
      />
      <KpiCard
        label="Pendências"
        value={formatInteger(resumo.pendenciasAbertas)}
        tone={resumo.pendenciasAbertas > 0 ? "danger" : "success"}
        hint={`${formatInteger(resumo.pendenciasResolvidas)} resolvidas`}
      />
      <KpiCard
        label="Trajetória"
        value={`${resumo.unidadesDistintas}u · ${resumo.setoresDistintos}s`}
        hint={`${resumo.cargosDistintos} cargos · ${resumo.funcoesDistintas} funções`}
      />
    </div>
  );
}

/* ----------------------------- Linha do Tempo ---------------------------- */

type TimelineExtra = {
  key: string;
  data: string;
  titulo: string;
  detalhe?: string;
  tipo: string;
};

export function TimelineFuncional({
  historico,
  extras = [],
  filtro,
}: {
  historico: HistoricoEvento[];
  extras?: TimelineExtra[];
  filtro?: string;
}) {
  const items = useMemo(() => {
    const fromHist: TimelineExtra[] = historico.map((ev) => ({
      key: `h:${ev.id}`,
      data: ev.data_inicio,
      titulo: EVENTO_LABELS[ev.tipo_evento] ?? ev.tipo_evento,
      detalhe:
        [
          ev.data_fim ? `até ${formatDate(ev.data_fim)}` : null,
          ev.motivo,
          ev.documento_referencia ? `Ref.: ${ev.documento_referencia}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
      tipo: ev.tipo_evento,
    }));
    const all = [...fromHist, ...extras].sort((a, b) =>
      b.data.localeCompare(a.data),
    );
    if (!filtro) return all;
    const q = filtro.toLowerCase();
    return all.filter(
      (i) =>
        i.titulo.toLowerCase().includes(q) ||
        (i.detalhe ?? "").toLowerCase().includes(q),
    );
  }, [historico, extras, filtro]);

  if (!items.length) {
    return <EmptyState title="Nenhum evento na linha do tempo" />;
  }

  return (
    <Card className="p-0">
      <ol className="relative border-l border-border pl-6 py-4 pr-4">
        {items.map((it) => (
          <li key={it.key} className="mb-4 last:mb-0">
            <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xs font-mono text-muted-foreground">
                {formatDate(it.data)}
              </span>
              <Badge variant="secondary">{it.titulo}</Badge>
            </div>
            {it.detalhe && (
              <p className="mt-1 text-sm text-muted-foreground">{it.detalhe}</p>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* ------------------------------- Lotações -------------------------------- */

export type LookupMap = Map<string, string>;

export function LotacoesTable({
  historico,
  unidades,
  setores,
  cargos,
  funcoes,
  loading,
}: {
  historico: HistoricoEvento[];
  unidades: LookupMap;
  setores: LookupMap;
  cargos: LookupMap;
  funcoes: LookupMap;
  loading?: boolean;
}) {
  type Row = ReturnType<typeof deriveLotacoes>[number];
  const rows = useMemo(() => deriveLotacoes(historico), [historico]);
  const cols: DataTableColumn<Row>[] = [
    { key: "inicio", header: "Início", cell: (r) => formatDate(r.data_inicio) },
    {
      key: "fim",
      header: "Fim",
      cell: (r) => (r.data_fim_efetiva ? formatDate(r.data_fim_efetiva) : "—"),
    },
    {
      key: "unidade",
      header: "Unidade",
      cell: (r) =>
        r.unidade_novo_id ? unidades.get(r.unidade_novo_id) ?? "—" : "—",
    },
    {
      key: "setor",
      header: "Setor",
      cell: (r) =>
        r.setor_novo_id ? setores.get(r.setor_novo_id) ?? "—" : "—",
    },
    {
      key: "cargo",
      header: "Cargo",
      cell: (r) =>
        r.cargo_novo_id ? cargos.get(r.cargo_novo_id) ?? "—" : "—",
    },
    {
      key: "funcao",
      header: "Função",
      cell: (r) =>
        r.funcao_novo_id ? funcoes.get(r.funcao_novo_id) ?? "—" : "—",
    },
    {
      key: "tipo",
      header: "Motivo",
      cell: (r) => (
        <span className="text-xs">
          {EVENTO_LABELS[r.tipo_evento] ?? r.tipo_evento}
          {r.motivo ? ` · ${r.motivo}` : ""}
        </span>
      ),
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (r) =>
        r.data_fim_efetiva ? (
          <Badge variant="outline">Encerrada</Badge>
        ) : (
          <Badge>Atual</Badge>
        ),
    },
  ];
  return (
    <DataTable<Row>
      columns={cols}
      rows={rows}
      getRowKey={(r) => r.id}
      loading={loading}
      emptyTitle="Sem lotações registradas"
      emptyDescription="Registre eventos funcionais (admissão, transferência) para popular o histórico de lotações."
    />
  );
}

/* ---------------------------- Movimentações ------------------------------ */

export function MovimentacoesTable({
  historico,
  loading,
}: {
  historico: HistoricoEvento[];
  loading?: boolean;
}) {
  const rows = useMemo(() => deriveMovimentacoes(historico), [historico]);
  const cols: DataTableColumn<HistoricoEvento>[] = [
    { key: "data", header: "Data", cell: (r) => formatDate(r.data_inicio) },
    {
      key: "tipo",
      header: "Tipo",
      cell: (r) => (
        <Badge variant="secondary">
          {EVENTO_LABELS[r.tipo_evento] ?? r.tipo_evento}
        </Badge>
      ),
    },
    { key: "motivo", header: "Motivo", cell: (r) => r.motivo ?? "—" },
    {
      key: "doc",
      header: "Documento",
      cell: (r) => r.documento_referencia ?? "—",
    },
  ];
  return (
    <DataTable<HistoricoEvento>
      columns={cols}
      rows={rows}
      getRowKey={(r) => r.id}
      loading={loading}
      emptyTitle="Sem movimentações registradas"
    />
  );
}

/* ------------------------------ Documentos ------------------------------- */

export type DossieDocumento = {
  id: string;
  tipo: string;
  descricao: string;
  assinado_em: string;
  assinado_por_nome: string | null;
};

export function DocumentosTab({
  docs,
  loading,
}: {
  docs: DossieDocumento[];
  loading?: boolean;
}) {
  if (loading) {
    return <Card className="p-6 text-sm text-muted-foreground">Carregando...</Card>;
  }
  if (!docs.length) {
    return (
      <EmptyState
        title="Nenhum documento cadastrado"
        description="Documentos assinados relacionados a este profissional aparecerão aqui. Estrutura preparada para expansão futura."
      />
    );
  }
  const cols: DataTableColumn<DossieDocumento>[] = [
    { key: "data", header: "Data", cell: (r) => formatDate(r.assinado_em) },
    { key: "tipo", header: "Tipo", cell: (r) => <Badge variant="secondary">{r.tipo}</Badge> },
    { key: "desc", header: "Descrição", cell: (r) => r.descricao },
    {
      key: "resp",
      header: "Responsável",
      cell: (r) => r.assinado_por_nome ?? "—",
    },
  ];
  return (
    <DataTable<DossieDocumento>
      columns={cols}
      rows={docs}
      getRowKey={(r) => r.id}
      emptyTitle="Nenhum documento cadastrado"
    />
  );
}

/* ---------------------------- Observações -------------------------------- */

export function ObservacoesTab({
  observacoes,
  atualizacoes,
}: {
  observacoes: string | null;
  atualizacoes: Array<{
    id: string | number;
    data: string;
    responsavel: string | null;
    operacao: string;
  }>;
}) {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4" /> Observações administrativas
        </h3>
        {observacoes ? (
          <p className="whitespace-pre-wrap text-sm">{observacoes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhuma observação registrada.
          </p>
        )}
      </Card>
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Histórico de alterações</h3>
        {!atualizacoes.length ? (
          <p className="text-sm text-muted-foreground">
            Sem alterações registradas na auditoria.
          </p>
        ) : (
          <ol className="divide-y">
            {atualizacoes.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  <Badge variant="outline" className="mr-2 capitalize">
                    {a.operacao}
                  </Badge>
                  {a.responsavel ?? "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(a.data)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------- Busca + Export ----------------------------- */

export function DossieToolbar({
  filtro,
  onFiltroChange,
  onExport,
}: {
  filtro: string;
  onFiltroChange: (v: string) => void;
  onExport: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filtro}
          onChange={(e) => onFiltroChange(e.target.value)}
          placeholder="Pesquisar no dossiê (movimentação, competência, motivo…)"
          className="pl-8"
        />
      </div>
      <Button size="sm" variant="outline" onClick={onExport}>
        <Download className="mr-1 h-4 w-4" /> Exportar CSV
      </Button>
    </div>
  );
}

/* ----------------------------- misc helper ------------------------------ */
export function useLocalFilter(initial = "") {
  return useState(initial);
}