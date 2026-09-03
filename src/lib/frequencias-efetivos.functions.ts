import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACOES, EVENTOS, ensurePermission, emitEvento } from "./authz.server";
import { orquestrarSincronizacao } from "./frequencia-sincronizacao.functions";
import { garantirCompetenciaUnidade } from "./competencia-unidade.server";
import { assertPrazoEnvio } from "./prazo-envio";

const VAL = z.union([z.number(), z.string()]).default(0);

const LinhaSchema = z.object({
  profissional_id: z.string().uuid(),
  status_linha: z.enum(["pendente", "aprovada", "rejeitada"]).optional(),
  dias_trabalhados: VAL,
  faltas_injustificadas: VAL,
  atestado: VAL,
  he_50: VAL,
  he_100: VAL,
  ferias_terco: VAL,
  ferias_integral: VAL,
  sal_sub_h: VAL,
  adicional_noturno: VAL,
  aulas_suplementares: VAL,
  sobreaviso: VAL,
  plantoes_extras: VAL,
  incentivo: VAL,
  ferias: VAL,
  licenca_premio: VAL,
  observacoes: z.string().nullable().optional(),
});

const SalvarSchema = z.object({
  competencia_id: z.string().uuid(),
  unidade_id: z.string().uuid(), setor_id: z.string().uuid().optional(),
  linhas: z.array(LinhaSchema),
});

