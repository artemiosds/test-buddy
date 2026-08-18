import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensurePermission } from "./authz.server";
import { resolverElegivel } from "./piso-elegiveis.server";
import { calcularPiso } from "./piso-calculo";
import { carregarReferencias, refDe } from "./piso-referencia.server";
import { consolidarCompetencia } from "./piso-consolidacao.server";
import { normCpf, normMatricula, normNome } from "./piso-match";
import {
  carregarElegiveis,
  montarLinhas,
  pend,
  somenteDigitos,
  type ProfBase,
} from "./piso-gestao.server";
import { ConsolidarInput, ListInput } from "./piso-gestao.schemas";
export type { LinhaElegivel } from "./piso-gestao.server";


export const listPisoElegiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    try {
      await ensurePermission(context.supabase, context.userId, "piso.visualizar");
    const todas = await montarLinhas(context.supabase, data.competencia ?? null);

    const busca = (data.busca ?? "").trim().toLowerCase();
    const buscaDigitos = somenteDigitos(data.busca);
    const cpfFiltro = somenteDigitos(data.cpf);
    const filtradas = todas.filter((l) => {
      if (data.categoria && l.categoria !== data.categoria) return false;
      if (data.unidade_id && l.unidade_id !== data.unidade_id) return false;
      if (data.cargo_id && l.cargo_id !== data.cargo_id) return false;
      if (data.vinculo_id && l.vinculo_id !== data.vinculo_id) return false;
      if (data.situacao && l.situacao_funcional !== data.situacao) return false;
      if (cpfFiltro && !somenteDigitos(l.cpf).includes(cpfFiltro)) return false;
      if (data.statusImportacao === "importado" && l.status_importacao !== "importado")
        return false;

      if (data.statusImportacao === "pendente" && l.status_importacao !== "pendente") return false;
      if (data.statusImportacao === "divergente" && !l.divergencia) return false;
      if (busca) {
        const okNome = l.nome.toLowerCase().includes(busca);
        const okCpf = buscaDigitos.length > 0 && somenteDigitos(l.cpf).includes(buscaDigitos);
        const okMat = (l.matricula ?? "").toLowerCase().includes(busca);
        if (!okNome && !okCpf && !okMat) return false;
      }
      return true;
    });

    // Os cards refletem exatamente o recorte dos filtros aplicados.
    const base = filtradas;
    const resumo = {
      elegiveis: base.length,
      enfermeiros: base.filter((l) => l.categoria === "ENFERMEIRO").length,
      tecnicos: base.filter((l) => l.categoria === "TECNICO_ENFERMAGEM").length,
      auxiliares: base.filter((l) => l.categoria === "AUXILIAR_ENFERMAGEM").length,
      importados: base.filter((l) => l.status_importacao === "importado").length,
      pendentes: base.filter((l) => l.status_importacao === "pendente").length,
      divergentes: base.filter((l) => l.divergencia).length,
      efetivos: base.filter((l) => /efetiv|estatut/i.test(l.vinculo ?? "")).length,
      contratados: base.filter((l) => (l.vinculo ?? "") && !/efetiv|estatut/i.test(l.vinculo!))
        .length,
      valorComplemento: base.reduce((s, l) => s + (l.complementacao ?? 0), 0),
      /** Complemento apenas dos profissionais já importados/consolidados. */
      valorComplementoImportados: base
        .filter((l) => l.status_importacao === "importado")
        .reduce((s, l) => s + (l.complementacao ?? 0), 0),
      /** Profissionais sem valor de referência cadastrado para a competência. */
      semReferencia: base.filter((l) => !l.referencia_configurada).length,
      /** Total de elegíveis no cadastro, ignorando filtros (para estado vazio). */
      totalCadastro: todas.length,
    };


    const from = (data.page - 1) * data.pageSize;
      return {
        rows: filtradas.slice(from, from + data.pageSize),
        count: filtradas.length,
        resumo,
      };
    } catch (err) {
      console.error("[listPisoElegiveis] Erro:", err);
      throw err instanceof Error ? err : new Error("Erro ao listar profissionais elegíveis");
    }
  });


