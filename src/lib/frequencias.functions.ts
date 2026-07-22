import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACOES, EVENTOS, ensurePermission, emitEvento } from "./authz.server";

const NUM = z.number().nonnegative().default(0);

const LinhaSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  _new: z.boolean().optional(),
  _dirty: z.boolean().optional(),
  profissional_id: z.string().uuid(),
  dias_trabalhados: NUM,
  faltas_justificadas: NUM,
  faltas_injustificadas: NUM,
  ferias: NUM,
  licencas: NUM,
  afastamentos: NUM,
  horas_extras: NUM,
  plantoes_extras: NUM,
  adicional_noturno: NUM,
  atestado: NUM,
  he_50: NUM,
  he_100: NUM,
  sobreaviso: NUM,
  incentivo: NUM,
  licenca_premio: NUM,
  ferias_terco: NUM,
  ferias_integral: NUM,
  sal_sub_h: NUM,
  aulas_suplementares: NUM,
  observacoes: z.string().nullable().optional(),
});

const SalvarSchema = z.object({
  frequencia_id: z.string().uuid(),
  observacoes: z.string().nullable().optional(),
  linhas: z.array(LinhaSchema),
  ids_manter: z.array(z.string().uuid()),
});

const PAYLOAD_FIELDS = [
  "dias_trabalhados",
  "faltas_justificadas",
  "faltas_injustificadas",
  "ferias",
  "licencas",
  "afastamentos",
  "horas_extras",
  "plantoes_extras",
  "adicional_noturno",
  "atestado",
  "he_50",
  "he_100",
  "sobreaviso",
  "incentivo",
  "licenca_premio",
  "ferias_terco",
  "ferias_integral",
  "sal_sub_h",
  "aulas_suplementares",
  "observacoes",
] as const;

export const salvarLinhasFrequencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof SalvarSchema>) => SalvarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.FREQUENCIA_EDITAR);

    const dirty = data.linhas.filter((l) => l._dirty);
    const toInsert = dirty
      .filter((l) => l._new)
      .map((l) => {
        const row: Record<string, unknown> = {
          frequencia_id: data.frequencia_id,
          profissional_id: l.profissional_id,
          created_by: userId,
        };
        for (const f of PAYLOAD_FIELDS) row[f] = (l as any)[f];
        return row;
      });
    const toUpdate = dirty.filter((l) => !l._new && l.id);

    // Delete rows that existed but are no longer in the sheet
    const { data: existentes, error: exErr } = await supabase
      .from("frequencia_profissional")
      .select("id")
      .eq("frequencia_id", data.frequencia_id)
      .is("deleted_at", null);
    if (exErr) throw new Error(exErr.message);
    const kept = new Set(data.ids_manter);
    const toDelete = (existentes ?? []).map((r) => r.id).filter((eid) => !kept.has(eid));

    if (toInsert.length) {
      const { error } = await supabase.from("frequencia_profissional").insert(toInsert as never);
      if (error) throw new Error(error.message);
    }
    for (const l of toUpdate) {
      const patch: Record<string, unknown> = { updated_by: userId };
      for (const f of PAYLOAD_FIELDS) patch[f] = (l as any)[f];
      const { error } = await supabase
        .from("frequencia_profissional")
        .update(patch as never)
        .eq("id", l.id!);
      if (error) throw new Error(error.message);
    }
    if (toDelete.length) {
      const { error } = await supabase
        .from("frequencia_profissional")
        .update({ deleted_at: new Date().toISOString(), deleted_by: userId } as never)
        .in("id", toDelete);
      if (error) throw new Error(error.message);
    }
    const { error: fErr } = await supabase
      .from("frequencias")
      .update({ observacoes: data.observacoes ?? null, updated_by: userId } as never)
      .eq("id", data.frequencia_id);
    if (fErr) throw new Error(fErr.message);
    return { ok: true };
  });

const StatusEnum = z.enum([
  "rascunho",
  "enviada",
  "em_analise",
  "com_pendencias",
  "aprovada",
  "rejeitada",
  "arquivada",
]);

