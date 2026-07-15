import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACOES, EVENTOS, ensurePermission, emitEvento } from "./authz.server";

const NUM = z.number().nonnegative();

const LinhaSchema = z.object({
  profissional_id: z.string().uuid(),
  faltas_injustificadas: NUM.default(0),
  atestado: NUM.default(0),
  he_50: NUM.default(0),
  he_100: NUM.default(0),
  ferias_terco: NUM.default(0),
  ferias_integral: NUM.default(0),
  sal_sub_h: NUM.default(0),
  adicional_noturno: NUM.default(0),
  aulas_suplementares: NUM.default(0),
  sobreaviso: NUM.default(0),
  plantoes_extras: NUM.default(0),
  incentivo: NUM.default(0),
  ferias: NUM.default(0),
  licenca_premio: NUM.default(0),
  observacoes: z.string().nullable().optional(),
});

const SalvarSchema = z.object({
  competencia_id: z.string().uuid(),
  unidade_id: z.string().uuid(),
  linhas: z.array(LinhaSchema),
});

const EnviarSchema = z.object({
  competencia_id: z.string().uuid(),
  unidade_id: z.string().uuid(),
});

const PAYLOAD_FIELDS = [
  "faltas_injustificadas","atestado","he_50","he_100",
  "ferias_terco","ferias_integral","sal_sub_h","adicional_noturno",
  "aulas_suplementares","sobreaviso","plantoes_extras","incentivo",
  "ferias","licenca_premio","observacoes",
] as const;

type SupabaseCtx = { supabase: any; userId: string };

/**
 * Garante que exista uma competencia_unidades para (comp, unidade) e uma
 * frequencias(tipo='efetivos') vinculada, retornando ambos os ids.
 */
async function ensureFolhaEfetivos(
  ctx: SupabaseCtx,
  competencia_id: string,
  unidade_id: string,
) {
  const { supabase, userId } = ctx;

  let { data: cu, error: cuErr } = await supabase
    .from("competencia_unidades")
    .select("id, status")
    .eq("competencia_id", competencia_id)
    .eq("unidade_id", unidade_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (cuErr) throw new Error(cuErr.message);

  if (!cu) {
    const { data: ins, error } = await supabase
      .from("competencia_unidades")
      .insert({
        competencia_id,
        unidade_id,
        status: "nao_iniciada",
        created_by: userId,
      } as never)
      .select("id, status")
      .single();
    if (error) throw new Error(error.message);
    cu = ins as any;
  }

  let { data: freq, error: fErr } = await supabase
    .from("frequencias")
    .select("id, status")
    .eq("competencia_unidade_id", cu!.id)
    .eq("tipo", "efetivos")
    .is("deleted_at", null)
    .maybeSingle();
  if (fErr) throw new Error(fErr.message);

  if (!freq) {
    const { data: ins, error } = await supabase
      .from("frequencias")
      .insert({
        competencia_unidade_id: cu!.id,
        tipo: "efetivos",
        status: "rascunho",
        created_by: userId,
      } as never)
      .select("id, status")
      .single();
    if (error) throw new Error(error.message);
    freq = ins as any;
  }

  return { competencia_unidade_id: cu!.id, frequencia_id: freq!.id, frequencia_status: freq!.status as string };
}

export const listarFolhaEfetivos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { competencia_id: string; unidade_id: string }) =>
    z.object({
      competencia_id: z.string().uuid(),
      unidade_id: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.FREQUENCIA_VISUALIZAR);

    const { frequencia_id, frequencia_status } = await ensureFolhaEfetivos(
      { supabase, userId },
      data.competencia_id,
      data.unidade_id,
    );

    const { data: profs, error: pErr } = await supabase
      .from("profissionais")
      .select(`
        id, matricula, nome_completo, nome_social,
        proj, h_p, c_h, jorn,
        cargo_id, funcao_id, setor_id,
        cargos ( nome ),
        funcoes ( nome ),
        setores ( nome ),
        vinculos!inner ( id, natureza )
      `)
      .eq("unidade_id", data.unidade_id)
      .eq("status", "ativo")
      .is("deleted_at", null)
      .eq("vinculos.natureza", "efetivo")
      .order("nome_completo");
    if (pErr) throw new Error(pErr.message);

    const profIds = (profs ?? []).map((p: any) => p.id);
    let linhas: any[] = [];
    if (profIds.length) {
      const { data: fs, error } = await supabase
        .from("frequencia_profissional")
        .select("*")
        .eq("frequencia_id", frequencia_id)
        .in("profissional_id", profIds)
        .is("deleted_at", null);
      if (error) throw new Error(error.message);
      linhas = fs ?? [];
    }
    const byProf = new Map(linhas.map((l) => [l.profissional_id, l]));

    return {
      frequencia_id,
      frequencia_status,
      itens: (profs ?? []).map((p: any) => ({
        profissional: {
          id: p.id,
          matricula: p.matricula,
          nome: p.nome_social || p.nome_completo,
          cargo: p.cargos?.nome ?? null,
          funcao: p.funcoes?.nome ?? null,
          setor: p.setores?.nome ?? null,
          cargo_id: p.cargo_id ?? null,
          funcao_id: p.funcao_id ?? null,
          setor_id: p.setor_id ?? null,
          proj: p.proj,
          h_p: p.h_p,
          c_h: p.c_h,
          jorn: p.jorn,
        },
        linha: byProf.get(p.id) ?? null,
      })),
    };
  });

