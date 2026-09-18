import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { autorizarCron } from "@/lib/cron-auth.server";

// Cron endpoint: notify about approaching deadlines and auto-lock past-deadline competencies.
// Called by pg_cron daily. Public (no auth) — safe because it only:
//  - reads/writes internal notifications
//  - transitions competencies past their prazo_envio from 'em_elaboracao' to 'enviada'
// Autenticação fail-closed: exige o header `x-cron-secret`. Se DEADLINE_CRON_SECRET
// não estiver configurado, a rota inteira responde 503 (nunca fica aberta).

export const Route = createFileRoute("/api/public/hooks/deadline-check")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const negado = autorizarCron(request);
        if (negado) return negado.response;

        const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const key =
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.SERVICE_ROLE_KEY ||
          process.env.SUPABASE_ADMIN_KEY;

        if (!url || !key) {
          return new Response(JSON.stringify({ error: "missing supabase env" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const supa = createClient(url, key, {
          auth: { autoRefreshToken: false, persistSession: false },
          global: { headers: { "x-application-name": "hsm-gestao-cron" } },
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

        // Destinatários: usuários ativos dos perfis MASTER / ADMIN_SMS / DIRETOR_UNIDADE.
        // (o perfil fica em `perfis.codigo`, referenciado por `usuarios.perfil_id`)
        const { data: perfisAlvo } = await supa
          .from("perfis")
          .select("id, codigo")
          .in("codigo", ["MASTER", "ADMIN_SMS", "DIRETOR_UNIDADE"]);

        const perfilIds = ((perfisAlvo ?? []) as Array<{ id: string }>).map((p) => p.id);

        const { data: alvos } = perfilIds.length
          ? await supa
              .from("usuarios")
              .select("id")
              .in("perfil_id", perfilIds)
              .eq("status", "ativo")
              .is("deleted_at", null)
          : { data: [] as Array<{ id: string }> };

        const alvoIds = ((alvos ?? []) as Array<{ id: string }>).map((u) => u.id);

        let notifCount = 0;
        let notifFalhas = 0;

        if (alvoIds.length > 0) {
          const { notificarUsuarios } = await import("@/lib/notificar.server");

          for (const comp of proximas || []) {
            const dias = Math.ceil(
              (new Date(comp.prazo_envio + "T00:00:00").getTime() - today.getTime()) / 86400000,
            );
            const r = await notificarUsuarios({
              client: supa,
              destinatarios: alvoIds,
              titulo: `Prazo de envio próximo (${comp.mes}/${comp.ano})`,
              mensagem: `A competência ${comp.mes}/${comp.ano} tem prazo de envio em ${dias} dia(s).`,
              tipo: "alerta",
              prioridade: "alta",
              entidade_tipo: "competencia",
              entidade_id: comp.id,
              link: `/competencias/${comp.id}`,
              email: true,
            });
            notifCount += r.notificacoes;
            if (r.erro) notifFalhas++;
          }

          for (const comp of vencidas || []) {
            const r = await notificarUsuarios({
              client: supa,
              destinatarios: alvoIds,
              titulo: `Prazo vencido (${comp.mes}/${comp.ano})`,
              mensagem: `A competência ${comp.mes}/${comp.ano} teve o prazo de envio vencido e foi encerrada para elaboração.`,
              tipo: "alerta",
              prioridade: "urgente",
              entidade_tipo: "competencia",
              entidade_id: comp.id,
              link: `/competencias/${comp.id}`,
              email: true,
            });
            notifCount += r.notificacoes;
            if (r.erro) notifFalhas++;
          }
        }

        // 3) Pendência institucional para folhas que perderam o prazo de envio.
        let pendenciasAbertas = 0;
        if (vencidas && vencidas.length > 0) {
          const { abrirPendenciaAutomatica } = await import("@/lib/pendencias-auto.server");
          const compIds = vencidas.map((v) => v.id);
          const { data: folhas } = await supa
            .from("frequencias")
            .select(
              "id, status, competencia_unidade_id, competencia_unidades!inner(competencia_id, unidade_id)",
            )
            .in("competencia_unidades.competencia_id" as never, compIds)
            .eq("status", "rascunho");

          for (const f of (folhas as any[]) || []) {
            const cu = f.competencia_unidades;
            const r = await abrirPendenciaAutomatica({
              titulo: "Folha não enviada — prazo de envio vencido",
              descricao:
                "O prazo de envio da competência venceu e esta folha permanecia em elaboração.",
              categoria: "folha",
              prioridade: "critica",
              origem_tipo: "prazo_envio_vencido",
              origem_id: f.id,
              unidade_id: cu?.unidade_id ?? null,
              competencia_id: cu?.competencia_id ?? null,
              competencia_unidade_id: f.competencia_unidade_id ?? null,
              frequencia_id: f.id,
              prazo: new Date().toISOString(),
              dados: { motivo: "prazo_envio_vencido" },
            });
            if (r.criada) pendenciasAbertas += 1;
          }
        }

        // 4) SLA das pendências institucionais (vencidas, próximas, escaladas).
        const { data: sla } = await supa.rpc("sla_pendencias_processar" as never);
        const slaResumo = Array.isArray(sla) ? sla[0] : sla;

        return new Response(
          JSON.stringify({
            ok: true,
            proximas: proximas?.length || 0,
            vencidas_locked: locked,
            notificacoes_criadas: notifCount,
            notificacoes_com_falha: notifFalhas,
            destinatarios: alvoIds.length,
            pendencias_abertas: pendenciasAbertas,
            sla_pendencias: slaResumo ?? null,
            timestamp: new Date().toISOString(),
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
} as any);
