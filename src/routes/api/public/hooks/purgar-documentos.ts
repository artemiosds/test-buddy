import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { autorizarCron } from "@/lib/cron-auth.server";

/**
 * Rotina de retenção de anexos na lixeira.
 *
 * O bucket R2 opera com bloqueio indefinido: NENHUM binário é apagado por esta
 * rotina. Documentos com `deleted_at` e `purga_apos` vencido são apenas
 * marcados com `metadata.retido_r2` e `metadata.retencao_verificada_em`,
 * mantendo o arquivo disponível para consulta permanente e o rastro no banco.
 *
 * Chamada por pg_cron. Exige `x-cron-secret`; sem `DEADLINE_CRON_SECRET`
 * configurado a rota devolve 503 (fail-closed).
 */

export const Route = createFileRoute("/api/public/hooks/purgar-documentos")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const negado = autorizarCron(request);
        if (negado) return negado.response;

        const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) {
          return Response.json({ error: "missing supabase env" }, { status: 500 });
        }
        const supa = createClient(url, key, {
          auth: { autoRefreshToken: false, persistSession: false },
          global: { headers: { "x-application-name": "hsm-gestao-purgar" } },
        });

        const agora = new Date().toISOString();
        const { data: vencidos, error } = await supa
          .from("documentos")
          .select("id, storage_path, metadata")
          .not("deleted_at", "is", null)
          .not("purga_apos", "is", null)
          .lte("purga_apos", agora)
          .limit(500);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        type Doc = { id: string; storage_path: string; metadata: Record<string, unknown> | null };
        const alvos = ((vencidos ?? []) as Doc[]).filter(
          (d) => d.storage_path && !(d.metadata ?? {}).retido_r2,
        );
        if (!alvos.length) return Response.json({ ok: true, retidos: 0, purgados: 0 });

        // Nenhuma exclusão física: o binário é retido indefinidamente no R2.
        for (const d of alvos) {
          await supa
            .from("documentos")
            .update({
              metadata: {
                ...(d.metadata ?? {}),
                retido_r2: true,
                retencao_verificada_em: agora,
              },
            })
            .eq("id", d.id);
        }
        return Response.json({ ok: true, retidos: alvos.length, purgados: 0 });

      },
    },
  },
});
