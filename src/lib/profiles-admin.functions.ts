// Server functions para CRUD de Perfis + Matriz Perfil × Permissão.
// Somente MASTER pode escrever. Perfis com is_sistema=true recebem proteção
// extra (não podem ser excluídos, código não pode mudar, MASTER não pode
// ser desativado). RLS/policies existentes continuam sendo a fonte da verdade
// em runtime — este módulo só oferece a UI administrativa.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureMaster, emitEvento, EVENTOS } from "./authz.server";

const CODIGO_RE = /^[A-Z][A-Z0-9_]{1,49}$/;

async function loadPerfil(supabase: any, id: string) {
  const { data, error } = await supabase
    .from("perfis")
    .select("id, codigo, nome, is_sistema, status, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Perfil não encontrado.");
  return data as {
    id: string;
    codigo: string;
    nome: string;
    is_sistema: boolean;
    status: string;
    deleted_at: string | null;
  };
}

// ---------------------------------------------------------------------------
// Criar
// ---------------------------------------------------------------------------
export const createPerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        codigo: z.string().regex(CODIGO_RE, "Código deve ser MAIÚSCULO, começar com letra e usar apenas A-Z 0-9 _."),
        nome: z.string().min(2).max(120),
        descricao: z.string().max(500).optional().nullable(),
        nivel_hierarquico: z.number().int().min(1).max(999).default(100),
        admin_2fa_required: z.boolean().default(false),
        copiar_de: z.string().uuid().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await ensureMaster(context.supabase, context.userId);

    const { data: dup } = await context.supabase
      .from("perfis")
      .select("id")
      .eq("codigo", data.codigo)
      .maybeSingle();
    if (dup) throw new Error(`Já existe um perfil com o código ${data.codigo}.`);

    const { data: created, error } = await context.supabase
      .from("perfis")
      .insert({
        codigo: data.codigo,
        nome: data.nome,
        descricao: data.descricao ?? null,
        nivel_hierarquico: data.nivel_hierarquico,
        admin_2fa_required: data.admin_2fa_required,
        is_sistema: false,
        status: "ativa",
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const newId = (created as { id: string }).id;

    if (data.copiar_de) {
      const { data: src, error: sErr } = await context.supabase
        .from("perfil_permissoes")
        .select("permissao_id, concedida")
        .eq("perfil_id", data.copiar_de);
      if (sErr) throw new Error(sErr.message);
      const rows = (src ?? [])
        .filter((r: { concedida: boolean }) => r.concedida)
        .map((r: { permissao_id: string }) => ({
          perfil_id: newId,
          permissao_id: r.permissao_id,
          concedida: true,
        }));
      if (rows.length > 0) {
        const { error: iErr } = await context.supabase.from("perfil_permissoes").insert(rows);
        if (iErr) throw new Error(iErr.message);
      }
    }

    await emitEvento(context.supabase, "perfil.criado", "permissao", newId, {
      codigo: data.codigo,
      copiado_de: data.copiar_de ?? null,
    });
    return { id: newId };
  });

// ---------------------------------------------------------------------------
// Editar
// ---------------------------------------------------------------------------
export const updatePerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        codigo: z.string().regex(CODIGO_RE).optional(),
        nome: z.string().min(2).max(120).optional(),
        descricao: z.string().max(500).nullable().optional(),
        nivel_hierarquico: z.number().int().min(1).max(999).optional(),
        admin_2fa_required: z.boolean().optional(),
        status: z.enum(["ativa", "inativa", "suspensa", "arquivada"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await ensureMaster(context.supabase, context.userId);
    const atual = await loadPerfil(context.supabase, data.id);

    const patch: Record<string, unknown> = {};
    if (data.nome !== undefined) patch.nome = data.nome;
    if (data.descricao !== undefined) patch.descricao = data.descricao;
    if (data.nivel_hierarquico !== undefined) patch.nivel_hierarquico = data.nivel_hierarquico;

    if (data.codigo !== undefined && data.codigo !== atual.codigo) {
      if (atual.is_sistema)
        throw new Error("O código de perfis de sistema não pode ser alterado.");
      const { data: dup } = await context.supabase
        .from("perfis")
        .select("id")
        .eq("codigo", data.codigo)
        .neq("id", data.id)
        .maybeSingle();
      if (dup) throw new Error(`Já existe um perfil com o código ${data.codigo}.`);
      patch.codigo = data.codigo;
    }

    if (data.admin_2fa_required !== undefined) {
      if (atual.codigo === "MASTER" && data.admin_2fa_required === false)
        throw new Error("MASTER deve manter 2FA obrigatório.");
      patch.admin_2fa_required = data.admin_2fa_required;
    }

    if (data.status !== undefined && data.status !== atual.status) {
      if (atual.codigo === "MASTER" && data.status !== "ativa")
        throw new Error("O perfil MASTER não pode ser desativado.");
      patch.status = data.status;
    }

    if (Object.keys(patch).length === 0) return { id: data.id, changed: false };
    patch.updated_by = context.userId;

    const { error } = await context.supabase
      .from("perfis")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await emitEvento(context.supabase, "perfil.editado", "permissao", data.id, {
      campos: Object.keys(patch),
    });
    return { id: data.id, changed: true };
  });

