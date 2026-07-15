import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACOES, EVENTOS, ensurePermission, emitEvento } from "./authz.server";


const CriarSchema = z.object({
  ano: z.number().int().min(2000).max(2100),
  mes: z.number().int().min(1).max(12),
  data_inicio: z.string().min(10),
  data_fim: z.string().min(10),
  prazo_envio: z.string().nullable().optional(),
  prazo_analise: z.string().nullable().optional(),
  secretaria_id: z.string().uuid(),
  descricao: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

export const criarCompetencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => CriarSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, ACOES.COMPETENCIA_CRIAR, {
      _secretaria_id: data.secretaria_id,
    });
    const { error, data: row } = await context.supabase
      .from("competencias")
      .insert({
        ano: data.ano,
        mes: data.mes,
        data_inicio: data.data_inicio,
        data_fim: data.data_fim,
        prazo_envio: data.prazo_envio ?? null,
        prazo_analise: data.prazo_analise ?? null,
        secretaria_id: data.secretaria_id,
        descricao: data.descricao ?? null,
        observacoes: data.observacoes ?? null,
        status: "aberta",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const id = row.id as string;
    await emitEvento(context.supabase, EVENTOS.COMPETENCIA_CRIADA, "competencia", id, {
      ano: data.ano, mes: data.mes, secretaria_id: data.secretaria_id,
    });
    return { id };
  });

const EditarSchema = z.object({
  id: z.string().uuid(),
  descricao: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  prazo_envio: z.string().nullable().optional(),
  prazo_analise: z.string().nullable().optional(),
});

export const editarCompetencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => EditarSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, ACOES.COMPETENCIA_EDITAR);
    const patch: Record<string, unknown> = { updated_by: context.userId };
    if (data.descricao !== undefined) patch.descricao = data.descricao;
    if (data.observacoes !== undefined) patch.observacoes = data.observacoes;
    if (data.prazo_envio !== undefined) patch.prazo_envio = data.prazo_envio;
    if (data.prazo_analise !== undefined) patch.prazo_analise = data.prazo_analise;
    const { error } = await context.supabase.from("competencias").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    await emitEvento(context.supabase, EVENTOS.COMPETENCIA_EDITADA, "competencia", data.id, patch);
    return { id: data.id };
  });

const StatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["aberta", "em_processamento", "encerrada", "arquivada"]),
  motivo: z.string().optional(),
});

export const alterarStatusCompetencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => StatusSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Autorização por destino (mapeia status → ação canônica)
    const acaoPorDestino: Record<string, string> = {
      encerrada: ACOES.COMPETENCIA_ENCERRAR,
      arquivada: ACOES.COMPETENCIA_ARQUIVAR,
      aberta:    ACOES.COMPETENCIA_REABRIR,
      em_processamento: ACOES.COMPETENCIA_EDITAR,
    };
    await ensurePermission(context.supabase, context.userId, acaoPorDestino[data.status] ?? ACOES.COMPETENCIA_EDITAR);

    if (data.status === "encerrada") {
      const { count, error: cErr } = await context.supabase
        .from("frequencias")
        .select("id, competencia_unidades!inner(competencia_id)", { count: "exact", head: true })
        .eq("competencia_unidades.competencia_id", data.id)
        .in("status", ["rascunho", "enviada", "em_analise", "com_pendencias"]);
      if (cErr) throw new Error(cErr.message);
      if ((count ?? 0) > 0) {
        throw new Error(`Existem ${count} folha(s) não aprovadas. Aprove ou arquive antes de encerrar.`);
      }
    } else if (data.status === "aberta" && (!data.motivo || !data.motivo.trim())) {
      throw new Error("Motivo da reabertura é obrigatório.");
    }

    const patch: Record<string, unknown> = { status: data.status, updated_by: context.userId };
    if (data.motivo !== undefined) patch.motivo_reabertura = data.motivo;

    const { error } = await context.supabase
      .from("competencias")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const EVENTO_POR_DESTINO: Record<string, string> = {
      encerrada: EVENTOS.COMPETENCIA_ENCERRADA,
      arquivada: EVENTOS.COMPETENCIA_ARQUIVADA,
      aberta:    EVENTOS.COMPETENCIA_REABERTA,
    };
    const tipoEvento = EVENTO_POR_DESTINO[data.status];
    if (tipoEvento) {
      await emitEvento(context.supabase, tipoEvento, "competencia", data.id, {
        motivo: data.motivo ?? null,
      });
    }
    return { id: data.id };
  });

const VincularSchema = z.object({
  competencia_id: z.string().uuid(),
  unidade_ids: z.array(z.string().uuid()).min(1),
});

export const vincularUnidadesCompetencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => VincularSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, ACOES.COMPETENCIA_EDITAR);
    const rows = data.unidade_ids.map((uid) => ({
      competencia_id: data.competencia_id,
      unidade_id: uid,
      status: "nao_iniciada" as const,
      created_by: context.userId,
    }));
    const { error } = await context.supabase.from("competencia_unidades").insert(rows);
    if (error) throw new Error(error.message);
    return { count: rows.length };
  });

export const desvincularUnidadeCompetencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, ACOES.COMPETENCIA_EDITAR);
    const { error } = await context.supabase
      .from("competencia_unidades")
      .update({ deleted_at: new Date().toISOString(), deleted_by: context.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { id: data.id };
  });

const IniciarFreqSchema = z.object({
  competencia_unidade_id: z.string().uuid(),
  tipo: z.enum(["contratados", "efetivos"]),
});

export const iniciarFrequencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => IniciarFreqSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, ACOES.FREQUENCIA_CRIAR);
    const { data: row, error } = await context.supabase
      .from("frequencias")
      .insert({
        competencia_unidade_id: data.competencia_unidade_id,
        tipo: data.tipo,
        status: "rascunho",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const id = row.id as string;
    await emitEvento(context.supabase, EVENTOS.FREQUENCIA_INICIADA, "frequencia", id, {
      competencia_unidade_id: data.competencia_unidade_id, tipo: data.tipo,
    });
    return { id };
  });
