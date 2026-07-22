import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACOES, EVENTOS, ensureMaster, ensurePermission, emitEvento } from "./authz.server";

export const createUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        email: z.string().email(),
        nome_completo: z.string().min(2),
        telefone: z.string().optional().nullable(),
        perfil_id: z.string().uuid(),
        password: z.string().min(6).optional(),
        status: z.enum(["ativo", "pendente", "inativo", "bloqueado"]).default("ativo"),
        unidade_ids: z.array(z.string().uuid()).optional().default([]),
        unidade_principal_id: z.string().uuid().optional().nullable(),
      })
      .parse(data),
  )

  .handler(async ({ data, context }) => {
    // Only MASTER can create users
    const { data: isMaster, error: mErr } = await context.supabase.rpc("is_master", {
      _user_id: context.userId,
    });
    if (mErr) throw new Error(mErr.message);
    if (!isMaster) throw new Error("Apenas o perfil Master pode criar usuários.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const password = data.password ?? Math.random().toString(36).slice(2, 10) + "A1!";

    const tryCreate = async () =>
      supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password,
        email_confirm: true,
        user_metadata: {
          nome_completo: data.nome_completo,
          telefone: data.telefone ?? null,
        },
      });

    let { data: created, error: cErr } = await tryCreate();

    // If auth.users already has this email but there's no active public.usuarios row,
    // it's an orphan from a previous soft-delete — clean it up and retry once.
    if (cErr && cErr.message.toLowerCase().includes("already")) {
      const { data: existing } = await supabaseAdmin
        .from("usuarios")
        .select("id, deleted_at")
        .eq("email", data.email)
        .maybeSingle();

      const isOrphanOrSoftDeleted = !existing || existing.deleted_at !== null;
      if (isOrphanOrSoftDeleted) {
        // Find auth user id by listing (admin API has no getByEmail).
        let orphanId: string | undefined = existing?.id;
        if (!orphanId) {
          const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
          orphanId = list?.users.find(
            (u) => u.email?.toLowerCase() === data.email.toLowerCase(),
          )?.id;
        }
        if (orphanId) {
          if (existing) {
            await supabaseAdmin.from("usuarios").delete().eq("id", orphanId);
          }
          await supabaseAdmin.auth.admin.deleteUser(orphanId);
          ({ data: created, error: cErr } = await tryCreate());
        }
      }
    }

    if (cErr) {
      const message = cErr.message.toLowerCase().includes("already")
        ? "Já existe uma conta cadastrada com este e-mail."
        : cErr.message;
      throw new Error(message);
    }
    const newId = created.user?.id;
    if (!newId) throw new Error("Falha ao criar usuário.");

    // Keep this independent from the auth trigger: if the trigger exists it updates,
    // if it is missing/delayed it creates the public user row immediately.
    const { error: uErr } = await supabaseAdmin.from("usuarios").upsert(
      {
        id: newId,
        perfil_id: data.perfil_id,
        status: data.status,
        nome_completo: data.nome_completo,
        email: data.email,
        telefone: data.telefone ?? null,
      },
      { onConflict: "id" },
    );
    if (uErr) throw new Error(uErr.message);

    // Link user to units (usuario_unidades) and propagate secretaria links.
    if (data.unidade_ids && data.unidade_ids.length > 0) {
      const principalUnidade = data.unidade_principal_id ?? data.unidade_ids[0];
      const rows = data.unidade_ids.map((uid) => ({
        usuario_id: newId,
        unidade_id: uid,
        is_principal: uid === principalUnidade,
      }));
      const { error: vErr } = await supabaseAdmin.from("usuario_unidades").insert(rows);
      if (vErr) throw new Error(`Usuário criado, mas falha ao vincular unidades: ${vErr.message}`);

      // Deriva as secretarias das unidades e cria vínculos em usuario_secretarias.
      // Necessário para as RLS (user_has_secretaria) que gateiam competências, frequências, etc.
      const { data: unidadesInfo, error: unErr } = await supabaseAdmin
        .from("unidades")
        .select("id, secretaria_id")
        .in("id", data.unidade_ids);
      if (unErr)
        throw new Error(
          `Usuário criado, mas falha ao ler secretarias das unidades: ${unErr.message}`,
        );

      const secretariaByUnidade = new Map<string, string>();
      for (const u of unidadesInfo ?? []) {
        if (u.secretaria_id) secretariaByUnidade.set(u.id, u.secretaria_id);
      }
      const principalSecretaria = secretariaByUnidade.get(principalUnidade) ?? null;
      const secretariaIds = Array.from(new Set(secretariaByUnidade.values()));

      if (secretariaIds.length > 0) {
        const secRows = secretariaIds.map((sid) => ({
          usuario_id: newId,
          secretaria_id: sid,
          is_principal: sid === principalSecretaria,
        }));
        const { error: sErr } = await supabaseAdmin.from("usuario_secretarias").insert(secRows);
        if (sErr)
          throw new Error(`Usuário criado, mas falha ao vincular secretarias: ${sErr.message}`);

        // Também define a secretaria principal em usuarios.secretaria_id (usada pela RLS).
        if (principalSecretaria) {
          const { error: upErr } = await supabaseAdmin
            .from("usuarios")
            .update({ secretaria_id: principalSecretaria })
            .eq("id", newId);
          if (upErr)
            throw new Error(
              `Usuário criado, mas falha ao definir secretaria principal: ${upErr.message}`,
            );
        }
      }
    }

    await emitEvento(context.supabase, EVENTOS.USUARIO_CRIADO, "usuario", newId, {
      email: data.email,
      perfil_id: data.perfil_id,
      status: data.status,
    });
    return { id: newId, email: data.email, password };
  });

