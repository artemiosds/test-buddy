import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { garantirCompetenciaUnidade } from "./competencia-unidade.server";

/**
 * Orquestrador de Sincronização de Frequências
 * 
 * Cada módulo (Contratados, Efetivos e Frequências Mensais) deve manter seu fluxo, regras de negócio, 
 * cálculos, validações, formulários e tabelas totalmente independentes. Não deve existir reutilização 
 * de lógica que altere o comportamento específico de cada módulo. O único ponto compartilhado será a 
 * Camada de Orquestração, responsável exclusivamente por sincronizar metadados (status, totais, progresso, 
 * datas, responsáveis, anexos e indicadores) para a tabela frequencias, consumida pelos módulos de 
 * Aprovação, Dashboard e Relatórios. A Camada de Orquestração não pode executar cálculos de folha, 
 * alterar regras de negócio ou modificar dados das tabelas especializadas; ela apenas espelha o estado 
 * atual de cada fluxo. Dessa forma, qualquer evolução futura em Contratados, Efetivos ou Frequências 
 * Mensais ocorrerá de forma isolada, sem risco de impactar os demais módulos.
 */

const EventoDomínioSchema = z.enum([
  "FOLHA_SALVA",
  "FOLHA_ENVIADA",
  "FOLHA_APROVADA",
  "FOLHA_REJEITADA",
  "FOLHA_DEVOLVIDA",
  "LINHA_ALTERADA",
]);

const SincronizarSchema = z.object({
  evento: EventoDomínioSchema,
  tipo: z.enum(["efetivos", "contratados", "mensal"]),
  competencia_id: z.string().uuid(),
  unidade_id: z.string().uuid(),
  setor_id: z.string().uuid().optional(),
  payload: z.any().optional(),
});

/**
 * Sincroniza os metadados de uma folha na tabela consolidada 'frequencias'.
 * Deve ser chamado dentro de uma transação ou logo após operações bem-sucedidas.
 */
