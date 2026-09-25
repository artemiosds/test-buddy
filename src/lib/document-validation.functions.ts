import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type PublicDocumentRow = {
  id: string;
  documento_tipo: string;
  descricao: string | null;
  hash_sha256: string;
  nome_assinante: string | null;
  assinado_em: string;
  status: string;
  revogado_em: string | null;
  motivo_revogacao: string | null;
  codigo_validacao: string;
};

export const getPublicDocumentValidation = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ code: z.string().trim().min(1).max(160) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const query = supabaseAdmin
      .from("documentos_assinados")
      .select("id, documento_tipo, descricao, hash_sha256, nome_assinante, assinado_em, status, revogado_em, motivo_revogacao, codigo_validacao")
      .limit(1);
    const { data: rows, error } = await (uuidRe.test(data.code)
      ? query.eq("id", data.code)
      : query.eq("codigo_validacao", data.code));
    if (error) throw new Error("Não foi possível consultar a autenticidade do documento.");

    const row = (rows?.[0] ?? null) as PublicDocumentRow | null;
    if (!row) return null;
    return {
      id: row.id,
      tipo: row.documento_tipo,
      descricao: row.descricao ?? row.documento_tipo,
      hash: row.hash_sha256,
      nomeAssinante: row.nome_assinante,
      assinadoEm: row.assinado_em,
      status: row.status ?? "ativo",
      revogadoEm: row.revogado_em,
      motivoRevogacao: row.motivo_revogacao,
      codigoValidacao: row.codigo_validacao,
    };
  });