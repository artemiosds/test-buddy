import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail, generateEmailTemplate } from "./email.server";
import { logger } from "./logger";

export type ResultadoEmailAviso = {
  destinatarios: number;
  enviados: number;
  falhas: number;
  motivo: string | null;
};

type Alvo = { id: string; email: string; nome: string };

/**
 * Envia (ou reenvia) por e-mail um aviso do mural, usando as credenciais SMTP
 * de public.configuracoes_sistema (com fallback para variáveis de ambiente).
 */
export async function enviarEmailsAviso(avisoId: string): Promise<ResultadoEmailAviso> {
  const vazio: ResultadoEmailAviso = { destinatarios: 0, enviados: 0, falhas: 0, motivo: null };

  const { data: aviso, error: aErr } = await supabaseAdmin
    .from("avisos_mural")
    .select("id, titulo, subtitulo, mensagem, tipo, prioridade, data_inicio, data_fim, destinatarios")
    .eq("id", avisoId)
    .maybeSingle();

  if (aErr || !aviso) {
    return { ...vazio, motivo: "Aviso não encontrado." };
  }

  const dest = (aviso.destinatarios ?? { tipo: "todos" }) as { tipo?: string; valores?: string[] };
  const alvos = new Map<string, Alvo>();

  const addUsuarios = (
    lista: Array<{ id: unknown; email: unknown; nome_completo: unknown }> | null | undefined,
  ) => {
    for (const u of lista ?? []) {
      const email = (u.email as string) ?? "";
      if (!email.includes("@")) continue;
      alvos.set(u.id as string, {
        id: u.id as string,
        email,
        nome: (u.nome_completo as string) ?? "",
      });
    }
  };

  const baseSelect = () =>
    supabaseAdmin
      .from("usuarios")
      .select("id, email, nome_completo")
      .eq("status", "ativo")
      .is("deleted_at", null);

  if (dest.tipo === "perfis" && (dest.valores?.length ?? 0) > 0) {
    const { data: perfis } = await supabaseAdmin
      .from("perfis")
      .select("id, codigo")
      .in("codigo", dest.valores as string[]);
    const perfilIds = (perfis ?? []).map((p) => p.id as string);
    if (perfilIds.length > 0) {
      const { data } = await baseSelect().in("perfil_id", perfilIds);
      addUsuarios(data);
    }
  } else if (dest.tipo === "unidades" && (dest.valores?.length ?? 0) > 0) {
    const { data: vinculos } = await supabaseAdmin
      .from("usuario_unidades")
      .select("usuario_id")
      .in("unidade_id", dest.valores as string[])
      .is("data_fim", null);
    const ids = [...new Set((vinculos ?? []).map((v) => v.usuario_id as string))];
    if (ids.length > 0) {
      const { data } = await baseSelect().in("id", ids);
      addUsuarios(data);
    }
  } else {
    const { data } = await baseSelect();
    addUsuarios(data);
  }

  const destinatarios = [...alvos.values()];
  if (destinatarios.length === 0) {
    return { ...vazio, motivo: "Nenhum destinatário ativo com e-mail válido para este aviso." };
  }

  const baseUrl = process.env.VITE_APP_URL || process.env.SITE_URL || "https://hsmgestao.lovable.app";
  const assunto = `[Mural] ${aviso.titulo as string}`;
  const html = generateEmailTemplate({
    title: aviso.titulo as string,
    message: `${aviso.subtitulo ? `<strong>${aviso.subtitulo as string}</strong><br/><br/>` : ""}${(aviso.mensagem as string).replace(/\n/g, "<br/>")}`,
    ctaLabel: "Abrir o mural de avisos",
    ctaUrl: `${baseUrl}/administracao/mural`,
    details: [
      { label: "Tipo", value: String(aviso.tipo ?? "informativo") },
      { label: "Prioridade", value: String(aviso.prioridade ?? "normal") },
    ],
  });

  let enviados = 0;
  let falhas = 0;
  let motivo: string | null = null;

  for (const u of destinatarios) {
    const res = await sendEmail({ to: u.email, subject: assunto, html });
    if (res.success) {
      enviados += 1;
    } else {
      falhas += 1;
      if (!motivo) motivo = (res.error as Error | undefined)?.message ?? "Falha no envio do e-mail.";
      if ((res as { skipped?: boolean }).skipped) break; // SMTP desativado/incompleto: não insistir
    }
  }

  logger.info("mural.aviso.email", { avisoId, destinatarios: destinatarios.length, enviados, falhas });

  return { destinatarios: destinatarios.length, enviados, falhas, motivo };
}
