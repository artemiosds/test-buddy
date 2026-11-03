import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { waitUntil } from "@vercel/functions";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACOES, EVENTOS, ensurePermission, emitEvento } from "./authz.server";
import { orquestrarSincronizacao } from "./frequencia-sincronizacao.functions";
import { garantirCompetenciaUnidade } from "./competencia-unidade.server";
import { assertPrazoEnvio } from "./prazo-envio";
import { linhaEditavel, MSG_LINHA_BLOQUEADA } from "./edicao-linha";
import { assertAcessoGlobal } from "./acesso-global.server";

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


const STATUS_FOLHAS_PENDENTES_ENVIO = ["rascunho", "com_pendencias", "rejeitada", "devolvida"] as const;
const STATUS_FOLHAS_CONCLUIDAS_ENVIO = ["enviada", "em_analise", "aprovada", "aprovadas", "arquivada"] as const;

function folhaPodeSerEnviada(status: unknown): boolean {
  return (STATUS_FOLHAS_PENDENTES_ENVIO as readonly string[]).includes(String(status ?? "rascunho").toLowerCase());
}

/** Garante um cabeçalho Geral e um cabeçalho por setor ativo, sem duplicar folhas. */
async function garantirCabecalhosSetoriais(
  supabase: any,
  competencia_unidade_id: string,
  unidade_id: string,
  tipo: "efetivos" | "contratados",
  userId: string,
): Promise<{ setores: any[]; folhas: any[] }> {
  const { data: setores, error: setoresErr } = await supabase
    .from("setores")
    .select("id, nome")
    .eq("unidade_id", unidade_id)
    .is("deleted_at", null)
    .order("nome");
  if (setoresErr) throw new Error(setoresErr.message);

  const carregarFolhas = async () => {
    const { data, error } = await supabase
      .from("frequencias")
      .select("id, status, setor_id, data_envio, enviada_por")
      .eq("competencia_unidade_id", competencia_unidade_id)
      .eq("tipo", tipo)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
    return data ?? [];
  };

  let folhas = await carregarFolhas();
  const esperados: Array<string | null> = [null, ...(setores ?? []).map((s: any) => String(s.id))];
  for (const setorId of esperados) {
    if (folhas.some((f: any) => (f.setor_id ? String(f.setor_id) : null) === setorId)) continue;
    const { error } = await supabase.from("frequencias").insert({
      competencia_unidade_id,
      tipo,
      setor_id: setorId,
      status: "rascunho",
      created_by: userId,
    } as never);
    if (error) {
      const duplicada = (error as any).code === "23505" || /duplicate key/i.test(error.message ?? "");
      if (!duplicada) throw new Error(error.message);
      // Outra requisição criou o mesmo cabeçalho. A releitura abaixo resolve a corrida.
    }
  }
  folhas = await carregarFolhas();
  return { setores: setores ?? [], folhas };
}