const AlterarStatusSchema = z.object({
  frequencia_id: z.string().uuid(),
  status: StatusEnum,
  observacoes: z.string().nullable().optional(),
});

const PERM_STATUS: Record<string, string> = {
  enviada: ACOES.FREQUENCIA_ENVIAR,
  em_analise: ACOES.FREQUENCIA_ANALISAR,
  aprovada: ACOES.FREQUENCIA_APROVAR,
  rejeitada: ACOES.FREQUENCIA_REJEITAR,
  com_pendencias: ACOES.FREQUENCIA_REJEITAR,
  arquivada: ACOES.FREQUENCIA_ARQUIVAR,
  rascunho: ACOES.FREQUENCIA_REABRIR,
};

const EVENTO_STATUS: Record<string, string> = {
  enviada: EVENTOS.FREQUENCIA_ENVIADA,
  em_analise: EVENTOS.FREQUENCIA_EM_ANALISE,
  aprovada: EVENTOS.FREQUENCIA_APROVADA,
  rejeitada: EVENTOS.FREQUENCIA_REJEITADA,
  com_pendencias: EVENTOS.FREQUENCIA_COM_PENDENCIAS,
  arquivada: EVENTOS.FREQUENCIA_ARQUIVADA,
  rascunho: EVENTOS.FREQUENCIA_REABERTA,
};

const ACAO_LABEL: Record<string, string> = {
  enviada: "Envio para análise",
  em_analise: "Colocada em análise",
  aprovada: "Aprovação",
  com_pendencias: "Retorno com pendências",
  rejeitada: "Rejeição",
  arquivada: "Arquivada",
  rascunho: "Reabertura",
};

export const alterarStatusFrequencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof AlterarStatusSchema>) => AlterarStatusSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const perm = PERM_STATUS[data.status];
    if (perm) await ensurePermission(supabase, userId, perm);

    const { data: freq, error: fErr } = await supabase
      .from("frequencias")
      .select(
        "id, status, competencia_unidade_id, competencia_unidades(competencia_id, competencias(prazo_envio))",
      )
      .eq("id", data.frequencia_id)
      .maybeSingle();
    if (fErr) throw new Error(fErr.message);
    if (!freq) throw new Error("Frequência não encontrada");
    const anterior = (freq as any).status;

    // Guard: aprovar bloqueado se houver pendências abertas/respondidas
    if (data.status === "aprovada") {
      const { count } = await supabase
        .from("frequencia_pendencias")
        .select("id", { count: "exact", head: true })
        .eq("frequencia_id", data.frequencia_id)
        .in("status", ["aberta", "respondida"])
        .is("deleted_at", null);
      if ((count ?? 0) > 0) {
        throw new Error(`Existem ${count} pendência(s) não resolvida(s).`);
      }
    }

    const patch: Record<string, unknown> = { status: data.status, updated_by: userId };
    if (data.status === "enviada") {
      patch.enviada_por = userId;
      patch.data_envio = new Date().toISOString();
    }
    if (data.status === "aprovada") {
      patch.aprovada_por = userId;
      patch.data_aprovacao = new Date().toISOString();
    }

    const { error: upErr } = await supabase
      .from("frequencias")
      .update(patch as never)
      .eq("id", data.frequencia_id);
    if (upErr) throw new Error(upErr.message);

    const label = ACAO_LABEL[data.status];
    if (label) {
      const prazoEnvio = (freq as any).competencia_unidades?.competencias?.prazo_envio;
      const foraPrazo =
        data.status === "enviada" &&
        !!prazoEnvio &&
        new Date() > new Date(prazoEnvio + "T23:59:59");
      const { error: logErr } = await supabase.from("frequencia_aprovacoes").insert({
        frequencia_id: data.frequencia_id,
        status_anterior: anterior,
        status_novo: data.status,
        acao: foraPrazo ? `${label} (FORA DO PRAZO)` : label,
        observacoes: data.observacoes ?? null,
        executado_por: userId,
        created_by: userId,
      } as never);
      if (logErr) throw new Error(logErr.message);
    }

    const tipoEvento = EVENTO_STATUS[data.status];
    if (tipoEvento) {
      await emitEvento(supabase, tipoEvento, "frequencia", data.frequencia_id, {
        status_anterior: anterior,
        status_novo: data.status,
      });
    }
    return { ok: true };
  });

