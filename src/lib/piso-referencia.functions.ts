import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensurePermission } from "./authz.server";

const CATEGORIAS = ["ENFERMEIRO", "TECNICO_ENFERMAGEM", "AUXILIAR_ENFERMAGEM"] as const;

export const listPisoReferencias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ competencia: z.string().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.visualizar");
    let q = context.supabase
      .from("piso_referencia")
      .select("*")
      .order("competencia", { ascending: false })
      .order("categoria", { ascending: true })
      .limit(2000);
    if (data.competencia) q = q.eq("competencia", data.competencia);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const salvarPisoReferencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        competencia: z.string().regex(/^\d{4}-\d{2}$/),
        categoria: z.enum(CATEGORIAS),
        valor_referencia: z.number().nonnegative(),
        jornada_base: z.number().int().positive().default(44),
        observacao: z.string().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.importar");
    const { error } = await context.supabase.from("piso_referencia").upsert(
      {
        ...data,
        observacao: data.observacao ?? null,
        updated_by: context.userId,
        created_by: context.userId,
      },
      { onConflict: "competencia,categoria" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirPisoReferencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.importar");
    const { error } = await context.supabase.from("piso_referencia").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Importa uma tabela oficial (linhas já lidas de Excel/CSV no cliente). */
export const importarPisoReferencias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        linhas: z
          .array(
            z.object({
              competencia: z.string().regex(/^\d{4}-\d{2}$/),
              categoria: z.enum(CATEGORIAS),
              valor_referencia: z.number().nonnegative(),
              jornada_base: z.number().int().positive().default(44),
            }),
          )
          .max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.importar");
    if (data.linhas.length === 0) return { gravados: 0 };
    const { error } = await context.supabase.from("piso_referencia").upsert(
      data.linhas.map((l) => ({ ...l, created_by: context.userId, updated_by: context.userId })),
      { onConflict: "competencia,categoria" },
    );
    if (error) throw new Error(error.message);
    return { gravados: data.linhas.length };
  });
