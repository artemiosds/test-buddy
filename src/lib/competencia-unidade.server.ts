import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Garante que um vínculo Competência/Unidade exista de forma segura e idempotente.
 * Resolve race conditions de inserção concorrente através de retries e upsert.
 */
export async function garantirCompetenciaUnidade(params: {
  competencia_id: string;
  unidade_id: string;
  userId: string;
}) {
  const { competencia_id, unidade_id, userId } = params;
  const MAX_RETRIES = 3;
  let lastError = null;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const { data, error } = await supabaseAdmin
        .from("competencia_unidades")
        .upsert(
          { competencia_id, unidade_id, updated_by: userId },
          { onConflict: "competencia_id,unidade_id" }
        )
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (data) return data.id;
    } catch (e: any) {
      lastError = e;
      // Race condition detectada ou erro transitório
      await new Promise(resolve => setTimeout(resolve, 50 * (i + 1)));
    }
  }

  throw new Error(`Falha ao garantir vínculo Competência/Unidade: ${lastError?.message || "Erro desconhecido"}`);
}
