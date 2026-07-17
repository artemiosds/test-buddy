import { createFileRoute } from "@tanstack/react-router";
import { Network, Users } from "lucide-react";

import { useAnalytics } from "@/hooks/use-analytics";
import { EmptyState, KpiCard, PageHeader } from "@/components/shared";

export const Route = createFileRoute("/_authenticated/gestao-pessoas/distribuicao-setor")({
  head: () => ({
    meta: [
      { title: "Distribuição por Setor — Gestão de Pessoas" },
      { name: "description", content: "Distribuição de profissionais por setor." },
    ],
  }),
  component: DistribuicaoSetor,
});

function DistribuicaoSetor() {
  const a = useAnalytics({});
  const rows = a.distribuicaoSetor.data ?? [];
  const total = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Distribuição por Setor"
        description="Quantidade de profissionais vinculados por setor (ordenado do maior para o menor)."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Setores com profissionais" value={rows.length.toLocaleString("pt-BR")} loading={a.distribuicaoSetor.isLoading} icon={<Network className="h-4 w-4" />} />
        <KpiCard label="Profissionais vinculados" value={total.toLocaleString("pt-BR")} loading={a.distribuicaoSetor.isLoading} icon={<Users className="h-4 w-4" />} />
        <KpiCard label="Total de setores" value={(a.totalSetores.data ?? 0).toLocaleString("pt-BR")} loading={a.totalSetores.isLoading} icon={<Network className="h-4 w-4" />} />
      </div>

      <div className="mt-6 rounded-md border">
        <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Distribuição por setor
        </div>
        {a.distribuicaoSetor.isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Carregando…</div>
        ) : rows.length === 0 ? (
          <EmptyState className="m-3" title="Sem distribuição registrada" description="Nenhum profissional vinculado a setores." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-muted-foreground">
                <th className="w-10 px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Setor</th>
                <th className="w-32 px-3 py-2 text-right">Profissionais</th>
                <th className="w-24 px-3 py-2 text-right">% do total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2">{r.nome}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{r.total.toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {total > 0 ? ((r.total / total) * 100).toFixed(1) : "0"}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}