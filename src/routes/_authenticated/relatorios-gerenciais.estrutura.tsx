import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Building2, ChevronDown, ChevronRight, Download, Network, User, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterBar } from "@/components/shared/FilterBar";
import { KpiCard } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { downloadCsv } from "@/lib/csv-export";
import { getOrganograma, type OrgUnidade } from "@/lib/relatorios-gerenciais";
import { useUnidadesLookup } from "@/hooks/use-lookups";

export const Route = createFileRoute("/_authenticated/relatorios-gerenciais/estrutura")({
  component: EstruturaOrganizacional,
});

function EstruturaOrganizacional() {
  const [unidadeId, setUnidadeId] = useState<string>("");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const unidades = useUnidadesLookup();

  const { data = [], isLoading } = useQuery({
    queryKey: ["rel-ger", "organograma", unidadeId || null],
    queryFn: () => getOrganograma(unidadeId || null),
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    return data
      .map((u) => {
        const setores = u.setores
          .map((s) => ({
            ...s,
            profissionais: s.profissionais.filter((p) => p.nome_completo.toLowerCase().includes(needle)),
          }))
          .filter((s) => s.nome.toLowerCase().includes(needle) || s.profissionais.length > 0);
        const semSetor = u.sem_setor.filter((p) => p.nome_completo.toLowerCase().includes(needle));
        return { ...u, setores, sem_setor: semSetor };
      })
      .filter((u) => u.nome.toLowerCase().includes(needle) || u.setores.length > 0 || u.sem_setor.length > 0);
  }, [data, q]);

  const totals = useMemo(() => ({
    unidades: filtered.length,
    setores: filtered.reduce((a, u) => a + u.setores.length, 0),
    profissionais: filtered.reduce((a, u) => a + u.sem_setor.length + u.setores.reduce((b, s) => b + s.profissionais.length, 0), 0),
  }), [filtered]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function expandAll() { setExpanded(new Set(filtered.flatMap((u) => [u.id, ...u.setores.map((s) => s.id)]))); }
  function collapseAll() { setExpanded(new Set()); }

  function exportCsv() {
    type Flat = { unidade: string; diretor: string; setor: string; coordenador: string; nome: string; cargo: string; funcao: string; status: string };
    const rows: Flat[] = [];
    for (const u of filtered) {
      for (const s of u.setores) {
        for (const p of s.profissionais) {
          rows.push({ unidade: u.nome, diretor: u.diretor ?? "", setor: s.nome, coordenador: s.coordenador ?? "", nome: p.nome_completo, cargo: p.cargo_nome ?? "", funcao: p.funcao_nome ?? "", status: p.status ?? "" });
        }
      }
      for (const p of u.sem_setor) {
        rows.push({ unidade: u.nome, diretor: u.diretor ?? "", setor: "(sem setor)", coordenador: "", nome: p.nome_completo, cargo: p.cargo_nome ?? "", funcao: p.funcao_nome ?? "", status: p.status ?? "" });
      }
    }
    downloadCsv("estrutura-organizacional.csv", rows, [
      { header: "Unidade", value: (r) => r.unidade },
      { header: "Diretor", value: (r) => r.diretor },
      { header: "Setor", value: (r) => r.setor },
      { header: "Coordenador", value: (r) => r.coordenador },
      { header: "Profissional", value: (r) => r.nome },
      { header: "Cargo", value: (r) => r.cargo },
      { header: "Função", value: (r) => r.funcao },
      { header: "Status", value: (r) => r.status },
    ]);
  }

  return (
    <div className="space-y-4">
      <FilterBar
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={expandAll}>Expandir tudo</Button>
            <Button size="sm" variant="ghost" onClick={collapseAll}>Recolher</Button>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filtered.length}><Download className="mr-1 h-4 w-4" /> CSV</Button>
          </div>
        }
      >
        <FilterBar.Field label="Unidade">
          <Select value={unidadeId || "__all__"} onValueChange={(v) => setUnidadeId(v === "__all__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as unidades</SelectItem>
              {(unidades.data ?? []).map((u) => (<SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="Buscar (unidade, setor, profissional)">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome..." />
        </FilterBar.Field>
      </FilterBar>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Unidades" value={totals.unidades} />
        <KpiCard label="Setores" value={totals.setores} />
        <KpiCard label="Profissionais" value={totals.profissionais} />
      </div>

      {isLoading && <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">Carregando organograma…</div>}
      {!isLoading && filtered.length === 0 && <EmptyState title="Nenhuma unidade" description="Ajuste os filtros ou a busca." />}

      <div className="space-y-2">
        {filtered.map((u) => (<UnidadeNode key={u.id} unidade={u} expanded={expanded} onToggle={toggle} />))}
      </div>
    </div>
  );
}

function UnidadeNode({ unidade, expanded, onToggle }: { unidade: OrgUnidade; expanded: Set<string>; onToggle: (id: string) => void }) {
  const open = expanded.has(unidade.id);
  const total = unidade.sem_setor.length + unidade.setores.reduce((a, s) => a + s.profissionais.length, 0);
  return (
    <div className="rounded-md border bg-card">
      <button
        type="button"
        onClick={() => onToggle(unidade.id)}
        className="flex w-full items-center gap-2 p-3 text-left hover:bg-muted/40"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Building2 className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <div className="font-semibold">{unidade.nome}{unidade.sigla ? <span className="ml-1 text-xs text-muted-foreground">({unidade.sigla})</span> : null}</div>
          <div className="text-xs text-muted-foreground">
            <UserCog className="mr-1 inline h-3 w-3" />
            Diretor: {unidade.diretor ?? "não informado"} · {unidade.setores.length} setor(es) · {total} profissional(is)
          </div>
        </div>
      </button>
      {open && (
        <div className="border-t bg-muted/20 p-3 space-y-2">
          {unidade.setores.length === 0 && unidade.sem_setor.length === 0 && (
            <div className="text-xs text-muted-foreground">Sem setores nem profissionais lotados.</div>
          )}
          {unidade.setores.map((s) => {
            const so = expanded.has(s.id);
            return (
              <div key={s.id} className="rounded border bg-card">
                <button
                  type="button"
                  onClick={() => onToggle(s.id)}
                  className="flex w-full items-center gap-2 p-2 text-left hover:bg-muted/40"
                >
                  {so ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <Network className="h-4 w-4 text-primary/80" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{s.nome}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Coordenador: {s.coordenador ?? "não informado"} · {s.profissionais.length} profissional(is)
                    </div>
                  </div>
                </button>
                {so && s.profissionais.length > 0 && (
                  <ul className="divide-y border-t text-sm">
                    {s.profissionais.map((p) => (
                      <li key={p.id} className="flex items-center gap-2 p-2">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="flex-1">{p.nome_completo}</span>
                        <span className="text-xs text-muted-foreground">{p.cargo_nome ?? "—"}</span>
                        {p.funcao_nome && <span className="text-xs text-muted-foreground">· {p.funcao_nome}</span>}
                        {p.status && p.status !== "ativo" && <span className="rounded-full bg-amber-100 px-2 text-[10px] uppercase text-amber-700">{p.status}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          {unidade.sem_setor.length > 0 && (
            <div className="rounded border border-dashed bg-card">
              <div className="p-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profissionais sem setor ({unidade.sem_setor.length})</div>
              <ul className="divide-y border-t text-sm">
                {unidade.sem_setor.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 p-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="flex-1">{p.nome_completo}</span>
                    <span className="text-xs text-muted-foreground">{p.cargo_nome ?? "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}