const PendenciaSchema = z.object({
  frequencia_id: z.string().uuid(),
  frequencia_profissional_id: z.string().uuid(),
  titulo: z.string().min(1).max(200),
  descricao: z.string().max(2000).optional().default(""),
});

export const abrirPendenciaLinha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof PendenciaSchema>) => PendenciaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.PENDENCIA_CRIAR);
    const { data: inserted, error } = await supabase
      .from("frequencia_pendencias")
      .insert({
        frequencia_id: data.frequencia_id,
        frequencia_profissional_id: data.frequencia_profissional_id,
        titulo: data.titulo,
        descricao: data.descricao,
        status: "aberta",
        aberta_por: userId,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    // Marca a frequência como com_pendencias se estava enviada/em_analise
    const { data: freq } = await supabase
      .from("frequencias")
      .select("status")
      .eq("id", data.frequencia_id)
      .maybeSingle();
    const st = (freq as any)?.status;
    if (st === "enviada" || st === "em_analise") {
      await supabase
        .from("frequencias")
        .update({ status: "com_pendencias", updated_by: userId } as never)
        .eq("id", data.frequencia_id);
      await emitEvento(
        supabase,
        EVENTOS.FREQUENCIA_COM_PENDENCIAS,
        "frequencia",
        data.frequencia_id,
        {
          motivo: "pendencia_aberta",
        },
      );
    }
    await emitEvento(
      supabase,
      EVENTOS.PENDENCIA_CRIADA,
      "pendencia",
      (inserted as any)?.id ?? null,
      {
        frequencia_id: data.frequencia_id,
        frequencia_profissional_id: data.frequencia_profissional_id,
        titulo: data.titulo,
      },
    );
    return { ok: true };
  });

const AutoInsertSchema = z.object({
  frequencia_id: z.string().uuid(),
  profissional_ids: z.array(z.string().uuid()).min(1),
});

export const inserirLinhasAuto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof AutoInsertSchema>) => AutoInsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.FREQUENCIA_EDITAR);
    const rows = data.profissional_ids.map((pid) => ({
      frequencia_id: data.frequencia_id,
      profissional_id: pid,
      created_by: userId,
    }));
    const { error } = await supabase.from("frequencia_profissional").insert(rows as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const AnexoSchema = z.object({
  frequencia_profissional_id: z.string().uuid(),
  unidade_id: z.string().uuid().nullable().optional(),
  categoria_id: z.string().uuid().nullable().optional(),
  nome: z.string().min(1).max(255),
  storage_path: z.string().min(1),
  mime_type: z.string().nullable().optional(),
  tamanho_bytes: z.number().int().nonnegative(),
});

export const registrarAnexoLinha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof AnexoSchema>) => AnexoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.DOCUMENTO_UPLOAD);
    const { data: doc, error } = await supabase
      .from("documentos")
      .insert({
        tipo_entidade: "frequencia",
        entidade_id: data.frequencia_profissional_id,
        unidade_id: data.unidade_id ?? null,
        categoria_id: data.categoria_id ?? null,
        nome: data.nome,
        storage_path: data.storage_path,
        mime_type: data.mime_type ?? null,
        tamanho_bytes: data.tamanho_bytes,
        metadata: { frequencia_profissional_id: data.frequencia_profissional_id },
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await emitEvento(supabase, EVENTOS.DOCUMENTO_ANEXADO, "documento", (doc as any)?.id ?? null, {
      frequencia_profissional_id: data.frequencia_profissional_id,
      nome: data.nome,
    });
    return { ok: true };
  });