export const salvarFolhaEfetivos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof SalvarSchema>) => SalvarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.FREQUENCIA_EDITAR);

    const { data: comp, error: cErr } = await supabase
      .from("competencias")
      .select("id, status")
      .eq("id", data.competencia_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!comp) throw new Error("Competência não encontrada.");
    const st = (comp as any).status;
    if (st === "encerrada" || st === "arquivada") {
      throw new Error("Competência encerrada — folha de efetivos em modo somente leitura.");
    }

    const { frequencia_id, frequencia_status } = await ensureFolhaEfetivos(
      { supabase, userId },
      data.competencia_id,
      data.unidade_id,
    );
    if (frequencia_status !== "rascunho" && frequencia_status !== "com_pendencias" && frequencia_status !== "rejeitada") {
      throw new Error("Folha já enviada — não é possível editar.");
    }

    const profIds = data.linhas.map((l) => l.profissional_id);
    const { data: existentes, error: exErr } = await supabase
      .from("frequencia_profissional")
      .select("id, profissional_id, status_linha")
      .eq("frequencia_id", frequencia_id)
      .in("profissional_id", profIds)
      .is("deleted_at", null);
    if (exErr) throw new Error(exErr.message);
    const byProf = new Map((existentes ?? []).map((r: any) => [r.profissional_id, r]));

    const toInsert: Record<string, unknown>[] = [];
    const toUpdate: { id: string; patch: Record<string, unknown> }[] = [];

    for (const l of data.linhas) {
      const ex = byProf.get(l.profissional_id);
      if (ex && ex.status_linha === "aprovada") continue;

      const payload: Record<string, unknown> = {};
      for (const f of PAYLOAD_FIELDS) payload[f] = (l as any)[f] ?? (f === "observacoes" ? null : 0);

      if (ex) {
        toUpdate.push({ id: ex.id, patch: { ...payload, updated_by: userId } });
      } else {
        toInsert.push({
          frequencia_id,
          profissional_id: l.profissional_id,
          created_by: userId,
          ...payload,
        });
      }
    }

    if (toInsert.length) {
      const { error } = await supabase.from("frequencia_profissional").insert(toInsert as never);
      if (error) throw new Error(error.message);
    }
    for (const u of toUpdate) {
      const { error } = await supabase
        .from("frequencia_profissional")
        .update(u.patch as never)
        .eq("id", u.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true, inseridas: toInsert.length, atualizadas: toUpdate.length };
  });

export const enviarFolhaEfetivos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof EnviarSchema>) => EnviarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.FREQUENCIA_ENVIAR);

    const { frequencia_id } = await ensureFolhaEfetivos(
      { supabase, userId },
      data.competencia_id,
      data.unidade_id,
    );

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("frequencias")
      .update({
        status: "enviada",
        data_envio: now,
        enviada_por: userId,
        updated_by: userId,
      } as never)
      .eq("id", frequencia_id)
      .in("status", ["rascunho", "com_pendencias", "rejeitada"]);
    if (error) throw new Error(error.message);

    const { count } = await supabase
      .from("frequencia_profissional")
      .select("id", { count: "exact", head: true })
      .eq("frequencia_id", frequencia_id)
      .is("deleted_at", null);

    await emitEvento(
      supabase,
      EVENTOS.FREQUENCIA_ENVIADA,
      "frequencia",
      `${data.competencia_id}:${data.unidade_id}:efetivos`,
      {
        competencia_id: data.competencia_id,
        unidade_id: data.unidade_id,
        folha: "efetivos",
        linhas: count ?? 0,
      },
    );
    return { ok: true, enviadas: count ?? 0 };
  });