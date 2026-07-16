import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { iniciarFrequencia } from "@/lib/competencias.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, FileText } from "lucide-react";
import { usePermissions, useCurrentUser } from "@/hooks/use-permissions";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/frequencias")({
  component: FrequenciasPage,
});

type TipoFreq = Database["public"]["Enums"]["tipo_frequencia"];

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function FrequenciasPage() {
  const { has } = usePermissions();
  const { data: me } = useCurrentUser();
  const qc = useQueryClient();
  const [competenciaId, setCompetenciaId] = useState<string>("");
  const [tipoFiltro, setTipoFiltro] = useState<TipoFreq | "todos">("todos");
  const [busca, setBusca] = useState("");

  const { data: competencias } = useQuery({
    queryKey: ["competencias-lista"],
    queryFn: async () => {
      const { data } = await supabase.from("competencias")
        .select("id, ano, mes, status")
        .is("deleted_at", null)
        .order("ano", { ascending: false })
        .order("mes", { ascending: false });
      const list = data ?? [];
      if (list.length && !competenciaId) setCompetenciaId(list[0].id);
      return list;
    },
  });

  const { data: unidadesComp } = useQuery({
    queryKey: ["competencia-unidades-freq", competenciaId],
    enabled: !!competenciaId,
    queryFn: async () => {
      const { data, error } = await supabase.from("competencia_unidades")
        .select("id, unidade_id, status, unidades(id, nome, sigla, cnes)")
        .eq("competencia_id", competenciaId)
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: frequencias } = useQuery({
    queryKey: ["frequencias", competenciaId],
    enabled: !!competenciaId && !!unidadesComp?.length,
    queryFn: async () => {
      const cuIds = unidadesComp!.map((u) => u.id);
      const { data, error } = await supabase.from("frequencias")
        .select("id, competencia_unidade_id, tipo, status, total_profissionais, data_envio, data_aprovacao")
        .in("competencia_unidade_id", cuIds)
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const freqIds = (frequencias ?? []).map((f) => f.id);
  const { data: pendCountByFreq } = useQuery({
    queryKey: ["pendencias-por-frequencia", competenciaId, freqIds],
    enabled: freqIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("frequencia_pendencias")
        .select("frequencia_id, status")
        .in("frequencia_id", freqIds)
        .in("status", ["aberta", "respondida"])
        .is("deleted_at", null);
      if (error) throw error;
      const m = new Map<string, number>();
      (data ?? []).forEach((p) => m.set(p.frequencia_id, (m.get(p.frequencia_id) ?? 0) + 1));
      return m;
    },
  });

  const iniciarFn = useServerFn(iniciarFrequencia);

  const criarMutation = useMutation({
    mutationFn: async ({ cuId, tipo }: { cuId: string; tipo: TipoFreq }) => {
      return await iniciarFn({ data: { competencia_unidade_id: cuId, tipo } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["frequencias", competenciaId] });
      toast.success("Frequência criada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canCriar = has("frequencia.criar");

  const rows = (unidadesComp ?? [])
    .filter((u) => {
      if (!busca) return true;
      const q = busca.toLowerCase();
      const nome = u.unidades?.nome?.toLowerCase() ?? "";
      const sigla = u.unidades?.sigla?.toLowerCase() ?? "";
      return nome.includes(q) || sigla.includes(q);
    })
    .flatMap((u) => {
      const tipos: TipoFreq[] = tipoFiltro === "todos" ? ["contratados", "efetivos"] : [tipoFiltro];
      return tipos.map((tipo) => {
        const freq = frequencias?.find((f) => f.competencia_unidade_id === u.id && f.tipo === tipo);
        return { cu: u, tipo, freq };
      });
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Frequências Mensais</h1>
        <p className="text-sm text-muted-foreground">Planilhas de frequência por unidade e vínculo.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <div className="flex-1 min-w-[240px]">
          <label className="text-xs text-muted-foreground">Competência</label>
          <Select value={competenciaId} onValueChange={setCompetenciaId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {competencias?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{MESES[c.mes - 1]}/{c.ano} · {c.status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <label className="text-xs text-muted-foreground">Tipo</label>
          <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as TipoFreq | "todos")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="contratados">Contratados</SelectItem>
              <SelectItem value="efetivos">Efetivos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[240px]">
          <label className="text-xs text-muted-foreground">Buscar unidade</label>
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou sigla..." />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {!competenciaId ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Selecione uma competência.</div>
        ) : !unidadesComp?.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma unidade vinculada nesta competência. Acesse a competência para vincular unidades.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr className="text-left">
                <th className="p-3">Unidade</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Profissionais</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ cu, tipo, freq }) => (
                <tr key={`${cu.id}-${tipo}`} className="border-b last:border-0">
                  <td className="p-3">
                    <div className="font-medium">{cu.unidades?.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {cu.unidades?.sigla} · CNES {cu.unidades?.cnes ?? "—"}
                    </div>
                  </td>
                  <td className="p-3 capitalize">{tipo}</td>
                  <td className="p-3">{freq?.total_profissionais ?? "—"}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {freq ? (
                        <StatusBadge domain="frequencia" value={freq.status} />
                      ) : (
                        <Badge variant="outline">Não iniciada</Badge>
                      )}
                      {freq && (pendCountByFreq?.get(freq.id) ?? 0) > 0 && (
                        <Badge variant="destructive" title="Pendências em aberto/respondidas">
                          {pendCountByFreq!.get(freq.id)} pend.
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    {freq ? (
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/frequencias/$id" params={{ id: freq.id }}>
                          <FileText className="mr-1 h-4 w-4" />Abrir
                        </Link>
                      </Button>
                    ) : canCriar ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => criarMutation.mutate({ cuId: cu.id, tipo })}
                        disabled={criarMutation.isPending}
                      >
                        <Plus className="mr-1 h-4 w-4" />Iniciar
                      </Button>
                    ) : null}
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