async function assertMaster(context: { supabase: any; userId: string }) {
  const { data: isMaster, error } = await context.supabase.rpc("is_master", {
    _user_id: context.userId,
  });
  if (error) throw new Error(error.message);
  if (!isMaster) throw new Error("Apenas o perfil Master pode executar esta ação.");
}

export const updateUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        nome_completo: z.string().min(2).optional(),
        email: z.string().email().optional(),
        telefone: z.string().optional().nullable(),
        password: z.string().min(6).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const authPatch: Record<string, unknown> = {};
    if (data.email) authPatch.email = data.email;
    if (data.password) authPatch.password = data.password;
    if (data.nome_completo || data.telefone !== undefined) {
      authPatch.user_metadata = {
        nome_completo: data.nome_completo,
        telefone: data.telefone ?? null,
      };
    }
    if (Object.keys(authPatch).length > 0) {
      const { error: aErr } = await supabaseAdmin.auth.admin.updateUserById(data.id, authPatch);
      if (aErr) throw new Error(aErr.message);
    }

    const rowPatch: {
      nome_completo?: string;
      email?: string;
      telefone?: string | null;
    } = {};
    if (data.nome_completo) rowPatch.nome_completo = data.nome_completo;
    if (data.email) rowPatch.email = data.email;
    if (data.telefone !== undefined) rowPatch.telefone = data.telefone ?? null;
    if (Object.keys(rowPatch).length > 0) {
      const { error: uErr } = await supabaseAdmin
        .from("usuarios")
        .update(rowPatch)
        .eq("id", data.id);
      if (uErr) throw new Error(uErr.message);
    }
    await emitEvento(context.supabase, EVENTOS.USUARIO_EDITADO, "usuario", data.id, {
      campos: Object.keys(rowPatch),
    });
    return { id: data.id };
  });

export const deleteUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertMaster(context);
    if (data.id === context.userId) {
      throw new Error("Você não pode excluir a própria conta.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Hard delete: auth.users cascade removes public.usuarios via FK ON DELETE CASCADE.
    const { error: dErr } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (dErr) throw new Error(dErr.message);

    // Safety net: ensure the public row is gone even if cascade didn't apply.
    await supabaseAdmin.from("usuarios").delete().eq("id", data.id);

    await emitEvento(context.supabase, EVENTOS.USUARIO_EXCLUIDO, "usuario", data.id, {});
    return { id: data.id };
  });

/**
 * Ajusta perfil e/ou status do usuário. Somente Master.
 * Bloqueia o Master de rebaixar/inativar a si próprio para evitar bloqueio total.
 */
export const alterarPerfilStatusUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        perfil_id: z.string().uuid().optional(),
        status: z.enum(["ativo", "pendente", "inativo", "bloqueado"]).optional(),
      })
      .refine((v) => v.perfil_id || v.status, {
        message: "Informe ao menos perfil ou status.",
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await ensureMaster(context.supabase, context.userId);
    if (data.id === context.userId && (data.status === "inativo" || data.status === "bloqueado")) {
      throw new Error("Você não pode inativar/bloquear a própria conta.");
    }
    const patch: Record<string, unknown> = {};
    if (data.perfil_id) patch.perfil_id = data.perfil_id;
    if (data.status) patch.status = data.status;
    const { error } = await context.supabase
      .from("usuarios")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.status) {
      if (data.status === "inativo" || data.status === "bloqueado") {
        await emitEvento(context.supabase, EVENTOS.USUARIO_BLOQUEADO, "usuario", data.id, {
          status: data.status,
        });
      } else {
        await emitEvento(context.supabase, EVENTOS.USUARIO_EDITADO, "usuario", data.id, {
          status: data.status,
        });
      }
    }
    if (data.perfil_id) {
      await emitEvento(context.supabase, EVENTOS.USUARIO_PERFIL_ALTERADO, "usuario", data.id, {
        perfil_id: data.perfil_id,
      });
    }
    return { id: data.id };
  });

