import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, Coins, Database, Loader2, ThumbsUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getHsmEstatisticas } from "@/lib/hsm-config.functions";
import { agentePorSlug } from "@/lib/hsm/agentes";

type Resumo = {
  eventos?: number;
  sucessos?: number;
  erros?: number;
  cache_hits?: number;
  consultas?: number;
  tokens?: number;
  custo_usd?: number;
  duracao_media_ms?: number;
  usuarios?: number;
};

type Stats = {
  resumo?: Resumo;
  por_modelo?: { modelo: string; provedor: string; eventos: number; tokens: number; custo_usd: number }[];
  por_ferramenta?: { ferramenta: string; eventos: number; erros: number; cache_hits: number }[];
  por_agente?: { agente: string; eventos: number; erros: number }[];
  erros_recentes?: { created_at: string; ferramenta: string | null; modelo: string | null; erro: string }[];
  feedback?: { total?: number; positivos?: number; negativos?: number };
};

const PERIODOS = [7, 30, 90] as const;

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function Kpi({
  icone,
  titulo,
  valor,
  detalhe,
}: {
  icone: React.ReactNode;
  titulo: string;
  valor: string;
  detalhe?: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icone}
        {titulo}
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums">{valor}</p>
      {detalhe ? <p className="text-[11px] text-muted-foreground">{detalhe}</p> : null}
    </div>
  );
}

/** Fase 7 — painel gerencial de uso do HSM Expert (somente perfil Master). */
export function HsmEstatisticas() {
  const buscar = useServerFn(getHsmEstatisticas);
  const [dias, setDias] = useState<number>(30);

  const stats = useQuery({
    queryKey: ["hsm-estatisticas", dias],
    queryFn: async () => (await buscar({ data: { dias } })) as Stats,
    retry: false,
  });

  if (stats.isError) {
    return (
      <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        Estatísticas disponíveis apenas para o perfil Master.
      </p>
    );
  }

  const r = stats.data?.resumo ?? {};
  const eventos = num(r.eventos);
  const cacheTaxa = eventos ? Math.round((num(r.cache_hits) / eventos) * 100) : 0;
  const erroTaxa = eventos ? Math.round((num(r.erros) / eventos) * 100) : 0;
  const fb = stats.data?.feedback ?? {};
  const fbTotal = num(fb.total);
  const satisfacao = fbTotal ? Math.round((num(fb.positivos) / fbTotal) * 100) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label>Estatísticas de uso</Label>
          <p className="text-xs text-muted-foreground">
            Consumo, custo estimado, cache, falhas e satisfação dos usuários.
          </p>
        </div>
        <div className="flex gap-1">
          {PERIODOS.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={p === dias ? "default" : "outline"}
              onClick={() => setDias(p)}
            >
              {p}d
            </Button>
          ))}
        </div>
      </div>

      {stats.isLoading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Carregando estatísticas...
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              icone={<Activity className="size-3.5" />}
              titulo="Interações"
              valor={eventos.toLocaleString("pt-BR")}
              detalhe={`${num(r.usuarios)} usuário(s) · ${num(r.duracao_media_ms)}ms médios`}
            />
            <Kpi
              icone={<Coins className="size-3.5" />}
              titulo="Custo estimado"
              valor={`US$ ${num(r.custo_usd).toFixed(4)}`}
              detalhe={`${num(r.tokens).toLocaleString("pt-BR")} tokens`}
            />
            <Kpi
              icone={<Database className="size-3.5" />}
              titulo="Cache"
              valor={`${cacheTaxa}%`}
              detalhe={`${num(r.cache_hits)} de ${num(r.consultas)} consultas`}
            />
            <Kpi
              icone={<AlertTriangle className="size-3.5" />}
              titulo="Falhas"
              valor={`${erroTaxa}%`}
              detalhe={`${num(r.erros)} evento(s) com erro`}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium">Por modelo</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {(stats.data?.por_modelo ?? []).slice(0, 8).map((m) => (
                  <li key={`${m.provedor}-${m.modelo}`} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {m.modelo} <span className="opacity-60">({m.provedor})</span>
                    </span>
                    <span className="tabular-nums">
                      {m.eventos} · US$ {num(m.custo_usd).toFixed(4)}
                    </span>
                  </li>
                ))}
                {(stats.data?.por_modelo ?? []).length === 0 ? <li>Sem dados no período.</li> : null}
              </ul>
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium">Por agente</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {(stats.data?.por_agente ?? []).map((a) => (
                  <li key={a.agente} className="flex items-center justify-between gap-2">
                    <span className="truncate">{agentePorSlug(a.agente).nome}</span>
                    <span className="tabular-nums">
                      {a.eventos}
                      {a.erros ? ` · ${a.erros} erro(s)` : ""}
                    </span>
                  </li>
                ))}
                {(stats.data?.por_agente ?? []).length === 0 ? <li>Sem dados no período.</li> : null}
              </ul>
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium">Ferramentas mais usadas</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {(stats.data?.por_ferramenta ?? []).slice(0, 8).map((f) => (
                  <li key={f.ferramenta} className="flex items-center justify-between gap-2">
                    <span className="truncate">{f.ferramenta}</span>
                    <span className="tabular-nums">
                      {f.eventos}
                      {f.cache_hits ? ` · ${f.cache_hits} cache` : ""}
                    </span>
                  </li>
                ))}
                {(stats.data?.por_ferramenta ?? []).length === 0 ? <li>Sem dados no período.</li> : null}
              </ul>
            </div>

            <div className="rounded-lg border p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <ThumbsUp className="size-3.5" /> Satisfação
              </p>
              <p className="mt-2 text-xl font-semibold tabular-nums">
                {satisfacao === null ? "—" : `${satisfacao}%`}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {num(fb.positivos)} positivo(s) · {num(fb.negativos)} negativo(s)
              </p>
            </div>
          </div>

          {(stats.data?.erros_recentes ?? []).length > 0 ? (
            <div className="rounded-lg border border-destructive/30 p-3">
              <p className="text-xs font-medium">Falhas recentes</p>
              <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                {(stats.data?.erros_recentes ?? []).slice(0, 8).map((e, i) => (
                  <li key={`${e.created_at}-${i}`} className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      {new Date(e.created_at).toLocaleString("pt-BR")}
                    </Badge>
                    {e.ferramenta ? <span className="font-medium">{e.ferramenta}</span> : null}
                    <span className="truncate">{e.erro}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