// --------------------------- Dashboard ---------------------------

export const getPisoDashboardGestao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ competencia: z.string().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.visualizar");
    const linhas = await montarLinhas(context.supabase, data.competencia ?? null);
    const importadas = linhas.filter((l) => l.status_importacao === "importado");
    const complementos = importadas.map((l) => l.complementacao).filter((v) => v > 0);

    const agrupar = (key: (l: (typeof linhas)[number]) => string) => {
      const m = new Map<string, { total: number; valor: number }>();
      for (const l of linhas) {
        const k = key(l);
        const cur = m.get(k) ?? { total: 0, valor: 0 };
        cur.total += 1;
        cur.valor += l.complementacao ?? 0;
        m.set(k, cur);
      }
      return Array.from(m.entries())
        .map(([label, v]) => ({ label, total: v.total, valor: Math.round(v.valor * 100) / 100 }))
        .sort((a, b) => b.total - a.total);
    };

    return {
      totais: {
        elegiveis: linhas.length,
        importados: importadas.length,
        pendentes: linhas.length - importadas.length,
        valorTotalPago: Math.round(importadas.reduce((s, l) => s + l.complementacao, 0) * 100) / 100,
        maiorComplemento: complementos.length ? Math.max(...complementos) : 0,
        menorComplemento: complementos.length ? Math.min(...complementos) : 0,
      },
      porUnidade: agrupar((l) => l.unidade ?? "Sem unidade").slice(0, 15),
      porCategoria: agrupar((l) => l.categoria),
      porCargaHoraria: agrupar((l) => (l.carga_horaria ? `${l.carga_horaria}h` : "—")),
    };
  });

// --------------------------- Competências ---------------------------

export const listCompetenciasConsolidadas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.visualizar");
    const { data, error } = await context.supabase
      .from("piso_competencia_profissional")
      .select("competencia")
      .limit(50000);
    if (error) throw new Error(error.message);
    const set = new Set<string>();
    for (const r of data ?? []) if (r.competencia) set.add(r.competencia);
    return { competencias: Array.from(set).sort().reverse() };
  });

// --------------------------- Histórico do profissional ---------------------------

export const getPisoHistoricoProfissional = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ profissional_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.visualizar");
    const { data: rows, error } = await context.supabase
      .from("piso_competencia_profissional")
      .select("*")
      .eq("profissional_id", data.profissional_id)
      .order("competencia", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

// --------------------------- Pendências ---------------------------

export const listPisoPendencias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        competencia: z.string().nullable().optional(),
        tipo: z.string().nullable().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.visualizar");
    let q = context.supabase
      .from("piso_pendencias")
      .select("*")
      .eq("resolvida", false)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (data.competencia) q = q.eq("competencia", data.competencia);
    if (data.tipo) q = q.eq("tipo", data.tipo);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Divergências de cálculo são derivadas (não persistidas na importação).
    const derivadas: any[] = [];
    if (data.competencia && (!data.tipo || data.tipo === "valores_divergentes")) {
      const linhas = await montarLinhas(context.supabase, data.competencia);
      for (const l of linhas.filter((x) => x.divergencia)) {
        derivadas.push({
          id: `div-${l.id}`,
          tipo: "valores_divergentes",
          competencia: data.competencia,
          cpf: l.cpf,
          nome: l.nome,
          matricula: l.matricula,
          cargo: l.cargo,
          profissional_id: l.profissional_id,
          detalhe: `Diferença de R$ ${l.diferenca.toFixed(2)} entre o valor calculado e o importado.`,
          created_at: null,
        });
      }
    }
    return { rows: [...(rows ?? []), ...derivadas] };
  });

