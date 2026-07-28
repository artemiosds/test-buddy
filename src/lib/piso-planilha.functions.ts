import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensurePermission } from "./authz.server";
import {
  aplicarFiltroElegivel,
  carregarCatalogoElegivel,
  resolverElegivel,
} from "./piso-elegiveis.server";
import { carregarReferencias } from "./piso-referencia.server";
import {
  gerarPlanilhaContratados,
  gerarPlanilhaEfetivos,
  gerarPlanilhaCalculoPiso,
  type LinhaPlanilha,
  type MapaIncentivos,
} from "./piso-planilha";

const Input = z.object({
  /** Vazio = usa a competência mais recente já consolidada. */
  competencia: z.string().optional().nullable(),
  tipo: z.enum(["contratados", "efetivos", "calculo_piso"]),
  unidade_id: z.string().nullable().optional(),
  categoria: z.string().nullable().optional(),
  incentivos: z.record(z.string(), z.number()).optional(),
});

const ehEfetivo = (vinculo: string | null | undefined) => /efetiv|estatut/i.test(vinculo ?? "");

export const gerarPlanilhaOficialPiso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    await ensurePermission(supabase, context.userId, "piso.visualizar");

    // Competência: usa a informada ou, se vazia, a mais recente consolidada.
    let competencia = (data.competencia ?? "").trim();
    if (competencia.length < 4) {
      const { data: ult } = await supabase
        .from("piso_competencia_profissional")
        .select("competencia")
        .order("competencia", { ascending: false })
        .limit(1);
      competencia = ult?.[0]?.competencia ?? "";
    }

    // Cargos e funções elegíveis (normalização das categorias de enfermagem)
    const catalogo = await carregarCatalogoElegivel(supabase);

    // Cadastro (fonte oficial dos dados cadastrais)
    const base = supabase
      .from("profissionais")
      .select(
        "id, nome_completo, cpf, matricula, carga_horaria_semanal, cargo_id, funcao_id, unidade_id, setor_id, vinculo_id",
      )
      .is("deleted_at", null)
      .eq("status", "ativo")
      .limit(20000);
    const query = aplicarFiltroElegivel(base, catalogo);
    const profs: any[] = query ? (((await query).data ?? []) as any[]) : [];


    const idsUnidades = Array.from(
      new Set(profs.map((p: any) => p.unidade_id).filter(Boolean) as string[]),
    );
    const unidades = new Map<string, string>();
    if (idsUnidades.length) {
      const { data: us } = await supabase.from("unidades").select("id, nome").in("id", idsUnidades);
      for (const u of us ?? []) unidades.set(u.id, u.nome);
    }
    const idsVinculos = Array.from(
      new Set(profs.map((p: any) => p.vinculo_id).filter(Boolean) as string[]),
    );
    const vinculos = new Map<string, string>();
    if (idsVinculos.length) {
      const { data: vs } = await supabase.from("vinculos").select("id, nome").in("id", idsVinculos);
      for (const v of vs ?? []) vinculos.set(v.id, v.nome);
    }

    // Dados financeiros consolidados da competência
    const { data: consolidados } = await supabase
      .from("piso_competencia_profissional")
      .select("*")
      .eq("competencia", competencia)
      .limit(20000);
    const porProf = new Map<string, any>();
    for (const c of consolidados ?? []) porProf.set(c.profissional_id, c);

    const referencias = await carregarReferencias(supabase, competencia || null);

    const linhas: LinhaPlanilha[] = [];
    for (const p of profs) {
      const cargo = resolverElegivel(p, catalogo);
      const vinculo = p.vinculo_id ? (vinculos.get(p.vinculo_id) ?? null) : null;
      const efetivo = ehEfetivo(vinculo);
      if (data.tipo !== "contratados" && !efetivo) continue;
      if (data.tipo === "contratados" && efetivo) continue;
      if (data.unidade_id && p.unidade_id !== data.unidade_id) continue;
      if (data.categoria && cargo?.categoria !== data.categoria) continue;

      const c = porProf.get(p.id) ?? {};
      const ref = cargo?.categoria ? referencias.get(cargo.categoria) : undefined;
      const horaExtra = (Number(c.hora_extra_50) || 0) + (Number(c.hora_extra_100) || 0);
      const plantao = (Number(c.plantao) || 0) + (Number(c.sobreaviso) || 0);

      linhas.push({
        nome: p.nome_completo,
        cpf: p.cpf ?? null,
        lotacao: p.unidade_id ? (unidades.get(p.unidade_id) ?? null) : null,
        cargo: cargo?.nome ?? null,
        categoria: cargo?.categoria ?? null,
        dias: 30,
        salario_base: c.salario_base ?? null,
        insalubridade: c.insalubridade ?? null,
        hora_extra: horaExtra || null,
        adicional_noturno: null,
        plantao_sobreaviso: plantao || null,
        pensao_alimenticia: null,
        incentivo: c.auxilio_financeiro ?? null,
        matricula: p.matricula ?? null,
        vinculo,
        carga_horaria: p.carga_horaria_semanal ?? null,
        tempo_servico: c.tempo_servico ?? null,
        gratificacoes: c.gratificacoes ?? null,
        valor_referencia: c.valor_referencia ?? ref?.valor ?? null,
        complementacao: c.complementacao ?? null,
        inss: c.inss ?? null,
        irrf: c.irrf ?? null,
        vale_transporte: c.vale_transporte ?? null,
        hora_extra_50: c.hora_extra_50 ?? null,
        hora_extra_100: c.hora_extra_100 ?? null,
        plantao: c.plantao ?? null,
        sobreaviso: c.sobreaviso ?? null,
      });
    }

    linhas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    const base64 =
      data.tipo === "contratados"
        ? gerarPlanilhaContratados(linhas, {
            competencia,
            incentivos: (data.incentivos ?? undefined) as MapaIncentivos | undefined,
          })
        : data.tipo === "calculo_piso"
          ? gerarPlanilhaCalculoPiso(linhas, { competencia })
          : gerarPlanilhaEfetivos(linhas, { competencia });

    const sufixo = competencia.replace(/[^\dA-Za-z]/g, "-") || "GERAL";
    return {
      base64,
      total: linhas.length,
      filename:
        data.tipo === "contratados"
          ? `PLANILHA-CONTRATADOS-${sufixo}.xlsx`
          : data.tipo === "calculo_piso"
            ? `CALCULO_PISO_FOPAG-${sufixo}.xlsx`
            : `FOPAG-${sufixo}.xlsx`,
    };

  });
