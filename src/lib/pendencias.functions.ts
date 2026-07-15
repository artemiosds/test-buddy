// Módulo Genérico de Pendências Institucionais — Workflow Corporativo.
// Todas as mutações executam no servidor via createServerFn, com validação
// obrigatória de has_permission() e emissão de Eventos de Domínio.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ACOES,
  EVENTOS,
  emitEvento,
  ensurePermission,
  withObservability,
} from "./authz.server";

// ---------- Schemas ----------
const CategoriaSchema = z.enum(["frequencia", "documento", "ponto", "folha", "geral"]);
const PrioridadeSchema = z.enum(["baixa", "media", "alta", "critica"]);

const CriarSchema = z.object({
  titulo: z.string().min(3, "Título obrigatório"),
  descricao: z.string().optional().nullable(),
  categoria: CategoriaSchema.default("geral"),
  prioridade: PrioridadeSchema.default("media"),
  secretaria_id: z.string().uuid(),
  unidade_id: z.string().uuid().nullable().optional(),
  origem_tipo: z.string().optional().nullable(),
  origem_id: z.string().uuid().optional().nullable(),
  frequencia_id: z.string().uuid().optional().nullable(),
  frequencia_profissional_id: z.string().uuid().optional().nullable(),
  responsavel_id: z.string().uuid().optional().nullable(),
  prazo: z.string().optional().nullable(),      // YYYY-MM-DD
  sla_horas: z.number().int().positive().optional().nullable(),
});

// ---------- Helpers ----------
async function loadEscopo(supabase: any, id: string) {
  const { data, error } = await supabase
    .from("pendencias")
    .select("id, status, secretaria_id, unidade_id, correlation_id, categoria")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Pendência não encontrada.");
  return data as {
    id: string;
    status: string;
    secretaria_id: string | null;
    unidade_id: string | null;
    correlation_id: string;
    categoria: string;
  };
}

async function registrarHistorico(
  supabase: any,
  args: {
    pendencia_id: string;
    acao: string;
    status_anterior?: string | null;
    status_novo?: string | null;
    comentario?: string | null;
    autor_id: string;
    evento_id?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("pendencia_historico").insert({
    pendencia_id: args.pendencia_id,
    acao: args.acao,
    status_anterior: args.status_anterior ?? null,
    status_novo: args.status_novo ?? null,
    comentario: args.comentario ?? null,
    autor_id: args.autor_id,
    evento_id: args.evento_id ?? null,
    metadata: args.metadata ?? {},
  });
}

// =============================================================
// LISTAR
// =============================================================
export const listPendencias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: {
    status?: string | null;
    categoria?: string | null;
    unidade_id?: string | null;
    secretaria_id?: string | null;
    responsavel_id?: string | null;
    frequencia_id?: string | null;
    q?: string | null;
    limit?: number;
  } | undefined) =>
    z.object({
      status: z.string().nullish(),
      categoria: z.string().nullish(),
      unidade_id: z.string().uuid().nullish(),
      secretaria_id: z.string().uuid().nullish(),
      responsavel_id: z.string().uuid().nullish(),
      frequencia_id: z.string().uuid().nullish(),
      q: z.string().nullish(),
      limit: z.number().int().positive().max(500).default(200),
    }).parse(input ?? {}),
  )
  .handler(withObservability("pendencia.listar", async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("pendencias")
      .select(
        "id, numero, titulo, categoria, prioridade, status, secretaria_id, unidade_id, responsavel_id, prazo, aberta_em, respondida_em, resolvida_em, frequencia_id, frequencia_profissional_id",
      )
      .is("deleted_at", null)
      .order("aberta_em", { ascending: false })
      .limit(data.limit);

    if (data.status)         q = q.eq("status", data.status as any);
    if (data.categoria)      q = q.eq("categoria", data.categoria as any);

    if (data.unidade_id)     q = q.eq("unidade_id", data.unidade_id);
    if (data.secretaria_id)  q = q.eq("secretaria_id", data.secretaria_id);
    if (data.responsavel_id) q = q.eq("responsavel_id", data.responsavel_id);
    if (data.frequencia_id)  q = q.eq("frequencia_id", data.frequencia_id);
    if (data.q)              q = q.ilike("titulo", `%${data.q}%`);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  }));

