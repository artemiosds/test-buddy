import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACOES, EVENTOS, ensurePermission, emitEvento } from "./authz.server";
import { orquestrarSincronizacao } from "./frequencia-sincronizacao.functions";
import { garantirCompetenciaUnidade } from "./competencia-unidade.server";

// Contratados = vínculos não estatutários (comissionados vão na folha de efetivos).
const NATUREZAS_CONTRATADO = [
  "temporario",
  "celetista",
  "terceirizado",
  "estagiario",
  "residente",
  "voluntario",
] as const;

const VAL = z.union([z.number(), z.string()]).default(0);

const LinhaSchema = z.object({
  profissional_id: z.string().uuid(),
  status: z.enum(["rascunho", "enviada", "aprovada", "rejeitada", "com_pendencias", "devolvida", "em_analise", "arquivada"]).optional(),
  dias_trabalhados: VAL,
  dias_falta: VAL,
  atestado: VAL,
  he_50: VAL,
  he_100: VAL,
  adn: VAL,
  plantoes: VAL,
  sobreaviso: VAL,
  incentivo: VAL,
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
  "dias_falta",
  "atestado",
  "he_50",
  "he_100",
  "adn",
  "plantoes",
  "sobreaviso",
  "incentivo",
  "observacoes",
] as const;

/**
 * Retorna a folha de contratados (uma linha por profissional contratado da unidade).
 * Sempre inclui os dados bancários e o registro existente em frequencias_contratados
 * (ou null caso ainda não exista — o front renderiza como rascunho zerado).
 */
export const listarFolhaContratados = createServerFn({ method: "GET" })
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

    const query = supabase
      .from("profissionais")
      .select(
        `
        id, matricula, nome_completo, nome_social, cpf, status,
        banco, agencia, conta_corrente,
        cargo_id, funcao_id, setor_id,
        cargos ( nome ),
        funcoes ( nome ),
        setores!profissionais_setor_id_fkey ( nome ),
        vinculos!inner ( natureza, nome )
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

    const { data: allProfs, error: pErr } = await query;
    
    if (pErr) throw new Error(pErr.message);

    // Filtro de contratados: Qualquer profissional que NÃO seja estatutário/efetivo/comissionado/terceirizado
    const profs = (allProfs ?? []).filter((p: any) => {
      const natureza = p.vinculos?.natureza?.toLowerCase() || "";
      const nomeVinculo = (p.vinculos?.nome || "").toLowerCase();

      // Terceirizados nunca devem aparecer nas folhas (Missão: Remover Terceirizados)
      if (natureza.includes("terceir") || nomeVinculo.includes("terceir")) return false;

      const ehEstatutario = natureza.includes("estatut") || natureza.includes("efetiv") || nomeVinculo.includes("efetiv") || nomeVinculo.includes("estatut");
      const ehComissionado = natureza.includes("comission") || nomeVinculo.includes("comission");
      return !ehEstatutario && !ehComissionado;
    });

    const profIds = (profs ?? []).map((p: any) => p.id);
    let freqs: any[] = [];
    if (profIds.length) {
      const { data: fs, error: fErr } = await supabase
        .from("frequencias_contratados")
        .select("status, dias_trabalhados, dias_falta, atestado, he_50, he_100, adn, plantoes, sobreaviso, incentivo, observacoes, profissional_id, competencia_id, unidade_id")
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
        status: p.status ?? null,
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
      .select("id, status, ano, mes")
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

    const allRows: Record<string, unknown>[] = [];

    for (const l of data.linhas) {
      const ex = byProf.get(l.profissional_id);
      
      // Se linha já foi enviada/aprovada/etc., NÃO permite reescrever pelo usuário comum
      if (ex && ex.status !== "rascunho" && ex.status !== "rejeitada" && (ex.status as string) !== "devolvida") continue;

      // Validação de segurança: limite de dias no mês
      const diasNoMes = new Date(Number(comp.ano), Number(comp.mes), 0).getDate();
      const toN = (v: any) => {
        if (typeof v === 'number') return v;
        const s = String(v || '').replace(',', '.');
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
      };
      const totalDias = toN(l.dias_trabalhados) + toN(l.dias_falta) + toN(l.atestado);
      if (totalDias > diasNoMes) {
        throw new Error(`O total de dias para o profissional (id: ${l.profissional_id}) excede os ${diasNoMes} dias do mês.`);
      }

      const payload: Record<string, unknown> = {
        competencia_id: data.competencia_id,
        unidade_id: data.unidade_id,
        profissional_id: l.profissional_id,
        updated_by: userId,
        status: l.status || (ex ? ex.status : "rascunho"),
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
      // Upsert atômico de todas as linhas (novas e existentes)
      const { error } = await (supabase.from("frequencias_contratados") as any)
        .upsert(allRows, { onConflict: "competencia_id, unidade_id, profissional_id" });
      
      if (error) throw new Error(error.message || "Erro ao salvar lote de frequências");
    }

    // Sincronização após salvar
    await orquestrarSincronizacao({
      data: {
        evento: "FOLHA_SALVA",
        tipo: "contratados",
        competencia_id: data.competencia_id,
        unidade_id: data.unidade_id,
        setor_id: data.setor_id,
      }
    });

    return { ok: true, processadas: allRows.length };
  });

export const enviarFolhaContratados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof EnviarSchema>) => EnviarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.FREQUENCIA_ENVIAR);

    // Auditoria rico
    const { data: perfil } = await supabase
      .from("perfis")
      .select("nome, codigo")
      .eq("id", (context as any).user?.user_metadata?.perfil_id || "")
      .maybeSingle();

    const now = new Date().toISOString();
    // Resolvemos os profissionais do setor se houver filtro
    const profQuery = supabase
      .from("profissionais")
      .select("id")
      .eq("unidade_id", data.unidade_id)
      .is("deleted_at", null);
    
    if (data.setor_id) {
      profQuery.eq("setor_id", data.setor_id);
    }

    const { data: profs } = await profQuery;
    const profIds = (profs ?? []).map(p => p.id);

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
      .in("profissional_id", profIds)
      .in("status", ["rascunho", "rejeitada", "devolvida"])
      .is("deleted_at", null)
      .select("id");
    if (error) throw new Error(error.message);

    // Orquestração central
    await orquestrarSincronizacao({
      data: {
        evento: "FOLHA_ENVIADA",
        tipo: "contratados",
        competencia_id: data.competencia_id,
        unidade_id: data.unidade_id,
        setor_id: data.setor_id,
      }
    });

    // Registra histórico via tabela consolidada (Seção 2)
    const { data: freq } = await supabase
      .from("frequencias")
      .select("id, status")
      .eq("tipo", "contratados")
      .eq("competencia_unidade_id", (await garantirCompetenciaUnidade({ competencia_id: data.competencia_id, unidade_id: data.unidade_id, userId }))!)
      .filter("setor_id", data.setor_id ? "eq" : "is", data.setor_id ?? null)
      .maybeSingle();

    if (freq?.id) {
      await supabase.from("frequencia_historico").insert({
        frequencia_id: freq.id,
        status_anterior: freq.status || "rascunho",
        status_novo: "enviada",
        acao: "Envio para análise",
        executado_por: userId,
        executado_nome: perfil?.nome || "Usuário HSM",
        executado_perfil: perfil?.codigo || "Indefinido",
        detalhes: { total_linhas: (updated ?? []).length }
      } as never);
    }

    return { ok: true, enviadas: (updated ?? []).length };
  });