export const orquestrarSincronizacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof SincronizarSchema>) => SincronizarSchema.parse(d))
  .handler(async ({ data, context }) => {
    try {
      const { userId } = context;
    const { evento, tipo, competencia_id, unidade_id, setor_id } = data;

    // 1. Localiza (ou cria) a competencia_unidade_id de forma segura
    const cuId = await garantirCompetenciaUnidade({
      competencia_id,
      unidade_id,
      userId
    });
    
    const cu = { id: cuId };

    // 2. Coleta dados da fonte oficial baseado no tipo
    let statusOficial: string = "rascunho";
    let totalProfissionais = 0;
    let totalDias = 0;
    let totalFaltas = 0;
    let dataEnvio: string | null = null;
    let enviadaPor: string | null = null;
    let dataAprovacao: string | null = null;
    let aprovadaPor: string | null = null;

    if (tipo === "contratados") {
      const query = supabaseAdmin
        .from("profissionais")
        .select(`id, setor_id, vinculos!inner ( natureza, nome )`)
        .eq("unidade_id", unidade_id)
        .not("status", "in", "(inativo)")
        .is("deleted_at", null);

      if (setor_id) {
        query.eq("setor_id", setor_id);
      }

      const { data: profs, error: pErr } = await query;
      if (pErr) throw pErr;

      const elegiveis = (profs ?? []).filter((p: any) => {
        const natureza = p.vinculos?.natureza?.toLowerCase() || "";
        const nomeVinculo = (p.vinculos?.nome || "").toLowerCase();
        if (natureza.includes("terceir") || nomeVinculo.includes("terceir")) return false;
        const ehEstatutario = natureza.includes("estatut") || natureza.includes("efetiv") || nomeVinculo.includes("efetiv") || nomeVinculo.includes("estatut");
        const ehComissionado = natureza.includes("comission") || nomeVinculo.includes("comission");
        return !ehEstatutario && !ehComissionado;
      });

      totalProfissionais = elegiveis.length;

      const { data: contratados, error: err } = await supabaseAdmin
        .from("frequencias_contratados")
        .select("status, dias_trabalhados, dias_falta, enviada_em, enviada_por, aprovada_em, aprovada_por")
        .eq("competencia_id", competencia_id)
        .eq("unidade_id", unidade_id)
        .in("profissional_id", elegiveis.map(e => e.id))
        .is("deleted_at", null);

      if (err) throw err;
      
      if (contratados && contratados.length > 0) {
        const statuses = contratados.map(c => (c as any).status);
        if (statuses.some(s => ["rascunho", "devolvida", "rejeitada", "com_pendencias"].includes(s))) {
          statusOficial = "rascunho";
        } else if (statuses.every(s => s === "aprovada")) {
          statusOficial = "aprovada";
        } else if (statuses.some(s => s === "enviada")) {
          statusOficial = "enviada";
        }

        const ref = contratados.find(c => ((c as any).status) === statusOficial) || contratados[0];
        dataEnvio = (ref as any).enviada_em ?? null;
        enviadaPor = (ref as any).enviada_por ?? null;
        dataAprovacao = (ref as any).aprovada_em ?? null;
        aprovadaPor = (ref as any).aprovada_por ?? null;
      }

      totalDias = contratados?.reduce((acc, curr) => acc + (typeof (curr as any).dias_trabalhados === 'string' ? 0 : (Number((curr as any).dias_trabalhados) || 0)), 0) ?? 0;
      totalFaltas = contratados?.reduce((acc, curr) => acc + (typeof (curr as any).dias_falta === 'string' ? 0 : (Number((curr as any).dias_falta) || 0)), 0) ?? 0;

    } else {
      const queryBase = supabaseAdmin
        .from("frequencias")
        .select("id, status, data_envio, enviada_por, data_aprovacao, aprovada_por")
        .eq("competencia_unidade_id", cu.id)
        .eq("tipo", (tipo === "mensal" ? "mensal" : tipo) as any)
        .is("deleted_at", null);

      if (setor_id) {
        queryBase.filter("setor_id", "eq", setor_id);
      } else {
        queryBase.filter("setor_id", "is", null);
      }

      const { data: freqBase, error: fbErr } = await queryBase.maybeSingle();

      if (fbErr) throw fbErr;
      if (!freqBase) return { ok: true, msg: "Frequência base não encontrada para sincronização." };

      const { data: linhas, error: lErr } = await supabaseAdmin
        .from("frequencia_profissional")
        .select(`
          status_linha,
          dias_trabalhados, faltas_injustificadas, faltas_justificadas,
          profissionais!inner(setor_id)
        `)
        .eq("frequencia_id", freqBase.id)
        .filter("profissionais.setor_id", setor_id ? "eq" : "is", setor_id ?? null)
        .is("deleted_at", null);

      if (lErr) throw lErr;

      if (linhas && linhas.length > 0) {
        const statuses = linhas.map(l => (l as any).status_linha || "rascunho");
        if (statuses.some(s => ["rascunho", "devolvida", "rejeitada", "com_pendencias"].includes(s))) {
          statusOficial = "rascunho";
        } else if (statuses.every(s => s === "aprovada")) {
          statusOficial = "aprovada";
        } else if (statuses.some(s => s === "enviada")) {
          statusOficial = "enviada";
        }
      } else {
        statusOficial = freqBase.status;
      }

      totalProfissionais = linhas?.length ?? 0;
      dataEnvio = freqBase.data_envio;
      enviadaPor = freqBase.enviada_por;
      dataAprovacao = freqBase.data_aprovacao;
      aprovadaPor = freqBase.aprovada_por;

      totalDias = linhas?.reduce((acc, curr) => acc + (typeof (curr as any).dias_trabalhados === 'string' ? 0 : (Number((curr as any).dias_trabalhados) || 0)), 0) ?? 0;
      totalFaltas = linhas?.reduce((acc, curr) => 
        acc + (typeof (curr as any).faltas_injustificadas === 'string' ? 0 : (Number((curr as any).faltas_injustificadas) || 0)) + 
        (typeof (curr as any).faltas_justificadas === 'string' ? 0 : (Number((curr as any).faltas_justificadas) || 0)), 0) ?? 0;
    }

    // 3. Atualiza a tabela consolidada 'frequencias'
    // Obs.: o índice único é uma expressão (COALESCE(setor_id, ...)), portanto NÃO é
    // possível usar `upsert(onConflict: "competencia_unidade_id, tipo, setor_id")`.
    // Fazemos select + update/insert manualmente.
    const metadados = {
      status: statusOficial as any,
      total_profissionais: totalProfissionais,
      total_dias_trabalhados: totalDias,
      total_faltas: totalFaltas,
      data_envio: dataEnvio,
      enviada_por: enviadaPor,
      data_aprovacao: dataAprovacao,
      aprovada_por: aprovadaPor,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    const buscaExistente = supabaseAdmin
      .from("frequencias")
      .select("id")
      .eq("competencia_unidade_id", cu.id)
      .eq("tipo", tipo as any);

    if (setor_id) buscaExistente.eq("setor_id", setor_id);
    else buscaExistente.is("setor_id", null);

    const { data: existente, error: buscaErr } = await buscaExistente.maybeSingle();
    if (buscaErr) throw buscaErr;

    if (existente?.id) {
      const { error: updErr } = await supabaseAdmin
        .from("frequencias")
        .update(metadados as never)
        .eq("id", existente.id);
      if (updErr) throw updErr;
    } else {
      const { error: insErr } = await supabaseAdmin
        .from("frequencias")
        .insert({
          competencia_unidade_id: cu.id,
          tipo: tipo as any,
          setor_id: setor_id ?? null,
          created_by: userId,
          ...metadados,
        } as never);
      if (insErr) throw insErr;
    }

    // 4. Registrar no Log de Sincronização (Audit)
    await supabaseAdmin.from("audit_log").insert({
      tabela: "frequencias",
      operacao: "update",
      usuario_id: userId,
      contexto: {
        evento,
        tipo,
        competencia_id,
        unidade_id,
        status_oficial: statusOficial,
        total_profissionais: totalProfissionais
      }
    });

      return { 
        ok: true, 
        status: statusOficial, 
        total: totalProfissionais,
        tipo_sincronizado: tipo
      };
    } catch (err: any) {
      console.error("[orquestrarSincronizacao] Erro crítico:", err);
      const detalhe = err?.message || err?.details || err?.hint || err?.code;
      throw new Error(
        detalhe
          ? `Falha na sincronização da folha: ${detalhe}`
          : "Falha na orquestração de sincronização",
      );
    }
  });