// =============================================================
// DETALHE + HISTÓRICO
// =============================================================
export const getPendencia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(withObservability("pendencia.detalhe", async ({ data, context }) => {
    const { supabase } = context;
    const { data: p, error } = await supabase
      .from("pendencias")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) throw new Error("Pendência não encontrada.");

    const { data: hist } = await supabase
      .from("pendencia_historico")
      .select("*")
      .eq("pendencia_id", data.id)
      .order("created_at", { ascending: true });

    return { pendencia: p, historico: hist ?? [] };
  }));

// =============================================================
// CRIAR
// =============================================================
export const criarPendencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => CriarSchema.parse(input))
  .handler(withObservability("pendencia.criar", async ({ data, context }) => {
    const { supabase, userId } = context;

    await ensurePermission(supabase, userId, ACOES.PENDENCIA_CRIAR, {
      _unidade_id: data.unidade_id ?? null,
      _secretaria_id: data.secretaria_id,
    });

    // Gera número sequencial atômico
    const { data: numero, error: numErr } = await supabase.rpc(
      "proximo_numero_pendencia",
      { _secretaria_id: data.secretaria_id },
    );
    if (numErr) throw new Error(numErr.message);

    const insertPayload = {
      numero,
      titulo: data.titulo,
      descricao: data.descricao ?? null,
      categoria: data.categoria,
      prioridade: data.prioridade,
      status: "aberta" as const,
      secretaria_id: data.secretaria_id,
      unidade_id: data.unidade_id ?? null,
      origem_tipo: data.origem_tipo ?? null,
      origem_id: data.origem_id ?? null,
      frequencia_id: data.frequencia_id ?? null,
      frequencia_profissional_id: data.frequencia_profissional_id ?? null,
      responsavel_id: data.responsavel_id ?? null,
      prazo: data.prazo ?? null,
      sla_horas: data.sla_horas ?? null,
      created_by: userId,
      updated_by: userId,
    };

    // A escrita direta é bloqueada por policy — usa admin client no servidor.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pend, error } = await supabaseAdmin
      .from("pendencias")
      .insert(insertPayload)
      .select("id, correlation_id, numero")
      .single();
    if (error) throw new Error(error.message);

    const eventId = await emitEvento(
      supabase,
      EVENTOS.PENDENCIA_CRIADA,
      "pendencia",
      pend.id,
      {
        numero: pend.numero,
        categoria: data.categoria,
        prioridade: data.prioridade,
        secretaria_id: data.secretaria_id,
        unidade_id: data.unidade_id ?? null,
      },
      { correlation_id: pend.correlation_id },
    );

    await registrarHistorico(supabaseAdmin, {
      pendencia_id: pend.id,
      acao: "criar",
      status_novo: "aberta",
      comentario: data.descricao ?? null,
      autor_id: userId,
      evento_id: eventId,
    });

    return { id: pend.id, numero: pend.numero };
  }));