export const resolverPisoPendencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.importar");
    const { error } = await context.supabase
      .from("piso_pendencias")
      .update({ resolvida: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --------------------------- Consolidação da importação ---------------------------

/**
 * Consolida um lote de linhas na competência. Nunca cria nem altera
 * profissionais: o vínculo é feito exclusivamente pelo CPF do cadastro.
 */
export const consolidarLotePiso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConsolidarInput.parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.importar");
    const { supabase } = context;
    if (data.linhas.length === 0)
      return { atualizados: 0, rejeitados: 0, pendencias: 0, duplicados: 0 };

    const { profissionais, cargos } = await carregarElegiveis(supabase);
    const referencias = await carregarReferencias(supabase, data.competencia);
    const porCpf = new Map<string, ProfBase>();
    const porMatricula = new Map<string, ProfBase>();
    const porNome = new Map<string, ProfBase>();
    const porId = new Map<string, ProfBase>();
    for (const p of profissionais) {
      porId.set(p.id, p);
      const c = normCpf(p.cpf);
      if (c && !porCpf.has(c)) porCpf.set(c, p);
      const m = normMatricula(p.matricula);
      if (m && !porMatricula.has(m)) porMatricula.set(m, p);
      const n = normNome(p.nome_completo);
      if (n && !porNome.has(n)) porNome.set(n, p);
    }

    const vistos = new Set<string>();
    const pendencias: any[] = [];
    const upserts: any[] = [];
    let duplicados = 0;

    for (const l of data.linhas) {
      // Mesma ordem de busca das telas de Frequência/Folha:
      // CPF → matrícula → nome normalizado → id já resolvido no assistente.
      const cpf = normCpf(l.cpf);
      const mat = normMatricula(l.matricula);
      const nome = normNome(l.nome);
      const prof =
        (cpf ? porCpf.get(cpf) : undefined) ??
        (mat ? porMatricula.get(mat) : undefined) ??
        (nome ? porNome.get(nome) : undefined) ??
        (l.profissional_id ? porId.get(l.profissional_id) : undefined);

      if (!prof) {
        pendencias.push(
          pend(
            "cpf_nao_encontrado",
            l,
            data,
            cpf || mat || nome
              ? "Profissional não localizado no Cadastro por CPF, matrícula ou nome."
              : "Linha sem CPF, matrícula ou nome informados.",
          ),
        );
        continue;
      }
      if (vistos.has(prof.id)) {
        duplicados += 1;
        pendencias.push(
          pend("cpf_duplicado", l, data, "Profissional repetido no arquivo importado."),
        );
        continue;
      }
      vistos.add(prof.id);
      const categoria = resolverElegivel(prof, cargos)?.categoria ?? null;
      if (!categoria) {
        pendencias.push(pend("cargo_incompativel", l, data, "Cargo fora das categorias do Piso."));
        continue;
      }

      const memoria = calcularPiso({
        categoria,
        cargaHoraria: prof.carga_horaria_semanal,
        salarioBase: l.salario_base ?? null,
        insalubridade: l.insalubridade ?? null,
        auxilioImportado: l.auxilio_financeiro ?? null,
        ...refDe(referencias, categoria),
      });

      const base: Record<string, unknown> = {
        profissional_id: prof.id,
        competencia: data.competencia,
        categoria,
        valor_referencia: memoria.valorReferencia,
        complementacao: memoria.complementacao,
        total_remuneracao: memoria.totalRemuneracao,
        divergencia: memoria.divergencia,
        divergencia_valor: memoria.divergencia ? memoria.diferenca : null,
        divergencia_detalhe: memoria.divergencia
          ? `Calculado R$ ${memoria.complementacao.toFixed(2)} × importado R$ ${(memoria.auxilioImportado ?? 0).toFixed(2)}`
          : null,
        status_importacao: "importado",
        updated_by: context.userId,
      };

      for (const [k, v] of Object.entries(l)) {
        if (k === "cpf" || k === "nome") continue;
        if (v != null) base[k] = v;
      }

      const agora = new Date().toISOString();
      if (data.tipo === "piso") {
        base.origem_piso = true;
        base.historico_id_piso = data.historico_id;
        base.origem_piso_arquivo = data.origem_arquivo;
        base.origem_piso_em = agora;
        base.origem_piso_usuario = context.userId;
        base.origem_piso_layout = data.layout_versao ?? null;
      } else {
        base.origem_fopag = true;
        base.historico_id_fopag = data.historico_id;
        base.origem_folha_arquivo = data.origem_arquivo;
        base.origem_folha_em = agora;
        base.origem_folha_usuario = context.userId;
        base.origem_folha_layout = data.layout_versao ?? null;
      }
      upserts.push(base);
    }

    let atualizados = 0;
    let afetados: string[] = [];
    if (upserts.length > 0) {
      // Mescla com o registro já existente da competência (Piso + FOPAG).
      const ids = upserts.map((u) => u.profissional_id);
      afetados = ids;
      const { data: existentes } = await supabase
        .from("piso_competencia_profissional")
        .select("*")
        .eq("competencia", data.competencia)
        .in("profissional_id", ids);
      const mapEx = new Map((existentes ?? []).map((e: any) => [e.profissional_id, e]));
      const rows = upserts.map((u) => {
        const ex = mapEx.get(u.profissional_id);
        return ex ? { ...ex, ...u } : { ...u, created_by: context.userId };
      });
      const MAX_RETRIES = 3;
      let lastError = null;
      let success = false;
      
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const { error } = await supabase
          .from("piso_competencia_profissional")
          .upsert(rows, { onConflict: "profissional_id,competencia" });
          
        if (!error) {
          success = true;
          break;
        }
        lastError = error;
        await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
      }
      
      if (!success) throw new Error(`Falha crítica na persistência do lote consolidado: ${lastError?.message}`);
      
      atualizados = rows.length;
    }

    if (pendencias.length > 0) {
      const { error } = await supabase.from("piso_pendencias").insert(pendencias);
      if (error) console.error("Falha ao registrar pendências (não crítica):", error.message);
    }

    // Reprocessamento incremental: apenas os profissionais afetados pelo lote.
    let consolidacao = null;
    if (afetados.length > 0) {
      consolidacao = await consolidarCompetencia(supabase, {
        competencia: data.competencia,
        profissionalIds: afetados,
        userId: context.userId,
      });
    }

    return {
      atualizados,
      rejeitados: pendencias.length,
      pendencias: pendencias.length,
      duplicados,
      consolidacao,
    };
  });