// ---------------------------------------------------------------------------
// Duplicar (nome + código novos, herda permissões concedidas)
// ---------------------------------------------------------------------------
export const duplicarPerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        novo_codigo: z.string().regex(CODIGO_RE),
        novo_nome: z.string().min(2).max(120),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await ensureMaster(context.supabase, context.userId);
    const src = await loadPerfil(context.supabase, data.id);

    const { data: dup } = await context.supabase
      .from("perfis")
      .select("id")
      .eq("codigo", data.novo_codigo)
      .maybeSingle();
    if (dup) throw new Error(`Já existe um perfil com o código ${data.novo_codigo}.`);

    const { data: created, error } = await context.supabase
      .from("perfis")
      .insert({
        codigo: data.novo_codigo,
        nome: data.novo_nome,
        descricao: `Duplicado a partir de ${src.nome}`,
        nivel_hierarquico: 100,
        admin_2fa_required: false,
        is_sistema: false,
        status: "ativa",
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const newId = (created as { id: string }).id;

    const { data: srcPerms, error: sErr } = await context.supabase
      .from("perfil_permissoes")
      .select("permissao_id, concedida")
      .eq("perfil_id", data.id);
    if (sErr) throw new Error(sErr.message);

    const rows = (srcPerms ?? [])
      .filter((r: { concedida: boolean }) => r.concedida)
      .map((r: { permissao_id: string }) => ({
        perfil_id: newId,
        permissao_id: r.permissao_id,
        concedida: true,
      }));
    if (rows.length > 0) {
      const { error: iErr } = await context.supabase.from("perfil_permissoes").insert(rows);
      if (iErr) throw new Error(iErr.message);
    }

    await emitEvento(context.supabase, "perfil.duplicado", "permissao", newId, {
      origem_id: data.id,
      origem_codigo: src.codigo,
      permissoes_copiadas: rows.length,
    });
    return { id: newId };
  });

// ---------------------------------------------------------------------------
// Excluir (soft delete). Bloqueia is_sistema e perfis com usuários.
// ---------------------------------------------------------------------------
export const deletePerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await ensureMaster(context.supabase, context.userId);
    const atual = await loadPerfil(context.supabase, data.id);
    if (atual.is_sistema) throw new Error("Perfis de sistema não podem ser excluídos.");

    const { count, error: cErr } = await context.supabase
      .from("usuarios")
      .select("id", { count: "exact", head: true })
      .eq("perfil_id", data.id)
      .is("deleted_at", null);
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) > 0)
      throw new Error(
        `Este perfil tem ${count} usuário(s) vinculado(s). Migre-os para outro perfil antes de excluir.`,
      );

    const { error } = await context.supabase
      .from("perfis")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: context.userId,
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await emitEvento(context.supabase, "perfil.excluido", "permissao", data.id, {
      codigo: atual.codigo,
    });
    return { id: data.id };
  });

// ---------------------------------------------------------------------------
// Matriz: toggle único
// ---------------------------------------------------------------------------
export const setPerfilPermissao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        perfil_id: z.string().uuid(),
        permissao_id: z.string().uuid(),
        concedida: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await ensureMaster(context.supabase, context.userId);
    const atual = await loadPerfil(context.supabase, data.perfil_id);
    if (atual.codigo === "MASTER")
      throw new Error("MASTER tem acesso total por design — a matriz é read-only.");

    const { error } = await context.supabase.from("perfil_permissoes").upsert(
      {
        perfil_id: data.perfil_id,
        permissao_id: data.permissao_id,
        concedida: data.concedida,
        created_by: context.userId,
      } as never,
      { onConflict: "perfil_id,permissao_id" },
    );
    if (error) throw new Error(error.message);

    await emitEvento(context.supabase, EVENTOS.PERMISSAO_ALTERADA, "permissao", data.perfil_id, {
      permissao_id: data.permissao_id,
      concedida: data.concedida,
    });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Matriz: bulk (marcar/desmarcar tudo, por módulo, inverter, ids arbitrários)