// =============================================================
// ATRIBUIR RESPONSÁVEL
// =============================================================
export const atribuirPendencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      responsavel_id: z.string().uuid().nullable(),
      comentario: z.string().optional().nullable(),
    }).parse(input),
  )
  .handler(withObservability("pendencia.atribuir", async ({ data, context }) => {
    const { supabase, userId } = context;
    const p = await loadEscopo(supabase, data.id);
    await ensurePermission(supabase, userId, ACOES.PENDENCIA_ATRIBUIR, {
      _unidade_id: p.unidade_id,
      _secretaria_id: p.secretaria_id,
    });

    const novoStatus = p.status === "aberta" && data.responsavel_id ? "em_analise" : p.status;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("pendencias")
      .update({
        responsavel_id: data.responsavel_id,
        status: novoStatus as any,
        updated_by: userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const eventId = await emitEvento(
      supabase,
      EVENTOS.PENDENCIA_ATRIBUIDA,
      "pendencia",
      data.id,
      { responsavel_id: data.responsavel_id },
      { correlation_id: p.correlation_id },
    );

    await registrarHistorico(supabaseAdmin, {
      pendencia_id: data.id,
      acao: "atribuir",
      status_anterior: p.status,
      status_novo: novoStatus,
      comentario: data.comentario ?? null,
      autor_id: userId,
      evento_id: eventId,
      metadata: { responsavel_id: data.responsavel_id },
    });

    return { ok: true };
  }));

// =============================================================
// RESPONDER
// =============================================================
export const responderPendencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      resposta: z.string().min(1, "Resposta obrigatória"),
    }).parse(input),
  )
  .handler(withObservability("pendencia.responder", async ({ data, context }) => {
    const { supabase, userId } = context;
    const p = await loadEscopo(supabase, data.id);
    await ensurePermission(supabase, userId, ACOES.PENDENCIA_RESPONDER, {
      _unidade_id: p.unidade_id,
      _secretaria_id: p.secretaria_id,
    });

    if (["resolvida", "cancelada"].includes(p.status)) {
      throw new Error("Pendência já encerrada — não pode receber resposta.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("pendencias")
      .update({
        status: "respondida",
        respondida_em: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const eventId = await emitEvento(
      supabase,
      EVENTOS.PENDENCIA_RESPONDIDA,
      "pendencia",
      data.id,
      { resposta_len: data.resposta.length },
      { correlation_id: p.correlation_id },
    );

    await registrarHistorico(supabaseAdmin, {
      pendencia_id: data.id,
      acao: "responder",
      status_anterior: p.status,
      status_novo: "respondida",
      comentario: data.resposta,
      autor_id: userId,
      evento_id: eventId,
    });

    return { ok: true };
  }));

// =============================================================
// RESOLVER
// =============================================================
export const resolverPendencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      comentario: z.string().optional().nullable(),
    }).parse(input),
  )
  .handler(withObservability("pendencia.resolver", async ({ data, context }) => {
    const { supabase, userId } = context;
    const p = await loadEscopo(supabase, data.id);
    await ensurePermission(supabase, userId, ACOES.PENDENCIA_RESOLVER, {
      _unidade_id: p.unidade_id,
      _secretaria_id: p.secretaria_id,
    });

    if (p.status === "resolvida") return { ok: true };
    if (p.status === "cancelada") throw new Error("Pendência cancelada não pode ser resolvida.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("pendencias")
      .update({
        status: "resolvida",
        resolvida_em: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const eventId = await emitEvento(
      supabase,
      EVENTOS.PENDENCIA_RESOLVIDA,
      "pendencia",
      data.id,
      {},
      { correlation_id: p.correlation_id },
    );

    await registrarHistorico(supabaseAdmin, {
      pendencia_id: data.id,
      acao: "resolver",
      status_anterior: p.status,
      status_novo: "resolvida",
      comentario: data.comentario ?? null,
      autor_id: userId,
      evento_id: eventId,
    });

    return { ok: true };
  }));

// =============================================================
// REABRIR
// =============================================================
export const reabrirPendencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      motivo: z.string().min(3, "Motivo obrigatório"),
    }).parse(input),
  )
  .handler(withObservability("pendencia.reabrir", async ({ data, context }) => {
    const { supabase, userId } = context;
    const p = await loadEscopo(supabase, data.id);
    // Reabrir = ação de criador/analista — usa a mesma permissão de criar
    await ensurePermission(supabase, userId, ACOES.PENDENCIA_CRIAR, {
      _unidade_id: p.unidade_id,
      _secretaria_id: p.secretaria_id,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("pendencias")
      .update({
        status: "reaberta",
        reabertura_em: new Date().toISOString(),
        resolvida_em: null,
        updated_by: userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const eventId = await emitEvento(
      supabase,
      EVENTOS.PENDENCIA_REABERTA,
      "pendencia",
      data.id,
      { motivo: data.motivo },
      { correlation_id: p.correlation_id },
    );

    await registrarHistorico(supabaseAdmin, {
      pendencia_id: data.id,
      acao: "reabrir",
      status_anterior: p.status,
      status_novo: "reaberta",
      comentario: data.motivo,
      autor_id: userId,
      evento_id: eventId,
    });

    return { ok: true };
  }));

// =============================================================
// CANCELAR
// =============================================================
export const cancelarPendencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      motivo: z.string().min(3, "Motivo obrigatório"),
    }).parse(input),
  )
  .handler(withObservability("pendencia.cancelar", async ({ data, context }) => {
    const { supabase, userId } = context;
    const p = await loadEscopo(supabase, data.id);
    await ensurePermission(supabase, userId, ACOES.PENDENCIA_CANCELAR, {
      _unidade_id: p.unidade_id,
      _secretaria_id: p.secretaria_id,
    });

    if (p.status === "resolvida") throw new Error("Pendência já resolvida não pode ser cancelada.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("pendencias")
      .update({
        status: "cancelada",
        cancelada_em: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const eventId = await emitEvento(
      supabase,
      EVENTOS.PENDENCIA_CANCELADA,
      "pendencia",
      data.id,
      { motivo: data.motivo },
      { correlation_id: p.correlation_id },
    );

    await registrarHistorico(supabaseAdmin, {
      pendencia_id: data.id,
      acao: "cancelar",
      status_anterior: p.status,
      status_novo: "cancelada",
      comentario: data.motivo,
      autor_id: userId,
      evento_id: eventId,
    });

    return { ok: true };
  }));

// =============================================================
// ALTERAR PRIORIDADE
// =============================================================
export const alterarPrioridade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      prioridade: PrioridadeSchema,
      motivo: z.string().optional().nullable(),
    }).parse(input),
  )
  .handler(withObservability("pendencia.alterar_prioridade", async ({ data, context }) => {
    const { supabase, userId } = context;
    const p = await loadEscopo(supabase, data.id);
    await ensurePermission(supabase, userId, ACOES.PENDENCIA_EDITAR, {
      _unidade_id: p.unidade_id,
      _secretaria_id: p.secretaria_id,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("pendencias")
      .update({ prioridade: data.prioridade, updated_by: userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const eventId = await emitEvento(
      supabase,
      "pendencia.prioridade_alterada",
      "pendencia",
      data.id,
      { prioridade: data.prioridade, motivo: data.motivo ?? null },
      { correlation_id: p.correlation_id },
    );

    await registrarHistorico(supabaseAdmin, {
      pendencia_id: data.id,
      acao: "alterar_prioridade",
      status_anterior: p.status,
      status_novo: p.status,
      comentario: data.motivo ?? `Prioridade → ${data.prioridade}`,
      autor_id: userId,
      evento_id: eventId,
    });

    return { ok: true };
  }));

// =============================================================
// ALTERAR PRAZO
// =============================================================
export const alterarPrazo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      prazo: z.string().nullable(), // YYYY-MM-DD ou null
      sla_horas: z.number().int().positive().optional().nullable(),
      motivo: z.string().optional().nullable(),
    }).parse(input),
  )
  .handler(withObservability("pendencia.alterar_prazo", async ({ data, context }) => {
    const { supabase, userId } = context;
    const p = await loadEscopo(supabase, data.id);
    await ensurePermission(supabase, userId, ACOES.PENDENCIA_EDITAR, {
      _unidade_id: p.unidade_id,
      _secretaria_id: p.secretaria_id,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { prazo: string | null; updated_by: string; sla_horas?: number | null } = {
      prazo: data.prazo,
      updated_by: userId,
    };
    if (data.sla_horas !== undefined) patch.sla_horas = data.sla_horas;

    const { error } = await supabaseAdmin
      .from("pendencias")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const eventId = await emitEvento(
      supabase,
      "pendencia.prazo_alterado",
      "pendencia",
      data.id,
      { prazo: data.prazo, sla_horas: data.sla_horas ?? null, motivo: data.motivo ?? null },
      { correlation_id: p.correlation_id },
    );

    await registrarHistorico(supabaseAdmin, {
      pendencia_id: data.id,
      acao: "alterar_prazo",
      status_anterior: p.status,
      status_novo: p.status,
      comentario: data.motivo ?? `Prazo → ${data.prazo ?? "sem prazo"}`,
      autor_id: userId,
      evento_id: eventId,
    });

    return { ok: true };
  }));
