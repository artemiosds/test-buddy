import { createFileRoute } from "@tanstack/react-router";
import { autorizarCron } from "@/lib/cron-auth.server";

type Comp = {
  id: string;
  mes: number;
  ano: number;
  prazo_envio: string;
  status: "aberta" | "em_processamento";
};

type EntregaEmail = {
  evento_id: string;
  destinatario: string;
  payload: { subject?: string; html?: string; text?: string } | null;
};

const STATUS_COMPETENCIA_ABERTA = ["aberta", "em_processamento"] as const;
const LEASE_EMAIL_MS = 15 * 60 * 1000;

function resposta(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

/** Retenta apenas falhas anteriores à execução atual ou leases já expirados. */
async function reprocessarEmailsPendentes(
  supa: any,
  sendEmail: typeof import("@/lib/email.server").sendEmail,
  inicioExecucao: Date,
) {
  const limiteLease = new Date(inicioExecucao.getTime() - LEASE_EMAIL_MS).toISOString();

  const [falhas, travadas] = await Promise.all([
    supa
      .from("notificacao_evento_entregas")
      .select("evento_id, destinatario, payload")
      .eq("canal", "email")
      .eq("status", "falhou")
      .lt("atualizado_em", inicioExecucao.toISOString())
      .not("payload", "is", null)
      .order("atualizado_em", { ascending: true })
      .limit(100),
    supa
      .from("notificacao_evento_entregas")
      .select("evento_id, destinatario, payload")
      .eq("canal", "email")
      .eq("status", "processando")
      .lte("atualizado_em", limiteLease)
      .not("payload", "is", null)
      .order("atualizado_em", { ascending: true })
      .limit(100),
  ]);

  const erro = falhas.error ?? travadas.error;
  if (erro) {
    const detalhe = (erro.code ?? "") + " " + (erro.message ?? "");
    if (/PGRST202|PGRST205|42P01|42883|does not exist|schema cache/i.test(detalhe)) {
      return { tentativas: 0, enviados: 0, falhos: 0, ledgerDisponivel: false };
    }
    throw new Error("Falha ao consultar a fila de e-mails para retentativa.");
  }

  const unicos = new Map<string, EntregaEmail>();
  for (const row of [...(falhas.data ?? []), ...(travadas.data ?? [])] as EntregaEmail[]) {
    unicos.set(row.evento_id + "\u0000" + row.destinatario, row);
  }

  let enviados = 0;
  let falhosCount = 0;
  let tentativas = 0;

  for (const row of unicos.values()) {
    if (!row.payload?.subject || !row.payload.html || !row.evento_id || !row.destinatario) continue;
    tentativas++;
    const envio = await sendEmail({
      to: row.destinatario,
      subject: row.payload.subject,
      html: row.payload.html,
      text: row.payload.text,
      idempotencyKey: row.evento_id,
    });
    if ("duplicate" in envio && envio.duplicate) continue;
    if (envio.success) enviados++;
    else falhosCount++;
  }

  return { tentativas, enviados, falhos: falhosCount, ledgerDisponivel: true };
}

export const Route = createFileRoute("/api/public/hooks/deadline-check")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const negado = autorizarCron(request);
        if (negado) return negado.response;

        const inicioExecucao = new Date();

        try {
          // O mesmo cliente server-side usado pelo restante do sistema garante
          // que o endpoint opere no projeto Supabase configurado para a aplicação.
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { notificarUsuarios } = await import("@/lib/notificar.server");
          const { sendEmail } = await import("@/lib/email.server");
          const { etapaDoPrazo, mensagemEtapa } = await import("@/lib/prazo-envio-etapas");
          const supa = supabaseAdmin as any;

          // Confirma a migration antes de enviar qualquer alerta. A retentativa efetiva
          // fica no final da execução para não tentar novamente uma falha recém-criada.
          const { error: ledgerCheckError } = await supa
            .from("notificacao_evento_entregas")
            .select("evento_id")
            .limit(1);

          if (ledgerCheckError) {
            const detalhe = (ledgerCheckError.code ?? "") + " " + (ledgerCheckError.message ?? "");
            if (/PGRST202|PGRST205|42P01|42883|does not exist|schema cache/i.test(detalhe)) {
              return resposta(
                { ok: false, error: "notification_delivery_migration_required", ledger_disponivel: false },
                503,
              );
            }
            throw new Error("Falha ao verificar a outbox de notificações.");
          }

          const agora = new Date();
          const toISO = (d: Date) => d.toISOString().slice(0, 10);
          const dataLimite = toISO(new Date(agora.getTime() + 4 * 86400000));

          // "aberta" e "em_processamento" são os estados válidos não terminais
          // da tabela competencias. "encerrada"/"arquivada" nunca são reabertas pelo cron.
          const { data: candidatas, error: candidatasError } = await supa
            .from("competencias")
            .select("id, mes, ano, prazo_envio, status")
            .in("status", [...STATUS_COMPETENCIA_ABERTA])
            .not("prazo_envio", "is", null)
            .lte("prazo_envio", dataLimite);

          if (candidatasError) {
            throw new Error("Falha ao consultar competências com prazo de envio.");
          }

          const proximas: Array<Comp & { etapa: "3_dias" | "1_dia" | "1_hora" }> = [];
          const vencidas: Comp[] = [];
          for (const competencia of (candidatas ?? []) as Comp[]) {
            const etapa = etapaDoPrazo(competencia.prazo_envio, agora);
            if (etapa === "vencido") vencidas.push(competencia);
            else if (etapa) proximas.push({ ...competencia, etapa });
          }

          const { data: perfisAlvo, error: perfisError } = await supa
            .from("perfis")
            .select("id, codigo")
            .in("codigo", ["MASTER", "ADMIN_SMS", "DIRETOR_UNIDADE"]);

          if (perfisError) throw new Error("Falha ao consultar os perfis destinatários.");

          const perfis = (perfisAlvo ?? []) as Array<{ id: string; codigo: string }>;
          const perfilDiretor = perfis.find((p) => p.codigo === "DIRETOR_UNIDADE")?.id;

          const { data: alvos, error: alvosError } = perfis.length
            ? await supa
                .from("usuarios")
                .select("id, perfil_id")
                .in("perfil_id", perfis.map((p) => p.id))
                .eq("status", "ativo")
                .is("deleted_at", null)
            : { data: [] as Array<{ id: string; perfil_id: string }>, error: null };

          if (alvosError) throw new Error("Falha ao consultar os usuários destinatários.");

          const usuariosAlvo = (alvos ?? []) as Array<{ id: string; perfil_id: string }>;
          const alvoIds = usuariosAlvo.map((u) => u.id);
          const diretores = usuariosAlvo
            .filter((u) => u.perfil_id === perfilDiretor)
            .map((u) => u.id);

          const unidadesDoDiretor = new Map<string, Set<string>>();
          if (diretores.length > 0) {
            const { data: vinculos, error: vinculosError } = await supa
              .from("usuario_unidades")
              .select("usuario_id, unidade_id")
              .in("usuario_id", diretores)
              .is("data_fim", null);

            if (vinculosError) throw new Error("Falha ao consultar unidades dos diretores.");

            for (const vinculo of (vinculos ?? []) as Array<{
              usuario_id: string;
              unidade_id: string;
            }>) {
              const unidades = unidadesDoDiretor.get(vinculo.usuario_id) ?? new Set<string>();
              unidades.add(vinculo.unidade_id);
              unidadesDoDiretor.set(vinculo.usuario_id, unidades);
            }
          }

          /** Mantém gestores gerais e remove diretores que concluíram todas as folhas. */
          async function destinatariosPendentes(compId: string): Promise<string[]> {
            if (diretores.length === 0) return alvoIds;

            const { data: vinculosCompetencia, error: vinculosCompetenciaError } = await supa
              .from("competencia_unidades")
              .select("unidade_id")
              .eq("competencia_id", compId)
              .neq("status", "arquivada")
              .is("deleted_at", null);

            if (vinculosCompetenciaError) {
              throw new Error("Falha ao consultar unidades vinculadas à competência.");
            }

            const unidadesCompetencia = new Set(
              (vinculosCompetencia ?? []).map((v: { unidade_id: string }) => v.unidade_id),
            );

            const { data: folhas, error } = await supa
              .from("frequencias")
              .select("status, competencia_unidades!inner(competencia_id, unidade_id)")
              .eq("competencia_unidades.competencia_id" as never, compId)
              .is("competencia_unidades.deleted_at" as never, null);

            if (error) throw new Error("Falha ao verificar folhas pendentes da competência.");

            const enviadas = new Set<string>();
            const pendentes = new Set<string>();
            for (const folha of (folhas ?? []) as any[]) {
              const unidadeId = folha.competencia_unidades?.unidade_id;
              if (!unidadeId) continue;
              if (["enviada", "aprovada", "em_analise", "arquivada"].includes(folha.status)) {
                enviadas.add(unidadeId);
              } else {
                pendentes.add(unidadeId);
              }
            }

            const concluida = (unidadeId: string) =>
              enviadas.has(unidadeId) && !pendentes.has(unidadeId);

            return alvoIds.filter((id) => {
              if (!diretores.includes(id)) return true;
              const unidadesVinculadas = unidadesDoDiretor.get(id);
              if (!unidadesVinculadas || unidadesVinculadas.size === 0) return false;

              const unidadesRelevantes = [...unidadesVinculadas].filter((unidadeId) =>
                unidadesCompetencia.has(unidadeId),
              );
              if (unidadesRelevantes.length === 0) return false;
              return unidadesRelevantes.some((unidadeId) => !concluida(unidadeId));
            });
          }

          const fmtData = (data: string) => data.split("-").reverse().join("/");
          let notificacoesCriadas = 0;
          let notificacoesFalhas = 0;
          let emailsEnviados = 0;
          let emailsFalhos = 0;
          const etapasDisparadas: string[] = [];
          const vencidasComFalhaInApp = new Set<string>();

          async function disparar(
            competencia: Comp,
            etapa: "3_dias" | "1_dia" | "1_hora" | "vencido",
          ) {
            const destinatarios = await destinatariosPendentes(competencia.id);
            if (destinatarios.length === 0) return;

            const competenciaStr =
              String(competencia.mes).padStart(2, "0") + "/" + competencia.ano;
            const mensagem = mensagemEtapa(etapa, competenciaStr, fmtData(competencia.prazo_envio));
            const resultado = await notificarUsuarios({
              client: supa,
              destinatarios,
              titulo: mensagem.titulo,
              mensagem: mensagem.mensagem,
              tipo: "alerta",
              prioridade: mensagem.prioridade,
              canal: "interno",
              entidade_tipo: "competencia",
              entidade_id: competencia.id,
              link: "/competencias/" + competencia.id,
              eventoId: "prazo_envio:" + competencia.id + ":" + competencia.prazo_envio + ":" + etapa,
              email: true,
              emailDetalhes: [
                { label: "Competência", value: competenciaStr },
                { label: "Prazo de envio", value: fmtData(competencia.prazo_envio) + " às 23:59" },
              ],
            });

            notificacoesCriadas += resultado.notificacoes;
            notificacoesFalhas += resultado.notificacoes_falhas;
            emailsEnviados += resultado.emails;
            emailsFalhos += resultado.emails_falhos;

            if (etapa === "vencido" && resultado.notificacoes_falhas > 0) {
              vencidasComFalhaInApp.add(competencia.id);
            }
            if (resultado.notificacoes > 0 || resultado.emails > 0) {
              etapasDisparadas.push(competenciaStr + ":" + etapa);
            }
          }

          for (const competencia of proximas) await disparar(competencia, competencia.etapa);
          for (const competencia of vencidas) await disparar(competencia, "vencido");

          // Pendência institucional para folhas de rascunho que perderam o prazo.
          let pendenciasAbertas = 0;
          if (vencidas.length > 0) {
            const { data: folhas, error: folhasError } = await supa
              .from("frequencias")
              .select(
                "id, status, competencia_unidade_id, competencia_unidades!inner(competencia_id, unidade_id)",
              )
              .in("competencia_unidades.competencia_id" as never, vencidas.map((v) => v.id))
              .eq("status", "rascunho");

            if (folhasError) throw new Error("Falha ao localizar folhas não enviadas após o prazo.");

            const { abrirPendenciaAutomatica } = await import("@/lib/pendencias-auto.server");
            for (const folha of (folhas ?? []) as any[]) {
              const vinculo = folha.competencia_unidades;
              const pendencia = await abrirPendenciaAutomatica({
                titulo: "Folha não enviada — prazo de envio vencido",
                descricao:
                  "O prazo de envio da competência venceu e esta folha permanecia em elaboração.",
                categoria: "folha",
                prioridade: "critica",
                origem_tipo: "prazo_envio_vencido",
                origem_id: folha.id,
                unidade_id: vinculo?.unidade_id ?? null,
                competencia_id: vinculo?.competencia_id ?? null,
                competencia_unidade_id: folha.competencia_unidade_id ?? null,
                frequencia_id: folha.id,
                prazo: new Date().toISOString(),
                dados: { motivo: "prazo_envio_vencido" },
              });
              if (pendencia.criada) pendenciasAbertas++;
            }
          }

          // Encerra após o sino. Falha do sino mantém a competência aberta para
          // a próxima execução; falhas SMTP ficam na outbox e são retentadas à parte.
          const idsParaEncerrar = vencidas
            .filter((c) => !vencidasComFalhaInApp.has(c.id))
            .map((c) => c.id);

          let encerradas = 0;
          if (idsParaEncerrar.length > 0) {
            const { data, error } = await supa
              .from("competencias")
              .update({ status: "encerrada" })
              .in("id", idsParaEncerrar)
              .in("status", [...STATUS_COMPETENCIA_ABERTA])
              .select("id");

            if (error) throw new Error("Falha ao encerrar competências com prazo vencido.");
            encerradas = (data ?? []).length;
          }

          // Retenta apenas falhas de execuções anteriores e leases já expirados.
          // O filtro usa inicioExecucao, portanto falhas geradas neste ciclo só entram no próximo.
          const retentativas = await reprocessarEmailsPendentes(supa, sendEmail, inicioExecucao);
          emailsEnviados += retentativas.enviados;
          emailsFalhos += retentativas.falhos;

          const { data: sla, error: slaError } = await supa.rpc("sla_pendencias_processar" as never);
          if (slaError) throw new Error("Falha ao processar SLA das pendências institucionais.");
          const slaResumo = Array.isArray(sla) ? sla[0] : sla;

          const ok = notificacoesFalhas === 0 && emailsFalhos === 0 && retentativas.ledgerDisponivel;
          return resposta(
            {
              ok,
              candidatas: (candidatas ?? []).length,
              proximas: proximas.length,
              etapas_disparadas: etapasDisparadas,
              vencidas_detectadas: vencidas.length,
              vencidas_encerradas: encerradas,
              vencidas_pendentes_por_falha_inapp: vencidasComFalhaInApp.size,
              notificacoes_criadas: notificacoesCriadas,
              notificacoes_com_falha: notificacoesFalhas,
              emails_enviados: emailsEnviados,
              emails_com_falha: emailsFalhos,
              emails_retentados: retentativas.tentativas,
              emails_retentados_com_sucesso: retentativas.enviados,
              ledger_disponivel: retentativas.ledgerDisponivel,
              destinatarios: alvoIds.length,
              pendencias_abertas: pendenciasAbertas,
              sla_pendencias: slaResumo ?? null,
              timestamp: new Date().toISOString(),
            },
            ok ? 200 : 502,
          );
        } catch (error) {
          console.error(
            "[deadline-check] Falha na execução:",
            error instanceof Error ? error.message : String(error),
          );
          return resposta({ ok: false, error: "deadline_check_failed" }, 500);
        }
      },
    },
  },
} as any);