const EnviarSchema = z.object({
  competencia_id: z.string().uuid(),
  unidade_id: z.string().uuid(),
  setor_id: z.string().uuid().optional(),
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
/** Reduz o filtro de setor (que pode ser lista) a um único UUID ou null. */
function normalizarSetorId(setor_id?: string | string[] | null): string | null {
  if (Array.isArray(setor_id)) {
    return setor_id.length === 1 ? setor_id[0]! : null;
  }
  return setor_id ?? null;
}

async function ensureFolhaEfetivos(ctx: SupabaseCtx, competencia_id: string, unidade_id: string, setor_id?: string | string[]) {
  const { supabase, userId } = ctx;

  const cuId = await garantirCompetenciaUnidade({
    competencia_id,
    unidade_id,
    userId
  });

  const setor = normalizarSetorId(setor_id);

  const buscar = async () => {
    const q = supabase
      .from("frequencias")
      .select("id, status")
      .eq("competencia_unidade_id", cuId)
      .eq("tipo", "efetivos");
    if (setor) q.eq("setor_id", setor);
    else q.is("setor_id", null);
    const { data, error } = await q.order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    return data as { id: string; status: string } | null;
  };

  let freq = await buscar();

  if (!freq) {
    const { data: ins, error } = await supabase
      .from("frequencias")
      .insert({
        competencia_unidade_id: cuId,
        tipo: "efetivos",
        setor_id: setor,
        status: "rascunho",
        created_by: userId,
      } as never)
      .select("id, status")
      .single();

    if (error) {
      // 23505 = unique_violation (corrida entre requisições simultâneas)
      const dup = (error as any).code === "23505" || /duplicate key/i.test(error.message ?? "");
      if (!dup) throw new Error(error.message);
      freq = await buscar();
    } else {
      freq = ins as any;
    }
  }

  if (!freq) {
    throw new Error("Não foi possível abrir a folha de efetivos para esta unidade/setor. Tente novamente.");
  }

  return {
    competencia_unidade_id: cuId,
    frequencia_id: freq.id,
    frequencia_status: freq.status as string,
  };
}

/**
 * Retorna os ids de TODAS as folhas de efetivos da mesma competência/unidade
 * (a folha geral com setor_id NULL e as folhas criadas por setor).
 *
 * Motivo: quando a unidade envia por setor, as linhas ficam gravadas na folha
 * daquele setor. A tela sem filtro de setor lia só a folha de setor_id NULL e
 * por isso alguns profissionais apareciam "vazios", mesmo com dados visíveis
 * na tela de Aprovações (que lê todas as folhas).
 */
async function idsFolhasIrmasEfetivos(
  supabase: any,
  competencia_unidade_id: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("frequencias")
    .select("id")
    .eq("competencia_unidade_id", competencia_unidade_id)
    .eq("tipo", "efetivos")
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  return (data ?? []).map((f: any) => f.id as string);
}


export const listarFolhaEfetivos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { competencia_id: string; unidade_id: string; setor_id?: string | string[] }) =>
    z
      .object({
        competencia_id: z.string().uuid(),
        unidade_id: z.string().uuid(),
        setor_id: z.union([z.string().uuid(), z.array(z.string().uuid())]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.FREQUENCIA_VISUALIZAR);

    const { frequencia_id, frequencia_status, competencia_unidade_id } = await ensureFolhaEfetivos(
      { supabase, userId },
      data.competencia_id,
      data.unidade_id,
      data.setor_id
    );


    const query = supabase
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
      .not("status", "in", "(inativo)")
      .is("deleted_at", null)
      .order("nome_completo");

    if (data.setor_id) {
      if (Array.isArray(data.setor_id)) {
        query.in("setor_id", data.setor_id);
      } else {
        query.eq("setor_id", data.setor_id);
      }
    }

    const { data: profs, error: pErr } = await query;

    // Filtro de efetivos: Estatutário/Efetivo ou Comissionado (EXCLUI TERCEIRIZADOS)
    const profsFinais = (profs ?? []).filter((p: any) => {
      const natureza = p.vinculos?.natureza?.toLowerCase() || "";
      const nomeVinculo = (p.vinculos?.nome || "").toLowerCase();

      // Terceirizados nunca devem aparecer nas folhas (Missão: Remover Terceirizados)
      if (natureza.includes("terceir") || nomeVinculo.includes("terceir")) return false;

      const ehEstatutario = natureza.includes("estatut") || natureza.includes("efetiv") || nomeVinculo.includes("efetiv") || nomeVinculo.includes("estatut");
      const ehComissionado = natureza.includes("comission") || nomeVinculo.includes("comission");
      return ehEstatutario || ehComissionado;
    });

    const profIds = (profsFinais ?? []).map((p: any) => p.id);
    let linhas: any[] = [];
    if (profIds.length) {
      // Sem filtro de setor a visão é consolidada: lê as linhas de todas as
      // folhas irmãs (geral + por setor) para não "perder" lançamentos.
      const folhaIds = normalizarSetorId(data.setor_id)
        ? [frequencia_id]
        : await idsFolhasIrmasEfetivos(supabase, competencia_unidade_id);
      const { data: fs, error } = await supabase
        .from("frequencia_profissional")
        .select("*")
        .in("frequencia_id", folhaIds.length ? folhaIds : [frequencia_id])
        .in("profissional_id", profIds)
        .is("deleted_at", null)
        .order("updated_at", { ascending: true });
      if (error) throw new Error(error.message);
      linhas = fs ?? [];
    }
    // Ordem crescente por updated_at → o Map mantém a linha mais recente.
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
    await assertPrazoEnvio(supabase, userId, data.competencia_id);

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

    const { frequencia_id, frequencia_status, competencia_unidade_id } = await ensureFolhaEfetivos(
      { supabase, userId },
      data.competencia_id,
      data.unidade_id,
      data.setor_id
    );


    const isMaster = context.claims?.is_master === true;
    const { data: isMasterRPC } = await supabase.rpc("is_master", { _user_id: userId });
    
    // Fallback para Gestor através da tabela perfis caso has_role falhe tipagem ou não exista o enum gestor
    const { data: profile } = await supabase
      .from('usuarios')
      .select('perfil:perfis(codigo)')
      .eq('id', userId)
      .maybeSingle();
    const role = (profile?.perfil as any)?.codigo || "";
    const isGestor = role === "GESTOR" || role === "MASTER" || role === "ADMINISTRADOR_MASTER";
    
    const isMasterFinal = isMaster || isMasterRPC === true || isGestor;

    if (!isMasterFinal) {
      // 1. Bloqueio por status da folha (Bypass Protection)
      if (
        frequencia_status !== "rascunho" &&
        frequencia_status !== "com_pendencias" &&
        frequencia_status !== "rejeitada" &&
        frequencia_status !== "devolvida"

      ) {
        throw new Error("Folha já enviada ou aprovada — não é possível editar sem perfil Master ou Gestor.");
      }
    }

    const profIds = data.linhas.map((l) => l.profissional_id);
    // Sem filtro de setor, a linha do profissional pode estar gravada na folha
    // do setor dele. Procuramos em todas as folhas irmãs para ATUALIZAR a linha
    // existente em vez de criar uma duplicada na folha geral.
    const folhaIdsAlvo = normalizarSetorId(data.setor_id)
      ? [frequencia_id]
      : await idsFolhasIrmasEfetivos(supabase, competencia_unidade_id);
    const { data: existentes, error: exErr } = await supabase
      .from("frequencia_profissional")
      .select("id, frequencia_id, profissional_id, status_linha, updated_at, created_by, aprovada_em, aprovada_por")
      .in("frequencia_id", folhaIdsAlvo.length ? folhaIdsAlvo : [frequencia_id])
      .in("profissional_id", profIds)
      .is("deleted_at", null)
      .order("updated_at", { ascending: true });
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
      if (ex && ex.status_linha === "aprovada" && !isMasterFinal) {
        throw new Error("Não é possível alterar uma linha que já foi aprovada.");
      }

      // Concorrência Otimista: Verifica se a linha foi alterada por outro usuário
      if (ex?.updated_at && (l as any).updated_at) {
        const bancoTime = new Date(ex.updated_at).getTime();
        const clientTime = new Date((l as any).updated_at).getTime();
        if (bancoTime > clientTime) {
          throw new Error(`Conflito de edição: o profissional ${l.profissional_id} foi atualizado por outro usuário. Recarregue a página.`);
        }
      }

      // Validação de segurança: limite de dias no mês
      const diasNoMes = new Date(Number(comp.ano), Number(comp.mes), 0).getDate();
      
      const toN = (v: any) => {
        if (typeof v === 'number') return v;
        const s = String(v || '').trim();
        if (!s) return 0;
        const sClean = s.replace(/\./g, "").replace(',', '.');
        const n = parseFloat(sClean);
        return isNaN(n) ? 0 : n;
      };

      const totalDias = toN(l.dias_trabalhados) + toN(l.faltas_injustificadas) + 
                        toN(l.atestado) + toN(l.ferias) + toN(l.licenca_premio);
      
      if (totalDias > diasNoMes) {
        throw new Error(`O total de dias (${totalDias}) excede os ${diasNoMes} dias do mês para o profissional.`);
      }

      const payload: Record<string, unknown> = {
        frequencia_id: (ex as any)?.frequencia_id ?? frequencia_id,

        profissional_id: l.profissional_id,
        status_linha: l.status_linha || (ex ? ex.status_linha : "pendente") || "pendente",
        aprovada_em: (l.status_linha === "aprovada" && ex?.status_linha !== "aprovada") ? new Date().toISOString() : (ex?.aprovada_em ?? null),
        aprovada_por: (l.status_linha === "aprovada" && ex?.status_linha !== "aprovada") ? userId : (ex?.aprovada_por ?? null),
        updated_by: userId,
      };

      // Todas as linhas do lote precisam do mesmo conjunto de colunas: no upsert
      // em lote o PostgREST envia NULL para chaves ausentes (erro 23502 no `id`).
      payload.id = ex?.id ?? crypto.randomUUID();
      payload.created_by = (ex as any)?.created_by ?? userId;



      const inativo = naoAtivos.has(l.profissional_id);
      for (const f of PAYLOAD_FIELDS) {
        if (f === "observacoes") {
          payload[f] = (l as any)[f] ?? null;
        } else if (inativo) {
          payload[f] = "0";
        } else {
          const val = (l as any)[f];
          // Grava a string limpa vinda do frontend (ex: "24", "1,5", "Férias")
          // O Zod LinhaSchema usa VAL (z.union([z.number(), z.string()])), 
          // mas garantimos string aqui para o banco não aplicar cast numérico.
          // Se for nulo/vazio, salva "0" para manter consistência numérica visual.
          payload[f] = (val === null || val === undefined || val === "") ? "0" : String(val);
        }
      }

      allRows.push(payload);
    }

    if (allRows.length) {
      console.log("DEBUG_SALVAMENTO: Upsert no banco (Efetivos)", allRows);
      const { error } = await supabase
        .from("frequencia_profissional")
        .upsert(allRows, { onConflict: "frequencia_id, profissional_id" });
      
      if (error) {
        console.log("DEBUG_SUPABASE: Erro no upsert (Efetivos)", error);
        console.error("[salvarFolhaEfetivos] Erro ao salvar frequencia_profissional:", error);
        throw new Error(`Erro ao salvar no banco: ${error.message} (Código: ${error.code})`);
      }
    }
    // Sincronização após salvar
    await orquestrarSincronizacao({
      data: {
        evento: "FOLHA_SALVA",
        tipo: "efetivos",
        competencia_id: data.competencia_id,
        unidade_id: data.unidade_id,
        setor_id: normalizarSetorId(data.setor_id) ?? undefined,
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
    await assertPrazoEnvio(supabase, userId, data.competencia_id);

    const { frequencia_id, frequencia_status } = await ensureFolhaEfetivos(
      { supabase, userId },
      data.competencia_id,
      data.unidade_id,
      data.setor_id as string | undefined
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
        .select("dias_trabalhados, faltas_injustificadas, atestado, ferias, licenca_premio, profissionais!inner(setor_id)")
        .eq("frequencia_id", frequencia_id)
        .is("deleted_at", null);
      
      const diasNoMes = new Date(Number(comp.ano), Number(comp.mes), 0).getDate();
      const toN = (v: any) => {
        if (typeof v === 'number') return v;
        const s = String(v || '').trim();
        if (!s) return 0;
        const sClean = s.replace(/\./g, "").replace(',', '.');
        const n = parseFloat(sClean);
        return isNaN(n) ? 0 : n;
      };

      for (const l of (linhas ?? [])) {
        const total = toN(l.dias_trabalhados) + toN(l.faltas_injustificadas) + 
                     toN(l.atestado) + toN(l.ferias) + toN(l.licenca_premio);
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
        setor_id: normalizarSetorId(data.setor_id) ?? undefined,
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
