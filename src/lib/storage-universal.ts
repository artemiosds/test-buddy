/**
 * Camada universal de storage (client-safe).
 *
 * Uploads NOVOS vão para o Cloudflare R2 via URL assinada de PUT gerada no
 * servidor. Arquivos LEGADOS continuam sendo lidos do Supabase Storage —
 * nada é migrado. A decisão é feita pelo prefixo salvo em `storage_path`:
 *
 *   "r2:secretaria/unidade/pasta/entidade/arquivo.pdf"  -> Cloudflare R2
 *   "secretaria/unidade/..." ou "https://..."           -> Supabase / URL antiga
 *
 * Nenhuma credencial do R2 passa por aqui: o navegador só recebe URLs assinadas.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  confirmarUploadR2,
  removerDocumentoStorage,
  resolverUrlDocumento,
  solicitarUploadR2,
} from "@/lib/storage-r2.functions";

export const R2_PREFIXO = "r2:";

export function isR2(valor: string | null | undefined): boolean {
  return !!valor && valor.startsWith(R2_PREFIXO);
}

export function isUrlAbsoluta(valor: string | null | undefined): boolean {
  return !!valor && /^https?:\/\//i.test(valor);
}

export function isLegadoSupabase(valor: string | null | undefined): boolean {
  if (!valor) return false;
  if (isR2(valor)) return false;
  if (isUrlAbsoluta(valor)) return /supabase\.co\/storage/i.test(valor);
  return true;
}

/**
 * URL de visualização/download do documento, retrocompatível.
 * Sempre assinada e de curta duração — nunca URL pública.
 */
export async function obterUrlVisualizacao(
  urlOuPath: string | null | undefined,
  opcoes?: { bucket?: string; expiraEm?: number },
): Promise<string | null> {
  const alvo = (urlOuPath ?? "").trim();
  if (!alvo) return null;
  if (isUrlAbsoluta(alvo)) return alvo;

  if (isR2(alvo)) {
    try {
      const r = await resolverUrlDocumento({
        data: { storage_path: alvo, bucket: opcoes?.bucket ?? "documentos" },
      });
      return r?.url ?? null;
    } catch (e) {
      console.error("[storage] falha ao resolver URL no R2:", (e as Error)?.message);
      return null;
    }
  }

  const { data } = await supabase.storage
    .from(opcoes?.bucket ?? "documentos")
    .createSignedUrl(alvo, opcoes?.expiraEm ?? 300);
  return data?.signedUrl ?? null;
}

/**
 * Envia o arquivo para o R2 (PUT assinado). Se o R2 não estiver disponível ou
 * o envio falhar, cai automaticamente no Supabase Storage (fluxo legado).
 *
 * Retorna o valor a ser gravado em `documentos.storage_path`.
 */
export async function enviarArquivoUniversal(params: {
  file: File;
  /** Caminho já particionado, sem prefixo: {secretaria}/{unidade}/... */
  caminho: string;
  mime: string;
  limiteBytes: number;
  /** Bucket usado no fallback do Supabase. */
  bucket?: string;
}): Promise<{ storage_path: string; provider: "r2" | "supabase" }> {
  const bucket = params.bucket ?? "documentos";

  let destino: { provider: "r2" | "supabase"; url: string | null; storage_path: string | null } = {
    provider: "supabase",
    url: null,
    storage_path: null,
  };
  try {
    destino = await solicitarUploadR2({
      data: {
        caminho: params.caminho,
        mime: params.mime,
        tamanho: params.file.size,
        limite_bytes: params.limiteBytes,
      },
    });
  } catch (e) {
    console.error("[storage] presign indisponível, usando Supabase:", (e as Error)?.message);
  }

  if (destino.provider === "r2" && destino.url && destino.storage_path) {
    const storagePath = destino.storage_path;
    try {
      const put = await fetch(destino.url, {
        method: "PUT",
        headers: { "content-type": params.mime },
        body: params.file,
      });
      if (!put.ok) {
        throw new Error(`R2 respondeu ${put.status}: ${await put.text()}`);
      }
      await confirmarUploadR2({
        data: { storage_path: storagePath, limite_bytes: params.limiteBytes },
      });
      return { storage_path: storagePath, provider: "r2" };
    } catch (e) {
      console.error("[storage] upload no R2 falhou, usando Supabase:", (e as Error)?.message);
    }
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(params.caminho, params.file, { contentType: params.mime, upsert: false });
  if (error) throw new Error(error.message);
  return { storage_path: params.caminho, provider: "supabase" };
}

/** Remove o binário no destino correto (usado apenas em exclusões definitivas). */
export async function removerArquivoUniversal(
  storagePath: string,
  bucket = "documentos",
): Promise<void> {
  if (isR2(storagePath)) {
    await removerDocumentoStorage({ data: { storage_path: storagePath, bucket } });
    return;
  }
  await supabase.storage.from(bucket).remove([storagePath]);
}
