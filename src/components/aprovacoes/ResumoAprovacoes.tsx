import {
  Building2,
  CheckCircle2,
  ClipboardList,
  FileStack,
  ScanSearch,
  Users,
  XCircle,
} from "lucide-react";
import { KpiCard } from "@/components/shared";
import type { FreqRow } from "./tipos";

export type ResumoCounts = {
  total: number;
  em_analise: number;
  aprovadas: number;
  rejeitadas: number;
  com_pendencias: number;
  profissionais: number;
  unidades: number;
};

/** Calcula os números do painel a partir das frequências da competência. */
export function calcularResumo(rows: FreqRow[]): ResumoCounts {
  const unidades = new Set<string>();
  let profissionais = 0;
  let em_analise = 0;
  let aprovadas = 0;
  let rejeitadas = 0;
  let com_pendencias = 0;

  for (const r of rows) {
    const uid = r.competencia_unidades?.unidade_id;
    if (uid) unidades.add(uid);
    profissionais += r.total_profissionais ?? 0;
    if (r.status === "enviada" || r.status === "em_analise") em_analise += 1;
    if (r.status === "aprovada") aprovadas += 1;
    if (r.status === "rejeitada") rejeitadas += 1;
    if (r.status === "com_pendencias" || (r.status as string) === "devolvida") com_pendencias += 1;
  }

  return {
    total: rows.length,
    em_analise,
    aprovadas,
    rejeitadas,
    com_pendencias,
    profissionais,
    unidades: unidades.size,
  };
}

type Props = {
  resumo: ResumoCounts;
  loading?: boolean;
  onFiltrar: (status: string) => void;
};

/** Cartões de resumo da competência selecionada. Clique aplica o filtro de status. */
export function ResumoAprovacoes({ resumo, loading, onFiltrar }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      <KpiCard
        label="Total enviadas"
        value={resumo.total}
        icon={<FileStack />}
        iconTone="info"
        loading={loading}
        onClick={() => onFiltrar("todas")}
      />
      <KpiCard
        label="Em análise"
        value={resumo.em_analise}
        icon={<ScanSearch />}
        iconTone="info"
        loading={loading}
        onClick={() => onFiltrar("pendentes")}
      />
      <KpiCard
        label="Aprovadas"
        value={resumo.aprovadas}
        icon={<CheckCircle2 />}
        iconTone="success"
        tone="success"
        loading={loading}
        onClick={() => onFiltrar("aprovada")}
      />
      <KpiCard
        label="Rejeitadas"
        value={resumo.rejeitadas}
        icon={<XCircle />}
        iconTone="danger"
        tone="danger"
        loading={loading}
        onClick={() => onFiltrar("rejeitada")}
      />
      <KpiCard
        label="Com pendências"
        value={resumo.com_pendencias}
        icon={<ClipboardList />}
        iconTone="warning"
        tone="warning"
        loading={loading}
        onClick={() => onFiltrar("com_pendencias")}
      />
      <KpiCard
        label="Profissionais"
        value={resumo.profissionais}
        icon={<Users />}
        iconTone="neutral"
        loading={loading}
        description="Soma das folhas enviadas"
      />
      <KpiCard
        label="Unidades"
        value={resumo.unidades}
        icon={<Building2 />}
        iconTone="primary"
        loading={loading}
        description="Com envios na competência"
      />
    </div>
  );
}

export default ResumoAprovacoes;
