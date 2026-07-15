import React, { useContext } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { AnalyticsFilterContext } from "@/context/analytics-filter-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function AnalyticsFilters() {
  const ctx = useContext(AnalyticsFilterContext);
  const setFilters = ctx.setFilters!;

  const { data: competencias } = useQuery({
    queryKey: ["analytics", "competencias"],
    queryFn: async () => {
      const { data } = await supabase.from("competencias").select("id,mes,ano,status").is("deleted_at", null).order("ano", { ascending: false }).order("mes", { ascending: false });
      return data ?? [];
    },
  });

  const { data: unidades } = useQuery({
    queryKey: ["analytics", "unidades"],
    queryFn: async () => {
      const { data } = await supabase.from("unidades").select("id,nome,sigla").is("deleted_at", null).eq("status", "ativa").order("nome");
      return data ?? [];
    },
  });

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6 mb-4">
      <div>
        <label className="text-xs text-muted-foreground">Competência</label>
        <Select value={ctx.competenciaId ?? ""} onValueChange={(v) => setFilters({ competenciaId: v || null })}>
          <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas</SelectItem>
            {competencias?.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{`${c.mes}/${c.ano}`}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Unidade</label>
        <Select value={ctx.unidadeId ?? ""} onValueChange={(v) => setFilters({ unidadeId: v || null })}>
          <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas</SelectItem>
            {unidades?.map((u: any) => (
              <SelectItem key={u.id} value={u.id}>{u.sigla ? `${u.sigla} — ${u.nome}` : u.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Status</label>
        <Select value={ctx.status ?? ""} onValueChange={(v) => setFilters({ status: v || null })}>
          <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