/**
 * Aplica override individual de permissão (concedida | revogada | herdar).
 * "herdar" apaga (soft-delete) qualquer override existente.
 * Somente Master.
 */
export const setUsuarioPermissao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        usuario_id: z.string().uuid(),
        permissao_id: z.string().uuid(),
        state: z.enum(["herdar", "concedida", "revogada"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureMaster(supabase, userId);

    // Verifica se já há override ativo
    const { data: existing, error: exErr } = await supabase
      .from("usuario_permissoes")
      .select("id, tipo")
      .eq("usuario_id", data.usuario_id)
      .eq("permissao_id", data.permissao_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);

    if (data.state === "herdar") {
      if (existing) {
        // Soft-delete preserva histórico para auditoria (tg_audit_row cobre)
        const { error } = await supabase
          .from("usuario_permissoes")
          .update({
            deleted_at: new Date().toISOString(),
            deleted_by: userId,
          } as never)
          .eq("id", (existing as { id: string }).id);
        if (error) throw new Error(error.message);
      }
      return { ok: true, state: "herdar" as const };
    }

    if (existing) {
      const { error } = await supabase
        .from("usuario_permissoes")
        .update({ tipo: data.state, updated_by: userId } as never)
        .eq("id", (existing as { id: string }).id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("usuario_permissoes").insert({
        usuario_id: data.usuario_id,
        permissao_id: data.permissao_id,
        tipo: data.state,
        created_by: userId,
      } as never);
      if (error) throw new Error(error.message);
    }
    await emitEvento(supabase, EVENTOS.PERMISSAO_ALTERADA, "permissao", data.permissao_id, {
      usuario_id: data.usuario_id,
      state: data.state,
    });
    return { ok: true, state: data.state };
  });

/**
 * Ajusta vínculos usuário↔unidade. Substitui completamente a lista (delta interno).
 * Também propaga vínculos usuário↔secretaria (derivados) e secretaria principal em usuarios.
 * Somente Master.
 */
export const definirVinculosUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        usuario_id: z.string().uuid(),
        unidade_ids: z.array(z.string().uuid()),
        unidade_principal_id: z.string().uuid().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureMaster(supabase, userId);

    // Soft-delete atuais
    const nowIso = new Date().toISOString();
    const { error: delErr } = await supabase
      .from("usuario_unidades")
      .update({ deleted_at: nowIso, deleted_by: userId } as never)
      .eq("usuario_id", data.usuario_id)
      .is("deleted_at", null);
    if (delErr) throw new Error(delErr.message);

    if (data.unidade_ids.length === 0) return { ok: true };

    const principal =
      data.unidade_principal_id && data.unidade_ids.includes(data.unidade_principal_id)
        ? data.unidade_principal_id
        : data.unidade_ids[0];

    const rows = data.unidade_ids.map((uid) => ({
      usuario_id: data.usuario_id,
      unidade_id: uid,
      is_principal: uid === principal,
      created_by: userId,
    }));
    const { error: insErr } = await supabase.from("usuario_unidades").insert(rows as never);
    if (insErr) throw new Error(insErr.message);

    // Propaga secretarias
    const { data: unidadesInfo, error: unErr } = await supabase
      .from("unidades")
      .select("id, secretaria_id")
      .in("id", data.unidade_ids);
    if (unErr) throw new Error(unErr.message);

    const map = new Map<string, string>();
    for (const u of unidadesInfo ?? []) {
      const row = u as { id: string; secretaria_id: string | null };
      if (row.secretaria_id) map.set(row.id, row.secretaria_id);
    }
    const secIds = Array.from(new Set(map.values()));
    const secPrincipal = map.get(principal) ?? null;

    await supabase
      .from("usuario_secretarias")
      .update({ deleted_at: nowIso, deleted_by: userId } as never)
      .eq("usuario_id", data.usuario_id)
      .is("deleted_at", null);

    if (secIds.length > 0) {
      const secRows = secIds.map((sid) => ({
        usuario_id: data.usuario_id,
        secretaria_id: sid,
        is_principal: sid === secPrincipal,
        created_by: userId,
      }));
      const { error: sErr } = await supabase.from("usuario_secretarias").insert(secRows as never);
      if (sErr) throw new Error(sErr.message);
      if (secPrincipal) {
        await supabase
          .from("usuarios")
          .update({ secretaria_id: secPrincipal } as never)
          .eq("id", data.usuario_id);
      }
    }
    await emitEvento(supabase, EVENTOS.VINCULOS_ALTERADOS, "usuario", data.usuario_id, {
      unidade_ids: data.unidade_ids,
      unidade_principal_id: principal,
    });
    return { ok: true };
  });

// Silencia lint: import mantido para uso futuro (perfis/permissões granulares no servidor)
export const _rbacHelpers = { ensurePermission };
