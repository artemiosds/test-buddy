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
  rotuloMes,
  somaOuNulo,
  type LinhaPlanilha,
  type MapaIncentivos,
} from "./piso-planilha";


const Input = z.object({
  /** Vazio = usa a competência mais recente já consolidada. */
  competencia: z.string().optional().nullable(),
  tipo: z.enum(["contratados", "efetivos", "calculo_piso", "piso_enfermagem"]),
  unidade_id: z.string().nullable().optional(),
  categoria: z.string().nullable().optional(),
  incentivos: z.record(z.string(), z.number()).optional(),
  /** Restringe aos profissionais afetados por uma importação específica. */
  historico_id: z.string().uuid().nullable().optional(),
});

const ehEfetivo = (vinculo: string | null | undefined) => /efetiv|estatut/i.test(vinculo ?? "");

export const gerarPlanilhaOficialPiso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    try {
      const supabase = context.supabase;
      await ensurePermission(supabase, context.userId, "piso.visualizar");

    // Restrição por importação específica (histórico)
    let idsDaImportacao: Set<string> | null = null;
    let competenciaHist = "";
    let linhasHistorico: any[] | null = null;
    let origemModelo:
      | "UBS_SAUDE"
      | "HMO_SAUDE"
      | "HMSDS_SAUDE"
      | "CAPS_SAUDE"
      | "PADRAO_ADM"
      | null = null;
    if (data.historico_id) {
      const { data: hist } = await supabase
        .from("historico_importacoes")
        .select("competencia, nome_arquivo")
        .eq("id", data.historico_id)
        .maybeSingle();
      competenciaHist = (hist?.competencia ?? "").trim();
      const nomeArq = hist?.nome_arquivo ?? "";
      // H.M.S.D.S primeiro (mais específico), depois H.M.O, CAPS, UBS e por fim
      // o genérico PADRÃO ADM (CER / Centro Especializado / demais unidades).
      origemModelo = /H\W*M\W*S\W*D\W*S/i.test(nomeArq)
        ? "HMSDS_SAUDE"
        : /H\W*M\W*O/i.test(nomeArq)
          ? "HMO_SAUDE"
          : /CAPS/i.test(nomeArq)
            ? "CAPS_SAUDE"
            : /UBS/i.test(nomeArq)
              ? "UBS_SAUDE"
              : /\bCER\b|CENTRO[\s_.-]*ESPECIALIZAD|PADRAO[\s_.-]*ADM/i.test(nomeArq)
                ? "PADRAO_ADM"
                : null;


      if (data.tipo === "contratados" && origemModelo) {

        const { data: importadas, error: importadasErro } = await supabase
          .from("piso_enfermagem")
          .select("*")
          .eq("historico_id", data.historico_id)
          .order("nome", { ascending: true })
          .limit(10000);
        if (importadasErro) throw new Error(importadasErro.message);
        linhasHistorico = importadas ?? [];
      }
      const { data: vinc } = await supabase
        .from("piso_competencia_profissional")
        .select("profissional_id")
        .or(
          `historico_id_piso.eq.${data.historico_id},historico_id_fopag.eq.${data.historico_id}`,
        )
        .limit(10000);
      idsDaImportacao = new Set((vinc ?? []).map((v: any) => v.profissional_id));
      if (idsDaImportacao.size === 0 && !linhasHistorico?.length) {
        throw new Error(
          "Esta importação não gerou registros consolidados (nenhum profissional vinculado).",
        );
      }
    }

    // Competência: usa a informada ou, se vazia, a mais recente consolidada.
    let competencia = (data.competencia ?? "").trim() || competenciaHist;
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
      .limit(10000);
    const query = aplicarFiltroElegivel(base, catalogo);
    const profs: any[] = query ? (((await query).data ?? []) as any[]) : [];


    const idsUnidades = Array.from(
      new Set(profs.map((p: any) => p.unidade_id).filter(Boolean) as string[]),
    );
    const unidades = new Map<string, string>();
    const cnesPorUnidade = new Map<string, string | null>();
    if (idsUnidades.length) {
      const { data: us } = await supabase
        .from("unidades")
        .select("id, nome, cnes")
        .in("id", idsUnidades);
      for (const u of us ?? []) {
        unidades.set(u.id, u.nome);
        cnesPorUnidade.set(u.id, (u as { cnes?: string | null }).cnes ?? null);
      }
    }

    // CBO oficial do cargo (layout de envio do Piso)
    const idsCargos = Array.from(
      new Set(profs.map((p: any) => p.cargo_id).filter(Boolean) as string[]),
    );
    const cboPorCargo = new Map<string, string | null>();
    if (idsCargos.length) {
      const { data: cs } = await supabase.from("cargos").select("id, cbo").in("id", idsCargos);
      for (const c of cs ?? []) cboPorCargo.set(c.id, (c as { cbo?: string | null }).cbo ?? null);
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
      .limit(10000);
    const porProf = new Map<string, any>();
    for (const c of consolidados ?? []) porProf.set(c.profissional_id, c);

    const referencias = await carregarReferencias(supabase, competencia || null);

    const linhas: LinhaPlanilha[] = [];
    if (linhasHistorico) {
      for (const r of linhasHistorico) {
        const origem = (r.dados_origem ?? {}) as Record<string, unknown>;
        const horaExtra = Number(r.hora_extra_50) || 0;
        const gratificacao = Number(r.gratificacao_incentivo ?? r.gratificacao) || 0;
        const incentivo = Number(r.incentivo ?? r.auxilio_financeiro) || 0;
        const valorFinal = Number(r.valor_final) || 0;
        const auxilioTransporte =
          Number(r.auxilio_transporte ?? origem.auxilio_transporte) ||
          Math.max(0, valorFinal - horaExtra - gratificacao - incentivo);
        linhas.push({
          nome: r.nome ?? "",
          cpf: r.cpf ?? null,
          lotacao: r.unidade ?? null,
          cargo: r.cargo ?? null,
          categoria: null,
          dias: Number(r.dias_trabalhados ?? origem.dias_trabalhados) || 30,
          salario_base: r.salario_base ?? null,
          insalubridade: r.insalubridade ?? null,
          hora_extra: horaExtra || null,
          adicional_noturno: r.adicional_noturno ?? null,
          plantao_sobreaviso:
            (Number(r.plantao ?? origem.plantao) || 0) +
              (Number(r.sobreaviso ?? origem.sobreaviso) || 0) || null,
          plantao:
            (Number(r.plantao ?? origem.plantao) || 0) +
              (Number(r.sobreaviso ?? origem.sobreaviso) || 0) || null,

          pensao_alimenticia: null,
          incentivo: incentivo || null,
          gratificacoes: gratificacao || null,
          gratificacao_incentivo: gratificacao || null,
          vale_transporte: auxilioTransporte || null,
          auxilio_transporte: auxilioTransporte || null,
          total_liquido_base: r.total_liquido_base ?? r.valor_liquido ?? null,
          valor_final: valorFinal || null,
        });
      }
    }
    for (const p of linhasHistorico ? [] : profs) {
      const cargo = resolverElegivel(p, catalogo);
      const vinculo = p.vinculo_id ? (vinculos.get(p.vinculo_id) ?? null) : null;
      const efetivo = ehEfetivo(vinculo);
      if (!idsDaImportacao && data.tipo !== "piso_enfermagem") {
        if (data.tipo !== "contratados" && !efetivo) continue;
        if (data.tipo === "contratados" && efetivo) continue;
      }
      if (idsDaImportacao && !idsDaImportacao.has(p.id)) continue;
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
        cnes: p.unidade_id ? (cnesPorUnidade.get(p.unidade_id) ?? null) : null,
        cbo: p.cargo_id ? (cboPorCargo.get(p.cargo_id) ?? null) : null,
        encargo_patronal: null,
        encargo_trabalhista: null,
        vantagem_fixa: somaOuNulo([c.gratificacoes, c.tempo_servico]),
        vantagem_variavel: somaOuNulo([
          c.hora_extra_50,
          c.hora_extra_100,
          c.plantao,
          c.sobreaviso,
          c.auxilio_financeiro,
          c.complementacao,
        ]),
      });
    }

    linhas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    // O arquivo .xlsx é montado no navegador (ver piso-planilha-cliente.ts).
    // O servidor devolve apenas os dados, evitando gerar binário grande no
    // runtime serverless — causa do erro "Failed to fetch" no download.
    const sufixo = competencia.replace(/[^\dA-Za-z]/g, "-") || "GERAL";
    return {
      linhas,
      competencia,
      tipo: data.tipo,
      incentivos: (data.incentivos ?? null) as MapaIncentivos | null,
      total: linhas.length,
      filename:
        data.tipo === "contratados"
          ? `PLANILHA-CONTRATADOS-${sufixo}.xlsx`
          : data.tipo === "calculo_piso"
            ? `CALCULO_PISO_FOPAG-${sufixo}.xlsx`
            : data.tipo === "piso_enfermagem"
              ? `piso-enfermagem_${rotuloMes(competencia)}.xlsx`
              : `FOPAG-${sufixo}.xlsx`,
      origem_modelo: origemModelo,
    };
  } catch (err) {
    console.error("[gerarPlanilhaOficialPiso] Erro:", err);
    throw err instanceof Error ? err : new Error("Erro ao gerar planilha oficial");
  }
});
