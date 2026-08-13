import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACOES, ensurePermission } from "./authz.server";

const Schema = z.object({
  competencia_id: z.string().uuid(),
  unidade_id: z.string().uuid(),
  profissional_id: z.string().uuid(),
  folha: z.enum(["efetivos", "contratados"]),
});

/**
 * Garante que exista a LINHA da folha (efetivos ou contratados) para
 * (competência, unidade, profissional) e devolve o seu id.
 *
 * Usada para permitir o anexo individual de documentos numa linha que o
 * usuário ainda não salvou — a linha é criada em rascunho com zeros.
 */
export const garantirLinhaFolha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof Schema>) => Schema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.FREQUENCIA_EDITAR);

    const { data: comp, error: cErr } = await supabase
      .from("competencias")
      .select("id, status")
      .eq("id", data.competencia_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!comp) throw new Error("Competência não encontrada.");
    const st = (comp as any).status;
    if (st === "encerrada" || st === "arquivada") {
      throw new Error("Competência encerrada — folha em modo somente leitura.");
    }

    if (data.folha === "contratados") {
      // Já existe? devolve o id sem sobrescrever os valores digitados.
      const { data: existente, error: exErr } = await supabase
        .from("frequencias_contratados")
        .select("id")
        .eq("competencia_id", data.competencia_id)
        .eq("unidade_id", data.unidade_id)
        .eq("profissional_id", data.profissional_id)
        .maybeSingle();
      if (exErr) throw new Error(exErr.message);
      if (existente) return { id: (existente as any).id as string };

      // Usamos upsert com onConflict para evitar erro de concorrência/duplicidade (UNIQUE constraint)
      const { data: upserted, error: uErr } = await (supabase.from("frequencias_contratados") as any)
        .upsert({
          competencia_id: data.competencia_id,
          unidade_id: data.unidade_id,
          profissional_id: data.profissional_id,
          status: "rascunho",
          dias_trabalhados: 0,
          dias_falta: "0",
          atestado: "0",
          he_50: "0",
          he_100: "0",
          adn: "0",
          plantoes: "0",
          sobreaviso: "0",
          incentivo: "0",
          created_by: userId,
          deleted_at: null // Garante que estamos lidando com registros ativos no contexto da constraint
        }, { 
          onConflict: "competencia_id, unidade_id, profissional_id",
          ignoreDuplicates: false // Queremos que ele retorne o ID mesmo se já existir
        })
        .select("id")
        .single();

      if (uErr) throw new Error("Erro ao garantir linha de contratado: " + uErr.message);
      return { id: (upserted as any).id as string };
    }

    // ---- efetivos: competencia_unidades → frequencias → frequencia_profissional
    let { data: cu, error: cuErr } = await supabase
      .from("competencia_unidades")
      .select("id")
      .eq("competencia_id", data.competencia_id)
      .eq("unidade_id", data.unidade_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (cuErr) throw new Error(cuErr.message);
    if (!cu) {
      const { data: ins, error } = await supabase
        .from("competencia_unidades")
        .insert({
          competencia_id: data.competencia_id,
          unidade_id: data.unidade_id,
          status: "nao_iniciada",
          created_by: userId,
        } as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      cu = ins as any;
    }

    let { data: freq, error: fErr } = await supabase
      .from("frequencias")
      .select("id")
      .eq("competencia_unidade_id", (cu as any).id)
      .eq("tipo", "efetivos")
      .is("deleted_at", null)
      .maybeSingle();
    if (fErr) throw new Error(fErr.message);
    if (!freq) {
      const { data: ins, error } = await supabase
        .from("frequencias")
        .insert({
          competencia_unidade_id: (cu as any).id,
          tipo: "efetivos",
          status: "rascunho",
          created_by: userId,
        } as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      freq = ins as any;
    }

    const { data: existenteEf, error: exEfErr } = await supabase
      .from("frequencia_profissional")
      .select("id")
      .eq("frequencia_id", (freq as any).id)
      .eq("profissional_id", data.profissional_id)
      .maybeSingle();
    if (exEfErr) throw new Error(exEfErr.message);
    if (existenteEf) return { id: (existenteEf as any).id as string };

    // Usamos upsert para evitar erro de concorrência/duplicidade na tabela frequencia_profissional
    const { data: upserted, error: uErr } = await (supabase.from("frequencia_profissional") as any)
      .upsert({
        frequencia_id: (freq as any).id,
        profissional_id: data.profissional_id,
        dias_trabalhados: "0",
        faltas_justificadas: "0",
        faltas_injustificadas: "0",
        ferias: "0",
        licencas: "0",
        afastamentos: "0",
        horas_extras: "0",
        adicional_noturno: "0",
        plantoes_extras: "0",
        atestado: "0",
        he_50: "0",
        he_100: "0",
        sobreaviso: "0",
        incentivo: "0",
        licenca_premio: "0",
        ferias_terco: "0",
        ferias_integral: "0",
        sal_sub_h: "0",
        created_by: userId,
        deleted_at: null
      }, { 
        onConflict: "frequencia_id, profissional_id"
      })
      .select("id")
      .single();

    if (uErr) throw new Error("Erro ao garantir linha de efetivo: " + uErr.message);
    return { id: (upserted as any).id as string };
  });
