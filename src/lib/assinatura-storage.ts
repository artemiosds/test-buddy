/**
 * Resolução centralizada de caminhos do bucket "assinaturas".
 *
 * Histórico: alguns registros gravaram apenas o nome do arquivo em
 * `storage_path` ("<uuid>.png"), outros o caminho completo
 * ("pessoal/{userId}/<uuid>.png" ou "institucional/{userId}/<uuid>.png").
 * Por isso a visualização precisa testar os candidatos possíveis antes de
 * declarar "Object not found".
 */
import { supabase } from "@/integrations/supabase/client";

export const ASSINATURAS_BUCKET = "assinaturas";

/** Assinaturas eletrônicas (hash) não possuem arquivo no Storage. */
export function isVirtualSignature(path?: string | null): boolean {
  return !!path && path.startsWith("institutional_");
}

/** Lista de caminhos possíveis, do mais provável ao menos provável. */
export function signaturePathCandidates(path: string, userId?: string | null): string[] {
  const clean = path.replace(/^\/+/, "");
  const list = [clean];
  if (!clean.includes("/")) {
    if (userId) {
      list.push(`pessoal/${userId}/${clean}`, `institucional/${userId}/${clean}`, `${userId}/${clean}`);
    }
  } else {
    const file = clean.split("/").pop()!;
    if (userId) {
      list.push(`pessoal/${userId}/${file}`, `institucional/${userId}/${file}`, `${userId}/${file}`);
    }
    list.push(file);
  }
  return Array.from(new Set(list.filter(Boolean)));
}

/**
 * Retorna uma URL assinada válida testando todos os candidatos.
 * Retorna null quando nenhum caminho existe (ou assinatura virtual).
 */
export async function getSignatureSignedUrl(
  path: string | null | undefined,
  userId?: string | null,
  expiresIn = 600,
): Promise<string | null> {
  if (!path || isVirtualSignature(path)) return null;
  for (const candidate of signaturePathCandidates(path, userId)) {
    const { data, error } = await supabase.storage
      .from(ASSINATURAS_BUCKET)
      .createSignedUrl(candidate, expiresIn);
    if (!error && data?.signedUrl) return data.signedUrl;
  }
  return null;
}

/** 
 * Remove o arquivo tentando todos os candidatos (idempotente). 
 * Protegido por RLS do Storage que impede a exclusão se o arquivo estiver em uso histórico.
 */
export async function removeSignatureFile(
  path: string | null | undefined,
  userId?: string | null,
): Promise<{ success: boolean; kept?: boolean; error?: string }> {
  if (!path || isVirtualSignature(path)) return { success: true };

  try {
    // A política de RLS do Storage (Proteção de assinaturas em uso) retornará erro 
    // se tentarmos excluir um arquivo que a função public.assinatura_em_uso(name) detectar.
    const candidates = signaturePathCandidates(path, userId);
    const { data, error } = await supabase.storage.from(ASSINATURAS_BUCKET).remove(candidates);

    if (error) {
      // Se o erro for de RLS (ou similar), assumimos que o arquivo foi mantido por segurança
      console.warn("[STORAGE] Falha ou bloqueio na remoção física:", error);
      return { success: false, error: error.message };
    }

    // O Supabase remove() retorna a lista de arquivos deletados.
    // Se a lista estiver vazia mas não houve erro, pode ser que o RLS bloqueou silenciosamente 
    // ou o arquivo não existia.
    const deletedCount = data?.length || 0;
    return { success: true, kept: deletedCount === 0 };
  } catch (err) {
    console.error("[STORAGE] Erro crítico ao tentar remover arquivo:", err);
    return { success: false, error: String(err) };
  }
}