/** Promove o cabeçalho Geral somente quando todos os setores ativos foram submetidos. */
async function sincronizarCabecalhoGeralSeSetoresConcluidos(
  supabase: any,
  competencia_unidade_id: string,
  unidade_id: string,
  tipo: "efetivos" | "contratados",
  userId: string,
  executadoNome: string,
  executadoPerfil: string,
): Promise<void> {
  const { setores, folhas } = await garantirCabecalhosSetoriais(
    supabase, competencia_unidade_id, unidade_id, tipo, userId,
  );
  if (!setores.length) return;

  const statusPorSetor = new Map(
    folhas.filter((f: any) => f.setor_id).map((f: any) => [String(f.setor_id), String(f.status ?? "rascunho").toLowerCase()]),
  );
  const todosConcluidos = setores.every((s: any) =>
    (STATUS_FOLHAS_CONCLUIDAS_ENVIO as readonly string[]).includes(statusPorSetor.get(String(s.id)) ?? ""),
  );
  if (!todosConcluidos) return;

  const geral = folhas.find((f: any) => !f.setor_id);
  if (!geral || !folhaPodeSerEnviada(geral.status)) return;

  const now = new Date().toISOString();
  const { data: promovidas, error: promoverErr } = await supabase
    .from("frequencias")
    .update({ status: "enviada", data_envio: now, enviada_por: userId, updated_by: userId } as never)
    .eq("id", geral.id)
    .in("status", [...STATUS_FOLHAS_PENDENTES_ENVIO])
    .select("id");
  if (promoverErr) throw new Error(promoverErr.message);
  if (!(promovidas ?? []).length) return;

  const { error: historicoErr } = await supabase.from("frequencia_historico").insert([{
    frequencia_id: geral.id,
    status_anterior: String(geral.status ?? "rascunho"),
    status_novo: "enviada",
    acao: "Consolidação automática dos setores",
    justificativa: `Todos os ${setores.length} setores da unidade foram enviados para análise.`,
    executado_por: userId,
    executado_nome: executadoNome || "Usuário HSM",
    executado_perfil: executadoPerfil || "Indefinido",
  }] as never);
  if (historicoErr) throw new Error(historicoErr.message);
}

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

    const { data: linhasHistoricas, error: historicasErr } = await supabase
      .from("frequencias_contratados")
      .select("profissional_id")
      .eq("competencia_id", data.competencia_id)
      .eq("unidade_id", data.unidade_id)
      .is("deleted_at", null);
    if (historicasErr) throw new Error(historicasErr.message);

    const profissionaisComFrequenciaNestaUnidade = [
      ...new Set((linhasHistoricas ?? []).map((l: any) => l.profissional_id as string)),
    ];

    const selectProfissionais = `
      id, matricula, nome_completo, nome_social, cpf, status,
      banco, agencia, conta_corrente,
      cargo_id, funcao_id, setor_id,
      cargos ( nome ),
      funcoes ( nome ),
      setores!profissionais_setor_id_fkey ( nome ),
      vinculos!inner ( natureza, nome )
    `;
    const criarConsultaProfissionais = () =>
      supabase
        .from("profissionais")
        .select(selectProfissionais)
        .is("deleted_at", null)
        .order("nome_completo");
    const aplicarFiltroSetor = (q: any) => {
      if (data.setor_id) {
        if (Array.isArray(data.setor_id)) q.in("setor_id", data.setor_id);
        else q.eq("setor_id", data.setor_id);
      }
      return q;
    };

    const { data: profissionaisAtuais, error: atuaisErr } = await aplicarFiltroSetor(
      criarConsultaProfissionais(),
    )
      .eq("unidade_id", data.unidade_id)
      .not("status", "in", "(inativo)");
    if (atuaisErr) throw new Error(atuaisErr.message);

    // Consultar os históricos em lotes evita filtros id.in extensos e mantém
    // a mesma seleção de unidade/setor para as pessoas já lançadas na folha.
    const idsAtuais = new Set((profissionaisAtuais ?? []).map((p: any) => p.id as string));
    const idsHistoricosForaDaUnidade = profissionaisComFrequenciaNestaUnidade.filter(
      (id) => !idsAtuais.has(id),
    );
    const profissionaisHistoricos: any[] = [];
    const LOTE_IDS_HISTORICOS = 80;
    for (let i = 0; i < idsHistoricosForaDaUnidade.length; i += LOTE_IDS_HISTORICOS) {
      const lote = idsHistoricosForaDaUnidade.slice(i, i + LOTE_IDS_HISTORICOS);
      const { data: historicos, error: historicosErr } = await aplicarFiltroSetor(
        criarConsultaProfissionais(),
      ).in("id", lote);
      if (historicosErr) throw new Error(historicosErr.message);
      profissionaisHistoricos.push(...(historicos ?? []));
    }

    const porIdProfissional = new Map<string, any>();
    for (const p of [...(profissionaisAtuais ?? []), ...profissionaisHistoricos]) {
      porIdProfissional.set(p.id, p);
    }
    const allProfs = [...porIdProfissional.values()].sort((a, b) =>
      String(a.nome_completo ?? "").localeCompare(String(b.nome_completo ?? ""), "pt-BR"),
    );

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

