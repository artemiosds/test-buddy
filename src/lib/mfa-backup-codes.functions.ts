import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CODE_COUNT = 10;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I

function randomCode(len = 10): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  // formato AAAA-AAAA-AA para facilitar leitura
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 10)}`;
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input.trim().toUpperCase());
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Gera novos códigos de recuperação (revoga os anteriores).
 * Retorna os códigos em texto puro **uma única vez** — o servidor
 * persiste apenas os hashes em `usuarios.mfa_backup_codes`.
 */
export const regenerateBackupCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const codes = Array.from({ length: CODE_COUNT }, () => randomCode());
    const hashes = await Promise.all(codes.map((c) => sha256Hex(c)));

    const { error } = await context.supabase
      .from("usuarios")
      .update({ mfa_backup_codes: hashes })
      .eq("id", context.userId);

    if (error) throw new Error(error.message);
    return { codes };
  });

/** Quantos códigos ainda restam válidos (sem revelar valores). */
export const countBackupCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("usuarios")
      .select("mfa_backup_codes")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const list = Array.isArray(data?.mfa_backup_codes)
      ? (data!.mfa_backup_codes as unknown[])
      : [];
    return { count: list.length };
  });

/**
 * 7A/5D.1 — Consome um código de recuperação e desenrola os fatores MFA do
 * usuário. Requer sessão autenticada (aal1 já basta, o próprio fluxo é para
 * quem não consegue completar o desafio MFA). O código é validado no banco
 * via RPC `verify_and_consume_backup_code` (SECURITY DEFINER, SHA-256).
 * Se válido, usa o cliente admin (server-only, service_role) apenas para
 * remover os fatores TOTP verificados do próprio usuário — nenhuma outra
 * operação privilegiada é exposta ao cliente.
 */
export const consumeBackupCodeAndUnenroll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => {
    const code = String(input?.code ?? "").trim();
    if (code.length < 8 || code.length > 32) {
      throw new Error("Código de recuperação inválido");
    }
    return { code };
  })
  .handler(async ({ data, context }) => {
    const { data: ok, error: rpcErr } = await context.supabase.rpc(
      "verify_and_consume_backup_code",
      { _code: data.code },
    );
    if (rpcErr) throw new Error(rpcErr.message);
    if (!ok) {
      return { ok: false as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: factorsData, error: listErr } =
      await supabaseAdmin.auth.admin.mfa.listFactors({ userId: context.userId });
    if (listErr) throw new Error(listErr.message);

    const factors = factorsData?.factors ?? [];
    for (const f of factors) {
      const { error: delErr } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
        userId: context.userId,
        id: f.id,
      });
      if (delErr) throw new Error(delErr.message);
    }

    return { ok: true as const, removed: factors.length };
  });