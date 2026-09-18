/**
 * Abertura AUTOMÁTICA de pendências institucionais.
 *
 * Este é o único caminho pelo qual o sistema abre pendências sem intervenção
 * humana (folha rejeitada/devolvida, pendência de linha, prazo de envio
 * vencido). Regras invioláveis:
 *  - idempotência por (origem_tipo, origem_id) — nunca duplica pendência
 *    ainda em aberto para o mesmo fato gerador;
 *  - numeração sequencial via RPC `proximo_numero_pendencia`;
 *  - histórico + evento de domínio (o worker de eventos notifica/e-mail).
 */
import { EVENTOS, emitEvento } from "./authz.server";
import { logger } from "./logger";

const STATUS_EM_ABERTO = [
  "aberta",
  "em_analise",
  "aguardando_resposta",
  "respondida",
  "reaberta",
] as const;

export type AberturaAutomatica = {
  titulo: string;
  descricao?: string | null;
  categoria?: "frequencia" | "documento" | "ponto" | "folha" | "geral";
  prioridade?: "baixa" | "media" | "alta" | "critica";
  origem_tipo: string;
  origem_id: string;
  unidade_id?: string | null;
  secretaria_id?: string | null;
  competencia_id?: string | null;
  competencia_unidade_id?: string | null;
  frequencia_id?: string | null;
  frequencia_profissional_id?: string | null;
  responsavel_id?: string | null;
  prazo?: string | null;
  sla_horas?: number | null;
  autor_id?: string | null;
  dados?: Record<string, unknown>;
};

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Descobre a secretaria a partir da unidade (ou competência). */
async function resolverSecretaria(
  admin: any,
  params: { secretaria_id?: string | null; unidade_id?: string | null; competencia_id?: string | null },
): Promise<string | null> {
  if (params.secretaria_id) return params.secretaria_id;
  if (params.unidade_id) {
    const { data } = await admin
      .from("unidades")
      .select("secretaria_id")
      .eq("id", params.unidade_id)
      .maybeSingle();
    if (data?.secretaria_id) return data.secretaria_id as string;
  }
  if (params.competencia_id) {
    const { data } = await admin
      .from("competencias")
      .select("secretaria_id")
      .eq("id", params.competencia_id)
      .maybeSingle();
    if (data?.secretaria_id) return data.secretaria_id as string;
  }
  const { data } = await admin.from("secretarias").select("id").order("nome").limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/**
 * Abre (ou reaproveita) a pendência institucional do fato gerador informado.
 * Nunca lança — falha de pendência não pode derrubar o fluxo de origem.
 */
export async function abrirPendenciaAutomatica(
  input: AberturaAutomatica,
): Promise<{ criada: boolean; id: string | null; numero?: string | null }> {
  try {
    const admin = await getAdmin();

    // 1) Idempotência: já existe pendência aberta para este fato?
    const { data: existente } = await admin
      .from("pendencias")
      .select("id, numero")
      .eq("origem_tipo", input.origem_tipo)
      .eq("origem_id", input.origem_id)
      .in("status", STATUS_EM_ABERTO as unknown as string[])
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (existente?.id) return { criada: false, id: existente.id as string, numero: existente.numero };

    const secretariaId = await resolverSecretaria(admin, {
      secretaria_id: input.secretaria_id ?? null,
      unidade_id: input.unidade_id ?? null,
      competencia_id: input.competencia_id ?? null,
    });
    if (!secretariaId) {
      logger.warn("pendencia_auto.sem_secretaria", { origem: input.origem_tipo });
      return { criada: false, id: null };
    }

    const { data: numero, error: numErr } = await admin.rpc("proximo_numero_pendencia", {
      _secretaria_id: secretariaId,
    });
    if (numErr) throw new Error(numErr.message);

    const { data: pend, error } = await admin
      .from("pendencias")
      .insert({
        numero,
        titulo: input.titulo,
        descricao: input.descricao ?? null,
        categoria: input.categoria ?? "geral",
        prioridade: input.prioridade ?? "media",
        status: "aberta",
        secretaria_id: secretariaId,
        unidade_id: input.unidade_id ?? null,
        competencia_id: input.competencia_id ?? null,
        competencia_unidade_id: input.competencia_unidade_id ?? null,
        origem_tipo: input.origem_tipo,
        origem_id: input.origem_id,
        frequencia_id: input.frequencia_id ?? null,
        frequencia_profissional_id: input.frequencia_profissional_id ?? null,
        responsavel_id: input.responsavel_id ?? null,
        prazo: input.prazo ?? null,
        sla_horas: input.sla_horas ?? null,
        dados: input.dados ?? {},
        created_by: input.autor_id ?? null,
        updated_by: input.autor_id ?? null,
      })
      .select("id, numero, correlation_id")
      .single();
    if (error) throw new Error(error.message);

    const eventId = await emitEvento(
      admin,
      EVENTOS.PENDENCIA_CRIADA,
      "pendencia",
      pend.id,
      {
        numero: pend.numero,
        origem_tipo: input.origem_tipo,
        origem_id: input.origem_id,
        automatica: true,
      },
      { correlation_id: pend.correlation_id },
    );

    await admin.from("pendencia_historico").insert({
      pendencia_id: pend.id,
      acao: "criar",
      status_novo: "aberta",
      comentario: input.descricao ?? "Abertura automática pelo sistema.",
      autor_id: input.autor_id ?? null,
      evento_id: eventId,
      metadata: { automatica: true, origem_tipo: input.origem_tipo },
    });

    return { criada: true, id: pend.id as string, numero: pend.numero as string };
  } catch (e) {
    logger.warn("pendencia_auto.falhou", {
      origem: input.origem_tipo,
      message: (e as Error).message,
    });
    return { criada: false, id: null };
  }
}

/** Encerra automaticamente pendências de um fato gerador que deixou de existir. */
export async function resolverPendenciaAutomatica(params: {
  origem_tipo: string;
  origem_id: string;
  comentario: string;
  autor_id?: string | null;
}): Promise<number> {
  try {
    const admin = await getAdmin();
    const { data: abertas } = await admin
      .from("pendencias")
      .select("id, correlation_id, status")
      .eq("origem_tipo", params.origem_tipo)
      .eq("origem_id", params.origem_id)
      .in("status", STATUS_EM_ABERTO as unknown as string[])
      .is("deleted_at", null);

    for (const p of abertas ?? []) {
      await admin
        .from("pendencias")
        .update({
          status: "resolvida",
          resolvida_em: new Date().toISOString(),
          updated_by: params.autor_id ?? null,
        })
        .eq("id", p.id);

      const eventId = await emitEvento(
        admin,
        EVENTOS.PENDENCIA_RESOLVIDA,
        "pendencia",
        p.id,
        { automatica: true },
        { correlation_id: p.correlation_id },
      );

      await admin.from("pendencia_historico").insert({
        pendencia_id: p.id,
        acao: "resolver",
        status_anterior: p.status,
        status_novo: "resolvida",
        comentario: params.comentario,
        autor_id: params.autor_id ?? null,
        evento_id: eventId,
        metadata: { automatica: true },
      });
    }
    return (abertas ?? []).length;
  } catch (e) {
    logger.warn("pendencia_auto.resolver_falhou", { message: (e as Error).message });
    return 0;
  }
}
