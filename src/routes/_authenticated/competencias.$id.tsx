import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  vincularUnidadesCompetencia,
  desvincularUnidadeCompetencia,
} from "@/lib/competencias.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { usePermissions, useCurrentUser } from "@/hooks/use-permissions";
import type { Database } from "@/integrations/supabase/types";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/_authenticated/competencias/$id")({
  component: DetalhePage,
});

type StatusCU = Database["public"]["Enums"]["status_competencia_unidade"];

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const CU_LABEL: Record<StatusCU, string> = {
  nao_iniciada: "Não iniciada",
  em_elaboracao: "Em elaboração",
  enviada: "Enviada",
  em_analise: "Em análise",
  com_pendencias: "Com pendências",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
  arquivada: "Arquivada",
};

const CU_VARIANT: Record<StatusCU, "default" | "secondary" | "outline" | "destructive"> = {
  nao_iniciada: "outline",
  em_elaboracao: "secondary",
  enviada: "default",
  em_analise: "secondary",
  com_pendencias: "destructive",
  aprovada: "default",
  rejeitada: "destructive",
  arquivada: "outline",
};

function DetalhePage() {
  const { id } = Route.useParams();
  const { has } = usePermissions();
  const { data: me } = useCurrentUser();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: competencia } = useQuery({
    queryKey: ["competencia", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("competencias")
        .select("id, ano, mes, status, secretaria_id, data_inicio, data_fim")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: unidades } = useQuery({
    queryKey: ["unidades-secretaria", competencia?.secretaria_id],
    enabled: !!competencia?.secretaria_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("unidades")
        .select("id, nome, sigla, cnes")
        .eq("secretaria_id", competencia!.secretaria_id)
        .eq("status", "ativa")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: vinculadas } = useQuery({
    queryKey: ["competencia-unidades", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("competencia_unidades")
        .select("id, unidade_id, status, data_envio, data_aprovacao, observacoes")
        .eq("competencia_id", id)
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const vinculadaMap = useMemo(() => {
    const m = new Map<string, NonNullable<typeof vinculadas>[number]>();
    (vinculadas ?? []).forEach((v) => m.set(v.unidade_id, v));
    return m;
  }, [vinculadas]);

  const naoVinculadas = (unidades ?? []).filter((u) => !vinculadaMap.has(u.id));

  const vincularFn = useServerFn(vincularUnidadesCompetencia);
  const desvincularFn = useServerFn(desvincularUnidadeCompetencia);

  const vincularMutation = useMutation({
    mutationFn: async (unidadeIds: string[]) => {
      await vincularFn({ data: { competencia_id: id, unidade_ids: unidadeIds } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competencia-unidades", id] });
      setSelected(new Set());
      toast.success("Unidades vinculadas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const desvincularMutation = useMutation({
    mutationFn: async (cuId: string) => {
      await desvincularFn({ data: { id: cuId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competencia-unidades", id] });
      toast.success("Unidade desvinculada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canGerenciar = has("competencia.editar") || has("competencia.criar");

  if (!competencia) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }

  const encerrada = competencia.status !== "aberta";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/competencias"><ArrowLeft className="mr-1 h-4 w-4" />Voltar</Link>
          </Button>
          <h1 className="mt-2 text-2xl font-semibold">
            Competência {MESES[competencia.mes - 1]}/{competencia.ano}
          </h1>
          <p className="text-sm text-muted-foreground">Gestão de unidades vinculadas.</p>
        </div>
        <Badge variant={competencia.status === "aberta" ? "default" : "outline"}>
          {competencia.status}
        </Badge>
      </div>

      <section className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b p-3">
          <h2 className="font-medium">Unidades vinculadas ({vinculadas?.length ?? 0})</h2>
        </div>
        {!vinculadas?.length ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma unidade vinculada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr className="text-left">
                <th className="p-3">Unidade</th>
                <th className="p-3">Status</th>
                <th className="p-3">Envio</th>
                <th className="p-3">Aprovação</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {vinculadas.map((v) => {
                const u = unidades?.find((x) => x.id === v.unidade_id);
                return (
                  <tr key={v.id} className="border-b last:border-0">
                    <td className="p-3">
                      <div className="font-medium">{u?.nome ?? v.unidade_id}</div>
                      <div className="text-xs text-muted-foreground">{u?.sigla} · CNES {u?.cnes ?? "—"}</div>
                    </td>
                    <td className="p-3"><Badge variant={CU_VARIANT[v.status]}>{CU_LABEL[v.status]}</Badge></td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {v.data_envio ? new Date(v.data_envio).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {v.data_aprovacao ? new Date(v.data_aprovacao).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="p-3 text-right">
                      {canGerenciar && !encerrada && v.status === "nao_iniciada" && (
                        <Button size="sm" variant="ghost" onClick={() => desvincularMutation.mutate(v.id)}>
                          Desvincular
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {canGerenciar && !encerrada && naoVinculadas.length > 0 && (
        <section className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b p-3">
            <h2 className="font-medium">Vincular unidades ({naoVinculadas.length} disponíveis)</h2>
            <Button
              size="sm"
              disabled={selected.size === 0 || vincularMutation.isPending}
              onClick={() => vincularMutation.mutate(Array.from(selected))}
            >
              Vincular selecionadas ({selected.size})
            </Button>
          </div>
          <div className="max-h-96 overflow-auto p-3 space-y-1">
            {naoVinculadas.map((u) => (
              <label key={u.id} className="flex items-center gap-3 rounded p-2 hover:bg-muted/50 cursor-pointer">
                <Checkbox
                  checked={selected.has(u.id)}
                  onCheckedChange={(c) => {
                    const s = new Set(selected);
                    if (c) s.add(u.id); else s.delete(u.id);
                    setSelected(s);
                  }}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">{u.nome}</div>
                  <div className="text-xs text-muted-foreground">{u.sigla} · CNES {u.cnes ?? "—"}</div>
                </div>
              </label>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
