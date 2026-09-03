import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail, generateEmailTemplate } from "./email.server";
import { logger } from "./logger";

export type EscopoRejeicao = "folha" | "linha";

export type NotificarRejeicaoInput = {
  frequenciaId: string;
  escopo: EscopoRejeicao;
  /** "rejeitada" | "devolvida" | "com_pendencias" */
  status: string;
  motivo?: string | null;
  profissionalNome?: string | null;
  criadoPor?: string | null;
};

type Destinatario = { id: string; email: string | null; nome: string };

function statusLabel(status: string) {
  if (status === "rejeitada") return "Rejeitada";
  if (status === "devolvida") return "Devolvida para correção";
  return "Devolvida com pendências";
}

/**
 * Notifica (sino + e-mail) os responsáveis pela unidade quando uma folha
 * inteira ou uma linha individual de profissional é rejeitada/devolvida.
 * Nunca lança: falhas são apenas registradas em log.
 */
export async function notificarRejeicaoFrequencia(input: NotificarRejeicaoInput) {
  try {
    const { data: freq } = await supabaseAdmin
      .from("frequencias")
      .select(
        "id, tipo, created_by, competencia_unidades(unidade_id, competencia_id, unidades(nome), competencias(mes, ano))",
      )
      .eq("id", input.frequenciaId)
      .maybeSingle();

    if (!freq) {
      logger.warn("rejeicao.notificar.folha_nao_encontrada", { frequenciaId: input.frequenciaId });
      return { notificacoes: 0, emails: 0 };
    }

    const cu = (freq as any).competencia_unidades ?? {};
    const unidadeId: string | null = cu.unidade_id ?? null;
    const unidadeNome: string = cu.unidades?.nome ?? "Unidade";
    const competenciaStr = cu.competencias
      ? `${String(cu.competencias.mes).padStart(2, "0")}/${cu.competencias.ano}`
      : "";

    // ---- Destinatários: vinculados à unidade + criador da folha ----
    const alvos = new Map<string, Destinatario>();

    if (unidadeId) {
      const { data: vinculos } = await supabaseAdmin
        .from("usuario_unidades")
        .select("usuario_id")
        .eq("unidade_id", unidadeId)
        .is("data_fim", null);
      const ids = [...new Set((vinculos ?? []).map((v) => v.usuario_id as string))];
      if (ids.length) {
        const { data: us } = await supabaseAdmin
          .from("usuarios")
          .select("id, email, nome_completo")
          .in("id", ids)
          .eq("status", "ativo")
          .is("deleted_at", null);
        for (const u of us ?? []) {
          alvos.set(u.id as string, {
            id: u.id as string,
            email: (u.email as string) ?? null,
            nome: (u.nome_completo as string) ?? "",
          });
        }
      }
    }

    const criador = (freq as any).created_by as string | null;
    if (criador && !alvos.has(criador)) {
      const { data: u } = await supabaseAdmin
        .from("usuarios")
        .select("id, email, nome_completo")
        .eq("id", criador)
        .maybeSingle();
      if (u) {
        alvos.set(u.id as string, {
          id: u.id as string,
          email: (u.email as string) ?? null,
          nome: (u.nome_completo as string) ?? "",
        });
      }
    }

    const destinatarios = [...alvos.values()];
    if (!destinatarios.length) {
      logger.warn("rejeicao.notificar.sem_destinatarios", { frequenciaId: input.frequenciaId });
      return { notificacoes: 0, emails: 0 };
    }

    const label = statusLabel(input.status);
    const motivo = (input.motivo ?? "").trim() || "Nenhuma justificativa informada.";
    const tipoFolha = (freq as any).tipo === "contratados" ? "Contratados" : "Efetivos";

    const titulo =
      input.escopo === "linha"
        ? `Profissional rejeitado na folha ${tipoFolha} ${competenciaStr}`
        : `Folha ${tipoFolha} ${label.toLowerCase()} — ${competenciaStr}`;

    const mensagem =
      input.escopo === "linha"
        ? `O lançamento de ${input.profissionalNome || "um profissional"} na folha de ${tipoFolha} da unidade ${unidadeNome} (${competenciaStr}) foi rejeitado. Motivo: ${motivo}`
        : `A folha de ${tipoFolha} da unidade ${unidadeNome} (${competenciaStr}) foi ${label.toLowerCase()}. Motivo: ${motivo}`;

    const link = `/frequencias?competencia=${cu.competencia_id ?? ""}&unidade=${unidadeId ?? ""}`;

    // ---- Notificação in-app ----
    let notificacoes = 0;
    const { error: nErr, count } = await supabaseAdmin.from("notificacoes").insert(
      destinatarios.map((u) => ({
        usuario_id: u.id,
        tipo: "alerta" as const,
        prioridade: "alta" as const,
        canal: "interno" as const,
        titulo,
        mensagem,
        link,
        entidade_tipo: "frequencia",
        entidade_id: input.frequenciaId,
        created_by: input.criadoPor ?? null,
      })) as never,
      { count: "exact" },
    );
    if (nErr) logger.error("rejeicao.notificar.inapp_erro", { error: nErr.message });
    else notificacoes = count ?? destinatarios.length;

    // ---- E-mail ----
    const baseUrl = process.env.VITE_APP_URL || process.env.SITE_URL || "http://localhost:8080";
    const assunto = `[Ação Necessária] ${titulo}`;
    const emails = [
      ...new Set(destinatarios.map((u) => u.email).filter((e): e is string => !!e && e.includes("@"))),
    ];

    const html = generateEmailTemplate({
      title: titulo,
      message: `${mensagem} Acesse o sistema para corrigir e reenviar.`,
      ctaLabel: "Corrigir agora",
      ctaUrl: `${baseUrl}${link}`,
      details: [
        { label: "Unidade", value: unidadeNome },
        { label: "Competência", value: competenciaStr },
        { label: "Tipo de folha", value: tipoFolha },
        ...(input.escopo === "linha"
          ? [{ label: "Profissional", value: input.profissionalNome || "—" }]
          : []),
        { label: "Justificativa", value: motivo },
      ],
    });

    let enviados = 0;
    for (const email of emails) {
      const r = await sendEmail({ to: email, subject: assunto, html });
      if (r.success) enviados++;
    }

    return { notificacoes, emails: enviados };
  } catch (err) {
    logger.error("rejeicao.notificar.falhou", { error: err, frequenciaId: input.frequenciaId });
    return { notificacoes: 0, emails: 0 };
  }
}
