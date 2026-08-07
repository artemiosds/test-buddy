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
    const { evento, tipo, competencia_id, unidade_id } = data;

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
      // Para contratados, precisamos garantir que todos os profissionais elegíveis apareçam no total,
      // mesmo que ainda não tenham uma linha salva em frequencias_contratados.
      // O filtro de vínculos deve ser abrangente para não omitir profissionais da unidade.
      const { data: profs, error: pErr } = await supabaseAdmin
        .from("profissionais")
        .select(`id, vinculos!inner ( natureza, nome )`)
        .eq("unidade_id", unidade_id)
        .not("status", "in", "(desligado,inativo)")
        .is("deleted_at", null);

      if (pErr) throw pErr;

      // Filtramos no código para ter flexibilidade total e evitar erros de join complexos
      const elegiveis = (profs ?? []).filter((p: any) => {
        const natureza = p.vinculos?.natureza?.toLowerCase() || "";
        const nomeVinculo = (p.vinculos?.nome || "").toLowerCase();
        
        // Critério: Não estatutários (Efetivos/Estatutários vão para a outra folha)
        const ehEstatutario = natureza.includes("estatut") || natureza.includes("efetiv") || nomeVinculo.includes("efetiv") || nomeVinculo.includes("estatut") || nomeVinculo.includes("contrato");
        return !ehEstatutario;
      });

      totalProfissionais = elegiveis.length;

      const { data: contratados, error: err } = await supabaseAdmin
        .from("frequencias_contratados")
        .select("*")
        .eq("competencia_id", competencia_id)
        .eq("unidade_id", unidade_id)
        .is("deleted_at", null);

      if (err) throw err;
      
      totalProfissionais = elegiveis.length;
      // Status da folha de contratados é derivado do primeiro registro ou passado via payload
      statusOficial = contratados?.[0]?.status ?? "rascunho";
      dataEnvio = contratados?.[0]?.enviada_em ?? null;
      enviadaPor = contratados?.[0]?.enviada_por ?? null;
      dataAprovacao = contratados?.[0]?.aprovada_em ?? null;
      aprovadaPor = contratados?.[0]?.aprovada_por ?? null;

      totalDias = contratados?.reduce((acc, curr) => acc + (Number(curr.dias_trabalhados) || 0), 0) ?? 0;
      totalFaltas = contratados?.reduce((acc, curr) => acc + (Number(curr.dias_falta) || 0), 0) ?? 0;

    } else {
      // Efetivos ou Mensal (usam frequencia_profissional vinculada a uma frequencia base)
      const { data: freqBase, error: fbErr } = await supabaseAdmin
        .from("frequencias")
        .select("id, status, data_envio, enviada_por, data_aprovacao, aprovada_por")
        .eq("competencia_unidade_id", cu.id)
        .eq("tipo", (tipo === "mensal" ? "mensal" : tipo) as any)
        .is("deleted_at", null)
        .maybeSingle();

      if (fbErr) throw fbErr;
      if (!freqBase) return { ok: true, msg: "Frequência base não encontrada para sincronização." };

      const { data: linhas, error: lErr } = await supabaseAdmin
        .from("frequencia_profissional")
        .select("dias_trabalhados, faltas_injustificadas, faltas_justificadas")
        .eq("frequencia_id", freqBase.id)
        .is("deleted_at", null);

      if (lErr) throw lErr;

      statusOficial = freqBase.status;
      totalProfissionais = linhas?.length ?? 0;
      dataEnvio = freqBase.data_envio;
      enviadaPor = freqBase.enviada_por;
      dataAprovacao = freqBase.data_aprovacao;
      aprovadaPor = freqBase.aprovada_por;

      totalDias = linhas?.reduce((acc, curr) => acc + (Number(curr.dias_trabalhados) || 0), 0) ?? 0;
      totalFaltas = linhas?.reduce((acc, curr) => 
        acc + (Number(curr.faltas_injustificadas) || 0) + (Number(curr.faltas_justificadas) || 0), 0) ?? 0;
    }

    // 3. Atualiza a tabela consolidada 'frequencias'
    const { error: upsertErr } = await supabaseAdmin
      .from("frequencias")
      .upsert({
        competencia_unidade_id: cu.id,
        tipo: tipo as any,
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
      }, { onConflict: "competencia_unidade_id, tipo", ignoreDuplicates: false });

    if (upsertErr) throw upsertErr;

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
    } catch (err) {
      console.error("[orquestrarSincronizacao] Erro crítico:", err);
      throw err instanceof Error ? err : new Error("Falha na orquestração de sincronização");
    }
  });
