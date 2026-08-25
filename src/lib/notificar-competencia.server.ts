import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail, generateEmailTemplate } from "./email.server";
import { logger } from "./logger";

type Resultado = {
  usuarios: number;
  notificacoes: number;
  emails: number;
  aviso_id: string | null;
};

/**
 * Notifica os usuários vinculados às unidades ativas de uma secretaria sobre a
 * abertura de uma competência: notificação in-app (sino), aviso no mural e e-mail.
 */
export async function notificarNovaCompetencia(competenciaId: string, criadoPor?: string): Promise<Resultado> {
  const vazio: Resultado = { usuarios: 0, notificacoes: 0, emails: 0, aviso_id: null };

  const { data: comp, error: cErr } = await supabaseAdmin
    .from("competencias")
    .select("id, ano, mes, prazo_envio, prazo_analise, secretaria_id, secretarias(nome)")
    .eq("id", competenciaId)
    .maybeSingle();

  if (cErr || !comp) {
    logger.warn("competencia.notificar.nao_encontrada", { competenciaId, error: cErr?.message });
    return vazio;
  }

  const competenciaStr = `${String(comp.mes).padStart(2, "0")}/${comp.ano}`;
  const secretariaNome = (comp.secretarias as { nome?: string } | null)?.nome ?? "Secretaria";
  const fmt = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "não definido");

  // 1. Unidades ativas da secretaria
  const { data: unidades } = await supabaseAdmin
    .from("unidades")
    .select("id")
    .eq("secretaria_id", comp.secretaria_id)
    .eq("status", "ativa");

  const unidadeIds = (unidades ?? []).map((u) => u.id as string);

  // 2. Usuários vinculados a essas unidades + usuários da secretaria com acesso amplo
  const alvos = new Map<string, { id: string; email: string | null; nome: string }>();

  if (unidadeIds.length > 0) {
    const { data: vinculos } = await supabaseAdmin
      .from("usuario_unidades")
      .select("usuario_id")
      .in("unidade_id", unidadeIds)
      .is("data_fim", null);

    const ids = [...new Set((vinculos ?? []).map((v) => v.usuario_id as string))];
    if (ids.length > 0) {
      const { data: us } = await supabaseAdmin
        .from("usuarios")
        .select("id, email, nome_completo, status")
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

  const { data: amplos } = await supabaseAdmin
    .from("usuarios")
    .select("id, email, nome_completo")
    .eq("secretaria_id", comp.secretaria_id)
    .eq("acesso_todas_unidades", true)
    .eq("status", "ativo")
    .is("deleted_at", null);
  for (const u of amplos ?? []) {
    alvos.set(u.id as string, {
      id: u.id as string,
      email: (u.email as string) ?? null,
      nome: (u.nome_completo as string) ?? "",
    });
  }

  const destinatarios = [...alvos.values()];
  if (destinatarios.length === 0) {
    logger.warn("competencia.notificar.sem_destinatarios", { competenciaId });
    return vazio;
  }

  const titulo = `Nova competência aberta: ${competenciaStr}`;
  const mensagem =
    `A competência ${competenciaStr} foi aberta para ${secretariaNome}. ` +
    `Prazo de envio das folhas: ${fmt(comp.prazo_envio as string | null)}. ` +
    `Prazo de análise: ${fmt(comp.prazo_analise as string | null)}.`;

  // 3. Notificações in-app
  const { error: nErr, count } = await supabaseAdmin.from("notificacoes").insert(
    destinatarios.map((u) => ({
      usuario_id: u.id,
      tipo: "sistema" as const,
      prioridade: "alta" as const,
      canal: "interno" as const,
      titulo,
      mensagem,
      link: "/frequencias",
      entidade_tipo: "competencia",
      entidade_id: competenciaId,
      created_by: criadoPor ?? null,
    })) as never,
    { count: "exact" },
  );
  if (nErr) logger.error("competencia.notificar.inapp_erro", { error: nErr.message });

  // 4. Aviso no mural (para as unidades da secretaria)
  let avisoId: string | null = null;
  const { data: aviso, error: aErr } = await supabaseAdmin
    .from("avisos_mural")
    .insert({
      titulo,
      mensagem,
      tipo: "informativo",
      prioridade: "alta",
      fixado: true,
      destinatarios: unidadeIds.length > 0 ? { tipo: "unidades", valores: unidadeIds } : { tipo: "todos" },
      data_inicio: new Date().toISOString().split("T")[0],
      data_fim: (comp.prazo_envio as string | null) ?? null,
      ativo: true,
      criado_por: criadoPor ?? null,
    } as never)
    .select("id")
    .maybeSingle();
  if (aErr) logger.error("competencia.notificar.mural_erro", { error: aErr.message });
  else avisoId = (aviso?.id as string) ?? null;

  // 5. E-mails
  const baseUrl = process.env.VITE_APP_URL || process.env.SITE_URL || "https://hsmgestao.lovable.app";
  const emails = [...new Set(destinatarios.map((u) => u.email).filter((e): e is string => !!e && e.includes("@")))];
  let enviados = 0;

  for (const email of emails) {
    const html = generateEmailTemplate({
      title: "Nova Competência Aberta",
      message: mensagem,
      ctaLabel: "Acessar Sistema",
      ctaUrl: `${baseUrl}/frequencias`,
      details: [
        { label: "Competência", value: competenciaStr },
        { label: "Secretaria", value: secretariaNome },
        { label: "Prazo de Envio", value: fmt(comp.prazo_envio as string | null) },
        { label: "Prazo de Análise", value: fmt(comp.prazo_analise as string | null) },
      ],
    });
    const r = await sendEmail({ to: email, subject: `[Aviso] Nova Competência Aberta: ${competenciaStr}`, html });
    if (r.success) enviados++;
  }

  return {
    usuarios: destinatarios.length,
    notificacoes: count ?? destinatarios.length,
    emails: enviados,
    aviso_id: avisoId,
  };
}
