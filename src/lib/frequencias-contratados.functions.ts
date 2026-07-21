import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACOES, EVENTOS, ensurePermission, emitEvento } from "./authz.server";

// Contratados = qualquer vínculo cuja natureza NÃO seja estatutário.
const NATUREZAS_CONTRATADO = [
  "temporario", "celetista", "comissionado", "terceirizado",
  "estagiario", "residente", "voluntario",
] as const;

const NUM = z.number().nonnegative();

const LinhaSchema = z.object({
  profissional_id: z.string().uuid(),
  dias_trabalhados: NUM.default(0),
  dias_falta: NUM.default(0),
  atestado: NUM.default(0),
  he_50: NUM.default(0),
  he_100: NUM.default(0),
  adn: NUM.default(0),
  plantoes: NUM.default(0),
  sobreaviso: NUM.default(0),
  incentivo: NUM.default(0),
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
  "dias_trabalhados","dias_falta","atestado","he_50","he_100","adn",
  "plantoes","sobreaviso","incentivo","observacoes",
] as const;

/**
 * Retorna a folha de contratados (uma linha por profissional contratado da unidade).
 * Sempre inclui os dados bancários e o registro existente em frequencias_contratados
 * (ou null caso ainda não exista — o front renderiza como rascunho zerado).
 */
export const listarFolhaContratados = createServerFn({ method: "GET" })
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

    const { data: profs, error: pErr } = await supabase
      .from("profissionais")
      .select(`
        id, matricula, nome_completo, nome_social, cpf,
        banco, agencia, conta_corrente,
        cargo_id, funcao_id, setor_id,
        cargos ( nome ),
        funcoes ( nome ),
        setores!profissionais_setor_id_fkey ( nome ),
        vinculos!inner ( natureza )
      `)
      .eq("unidade_id", data.unidade_id)
      .eq("status", "ativo")
      .is("deleted_at", null)
      .in("vinculos.natureza", [...NATUREZAS_CONTRATADO])
      .order("nome_completo");
    if (pErr) throw new Error(pErr.message);

    const profIds = (profs ?? []).map((p: any) => p.id);
    let freqs: any[] = [];
    if (profIds.length) {
      const { data: fs, error: fErr } = await supabase
        .from("frequencias_contratados")
        .select("*")
        .eq("competencia_id", data.competencia_id)
        .eq("unidade_id", data.unidade_id)
        .in("profissional_id", profIds)
        .is("deleted_at", null);
      if (fErr) throw new Error(fErr.message);
      freqs = fs ?? [];
    }
    const byProf = new Map(freqs.map((f) => [f.profissional_id, f]));

    return (profs ?? []).map((p: any) => ({
      profissional: {
        id: p.id,
        matricula: p.matricula,
        nome: p.nome_social || p.nome_completo,
        cpf: p.cpf ?? null,
        cargo: p.cargos?.nome ?? null,
        funcao: p.funcoes?.nome ?? null,
        setor: p.setores?.nome ?? null,
        cargo_id: p.cargo_id ?? null,
        funcao_id: p.funcao_id ?? null,
        setor_id: p.setor_id ?? null,
        banco: p.banco,
        agencia: p.agencia,
        conta_corrente: p.conta_corrente,
      },
      linha: byProf.get(p.id) ?? null,
    }));
  });

export const salvarFolhaContratados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof SalvarSchema>) => SalvarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.FREQUENCIA_EDITAR);

    // Bloqueia edição se competência já estiver encerrada/arquivada.
    const { data: comp, error: cErr } = await supabase
      .from("competencias")
      .select("id, status")
      .eq("id", data.competencia_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!comp) throw new Error("Competência não encontrada.");
    const st = (comp as any).status;
    if (st === "encerrada" || st === "arquivada") {
      throw new Error("Competência encerrada — folha de contratados em modo somente leitura.");
    }

    // Existentes
    const profIds = data.linhas.map((l) => l.profissional_id);
    const { data: existentes, error: exErr } = await supabase
      .from("frequencias_contratados")
      .select("id, profissional_id, status")
      .eq("competencia_id", data.competencia_id)
      .eq("unidade_id", data.unidade_id)
      .in("profissional_id", profIds)
      .is("deleted_at", null);
    if (exErr) throw new Error(exErr.message);
    const byProf = new Map((existentes ?? []).map((r: any) => [r.profissional_id, r]));

    const toInsert: Record<string, unknown>[] = [];
    const toUpdate: { id: string; patch: Record<string, unknown> }[] = [];

    for (const l of data.linhas) {
      const ex = byProf.get(l.profissional_id);
      // Se linha já foi enviada/aprovada/etc., NÃO permite reescrever pelo usuário comum
      if (ex && ex.status !== "rascunho" && ex.status !== "rejeitada") continue;

      const payload: Record<string, unknown> = {};
      for (const f of PAYLOAD_FIELDS) payload[f] = (l as any)[f] ?? (f === "observacoes" ? null : 0);

      if (ex) {
        toUpdate.push({ id: ex.id, patch: { ...payload, updated_by: userId } });
      } else {
        toInsert.push({
          competencia_id: data.competencia_id,
          unidade_id: data.unidade_id,
          profissional_id: l.profissional_id,
          status: "rascunho",
          created_by: userId,
          ...payload,
        });
      }
    }

    if (toInsert.length) {
      const { error } = await supabase.from("frequencias_contratados").insert(toInsert as never);
      if (error) throw new Error(error.message);
    }
    for (const u of toUpdate) {
      const { error } = await supabase
        .from("frequencias_contratados")
        .update(u.patch as never)
        .eq("id", u.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true, inseridas: toInsert.length, atualizadas: toUpdate.length };
  });

export const enviarFolhaContratados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof EnviarSchema>) => EnviarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.FREQUENCIA_ENVIAR);

    const now = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from("frequencias_contratados")
      .update({
        status: "enviada",
        enviada_por: userId,
        enviada_em: now,
        updated_by: userId,
      } as never)
      .eq("competencia_id", data.competencia_id)
      .eq("unidade_id", data.unidade_id)
      .in("status", ["rascunho", "rejeitada"])
      .is("deleted_at", null)
      .select("id");
    if (error) throw new Error(error.message);

    await emitEvento(
      supabase,
      EVENTOS.FREQUENCIA_ENVIADA,
      "frequencia",
      `${data.competencia_id}:${data.unidade_id}:contratados`,
      {
        competencia_id: data.competencia_id,
        unidade_id: data.unidade_id,
        folha: "contratados",
        linhas: (updated ?? []).length,
      },
    );
    return { ok: true, enviadas: (updated ?? []).length };
  });
