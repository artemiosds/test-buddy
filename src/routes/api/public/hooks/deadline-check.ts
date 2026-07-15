import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Cron endpoint: notify about approaching deadlines and auto-lock past-deadline competencies.
// Called by pg_cron daily. Public (no auth) — safe because it only:
//  - reads/writes internal notifications
//  - transitions competencies past their prazo_envio from 'em_elaboracao' to 'enviada'
// Extra safety: requires a shared secret header when DEADLINE_CRON_SECRET is set.

export const Route = createFileRoute("/api/public/hooks/deadline-check")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const secret = process.env.DEADLINE_CRON_SECRET;
        if (secret) {
          const provided = request.headers.get("x-cron-secret");
          if (provided !== secret) {
            return new Response(JSON.stringify({ error: "unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
        }

        const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const key =
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.SERVICE_ROLE_KEY ||
          process.env.SUPABASE_ADMIN_KEY;

        if (!url || !key) {
          return new Response(
            JSON.stringify({ error: "missing supabase env" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        const supa = createClient(url, key, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const today = new Date();
        const toISO = (d: Date) => d.toISOString().slice(0, 10);
        const in3 = new Date(today);
        in3.setDate(in3.getDate() + 3);

        // 1) Competencies with prazo_envio in next 3 days and still active
        const { data: proximas } = await supa
          .from("competencias")
          .select("id, mes, ano, prazo_envio, status")
          .in("status", ["em_elaboracao", "enviada"])
          .gte("prazo_envio", toISO(today))
          .lte("prazo_envio", toISO(in3));

        // 2) Competencies past deadline still in em_elaboracao → force to 'enviada'
        const { data: vencidas } = await supa
          .from("competencias")
          .select("id, mes, ano, prazo_envio")
          .eq("status", "em_elaboracao")
          .lt("prazo_envio", toISO(today));

        let locked = 0;
        if (vencidas && vencidas.length > 0) {
          const ids = vencidas.map((v) => v.id);
          const { error } = await supa
            .from("competencias")
            .update({ status: "enviada" })
            .in("id", ids);
          if (!error) locked = ids.length;
        }

        // Collect users to notify: MASTER + ADMIN_SMS + DIRETOR_UNIDADE
        const { data: alvos } = await supa
          .from("usuarios")
          .select("id, perfil")
          .in("perfil", ["MASTER", "ADMIN_SMS", "DIRETOR_UNIDADE"])
          .eq("ativo", true);

        let notifCount = 0;
        const notifRows: any[] = [];

        for (const comp of proximas || []) {
          const dias = Math.ceil(
            (new Date(comp.prazo_envio + "T00:00:00").getTime() -
              today.getTime()) /
              86400000,
          );
          for (const u of alvos || []) {
            notifRows.push({
              usuario_id: u.id,
              titulo: `Prazo de envio próximo (${comp.mes}/${comp.ano})`,
              mensagem: `A competência ${comp.mes}/${comp.ano} tem prazo de envio em ${dias} dia(s).`,
              tipo: "alerta",
              prioridade: "alta",
              canal: "sistema",
              entidade_tipo: "competencia",
              entidade_id: comp.id,
              link: `/competencias/${comp.id}`,
            });
          }
        }

        for (const comp of vencidas || []) {
          for (const u of alvos || []) {
            notifRows.push({
              usuario_id: u.id,
              titulo: `Prazo vencido (${comp.mes}/${comp.ano})`,
              mensagem: `A competência ${comp.mes}/${comp.ano} teve o prazo de envio vencido e foi encerrada para elaboração.`,
              tipo: "alerta",
              prioridade: "urgente",
              canal: "sistema",
              entidade_tipo: "competencia",
              entidade_id: comp.id,
              link: `/competencias/${comp.id}`,
            });
          }
        }

        if (notifRows.length > 0) {
          const { error } = await supa.from("notificacoes").insert(notifRows);
          if (!error) notifCount = notifRows.length;
        }

        return new Response(
          JSON.stringify({
            ok: true,
            proximas: proximas?.length || 0,
            vencidas_locked: locked,
            notificacoes_criadas: notifCount,
            timestamp: new Date().toISOString(),
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
} as any);
