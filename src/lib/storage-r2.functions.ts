import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  R2_PREFIXO,
  assinarUrlDocumento,
  criarUrlUpload,
  removerDocumento,
  r2Disponivel,
  validarObjeto,
} from "./storage-r2.server";

const MIMES_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

const SolicitarSchema = z.object({
  /** Caminho/chave já particionada: {secretaria}/{unidade}/{pasta}/{entidade}/{uuid}.{ext} */
  caminho: z.string().min(3).max(500),
  mime: z.enum(MIMES_PERMITIDOS),
  tamanho: z.number().int().positive(),
  limite_bytes: z.number().int().positive().max(50 * 1024 * 1024),
});

/**
 * Gera a URL assinada de PUT no R2. Se o R2 estiver desabilitado ou falhar,
 * devolve `provider: "supabase"` e o cliente segue pelo fluxo legado.
 */
export const solicitarUploadR2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { caminho: string; mime: string; tamanho: number; limite_bytes: number }) =>
    SolicitarSchema.parse(d),
  )
  .handler(async ({ data }) => {
    if (data.tamanho > data.limite_bytes) {
      throw new Error("Arquivo maior que o limite permitido.");
    }
    if (!r2Disponivel()) {
      return { provider: "supabase" as const, url: null, storage_path: null };
    }
    try {
      const url = await criarUrlUpload(data.caminho, data.mime);
      return {
        provider: "r2" as const,
        url,
        storage_path: `${R2_PREFIXO}${data.caminho}`,
      };
    } catch (e) {
      console.error("[storage-r2] falha ao gerar URL de upload:", (e as Error)?.message);
      return { provider: "supabase" as const, url: null, storage_path: null };
    }
  });

const ConfirmarSchema = z.object({
  storage_path: z.string().min(3).max(520),
  limite_bytes: z.number().int().positive().max(50 * 1024 * 1024),
});

/** Valida no R2 (HEAD) o objeto recém-enviado; apaga e falha se exceder o limite. */
export const confirmarUploadR2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof ConfirmarSchema>) => ConfirmarSchema.parse(d))
  .handler(async ({ data }) => {
    const r = await validarObjeto(data.storage_path, data.limite_bytes);
    return { ok: true as const, tamanho: r.tamanho };
  });

const ResolverSchema = z.object({
  storage_path: z.string().min(1).max(520),
  bucket: z.string().min(1).max(60).optional(),
});

/** Resolve a URL de visualização (R2 assinado ou Supabase legado). */
export const resolverUrlDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof ResolverSchema>) => ResolverSchema.parse(d))
  .handler(async ({ data, context }) => {
    const url = await assinarUrlDocumento(context.supabase as never, data.storage_path, {
      bucket: data.bucket ?? "documentos",
    });
    return { url };
  });

/** Exclui o binário no destino correto (R2 ou Supabase legado). */
export const removerDocumentoStorage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof ResolverSchema>) => ResolverSchema.parse(d))
  .handler(async ({ data, context }) => {
    await removerDocumento(context.supabase as never, data.storage_path, data.bucket ?? "documentos");
    return { ok: true as const };
  });
