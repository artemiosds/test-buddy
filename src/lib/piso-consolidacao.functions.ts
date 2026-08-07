import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensurePermission } from "./authz.server";
import { consolidarCompetencia, reprocessarProfissional } from "./piso-consolidacao.server";

export const reprocessarCompetenciaConsolidada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ competencia: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      await ensurePermission(context.supabase, context.userId, "piso.importar");
      return await consolidarCompetencia(context.supabase, {
        competencia: data.competencia,
        userId: context.userId,
      });
    } catch (err) {
      console.error("[reprocessarCompetenciaConsolidada] Erro:", err);
      throw err instanceof Error ? err : new Error("Erro ao reprocessar competência");
    }
  });

export const reprocessarRegistroConsolidado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        profissional_id: z.string().uuid(),
        competencia: z.string().min(1).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.importar");
    const r = await reprocessarProfissional(context.supabase, {
      profissionalId: data.profissional_id,
      competencia: data.competencia ?? null,
      userId: context.userId,
    });
    return { resultados: r };
  });

export const getResumoConsolidacao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ competencia: z.string().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.visualizar");
    let q = context.supabase
      .from("piso_competencia_profissional")
      .select("competencia, status_consolidacao, consolidado_em, inconsistencias")
      .limit(50000);
    if (data.competencia) q = q.eq("competencia", data.competencia);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const porCompetencia = new Map<
      string,
      {
        competencia: string;
        total: number;
        consolidados: number;
        parciais: number;
        pendentes: number;
        divergentes: number;
        semImportacao: number;
        erros: number;
        inconsistencias: number;
        ultimoProcessamento: string | null;
      }
    >();
    for (const r of (rows ?? []) as any[]) {
      const c = r.competencia as string;
      const cur = porCompetencia.get(c) ?? {
        competencia: c,
        total: 0,
        consolidados: 0,
        parciais: 0,
        pendentes: 0,
        divergentes: 0,
        semImportacao: 0,
        erros: 0,
        inconsistencias: 0,
        ultimoProcessamento: null as string | null,
      };
      cur.total += 1;
      const s = r.status_consolidacao as string;
      if (s === "consolidado") cur.consolidados += 1;
      else if (s === "parcial") cur.parciais += 1;
      else if (s === "pendente") cur.pendentes += 1;
      else if (s === "divergente") cur.divergentes += 1;
      else if (s === "sem_importacao") cur.semImportacao += 1;
      else if (s === "erro") cur.erros += 1;
      cur.inconsistencias += Array.isArray(r.inconsistencias) ? r.inconsistencias.length : 0;
      if (r.consolidado_em && (!cur.ultimoProcessamento || r.consolidado_em > cur.ultimoProcessamento))
        cur.ultimoProcessamento = r.consolidado_em;
      porCompetencia.set(c, cur);
    }

    return {
      competencias: Array.from(porCompetencia.values()).sort((a, b) =>
        b.competencia.localeCompare(a.competencia),
      ),
    };
  });

export const getDetalheConsolidado = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ profissional_id: z.string().uuid(), competencia: z.string().min(1) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.visualizar");
    const { data: row, error } = await context.supabase
      .from("piso_competencia_profissional")
      .select("*")
      .eq("profissional_id", data.profissional_id)
      .eq("competencia", data.competencia)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { registro: null, origens: [] as any[], importacoes: [] as any[] };

    const ids = [row.historico_id_fopag, row.historico_id_piso].filter(Boolean) as string[];
    let importacoes: any[] = [];
    if (ids.length > 0) {
      const { data: hist } = await context.supabase
        .from("historico_importacoes")
        .select("*")
        .in("id", ids);
      importacoes = hist ?? [];
    }

    const CADASTRO = "Cadastro de Profissionais";
    const FOLHA = "Importação da Folha";
    const PISO = "Importação do Piso";
    const CALC = "Cálculo do sistema";
    const origens = [
      { campo: "Nome", valor: row.nome, origem: CADASTRO },
      { campo: "CPF", valor: row.cpf, origem: CADASTRO },
      { campo: "Matrícula", valor: row.matricula, origem: CADASTRO },
      { campo: "Cargo", valor: row.cargo_nome, origem: CADASTRO },
      { campo: "Categoria", valor: row.categoria, origem: CADASTRO },
      { campo: "Unidade", valor: row.unidade_nome, origem: CADASTRO },
      { campo: "Setor", valor: row.setor_nome, origem: CADASTRO },
      { campo: "Vínculo", valor: row.vinculo_nome, origem: CADASTRO },
      { campo: "Situação Funcional", valor: row.situacao_funcional, origem: CADASTRO },
      { campo: "Carga Horária", valor: row.carga_horaria_semanal, origem: CADASTRO },
      { campo: "Salário Base", valor: row.salario_base, origem: FOLHA },
      { campo: "Tempo de Serviço", valor: row.tempo_servico, origem: FOLHA },
      { campo: "Insalubridade", valor: row.insalubridade, origem: FOLHA },
      { campo: "Plantão", valor: row.plantao, origem: FOLHA },
      { campo: "Sobreaviso", valor: row.sobreaviso, origem: FOLHA },
      { campo: "Gratificações", valor: row.gratificacoes, origem: FOLHA },
      { campo: "Hora Extra 50%", valor: row.hora_extra_50, origem: FOLHA },
      { campo: "Hora Extra 100%", valor: row.hora_extra_100, origem: FOLHA },
      { campo: "Vale Transporte", valor: row.vale_transporte, origem: FOLHA },
      { campo: "INSS", valor: row.inss, origem: FOLHA },
      { campo: "IRRF", valor: row.irrf, origem: FOLHA },
      { campo: "Total Proventos", valor: row.total_proventos, origem: FOLHA },
      { campo: "Total Descontos", valor: row.total_descontos, origem: FOLHA },
      { campo: "Valor Líquido", valor: row.valor_liquido, origem: FOLHA },
      { campo: "Auxílio Financeiro Piso", valor: row.auxilio_financeiro, origem: PISO },
      { campo: "Competência", valor: row.competencia, origem: PISO },
      { campo: "Valor de Referência", valor: row.valor_referencia, origem: CALC },
      { campo: "Complementação", valor: row.complementacao, origem: CALC },
    ];

    return { registro: row, origens, importacoes };
  });
