import { createFileRoute } from "@tanstack/react-router";
import { Building2, Users } from "lucide-react";

import { useAnalytics } from "@/hooks/use-analytics";
import { EmptyState, KpiCard, PageHeader } from "@/components/shared";

export const Route = createFileRoute("/_authenticated/gestao-pessoas/lotacao")({
  head: () => ({
    meta: [
      { title: "Lotação das Unidades — Gestão de Pessoas" },
      { name: "description", content: "Distribuição de profissionais por unidade." },
    ],
  }),
  component: Lotacao,
});

function Lotacao() {
  const a = useAnalytics({});
  const rows = a.distribuicaoUnidade.data ?? [];
  const total = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Lotação das Unidades"
        description="Quantidade de profissionais lotados por unidade (ordenado do maior para o menor)."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Unidades com profissionais" value={rows.length.toLocaleString("pt-BR")} loading={a.distribuicaoUnidade.isLoading} icon={<Building2 className="h-4 w-4" />} />
        <KpiCard label="Profissionais lotados" value={total.toLocaleString("pt-BR")} loading={a.distribuicaoUnidade.isLoading} icon={<Users className="h-4 w-4" />} />
        <KpiCard label="Total de unidades" value={(a.totalUnidades.data ?? 0).toLocaleString("pt-BR")} loading={a.totalUnidades.isLoading} icon={<Building2 className="h-4 w-4" />} />
      </div>

      <div className="mt-6 rounded-md border">
        <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Lotação por unidade
        </div>
        {a.distribuicaoUnidade.isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Carregando…</div>
        ) : rows.length === 0 ? (
          <EmptyState className="m-3" title="Sem lotação registrada" description="Nenhum profissional vinculado a unidades." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-muted-foreground">
                <th className="w-10 px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Unidade</th>
                <th className="w-32 px-3 py-2 text-right">Profissionais</th>
                <th className="w-24 px-3 py-2 text-right">% do total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2">{r.sigla ? `${r.sigla} — ${r.nome}` : r.nome}</td>
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