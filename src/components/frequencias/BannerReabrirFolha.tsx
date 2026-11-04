import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ReabrirFolhaDialog } from "@/components/aprovacoes/ReabrirFolhaDialog";

/** Atalho no topo da folha aprovada para Master/Gestor reabrirem para retificação. */
export function BannerReabrirFolha({
  visivel,
  frequenciaId,
  tipo,
  competenciaId,
  unidadeId,
  setorId,
}: {
  visivel: boolean;
  frequenciaId?: string | null;
  tipo: "efetivos" | "contratados";
  competenciaId?: string | null;
  unidadeId?: string | null;
  setorId?: string | null;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const { data: idResolvido } = useQuery({
    queryKey: ["freq-id-reabrir", tipo, competenciaId, unidadeId, setorId ?? "geral"],
    enabled: visivel && !frequenciaId && !!competenciaId && !!unidadeId,
    queryFn: async () => {
      let q = supabase
        .from("frequencias")
        .select("id, competencia_unidades!inner(competencia_id, unidade_id)")
        .eq("tipo", tipo)
        .eq("competencia_unidades.competencia_id", competenciaId!)
        .eq("competencia_unidades.unidade_id", unidadeId!);
      q = setorId ? q.eq("setor_id", setorId) : q.is("setor_id", null);
      const { data } = await q.maybeSingle();
      return data?.id ?? null;
    },
  });
  const id = frequenciaId ?? idResolvido ?? null;
  if (!visivel || !id) return null;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
        <span className="flex items-center gap-2">
          <Lock className="h-4 w-4" /> Folha aprovada — somente leitura.
        </span>
        <Button size="sm" onClick={() => setAberto(id)}>
          Reabrir folha aprovada
        </Button>
      </div>
      <ReabrirFolhaDialog freqId={aberto} onClose={() => setAberto(null)} />
    </>
  );
}
