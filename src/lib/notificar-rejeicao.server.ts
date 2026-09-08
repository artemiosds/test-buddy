import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail, generateEmailTemplate } from "./email.server";
import { logger } from "./logger";

type Params = {
  frequenciaId: string;
  status: "rejeitada" | "devolvida" | "com_pendencias";
  profissionalNome?: string | null;
  justificativa?: string | null;
  autorId?: string | null;
};

type Resultado = { usuarios: number; notificacoes: number; emails: number; emails_falhos: number };

const LABEL: Record<string, string> = {
  rejeitada: "Rejeitada",
  devolvida: "Devolvida para correção",
  com_pendencias: "Com pendências",
};

/**
 * Avisa os usuários da unidade (sino + e-mail) que a folha — ou um lançamento
 * específico dela — foi rejeitada/devolvida para correção.
 */
export async function notificarRejeicaoFolha(params: Params): Promise<Resultado> {
  const vazio: Resultado = { usuarios: 0, notificacoes: 0, emails: 0, emails_falhos: 0 };

  const { data: freq } = await supabaseAdmin
    .from("frequencias")
    .select(
      "id, tipo, competencia_unidade_id, competencia_unidades(unidade_id, competencias(ano, mes), unidades(nome))",
    )
    .eq("id", params.frequenciaId)
    .maybeSingle();

  if (!freq) {
    logger.warn("rejeicao.notificar.folha_nao_encontrada", { frequenciaId: params.frequenciaId });
    return vazio;
  }

  const cu = (freq as any).competencia_unidades ?? null;
  const unidadeId: string | null = cu?.unidade_id ?? null;
  const unidadeNome: string = cu?.unidades?.nome ?? "Unidade";
  const comp = cu?.competencias ?? null;
  const competenciaStr = comp ? `${String(comp.mes).padStart(2, "0")}/${comp.ano}` : "";

  if (!unidadeId) return vazio;

  const { data: vinculos } = await supabaseAdmin
    .from("usuario_unidades")
    .select("usuario_id")
    .eq("unidade_id", unidadeId)
    .is("data_fim", null);

  const ids = [...new Set((vinculos ?? []).map((v) => v.usuario_id as string))];
  if (ids.length === 0) return vazio;

  const { data: usuarios } = await supabaseAdmin
    .from("usuarios")
    .select("id, email, nome_completo")
    .in("id", ids)
    .eq("status", "ativo")
    .is("deleted_at", null);

  const destinatarios = (usuarios ?? []).map((u) => ({
    id: u.id as string,
    email: (u.email as string) ?? null,
  }));
  if (destinatarios.length === 0) return vazio;

  const tipoLabel = (freq as any).tipo === "efetivos" ? "Efetivos" : "Contratados";
  const alvo = params.profissionalNome ? ` — ${params.profissionalNome}` : "";
  const titulo = `Folha ${tipoLabel} ${competenciaStr}: ${LABEL[params.status] ?? "Rejeitada"}${alvo}`;
  const mensagem =
    `A folha de ${tipoLabel} da unidade ${unidadeNome} (competência ${competenciaStr}) ` +
    `${params.profissionalNome ? `teve o lançamento de ${params.profissionalNome} ` : ""}` +
    `marcada como ${(LABEL[params.status] ?? "rejeitada").toLowerCase()}.` +
    (params.justificativa ? ` Justificativa: ${params.justificativa}` : "");
  const link = `/frequencias/${params.frequenciaId}`;

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
      entidade_id: params.frequenciaId,
      created_by: params.autorId ?? null,
    })) as never,
    { count: "exact" },
  );
  if (nErr) logger.error("rejeicao.notificar.inapp_erro", { error: nErr.message });
  else notificacoes = count ?? destinatarios.length;

  const baseUrl = process.env.VITE_APP_URL || process.env.SITE_URL || "https://hsmgestao.lovable.app";
  const emails = [...new Set(destinatarios.map((u) => u.email).filter((e): e is string => !!e && e.includes("@")))];
  let enviados = 0;
  let falhos = 0;

  for (const email of emails) {
    const html = generateEmailTemplate({
      title: titulo,
      message: mensagem,
      ctaLabel: "Corrigir agora",
      ctaUrl: `${baseUrl}${link}`,
      details: [
        { label: "Unidade", value: unidadeNome },
        { label: "Competência", value: competenciaStr || "-" },
        { label: "Folha", value: tipoLabel },
        ...(params.profissionalNome ? [{ label: "Profissional", value: params.profissionalNome }] : []),
        ...(params.justificativa ? [{ label: "Justificativa", value: params.justificativa }] : []),
      ],
    });
    const r = await sendEmail({ to: email, subject: `[HSM Gestão] ${titulo}`, html });
    if (r.success) enviados++;
    else falhos++;
  }

  return { usuarios: destinatarios.length, notificacoes, emails: enviados, emails_falhos: falhos };
}
