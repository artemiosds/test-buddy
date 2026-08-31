import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACOES, ensurePermission } from "./authz.server";
import { chaveR2, isCaminhoR2, objetoExisteR2 } from "./storage-r2.server";

const Schema = z.object({
  entidade_id: z.string().uuid(),
  tipo_entidade: z.enum(["frequencia", "frequencia_submissao"]).default("frequencia_submissao"),
  subtipo: z.string().max(30).optional(),
  setor_id: z.string().uuid().optional(),
  /** Notificação por e-mail é OPCIONAL — a notificação in-app é sempre criada. */
  notificar_email: z.boolean().default(false),
  mensagem: z.string().max(500).optional(),
});

/**
 * Solicita ao diretor/autor o reenvio dos anexos cujo binário não está mais no
 * armazenamento (R2/Supabase). Cria notificação in-app e, opcionalmente, e-mail.
 */
export const solicitarReenvioAnexos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof Schema>) => Schema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.FREQUENCIA_APROVAR);

    let q = supabase
      .from("documentos")
      .select("id, nome, storage_path, created_by, deleted_at, metadata, unidade_id")
      .eq("tipo_entidade", data.tipo_entidade)
      .eq("entidade_id", data.entidade_id);
    if (data.subtipo) q = q.eq("metadata->>folha", data.subtipo);
    if (data.setor_id) q = q.eq("metadata->>setor_id", data.setor_id);

    const { data: docs, error } = await q.order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = (docs ?? []) as Array<{
      id: string;
      nome: string;
      storage_path: string;
      created_by: string | null;
      deleted_at: string | null;
      metadata: Record<string, unknown> | null;
    }>;

    // Ausentes = removidos por falta de binário OU ativos cujo objeto não existe mais.
    const ausentes: typeof rows = [];
    for (const d of rows) {
      if (d.deleted_at) {
        if (d.metadata && (d.metadata as { binario_ausente?: boolean }).binario_ausente) ausentes.push(d);
        continue;
      }
      const existe = isCaminhoR2(d.storage_path) ? await objetoExisteR2(chaveR2(d.storage_path)) : true;
      if (!existe) ausentes.push(d);
    }

    if (ausentes.length === 0) {
      return { ausentes: [] as string[], destinatarios: 0, notificacoes: 0, emails: 0 };
    }

    const autorIds = [...new Set(ausentes.map((d) => d.created_by).filter((v): v is string => !!v))];
    if (autorIds.length === 0) {
      throw new Error("Não foi possível identificar o responsável pelos anexos ausentes.");
    }

    const { data: usuarios } = await supabase
      .from("usuarios")
      .select("id, nome_completo, email, status")
      .in("id", autorIds);

    const destinatarios = (usuarios ?? []).filter(
      (u) => (u as { status?: string }).status === "ativo",
    ) as Array<{ id: string; nome_completo: string | null; email: string | null }>;

    if (destinatarios.length === 0) {
      throw new Error("O responsável pelos anexos ausentes está inativo — solicite por outro canal.");
    }

    const listaNomes = ausentes.map((d) => d.nome);
    const titulo = "Reenvio de anexos solicitado";
    const mensagemBase =
      data.mensagem?.trim() ||
      `Os seguintes documentos comprobatórios não estão mais disponíveis no armazenamento e precisam ser reenviados: ${listaNomes.join(", ")}.`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: nErr, count } = await supabaseAdmin.from("notificacoes").insert(
      destinatarios.map((u) => ({
        usuario_id: u.id,
        tipo: "pendencia" as const,
        prioridade: "alta" as const,
        canal: "interno" as const,
        titulo,
        mensagem: mensagemBase,
        link: "/frequencias",
        entidade_tipo: data.tipo_entidade,
        entidade_id: data.entidade_id,
        created_by: userId,
      })) as never,
      { count: "exact" },
    );
    if (nErr) throw new Error(nErr.message);

    let emails = 0;
    if (data.notificar_email) {
      const { sendEmail, generateEmailTemplate } = await import("./email.server");
      const alvos = destinatarios.filter((u) => !!u.email && u.email.includes("@"));
      for (const u of alvos) {
        const html = generateEmailTemplate({
          title: titulo,
          message: mensagemBase,
          details: listaNomes.map((n, i) => ({ label: `Documento ${i + 1}`, value: n })),
        });
        const res = await sendEmail({
          to: u.email as string,
          subject: "[Ação necessária] Reenvio de documentos comprobatórios",
          html,
        });
        if (res.success) emails += 1;
      }
    }

    return {
      ausentes: listaNomes,
      destinatarios: destinatarios.length,
      notificacoes: count ?? destinatarios.length,
      emails,
    };
  });
