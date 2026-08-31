import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logger } from "./logger";
import { chaveR2, isCaminhoR2, objetoExisteR2 } from "./storage-r2.server";

export type AnexoAusenteAuditoria = {
  id: string;
  nome: string;
  tipo_entidade: string;
  entidade_id: string | null;
  storage_path: string;
  created_at: string;
  created_by: string | null;
  autor: string | null;
};

export type ResultadoAuditoriaAnexos = {
  verificados: number;
  ausentes: AnexoAusenteAuditoria[];
  masters_notificados: number;
  emails_enviados: number;
};

const TIPOS = ["frequencia", "frequencia_submissao"] as const;

/**
 * Auditoria diária de integridade dos anexos de submissão.
 *
 * Para todo documento ATIVO (`deleted_at` nulo) gravado no R2 e vinculado a uma
 * frequência/submissão, faz um HEAD no bucket. Se algum binário estiver
 * ausente, notifica todos os usuários Master (notificação in-app + e-mail).
 */
export async function auditarAnexosSubmissoes(): Promise<ResultadoAuditoriaAnexos> {
  const { data: docs, error } = await supabaseAdmin
    .from("documentos")
    .select("id, nome, tipo_entidade, entidade_id, storage_path, created_at, created_by")
    .is("deleted_at", null)
    .in("tipo_entidade", [...TIPOS])
    .like("storage_path", "r2:%")
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    logger.error("anexos.auditoria.erro_busca", { error: error.message });
    return { verificados: 0, ausentes: [], masters_notificados: 0, emails_enviados: 0 };
  }

  const linhas = (docs ?? []) as Omit<AnexoAusenteAuditoria, "autor">[];
  const ausentes: AnexoAusenteAuditoria[] = [];

  // HEADs em lotes para não estourar conexões simultâneas no worker.
  const LOTE = 20;
  for (let i = 0; i < linhas.length; i += LOTE) {
    const bloco = linhas.slice(i, i + LOTE);
    const checados = await Promise.all(
      bloco.map(async (d) => ({
        doc: d,
        existe: isCaminhoR2(d.storage_path) ? await objetoExisteR2(chaveR2(d.storage_path)) : true,
      })),
    );
    for (const c of checados) if (!c.existe) ausentes.push({ ...c.doc, autor: null });
  }

  if (ausentes.length === 0) {
    logger.info("anexos.auditoria.ok", { verificados: linhas.length });
    return { verificados: linhas.length, ausentes: [], masters_notificados: 0, emails_enviados: 0 };
  }

  // Nome do autor de cada anexo ausente (contexto na notificação).
  const autorIds = [...new Set(ausentes.map((a) => a.created_by).filter((v): v is string => !!v))];
  if (autorIds.length) {
    const { data: us } = await supabaseAdmin
      .from("usuarios")
      .select("id, nome_completo")
      .in("id", autorIds);
    const mapa = new Map((us ?? []).map((u) => [(u as { id: string }).id, (u as { nome_completo: string | null }).nome_completo]));
    for (const a of ausentes) a.autor = a.created_by ? (mapa.get(a.created_by) ?? null) : null;
  }

  const { data: perfilMaster } = await supabaseAdmin
    .from("perfis")
    .select("id")
    .eq("codigo", "MASTER")
    .maybeSingle();

  const { data: masters } = await supabaseAdmin
    .from("usuarios")
    .select("id, nome_completo, email")
    .eq("perfil_id", (perfilMaster as { id: string } | null)?.id ?? "")
    .eq("status", "ativo")
    .is("deleted_at", null);


  const destinatarios = (masters ?? []) as Array<{
    id: string;
    nome_completo: string | null;
    email: string | null;
  }>;

  const titulo = "Alerta: anexos ausentes no armazenamento";
  const lista = ausentes.slice(0, 20).map((a) => a.nome);
  const mensagem =
    `A auditoria diária encontrou ${ausentes.length} documento(s) comprobatório(s) ativo(s) ` +
    `sem o binário correspondente no armazenamento R2: ${lista.join(", ")}` +
    (ausentes.length > lista.length ? " e outros." : ".");

  let notificados = 0;
  if (destinatarios.length) {
    const { error: nErr, count } = await supabaseAdmin.from("notificacoes").insert(
      destinatarios.map((u) => ({
        usuario_id: u.id,
        tipo: "alerta" as const,
        prioridade: "urgente" as const,
        canal: "interno" as const,
        titulo,
        mensagem,
        link: "/configuracao",
        entidade_tipo: "documento",
        entidade_id: ausentes[0]?.entidade_id ?? null,
      })) as never,
      { count: "exact" },
    );
    if (nErr) logger.error("anexos.auditoria.erro_notificacao", { error: nErr.message });
    else notificados = count ?? destinatarios.length;
  }

  let emails = 0;
  const { sendEmail, generateEmailTemplate } = await import("./email.server");
  for (const u of destinatarios.filter((d) => !!d.email && d.email.includes("@"))) {
    const html = generateEmailTemplate({
      title: titulo,
      message: mensagem,
      details: ausentes.slice(0, 20).map((a) => ({
        label: a.nome,
        value: `${a.tipo_entidade} · ${a.entidade_id ?? "-"} · autor: ${a.autor ?? "desconhecido"}`,
      })),
    });
    const res = await sendEmail({
      to: u.email as string,
      subject: "[Crítico] Anexos ausentes no armazenamento R2",
      html,
    });
    if (res.success) emails += 1;
  }

  logger.error("anexos.auditoria.ausentes", {
    verificados: linhas.length,
    ausentes: ausentes.length,
  });

  return {
    verificados: linhas.length,
    ausentes,
    masters_notificados: notificados,
    emails_enviados: emails,
  };
}
