import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { autorizarCron } from "@/lib/cron-auth.server";

/**
 * Purga definitiva de anexos na lixeira.
 *
 * Remove o binário do Storage APENAS de documentos com `deleted_at` preenchido
 * e `purga_apos` já vencido (5 anos para anexos de folha/frequência, 2 anos
 * para os demais). O registro de metadados permanece no banco como rastro de
 * auditoria, marcado em `metadata.purgado_em`.
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
          (d) => d.storage_path && !(d.metadata ?? {}).purgado_em,
        );
        if (!alvos.length) return Response.json({ ok: true, purgados: 0 });

        const { error: rmErr } = await supa.storage
          .from("documentos")
          .remove(alvos.map((d) => d.storage_path));
        if (rmErr) return Response.json({ error: rmErr.message }, { status: 500 });

        for (const d of alvos) {
          await supa
            .from("documentos")
            .update({ metadata: { ...(d.metadata ?? {}), purgado_em: agora } })
            .eq("id", d.id);
        }
        return Response.json({ ok: true, purgados: alvos.length });
      },
    },
  },
});