// ---------------------------------------------------------------------------
export const setPerfilPermissoesEmMassa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        perfil_id: z.string().uuid(),
        permissao_ids: z.array(z.string().uuid()).min(1),
        concedida: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await ensureMaster(context.supabase, context.userId);
    const atual = await loadPerfil(context.supabase, data.perfil_id);
    if (atual.codigo === "MASTER")
      throw new Error("MASTER tem acesso total por design — a matriz é read-only.");

    const rows = data.permissao_ids.map((pid) => ({
      perfil_id: data.perfil_id,
      permissao_id: pid,
      concedida: data.concedida,
      created_by: context.userId,
    }));

    const { error } = await context.supabase
      .from("perfil_permissoes")
      .upsert(rows as never, { onConflict: "perfil_id,permissao_id" });
    if (error) throw new Error(error.message);

    await emitEvento(context.supabase, EVENTOS.PERMISSAO_ALTERADA, "permissao", data.perfil_id, {
      operacao: "bulk",
      qtd: rows.length,
      concedida: data.concedida,
    });
    return { ok: true, qtd: rows.length };
  });

// ---------------------------------------------------------------------------
// Override por unidade: define/limpa uma sobreposição de permissão do perfil
// para uma unidade específica. NULL/undefined em `concedida` remove o override
// e faz a unidade voltar a herdar o padrão do perfil.
// ---------------------------------------------------------------------------
export const setPerfilPermissaoUnidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        perfil_id: z.string().uuid(),
        permissao_id: z.string().uuid(),
        unidade_id: z.string().uuid(),
        concedida: z.boolean().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await ensureMaster(context.supabase, context.userId);
    const atual = await loadPerfil(context.supabase, data.perfil_id);
    if (atual.codigo === "MASTER")
      throw new Error("MASTER tem acesso total por design — sobreposições não se aplicam.");

    if (data.concedida === null) {
      const { error } = await context.supabase
        .from("perfil_permissoes_unidade")
        .delete()
        .eq("perfil_id", data.perfil_id)
        .eq("permissao_id", data.permissao_id)
        .eq("unidade_id", data.unidade_id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("perfil_permissoes_unidade")
        .upsert(
          {
            perfil_id: data.perfil_id,
            permissao_id: data.permissao_id,
            unidade_id: data.unidade_id,
            concedida: data.concedida,
            created_by: context.userId,
          } as never,
          { onConflict: "perfil_id,permissao_id,unidade_id" },
        );
      if (error) throw new Error(error.message);
    }

    await emitEvento(
      context.supabase,
      EVENTOS.PERMISSAO_ALTERADA,
      "permissao",
      data.perfil_id,
      {
        escopo: "unidade",
        unidade_id: data.unidade_id,
        permissao_id: data.permissao_id,
        concedida: data.concedida,
      },
    );
    return { ok: true };
  });

// Bulk por unidade — mesma semântica de setPerfilPermissoesEmMassa
export const setPerfilPermissoesUnidadeEmMassa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        perfil_id: z.string().uuid(),
        unidade_id: z.string().uuid(),
        permissao_ids: z.array(z.string().uuid()).min(1),
        concedida: z.boolean().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await ensureMaster(context.supabase, context.userId);
    const atual = await loadPerfil(context.supabase, data.perfil_id);
    if (atual.codigo === "MASTER")
      throw new Error("MASTER tem acesso total por design — sobreposições não se aplicam.");

    if (data.concedida === null) {
      const { error } = await context.supabase
        .from("perfil_permissoes_unidade")
        .delete()
        .eq("perfil_id", data.perfil_id)
        .eq("unidade_id", data.unidade_id)
        .in("permissao_id", data.permissao_ids);
      if (error) throw new Error(error.message);
    } else {
      const rows = data.permissao_ids.map((pid) => ({
        perfil_id: data.perfil_id,
        permissao_id: pid,
        unidade_id: data.unidade_id,
        concedida: data.concedida as boolean,
        created_by: context.userId,
      }));
      const { error } = await context.supabase
        .from("perfil_permissoes_unidade")
        .upsert(rows as never, { onConflict: "perfil_id,permissao_id,unidade_id" });
      if (error) throw new Error(error.message);
    }

    await emitEvento(
      context.supabase,
      EVENTOS.PERMISSAO_ALTERADA,
      "permissao",
      data.perfil_id,
      {
        escopo: "unidade",
        operacao: "bulk",
        unidade_id: data.unidade_id,
        qtd: data.permissao_ids.length,
        concedida: data.concedida,
      },
    );
    return { ok: true, qtd: data.permissao_ids.length };
  });

