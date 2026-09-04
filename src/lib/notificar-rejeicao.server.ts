import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logger } from "./logger";

type Resultado = { usuarios: number; notificacoes: number; emails: number };

const VAZIO: Resultado = { usuarios: 0, notificacoes: 0, emails: 0 };

/**
 * Destinatários de uma rejeição: usuários ativos vinculados à unidade da folha.
 */
async function destinatariosDaUnidade(unidadeId: string) {
  const { data: vinculos } = await supabaseAdmin
    .from("usuario_unidades")
    .select("usuario_id")
    .eq("unidade_id", unidadeId)
    .is("data_fim", null)
    .is("deleted_at", null);

  const ids = [...new Set((vinculos ?? []).map((v) => v.usuario_id as string))];
  if (ids.length === 0) return [] as Array<{ id: string; email: string | null; nome: string }>;

  const { data: us } = await supabaseAdmin
    .from("usuarios")
    .select("id, email, nome_completo")
    .in("id", ids)
    .eq("status", "ativo")
    .is("deleted_at", null);

  return (us ?? []).map((u) => ({
    id: u.id as string,
    email: (u.email as string) ?? null,
    nome: (u.nome_completo as string) ?? "",
  }));
}

/**
 * Notifica a unidade sobre uma rejeição/devolução — na folha inteira ou em um
 * profissional específico. Envia notificação in-app (sino) e e-mail.
 *
 * Nunca lança: a rejeição em si não pode falhar por causa do aviso.
 */
export async function notificarRejeicaoFolha(input: {
  frequenciaId: string;
  /** "rejeitada" | "devolvida" | "com_pendencias" */
  status?: string;
  /** Nome do profissional quando a rejeição é de uma linha específica. */
  profissionalNome?: string | null;
  justificativa?: string | null;
  autorId?: string | null;
}): Promise<Resultado> {
  try {
    const { data: freq } = await supabaseAdmin
      .from("frequencias")
      .select(
        `tipo,
         competencia_unidades:competencia_unidade_id(
           unidade_id,
           unidades:unidade_id(nome),
           competencias:competencia_id(ano, mes)
         )`,
      )
      .eq("id", input.frequenciaId)
      .maybeSingle();

    const cu = (freq as any)?.competencia_unidades;
    const unidadeId = cu?.unidade_id as string | undefined;
    if (!unidadeId) return VAZIO;

    const unidadeNome = cu?.unidades?.nome ?? "sua unidade";
    const comp = cu?.competencias;
    const competenciaStr = comp
      ? `${String(comp.mes).padStart(2, "0")}/${comp.ano}`
      : "competência atual";
    const tipo = (freq as any)?.tipo === "contratados" ? "Contratados" : "Efetivos";

    const devolvida = input.status === "devolvida" || input.status === "com_pendencias";
    const acao = devolvida ? "devolvido para correção" : "rejeitado";

    const titulo = input.profissionalNome
      ? `Lançamento ${acao}: ${input.profissionalNome}`
      : `Folha ${devolvida ? "devolvida" : "rejeitada"} — ${competenciaStr}`;

    const mensagem = input.profissionalNome
      ? `O lançamento de ${input.profissionalNome} na folha de ${tipo} (${competenciaStr}) da unidade ${unidadeNome} foi ${acao}. ` +
        `Justificativa: ${input.justificativa?.trim() || "não informada"}. Corrija o profissional e reenvie para análise.`
      : `A folha de ${tipo} (${competenciaStr}) da unidade ${unidadeNome} foi ${acao}. ` +
        `Justificativa: ${input.justificativa?.trim() || "não informada"}.`;

    const destinatarios = await destinatariosDaUnidade(unidadeId);
    if (destinatarios.length === 0) return VAZIO;

    const link = (freq as any)?.tipo === "contratados" ? "/folha-contratados" : "/folha-efetivos";

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
        created_by: input.autorId ?? null,
      })) as never,
      { count: "exact" },
    );
    if (nErr) logger.error("rejeicao.notificar.inapp_erro", { error: nErr.message });

    let emails = 0;
    const paraEmail = destinatarios.map((u) => u.email).filter((e): e is string => !!e);
    if (paraEmail.length > 0) {
      try {
        const { sendEmail, generateEmailTemplate } = await import("./email.server");
        const baseUrl = process.env["VITE_APP_URL"] || "https://hsm-gestao.lovable.app";
        const html = generateEmailTemplate({
          title: titulo,
          message: mensagem,
          ctaLabel: "Corrigir agora",
          ctaUrl: `${baseUrl}${link}`,
          details: [
            { label: "Unidade", value: unidadeNome },
            { label: "Competência", value: competenciaStr },
            { label: "Folha", value: tipo },
            ...(input.profissionalNome
              ? [{ label: "Profissional", value: input.profissionalNome }]
              : []),
            {
              label: "Justificativa",
              value: input.justificativa?.trim() || "Nenhuma justificativa informada.",
            },
          ],
        });
        const res = await sendEmail({
          to: paraEmail,
          subject: `[Ação necessária] ${titulo}`,
          html,
        });
        emails = (res as any)?.success === false ? 0 : paraEmail.length;
      } catch (mailErr) {
        logger.error("rejeicao.notificar.email_erro", { error: (mailErr as Error)?.message });
      }
    }

    return {
      usuarios: destinatarios.length,
      notificacoes: count ?? destinatarios.length,
      emails,
    };
  } catch (err) {
    logger.error("rejeicao.notificar.falhou", { error: (err as Error)?.message });
    return VAZIO;
  }
}