/** Remove o consolidado e as pendências geradas por uma importação. */
export const desfazerConsolidacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ historico_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.importar");
    const { supabase } = context;
    // Guarda o escopo afetado antes de remover, para reprocessar de forma incremental.
    const { data: afetadosRows } = await supabase
      .from("piso_competencia_profissional")
      .select("profissional_id, competencia")
      .or(
        `historico_id_piso.eq.${data.historico_id},historico_id_fopag.eq.${data.historico_id}`,
      );
    await supabase
      .from("piso_competencia_profissional")
      .delete()
      .eq("historico_id_piso", data.historico_id);
    await supabase
      .from("piso_competencia_profissional")
      .delete()
      .eq("historico_id_fopag", data.historico_id);
    await supabase.from("piso_pendencias").delete().eq("historico_id", data.historico_id);
    const { error } = await supabase
      .from("historico_importacoes")
      .update({ status: "Desfeito" })
      .eq("id", data.historico_id);
    if (error) throw new Error(error.message);

    const porComp = new Map<string, string[]>();
    for (const r of (afetadosRows ?? []) as any[]) {
      const arr = porComp.get(r.competencia) ?? [];
      arr.push(r.profissional_id);
      porComp.set(r.competencia, arr);
    }
    for (const [competencia, ids] of porComp) {
      await consolidarCompetencia(supabase, {
        competencia,
        profissionalIds: ids,
        userId: context.userId,
      });
    }
    return { ok: true, competenciasReprocessadas: porComp.size };
  });

// --------------------------- Auditoria da importação ---------------------------

export const registrarAuditoriaImportacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        historico_id: z.string().uuid(),
        tipo_planilha: z.enum(["piso", "fopag"]),
        atualizados: z.number().int().nonnegative(),
        pendencias: z.number().int().nonnegative(),
        duracao_ms: z.number().int().nonnegative(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.importar");
    const { error } = await context.supabase
      .from("historico_importacoes")
      .update({
        tipo_planilha: data.tipo_planilha,
        registros_atualizados: data.atualizados,
        registros_pendencias: data.pendencias,
        duracao_ms: data.duracao_ms,
      })
      .eq("id", data.historico_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
