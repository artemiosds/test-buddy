import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACOES, EVENTOS, ensurePermission, emitEvento } from "./authz.server";
import { orquestrarSincronizacao } from "./frequencia-sincronizacao.functions";
import { garantirCompetenciaUnidade } from "./competencia-unidade.server";

const NUM = z.number().nonnegative();

const LinhaSchema = z.object({
  profissional_id: z.string().uuid(),
  dias_trabalhados: NUM.default(0),
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
  "dias_trabalhados",
  "faltas_injustificadas",
  "atestado",
  "he_50",
  "he_100",
  "ferias_terco",
  "ferias_integral",
  "sal_sub_h",
  "adicional_noturno",
  "aulas_suplementares",
  "sobreaviso",
  "plantoes_extras",
  "incentivo",
  "ferias",
  "licenca_premio",
  "observacoes",
] as const;

type SupabaseCtx = { supabase: any; userId: string };

/**
 * Garante que exista uma competencia_unidades para (comp, unidade) e uma
 * frequencias(tipo='efetivos') vinculada, retornando ambos os ids.
 */
async function ensureFolhaEfetivos(ctx: SupabaseCtx, competencia_id: string, unidade_id: string) {
  const { supabase, userId } = ctx;

  const cuId = await garantirCompetenciaUnidade({
    competencia_id,
    unidade_id,
    userId
  });

  let { data: freq, error: fErr } = await supabase
    .from("frequencias")
    .select("id, status")
    .eq("competencia_unidade_id", cuId)
    .eq("tipo", "efetivos")
    .is("deleted_at", null)
    .maybeSingle();
  if (fErr) throw new Error(fErr.message);

  if (!freq) {
    const { data: ins, error } = await supabase
      .from("frequencias")
      .insert({
        competencia_unidade_id: cuId,
        tipo: "efetivos",
        status: "rascunho",
        created_by: userId,
      } as never)
      .select("id, status")
      .single();
    if (error) throw new Error(error.message);
    freq = ins as any;
  }

  return {
    competencia_unidade_id: cuId,
    frequencia_id: freq!.id,
    frequencia_status: freq!.status as string,
  };
}

export const listarFolhaEfetivos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { competencia_id: string; unidade_id: string }) =>
    z
      .object({
        competencia_id: z.string().uuid(),
        unidade_id: z.string().uuid(),
      })
      .parse(d),
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
      .select(
        `
        id, matricula, nome_completo, nome_social, status,
        proj, h_p, c_h, jorn,
        cargo_id, funcao_id, setor_id,
        cargos ( nome ),
        funcoes ( nome ),
        setores!profissionais_setor_id_fkey ( nome ),
        vinculos!inner ( id, natureza, nome )
      `,
      )
      .eq("unidade_id", data.unidade_id)
      .not("status", "in", "(desligado,inativo)")
      .is("deleted_at", null)
      .order("nome_completo");
    if (pErr) throw new Error(pErr.message);

    // Filtro de efetivos: Estatutário/Efetivo ou Comissionado
    const profsFinais = (profs ?? []).filter((p: any) => {
      const natureza = p.vinculos?.natureza?.toLowerCase() || "";
      const nomeVinculo = (p.vinculos?.nome || "").toLowerCase();
      const ehEstatutario = natureza.includes("estatut") || natureza.includes("efetiv") || nomeVinculo.includes("efetiv") || nomeVinculo.includes("estatut");
      const ehComissionado = natureza.includes("comission") || nomeVinculo.includes("comission");
      return ehEstatutario || ehComissionado;
    });

    const profIds = (profsFinais ?? []).map((p: any) => p.id);
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
      itens: (profsFinais ?? []).map((p: any) => ({
        profissional: {
          id: p.id,
          matricula: p.matricula,
          nome: p.nome_social || p.nome_completo,
          status: p.status ?? null,
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
      .select("id, status, ano, mes")
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
    if (
      frequencia_status !== "rascunho" &&
      frequencia_status !== "com_pendencias" &&
      frequencia_status !== "rejeitada"
    ) {
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

    // Proteção: profissionais que não estão ativos (férias/licença/afastamento…)
    // não recebem lançamentos numéricos — os campos são zerados no banco.
    const { data: profsStatus } = await supabase
      .from("profissionais")
      .select("id, status")
      .in("id", profIds);
    const naoAtivos = new Set(
      (profsStatus ?? [])
        .filter((p: any) => (p.status ?? "ativo") !== "ativo")
        .map((p: any) => p.id as string),
    );

    const allRows: any[] = [];

    for (const l of data.linhas) {
      const ex = byProf.get(l.profissional_id);
      if (ex && ex.status_linha === "aprovada") continue;

      // Validação de segurança: limite de dias no mês
      const diasNoMes = new Date(Number(comp.ano), Number(comp.mes), 0).getDate();
      const totalDias = Number(l.dias_trabalhados ?? 0) + Number(l.faltas_injustificadas ?? 0) + 
                        Number(l.atestado ?? 0) + Number(l.ferias ?? 0) + Number(l.licenca_premio ?? 0);
      
      if (totalDias > diasNoMes) {
        throw new Error(`O total de dias (${totalDias}) excede os ${diasNoMes} dias do mês para o profissional.`);
      }

      const payload: Record<string, unknown> = {
        frequencia_id,
        profissional_id: l.profissional_id,
        updated_by: userId,
      };

      if (!ex) {
        payload.created_by = userId;
      } else {
        payload.id = ex.id;
      }

      const inativo = naoAtivos.has(l.profissional_id);
      for (const f of PAYLOAD_FIELDS)
        payload[f] =
          f === "observacoes"
            ? ((l as any)[f] ?? null)
            : inativo
              ? 0
              : ((l as any)[f] ?? 0);

      allRows.push(payload);
    }

    if (allRows.length) {
      const { error } = await supabase
        .from("frequencia_profissional")
        .upsert(allRows, { onConflict: "frequencia_id, profissional_id" });
      if (error) throw new Error(error.message);
    }
    // Sincronização após salvar
    await orquestrarSincronizacao({
      data: {
        evento: "FOLHA_SALVA",
        tipo: "efetivos",
        competencia_id: data.competencia_id,
        unidade_id: data.unidade_id,
      }
    });

    return { ok: true, processadas: allRows.length };
  });

export const enviarFolhaEfetivos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof EnviarSchema>) => EnviarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.FREQUENCIA_ENVIAR);

    const { frequencia_id, frequencia_status } = await ensureFolhaEfetivos(
      { supabase, userId },
      data.competencia_id,
      data.unidade_id,
    );

    // Validação de segurança: total de dias no mês
    const { data: comp } = await supabase
      .from("competencias")
      .select("ano, mes")
      .eq("id", data.competencia_id)
      .single();
    
    if (comp) {
      const { data: linhas } = await supabase
        .from("frequencia_profissional")
        .select("dias_trabalhados, faltas_injustificadas, atestado, ferias, licenca_premio")
        .eq("frequencia_id", frequencia_id)
        .is("deleted_at", null);
      
      const diasNoMes = new Date(Number(comp.ano), Number(comp.mes), 0).getDate();
      for (const l of (linhas ?? [])) {
        const total = Number(l.dias_trabalhados ?? 0) + Number(l.faltas_injustificadas ?? 0) + 
                     Number(l.atestado ?? 0) + Number(l.ferias ?? 0) + Number(l.licenca_premio ?? 0);
        if (total > diasNoMes) {
          throw new Error(`Existem profissionais com mais de ${diasNoMes} dias lançados. Corrija antes de enviar.`);
        }
      }
    }

    const { data: perfil } = await supabase
      .from("perfis")
      .select("nome, codigo")
      .eq("id", (context as any).user?.user_metadata?.perfil_id || "")
      .maybeSingle();

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

    // Sincronização centralizada após envio
    await orquestrarSincronizacao({
      data: {
        evento: "FOLHA_ENVIADA",
        tipo: "efetivos",
        competencia_id: data.competencia_id,
        unidade_id: data.unidade_id,
      }
    });

    // Registra histórico (Seção 2)
    await supabase.from("frequencia_historico").insert({
      frequencia_id,
      status_anterior: frequencia_status,
      status_novo: "enviada",
      acao: "Envio para análise",
      executado_por: userId,
      executado_nome: perfil?.nome || "Usuário HSM",
      executado_perfil: perfil?.codigo || "Indefinido",
      detalhes: { total_linhas: count }
    } as never);

    return { ok: true, enviadas: count ?? 0 };
  });