/**
 * Visão consolidada (TODAS AS UNIDADES) — somente leitura.
 * Disponível apenas para Administrador Master / Gestor. Não cria folhas,
 * não altera status e não é usada por nenhum fluxo de gravação.
 */
export const listarConsolidadoContratados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { competencia_id: string }) =>
    z.object({ competencia_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.FREQUENCIA_VISUALIZAR);
    await assertAcessoGlobal(supabase, userId);

    const { data: allProfs, error: pErr } = await supabase
      .from("profissionais")
      .select(
        `
        id, matricula, nome_completo, nome_social, cpf, status,
        banco, agencia, conta_corrente,
        cargo_id, funcao_id, setor_id, unidade_id,
        cargos ( nome ),
        funcoes ( nome ),
        setores!profissionais_setor_id_fkey ( nome ),
        unidades ( nome, sigla ),
        vinculos!inner ( natureza, nome )
      `,
      )
      .not("status", "in", "(inativo)")
      .is("deleted_at", null)
      .order("nome_completo");
    if (pErr) throw new Error(pErr.message);

    const profs = (allProfs ?? []).filter((p: any) => {
      const natureza = p.vinculos?.natureza?.toLowerCase() || "";
      const nomeVinculo = (p.vinculos?.nome || "").toLowerCase();
      if (natureza.includes("terceir") || nomeVinculo.includes("terceir")) return false;
      const ehEstatutario =
        natureza.includes("estatut") ||
        natureza.includes("efetiv") ||
        nomeVinculo.includes("efetiv") ||
        nomeVinculo.includes("estatut");
      const ehComissionado = natureza.includes("comission") || nomeVinculo.includes("comission");
      return !ehEstatutario && !ehComissionado;
    });

    const profIds = new Set(profs.map((p: any) => p.id as string));
    let freqs: any[] = [];
    if (profIds.size) {
      // Sem filtro de IDs na URL (listas grandes causam 400 Bad Request).
      const { data: fs, error: fErr } = await supabase
        .from("frequencias_contratados")
        .select(
          "status, dias_trabalhados, dias_falta, atestado, he_50, he_100, adn, plantoes, sobreaviso, incentivo, observacoes, profissional_id, competencia_id, unidade_id",
        )
        .eq("competencia_id", data.competencia_id)
        .is("deleted_at", null)
        .limit(5000);
      if (fErr) throw new Error(fErr.message);
      freqs = (fs ?? []).filter((f: any) => profIds.has(f.profissional_id));
    }
    const byProf = new Map(freqs.map((f) => [f.profissional_id, f]));

    return profs.map((p: any) => ({
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
        unidade_id: p.unidade_id ?? null,
        unidade_nome: p.unidades?.nome ?? null,
        unidade_sigla: p.unidades?.sigla ?? null,
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
    await assertPrazoEnvio(supabase, userId, data.competencia_id);

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

    const { data: competenciaUnidade, error: competenciaUnidadeErr } = await supabase
      .from("competencia_unidades")
      .select("id")
      .eq("competencia_id", data.competencia_id)
      .eq("unidade_id", data.unidade_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (competenciaUnidadeErr) throw new Error(competenciaUnidadeErr.message);

    if (competenciaUnidade?.id) {
      let folhaQuery = supabase
        .from("frequencias")
        .select("id, status")
        .eq("competencia_unidade_id", competenciaUnidade.id)
        .eq("tipo", "contratados")
        .is("deleted_at", null);
      if (data.setor_id) {
        folhaQuery = folhaQuery.eq("setor_id", data.setor_id);
      } else {
        folhaQuery = folhaQuery.is("setor_id", null);
      }
      const { data: folhas, error: folhasErr } = await folhaQuery;
      if (folhasErr) throw new Error(folhasErr.message);
      const folhaBloqueada = (folhas ?? []).some((folha: any) =>
        ["aprovada", "aprovadas", "arquivada"].includes(String(folha.status ?? "").toLowerCase()),
      );
      if (folhaBloqueada) {
        throw new Error("Folha aprovada ou arquivada — frequência de contratados em modo somente leitura.");
      }
    }

    const isMaster = context.claims?.is_master === true;
    const { data: isMasterRPC } = await supabase.rpc("is_master", { _user_id: userId });
    
    const { data: profile } = await supabase
      .from('usuarios')
      .select('perfil:perfis(codigo)')
      .eq('id', userId)
      .maybeSingle();
    const role = (profile?.perfil as any)?.codigo || "";
    const isGestor = role === "GESTOR" || role === "MASTER" || role === "ADMINISTRADOR_MASTER";

    const isMasterFinal = isMaster || isMasterRPC === true || isGestor;

    // Existentes
    const profIds = data.linhas.map((l) => l.profissional_id);
    const { data: existentes, error: exErr } = await supabase
      .from("frequencias_contratados")
      .select("id, profissional_id, status, updated_at, created_by, aprovada_em, aprovada_por")
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
    // Férias/licença/afastamento mantêm os lançamentos digitados (Incentivo, HE…);
    // apenas desligados/inativos têm os campos numéricos zerados.
    const naoAtivos = new Set(
      (profsStatus ?? [])
        .filter((p: any) => ["desligado", "inativo"].includes(String(p.status ?? "ativo")))
        .map((p: any) => p.id as string),
    );

    const allRows: Record<string, unknown>[] = [];

    for (const l of data.linhas) {
      const ex = byProf.get(l.profissional_id);
      const statusExistente = String(ex?.status ?? "").toLowerCase();
      if (ex && ["aprovada", "aprovadas", "arquivada"].includes(statusExistente)) {
        throw new Error("Frequência aprovada ou arquivada — registro em modo somente leitura.");
      }

      // Mantém as regras existentes para linhas enviadas/em análise nos demais casos.
      if (!isMasterFinal && ex && ex.status !== "rascunho" && ex.status !== "rejeitada" && (ex.status as string) !== "devolvida") {
        throw new Error("Folha já enviada ou aprovada — não é possível editar sem perfil Master ou Gestor.");
      }

      // Concorrência Otimista
      if (ex?.updated_at && (l as any).updated_at) {
        const bancoTime = new Date(ex.updated_at).getTime();
        const clientTime = new Date((l as any).updated_at).getTime();
        if (bancoTime > clientTime) {
          throw new Error(`Conflito de edição: o registro do profissional foi atualizado por outro usuário. Recarregue a página.`);
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
      const totalDias = toN(l.dias_trabalhados) + toN(l.dias_falta) + toN(l.atestado);
      if (totalDias > diasNoMes) {
        throw new Error(`O total de dias para o profissional (id: ${l.profissional_id}) excede os ${diasNoMes} dias do mês.`);
      }

      const payload: Record<string, unknown> = {
        competencia_id: data.competencia_id,
        unidade_id: data.unidade_id,
        profissional_id: l.profissional_id,
        updated_by: userId,
        status: l.status || (ex ? ex.status : "rascunho") || "rascunho",
        aprovada_em: (l.status === "aprovada" && ex?.status !== "aprovada") ? new Date().toISOString() : (ex?.aprovada_em ?? null),
        aprovada_por: (l.status === "aprovada" && ex?.status !== "aprovada") ? userId : (ex?.aprovada_por ?? null),
      };

      // Todas as linhas do lote precisam do mesmo conjunto de colunas (ver Efetivos).
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
          // Se for nulo/vazio, salva "0" para manter consistência numérica visual.
          payload[f] = (val === null || val === undefined || val === "") ? "0" : String(val);
        }
      }

      allRows.push(payload);
    }

    if (allRows.length) {
      // Upsert atômico de todas as linhas (novas e existentes)
      const { error } = await (supabase.from("frequencias_contratados") as any)
        .upsert(allRows, { onConflict: "competencia_id, unidade_id, profissional_id" });
      
      if (error) {
        console.error("[salvarFolhaContratados] Erro ao salvar frequencias_contratados:", error);
        throw new Error(`Erro ao salvar no banco: ${error.message} (Código: ${error.code})`);
      }
    }

    // O upsert principal já confirmou a gravação. Na Vercel, waitUntil mantém
    // a sincronização de metadados viva após a resposta HTTP sem bloquear o usuário.
    // Fora desse runtime (como no desenvolvimento local), aguardamos como fallback seguro.
    const tarefaSincronizacao = orquestrarSincronizacao({
      data: {
        evento: "FOLHA_SALVA",
        tipo: "contratados",
        competencia_id: data.competencia_id,
        unidade_id: data.unidade_id,
        setor_id: data.setor_id,
      }
    }).catch((error) => {
      console.error("[salvarFolhaContratados] Falha na sincronização após a gravação confirmada:", error);
    });
    try {
      waitUntil(tarefaSincronizacao);
    } catch {
      await tarefaSincronizacao;
    }

    return { ok: true, processadas: allRows.length };
  });

export const enviarFolhaContratados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof EnviarSchema>) => EnviarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.FREQUENCIA_ENVIAR);
    await assertPrazoEnvio(supabase, userId, data.competencia_id);

    const { data: perfil } = await supabase
      .from("perfis")
      .select("nome, codigo")
      .eq("id", (context as any).user?.user_metadata?.perfil_id || "")
      .maybeSingle();

    const cuId = await garantirCompetenciaUnidade({
      competencia_id: data.competencia_id,
      unidade_id: data.unidade_id,
      userId,
    });
    const { setores, folhas: folhasExistentes } = await garantirCabecalhosSetoriais(
      supabase, cuId, data.unidade_id, "contratados", userId,
    );
    const folhaGeral = folhasExistentes.find((f: any) => !f.setor_id);
    const folhasSetoriais = folhasExistentes.filter((f: any) => !!f.setor_id);
    const setorSolicitado = data.setor_id ?? null;

    let folhasCandidatas: any[];
    if (setorSolicitado) {
      const selecionada = folhasSetoriais.find((f: any) => String(f.setor_id) === setorSolicitado);
      if (!selecionada) throw new Error("Não foi possível localizar a folha deste setor.");
      if (!folhaPodeSerEnviada(selecionada.status)) {
        throw new Error("Este setor já foi enviado para análise ou está em aprovação. O envio não será repetido.");
      }
      folhasCandidatas = [selecionada];
    } else if (setores.length > 0) {
      const setoresPendentes = folhasSetoriais.filter((f: any) => folhaPodeSerEnviada(f.status));
      if (!setoresPendentes.length) {
        throw new Error("Todos os setores desta unidade já foram enviados para análise.");
      }
      folhasCandidatas = [
        ...setoresPendentes,
        ...(folhaGeral && folhaPodeSerEnviada(folhaGeral.status) ? [folhaGeral] : []),
      ];
    } else {
      if (!folhaGeral || !folhaPodeSerEnviada(folhaGeral.status)) {
        throw new Error("Esta folha já foi enviada para análise. O envio não será repetido.");
      }
      folhasCandidatas = [folhaGeral];
    }

    // Claim atômico antes da atualização de linhas; já enviadas nunca são alvo.
    const now = new Date().toISOString();
    const { data: folhasMarcadas, error: marcarErr } = await supabase
      .from("frequencias")
      .update({
        status: "enviada",
        data_envio: now,
        enviada_por: userId,
        updated_by: userId,
      } as never)
      .in("id", folhasCandidatas.map((f: any) => String(f.id)))
      .in("status", [...STATUS_FOLHAS_PENDENTES_ENVIO])
      .select("id");
    if (marcarErr) throw new Error(marcarErr.message);

    const idsMarcados = new Set((folhasMarcadas ?? []).map((f: any) => String(f.id)));
    const folhasRealmenteEnviadas = folhasCandidatas.filter((f: any) => idsMarcados.has(String(f.id)));
    if (!folhasRealmenteEnviadas.length) {
      throw new Error("A folha foi enviada por outro usuário ou não possui setores pendentes. Atualize a página.");
    }
    const setoresMarcados = new Set(
      folhasRealmenteEnviadas.map((f: any) => f.setor_id).filter((id: any) => !!id).map(String),
    );
    const geralMarcada = folhasRealmenteEnviadas.some((f: any) => !f.setor_id);

    // Só seleciona profissionais dos setores cujos cabeçalhos foram reclamados neste envio.
    const profQuery = supabase
      .from("profissionais")
      .select("id, setor_id")
      .eq("unidade_id", data.unidade_id)
      .is("deleted_at", null);
    if (setorSolicitado) profQuery.eq("setor_id", setorSolicitado);
    const { data: profissionais, error: profsErr } = await profQuery;
    if (profsErr) throw new Error(profsErr.message);

    const profIds = (profissionais ?? [])
      .filter((p: any) => {
        if (setorSolicitado) return String(p.setor_id ?? "") === setorSolicitado;
        if (setores.length === 0) return geralMarcada;
        if (p.setor_id) return setoresMarcados.has(String(p.setor_id));
        return geralMarcada;
      })
      .map((p: any) => String(p.id));

    let updatedRows: any[] = [];
    if (profIds.length) {
      const { data: rows, error } = await supabase
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
        .in("status", [...STATUS_FOLHAS_PENDENTES_ENVIO])
        .is("deleted_at", null)
        .select("id, profissional_id");
      if (error) throw new Error(error.message);
      updatedRows = rows ?? [];
    }

    let persistidasQuery = supabase
      .from("frequencias_contratados")
      .select("profissional_id")
      .eq("competencia_id", data.competencia_id)
      .eq("unidade_id", data.unidade_id)
      .is("deleted_at", null);
    if (profIds.length) persistidasQuery = persistidasQuery.in("profissional_id", profIds);
    else persistidasQuery = persistidasQuery.in("profissional_id", ["00000000-0000-0000-0000-000000000000"]);
    const { data: linhasPersistidas, error: persistidasErr } = await persistidasQuery;
    if (persistidasErr) throw new Error(persistidasErr.message);
    const profissionaisEnviados = new Set((linhasPersistidas ?? []).map((l: any) => String(l.profissional_id)));

    await orquestrarSincronizacao({
      data: {
        evento: "FOLHA_ENVIADA",
        tipo: "contratados",
        competencia_id: data.competencia_id,
        unidade_id: data.unidade_id,
        setor_id: setorSolicitado ?? undefined,
      },
    });

    const historicos = folhasRealmenteEnviadas.map((folha: any) => ({
      frequencia_id: folha.id,
      status_anterior: String(folha.status ?? "rascunho"),
      status_novo: "enviada",
      acao: "Envio para análise",
      justificativa: !setorSolicitado
        ? `Envio consolidado da unidade: ${profissionaisEnviados.size} profissionais em ${setoresMarcados.size} setores.`
        : null,
      executado_por: userId,
      executado_nome: perfil?.nome || "Usuário HSM",
      executado_perfil: perfil?.codigo || "Indefinido",
    }));
    if (historicos.length) {
      const { error: histErr } = await supabase
        .from("frequencia_historico")
        .insert(historicos as never);
      if (histErr) throw new Error(histErr.message);
    }

    // A orquestração pode recalcular metadados a partir de linhas legadas;
    // reaplicamos "enviada" somente nos cabeçalhos que esta requisição marcou,
    // sem tocar em aprovação nem em cabeçalhos de outros setores.
    const idsRealmenteEnviados = folhasRealmenteEnviadas.map((f: any) => String(f.id));
    const { error: reafirmarErr } = await supabase
      .from("frequencias")
      .update({ status: "enviada", data_envio: now, enviada_por: userId, updated_by: userId } as never)
      .in("id", idsRealmenteEnviados)
      .in("status", [...STATUS_FOLHAS_PENDENTES_ENVIO])
      .select("id");
    if (reafirmarErr) throw new Error(reafirmarErr.message);

    await sincronizarCabecalhoGeralSeSetoresConcluidos(
      supabase, cuId, data.unidade_id, "contratados", userId,
      perfil?.nome || "Usuário HSM", perfil?.codigo || "Indefinido",
    );

    return {
      ok: true,
      enviadas: updatedRows.length || profissionaisEnviados.size,
      setores: setoresMarcados.size,
      frequencias: folhasRealmenteEnviadas.length,
      consolidado: !setorSolicitado,
    };
  });
