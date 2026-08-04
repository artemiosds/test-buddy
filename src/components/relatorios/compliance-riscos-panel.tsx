/**
 * Motor de Mapeamento de Riscos e Anomalias (Compliance Público).
 * Validação cruzada antes de fechar qualquer folha:
 *  - Duplicidade / acúmulo de vínculos (mesmo CPF em duas folhas ativas na competência)
 *  - Malha fina cadastral (CPF inválido, dados bancários ausentes, carga horária irregular)
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ChevronDown, ShieldAlert, ShieldCheck, UserSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { cpfVisivel, type NivelPrivacidade } from "@/lib/lgpd";

type Duplicidade = {
  cpf: string;
  nome_completo: string;
  ano: number;
  mes: number;
  carga_total: number;
  ocorrencias: number;
  vinculos: { unidade: string | null; tipo: string }[];
};

type MalhaFina = {
  profissional_id: string;
  nome_completo: string;
  cpf: string | null;
  ano: number;
  mes: number;
  unidade: string | null;
  tipo: string;
  carga_horaria_semanal: number | null;
  cpf_invalido: boolean;
  banco_ausente: boolean;
  carga_irregular: boolean;
};

type Riscos = { duplicidades: Duplicidade[]; malha_fina: MalhaFina[] };

export function ComplianceRiscosPanel({
  competenciaId,
  unidadeId,
  nivel,
  enabled = true,
}: {
  competenciaId: string;
  unidadeId: string;
  nivel: NivelPrivacidade;
  enabled?: boolean;
}) {
  const [aberto, setAberto] = useState(false);

  const { data, isLoading, error } = useQuery<Riscos>({
    queryKey: ["compliance-riscos", competenciaId, unidadeId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("compliance_riscos", {
        _competencia_id: competenciaId === "all" ? null : competenciaId,
        _unidade_id: unidadeId === "all" ? null : unidadeId,
      } as never);
      if (error) throw error;
      const r = (data ?? {}) as Partial<Riscos>;
      return { duplicidades: r.duplicidades ?? [], malha_fina: r.malha_fina ?? [] };
    },
  });

  const total = (data?.duplicidades.length ?? 0) + (data?.malha_fina.length ?? 0);
  const severidade = useMemo(() => {
    if (isLoading || error) return "neutro";
    if ((data?.duplicidades.length ?? 0) > 0) return "critico";
    if (total > 0) return "atencao";
    return "ok";
  }, [data, isLoading, error, total]);

  return (
    <section className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {severidade === "ok" ? (
          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <ShieldAlert
            className={cn(
              "h-5 w-5 shrink-0",
              severidade === "critico" ? "text-destructive" : "text-amber-600",
            )}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Riscos e anomalias (compliance público)</span>
            {isLoading ? (
              <Badge variant="outline">Analisando...</Badge>
            ) : error ? (
              <Badge variant="outline">Indisponível</Badge>
            ) : total === 0 ? (
              <Badge variant="secondary">Nenhum apontamento</Badge>
            ) : (
              <>
                {!!data?.duplicidades.length && (
                  <Badge variant="destructive">{data.duplicidades.length} duplicidade(s)</Badge>
                )}
                {!!data?.malha_fina.length && (
                  <Badge variant="outline">{data.malha_fina.length} na malha fina</Badge>
                )}
              </>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Validação cruzada antes do fechamento: acúmulo de vínculos e pendência cadastral.
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            aberto && "rotate-180",
          )}
        />
      </button>

      {aberto && (
        <div className="space-y-4 border-t p-4">
          <Bloco
            icone={<AlertTriangle className="h-4 w-4 text-destructive" />}
            titulo="Duplicidade e acúmulo de vínculos"
            descricao="Mesmo CPF em mais de uma folha ativa na mesma competência."
            vazio="Nenhum acúmulo de vínculo identificado."
            vazioOk
            itens={data?.duplicidades ?? []}
            render={(d: Duplicidade) => (
              <tr key={`${d.cpf}-${d.ano}-${d.mes}`} className="border-t">
                <td className="px-3 py-2">{d.nome_completo}</td>
                <td className="px-3 py-2 font-mono text-xs">{cpfVisivel(d.cpf, nivel)}</td>
                <td className="px-3 py-2">
                  {String(d.mes).padStart(2, "0")}/{d.ano}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {d.vinculos.map((v, i) => (
                      <Badge key={i} variant="outline" className="text-[11px]">
                        {v.unidade ?? "—"} · {v.tipo}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {d.carga_total > 44 ? (
                    <Badge variant="destructive">{d.carga_total}h/sem</Badge>
                  ) : (
                    `${d.carga_total}h/sem`
                  )}
                </td>
              </tr>
            )}
            cabecalho={["Profissional", "CPF", "Competência", "Vínculos ativos", "Carga somada"]}
          />

          <Bloco
            icone={<UserSearch className="h-4 w-4 text-amber-600" />}
            titulo="Malha fina cadastral"
            descricao="Profissionais na folha com pendência documental."
            vazio="Nenhuma pendência cadastral nas folhas filtradas."
            vazioOk
            itens={data?.malha_fina ?? []}
            render={(m: MalhaFina) => (
              <tr key={`${m.profissional_id}-${m.ano}-${m.mes}`} className="border-t">
                <td className="px-3 py-2">{m.nome_completo}</td>
                <td className="px-3 py-2 font-mono text-xs">{cpfVisivel(m.cpf, nivel)}</td>
                <td className="px-3 py-2">{m.unidade ?? "—"}</td>
                <td className="px-3 py-2">
                  {String(m.mes).padStart(2, "0")}/{m.ano}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {m.cpf_invalido && <Badge variant="destructive">CPF inválido</Badge>}
                    {m.banco_ausente && <Badge variant="outline">Sem dados bancários</Badge>}
                    {m.carga_irregular && (
                      <Badge variant="outline">Carga {m.carga_horaria_semanal ?? 0}h</Badge>
                    )}
                  </div>
                </td>
              </tr>
            )}
            cabecalho={["Profissional", "CPF", "Unidade", "Competência", "Inconformidades"]}
          />

          {error && (
            <p className="text-xs text-muted-foreground">
              Não foi possível executar a análise agora. Tente atualizar a página.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Bloco<T>({
  icone,
  titulo,
  descricao,
  itens,
  cabecalho,
  render,
  vazio,
}: {
  icone: React.ReactNode;
  titulo: string;
  descricao: string;
  itens: T[];
  cabecalho: string[];
  render: (item: T) => React.ReactNode;
  vazio: string;
  vazioOk?: boolean;
}) {
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const visiveis = mostrarTodos ? itens : itens.slice(0, 8);
  return (
    <div>
      <div className="mb-2 flex items-start gap-2">
        <span className="mt-0.5">{icone}</span>
        <div>
          <h3 className="text-sm font-semibold">{titulo}</h3>
          <p className="text-xs text-muted-foreground">{descricao}</p>
        </div>
      </div>
      {itens.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground">
          {vazio}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  {cabecalho.map((h, i) => (
                    <th
                      key={h}
                      className={cn("px-3 py-2", i === cabecalho.length - 1 && "text-left")}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>{visiveis.map((i) => render(i))}</tbody>
            </table>
          </div>
          {itens.length > 8 && (
            <div className="border-t bg-muted/30 px-3 py-2">
              <Button variant="ghost" size="sm" onClick={() => setMostrarTodos((v) => !v)}>
                {mostrarTodos ? "Mostrar menos" : `Ver todos (${itens.length})`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
