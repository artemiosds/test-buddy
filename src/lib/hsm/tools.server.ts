/**
 * HSM Expert — Registro de Ferramentas (Tool Registry).
 *
 * PRINCÍPIO DE SEGURANÇA: o modelo de IA **nunca** escreve SQL, nunca escolhe
 * tabela, coluna ou RPC. Ele apenas devolve o NOME de uma ferramenta deste
 * registro e os argumentos. Tudo o que acontece depois é código nosso:
 *
 *   nome da ferramenta (whitelist) → Zod → ensurePermission() → context.supabase (RLS)
 *
 * Nenhuma ferramenta usa `supabaseAdmin` ou `service_role`. O cliente recebido
 * é sempre o cliente autenticado do usuário (requireSupabaseAuth), portanto o
 * HSM Expert enxerga exatamente os mesmos dados que a interface mostra.
 */

import { z } from "zod";
import { ensurePermission } from "../authz.server";

export type ToolCtx = {
  supabase: any;
  userId: string;
  unidadeId?: string;
};

export type ToolResultado = {
  resumo: string;
  dados: unknown;
};

export type ToolDef = {
  nome: string;
  descricao: string;
  /** Código de permissão exigido (catálogo public.permissoes). */
  permissao: string;
  /** true = altera dados → exige confirmação explícita do usuário. */
  mutacao: boolean;
  /** Descrição dos argumentos para o planejador (texto curto). */
  argumentos: string;
  schema: z.ZodTypeAny;
  executar: (args: any, ctx: ToolCtx) => Promise<ToolResultado>;
};

export type ToolRisco = "baixo" | "medio" | "alto";

export type ToolCatalogItem = {
  nome: string;
  descricao: string;
  permissao: string;
  mutacao: boolean;
  argumentos: string;
  modulo: string;
  categoria: "consulta" | "analise" | "auditoria" | "acao";
  risco: ToolRisco;
  versao: string;
  agentes: string[];
  palavras_chave: string[];
  exemplos: string[];
};

const LIMITE = z.coerce.number().int().min(1).max(200).default(50);
const texto = (max = 120) => z.string().trim().max(max);

function erro(e: { message: string } | null) {
  if (e) throw new Error(e.message);
}

async function nomeUnidade(ctx: ToolCtx, termo?: string): Promise<string[] | null> {
  if (!termo) return null;
  const { data, error } = await ctx.supabase
    .from("unidades")
    .select("id")
    .ilike("nome", `%${termo}%`)
    .is("deleted_at", null)
    .limit(20);
  erro(error);
  const ids = (data ?? []).map((u: { id: string }) => u.id);
  return ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];
}

// -----------------------------------------------------------------------------
// Ferramentas de LEITURA
// -----------------------------------------------------------------------------

const listarProfissionais: ToolDef = {
  nome: "listarProfissionais",
  descricao:
    "Lista profissionais do cadastro com filtros opcionais (status, unidade, cargo/função, busca por nome ou CPF).",
  permissao: "profissional.visualizar",
  mutacao: false,
  argumentos:
    '{ status?: string (ativo|licenca|ferias|afastado|desligado|...), unidade?: string (nome), cargo?: string (nome do cargo ou função), busca?: string, limite?: number }',
  schema: z.object({
    status: texto(40).optional(),
    unidade: texto(120).optional(),
    cargo: texto(120).optional(),
    busca: texto(120).optional(),
    limite: LIMITE,
  }),
  async executar(a, ctx) {
    await ensurePermission(ctx.supabase, ctx.userId, "profissional.visualizar");
    let q = ctx.supabase
      .from("profissionais")
      .select(
        "id, nome_completo, cpf, matricula, status, situacao_funcional, carga_horaria_semanal, unidade_id, cargo_id, funcao_id",
        { count: "exact" },
      )
      .is("deleted_at", null)
      .order("nome_completo")
      .limit(a.limite);

    if (a.status) q = q.eq("status", a.status);
    if (a.busca) q = q.or(`nome_completo.ilike.%${a.busca}%,cpf.ilike.%${a.busca}%`);
    const unidades = ctx.unidadeId ? [ctx.unidadeId] : await nomeUnidade(ctx, a.unidade);
    if (unidades) q = q.in("unidade_id", unidades);

    const { data, error, count } = await q;
    erro(error);

    let linhas = (data ?? []) as any[];

    // Resolve nomes (unidade / cargo / função) sem embeds ambíguos.
    const [uni, car, fun] = await Promise.all([
      ctx.supabase.from("unidades").select("id, nome").is("deleted_at", null),
      ctx.supabase.from("cargos").select("id, nome").is("deleted_at", null),
      ctx.supabase.from("funcoes").select("id, nome").is("deleted_at", null),
    ]);
    const mapa = (r: any) =>
      new Map<string, string>(((r.data ?? []) as any[]).map((x) => [x.id, x.nome]));
    const mu = mapa(uni);
    const mc = mapa(car);
    const mf = mapa(fun);

    linhas = linhas.map((p) => ({
      nome: p.nome_completo,
      cpf: p.cpf,
      matricula: p.matricula,
      status: p.status,
      situacao: p.situacao_funcional,
      carga_horaria: p.carga_horaria_semanal,
      unidade: p.unidade_id ? (mu.get(p.unidade_id) ?? null) : null,
      cargo: p.cargo_id ? (mc.get(p.cargo_id) ?? null) : null,
      funcao: p.funcao_id ? (mf.get(p.funcao_id) ?? null) : null,
    }));

    if (a.cargo) {
      const alvo = a.cargo.toLowerCase();
      linhas = linhas.filter(
        (l) =>
          (l.cargo ?? "").toLowerCase().includes(alvo) ||
          (l.funcao ?? "").toLowerCase().includes(alvo),
      );
    }

    return {
      resumo: `${linhas.length} profissional(is) retornado(s)${count ? ` de ${count} no filtro` : ""}.`,
      dados: linhas,
    };
  },
};

const contarProfissionais: ToolDef = {
  nome: "contarProfissionais",
  descricao:
    "Conta profissionais agrupando por status, unidade, cargo, função, vínculo ou setor. Ideal para perguntas do tipo 'quantos...' e para gráficos.",
  permissao: "profissional.visualizar",
  mutacao: false,
  argumentos: '{ agrupar_por?: "status"|"unidade"|"cargo"|"funcao"|"vinculo"|"setor", status?: string }',
  schema: z.object({
    agrupar_por: z.enum(["status", "unidade", "cargo", "funcao", "vinculo", "setor"]).default("status"),
    status: texto(40).optional(),
  }),
  async executar(a, ctx) {
    await ensurePermission(ctx.supabase, ctx.userId, "profissional.visualizar");
    let q = ctx.supabase
      .from("profissionais")
      .select("status, unidade_id, cargo_id, funcao_id, vinculo_id, setor_id")
      .is("deleted_at", null)
      .limit(20000);
    if (a.status) q = q.eq("status", a.status);
    if (ctx.unidadeId) q = q.eq("unidade_id", ctx.unidadeId);
    const { data, error } = await q;
    erro(error);

    const tabelas: Record<string, [string, string]> = {
      unidade: ["unidades", "unidade_id"],
      cargo: ["cargos", "cargo_id"],
      funcao: ["funcoes", "funcao_id"],
      vinculo: ["vinculos", "vinculo_id"],
      setor: ["setores", "setor_id"],
    };

    let chave = (r: any) => String(r.status ?? "—");
    if (a.agrupar_por !== "status") {
      const [tabela, coluna] = tabelas[a.agrupar_por];
      const { data: refs } = await ctx.supabase.from(tabela).select("id, nome");
      const m = new Map<string, string>(((refs ?? []) as any[]).map((x) => [x.id, x.nome]));
      chave = (r: any) => (r[coluna] ? (m.get(r[coluna]) ?? "—") : "Não informado");
    }

    const contagem = new Map<string, number>();
    for (const r of (data ?? []) as any[]) {
      const k = chave(r);
      contagem.set(k, (contagem.get(k) ?? 0) + 1);
    }
    const linhas = [...contagem.entries()]
      .map(([grupo, total]) => ({ grupo, total }))
      .sort((x, y) => y.total - x.total);

    return {
      resumo: `Total ${(data ?? []).length} profissionais em ${linhas.length} grupo(s) por ${a.agrupar_por}.`,
      dados: { total: (data ?? []).length, grupos: linhas },
    };
  },
};

const buscarProfissional: ToolDef = {
  nome: "buscarProfissional",
  descricao: "Busca a ficha detalhada de um profissional por nome, CPF ou matrícula.",
  permissao: "profissional.visualizar",
  mutacao: false,
  argumentos: "{ termo: string (nome, CPF ou matrícula) }",
  schema: z.object({ termo: texto(120) }),
  async executar(a, ctx) {
    await ensurePermission(ctx.supabase, ctx.userId, "profissional.visualizar");
    let q = ctx.supabase
      .from("profissionais")
      .select(
        "id, nome_completo, cpf, matricula, status, situacao_funcional, data_admissao, carga_horaria_semanal, email, telefone, unidade_id, setor_id, cargo_id, funcao_id, vinculo_id",
      )
      .is("deleted_at", null)
      .or(
        `nome_completo.ilike.%${a.termo}%,cpf.ilike.%${a.termo}%,matricula.ilike.%${a.termo}%`,
      )
      .limit(10);
    if (ctx.unidadeId) q = q.eq("unidade_id", ctx.unidadeId);
    const { data, error } = await q;
    erro(error);
    return {
      resumo: `${(data ?? []).length} correspondência(s) para "${a.termo}".`,
      dados: data ?? [],
    };
  },
};

const listarUnidades: ToolDef = {
  nome: "listarUnidades",
  descricao: "Lista as unidades de saúde visíveis ao usuário (nome, sigla, CNES, status).",
  permissao: "unidade.visualizar",
  mutacao: false,
  argumentos: "{ busca?: string, limite?: number }",
  schema: z.object({ busca: texto(120).optional(), limite: LIMITE }),
  async executar(a, ctx) {
    await ensurePermission(ctx.supabase, ctx.userId, "unidade.visualizar");
    let q = ctx.supabase
      .from("unidades")
      .select("nome, sigla, cnes, tipo_atendimento, municipio, status")
      .is("deleted_at", null)
      .order("nome")
      .limit(a.limite);
    if (a.busca) q = q.ilike("nome", `%${a.busca}%`);
    if (ctx.unidadeId) q = q.eq("id", ctx.unidadeId);
    const { data, error } = await q;
    erro(error);
    return { resumo: `${(data ?? []).length} unidade(s).`, dados: data ?? [] };
  },
};

const listarCompetencias: ToolDef = {
  nome: "listarCompetencias",
  descricao: "Lista competências (mês/ano) com status, prazos e descrição.",
  permissao: "competencia.visualizar",
  mutacao: false,
  argumentos: '{ status?: "aberta"|"em_processamento"|"encerrada"|"arquivada", limite?: number }',
  schema: z.object({ status: texto(30).optional(), limite: LIMITE }),
  async executar(a, ctx) {
    await ensurePermission(ctx.supabase, ctx.userId, "competencia.visualizar");
    let q = ctx.supabase
      .from("competencias")
      .select("ano, mes, descricao, status, data_inicio, data_fim, prazo_envio, prazo_analise")
      .is("deleted_at", null)
      .order("ano", { ascending: false })
      .order("mes", { ascending: false })
      .limit(a.limite);
    if (a.status) q = q.eq("status", a.status);
    const { data, error } = await q;
    erro(error);
    return { resumo: `${(data ?? []).length} competência(s).`, dados: data ?? [] };
  },
};

const listarFrequencias: ToolDef = {
  nome: "listarFrequencias",
  descricao:
    "Lista o andamento das folhas de frequência por unidade/competência (status, totais, datas de envio e aprovação).",
  permissao: "frequencia.visualizar",
  mutacao: false,
  argumentos: '{ status?: string, limite?: number }',
  schema: z.object({ status: texto(30).optional(), limite: LIMITE }),
  async executar(a, ctx) {
    await ensurePermission(ctx.supabase, ctx.userId, "frequencia.visualizar");
    let q = ctx.supabase
      .from("frequencias")
      .select(
        "tipo, status, total_profissionais, total_faltas, total_horas_extras, data_envio, data_aprovacao",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(a.limite);
    if (a.status) q = q.eq("status", a.status);
    if (ctx.unidadeId) q = q.eq("unidade_id", ctx.unidadeId);
    const { data, error } = await q;
    erro(error);
    return { resumo: `${(data ?? []).length} folha(s) de frequência.`, dados: data ?? [] };
  },
};

const listarPendencias: ToolDef = {
  nome: "listarPendencias",
  descricao: "Lista pendências institucionais (número, título, status, prioridade, prazo).",
  permissao: "pendencia.visualizar",
  mutacao: false,
  argumentos: '{ status?: string, prioridade?: string, limite?: number }',
  schema: z.object({
    status: texto(30).optional(),
    prioridade: texto(20).optional(),
    limite: LIMITE,
  }),
  async executar(a, ctx) {
    await ensurePermission(ctx.supabase, ctx.userId, "pendencia.visualizar");
    let q = ctx.supabase
      .from("pendencias")
      .select("numero, titulo, categoria, status, prioridade, prazo, aberta_em, resolvida_em")
      .is("deleted_at", null)
      .order("aberta_em", { ascending: false })
      .limit(a.limite);
    if (a.status) q = q.eq("status", a.status);
    if (a.prioridade) q = q.eq("prioridade", a.prioridade);
    const { data, error } = await q;
    erro(error);
    return { resumo: `${(data ?? []).length} pendência(s).`, dados: data ?? [] };
  },
};

const resumoPisoEnfermagem: ToolDef = {
  nome: "resumoPisoEnfermagem",
  descricao:
    "Resumo consolidado do Piso Nacional da Enfermagem por competência: quantidade por categoria, unidade e divergências.",
  permissao: "piso.visualizar",
  mutacao: false,
  argumentos: '{ competencia?: string (AAAA-MM), limite?: number }',
  schema: z.object({ competencia: texto(12).optional(), limite: LIMITE }),
  async executar(a, ctx) {
    await ensurePermission(ctx.supabase, ctx.userId, "piso.visualizar");
    let q = ctx.supabase
      .from("piso_competencia_profissional")
      .select("competencia, categoria, unidade_nome, divergencia, status_consolidacao")
      .limit(20000);
    if (a.competencia) q = q.eq("competencia", a.competencia);
    if (ctx.unidadeId) q = q.eq("unidade_id", ctx.unidadeId);
    const { data, error } = await q;
    erro(error);
    const linhas = (data ?? []) as any[];
    const agrupar = (campo: string) => {
      const m = new Map<string, number>();
      for (const l of linhas) {
        const k = String(l[campo] ?? "—");
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return [...m.entries()].map(([grupo, total]) => ({ grupo, total })).sort((x, y) => y.total - x.total);
    };
    return {
      resumo: `${linhas.length} registro(s) consolidado(s)${a.competencia ? ` na competência ${a.competencia}` : ""}.`,
      dados: {
        total: linhas.length,
        divergencias: linhas.filter((l) => l.divergencia).length,
        por_categoria: agrupar("categoria"),
        por_unidade: agrupar("unidade_nome").slice(0, a.limite),
        por_competencia: agrupar("competencia"),
      },
    };
  },
};

const listarNotificacoes: ToolDef = {
  nome: "listarNotificacoes",
  descricao: "Lista as notificações do próprio usuário logado.",
  permissao: "notificacao.visualizar",
  mutacao: false,
  argumentos: "{ apenas_nao_lidas?: boolean, limite?: number }",
  schema: z.object({ apenas_nao_lidas: z.boolean().default(false), limite: LIMITE }),
  async executar(a, ctx) {
    await ensurePermission(ctx.supabase, ctx.userId, "notificacao.visualizar");
    let q = ctx.supabase
      .from("notificacoes")
      .select("titulo, mensagem, tipo, prioridade, lida, created_at")
      .eq("usuario_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(a.limite);
    if (a.apenas_nao_lidas) q = q.eq("lida", false);
    const { data, error } = await q;
    erro(error);
    return { resumo: `${(data ?? []).length} notificação(ões).`, dados: data ?? [] };
  },
};

const consultarAuditoria: ToolDef = {
  nome: "consultarAuditoria",
  descricao: "Consulta a trilha de auditoria do sistema (ações, tabelas, datas).",
  permissao: "auditoria.visualizar",
  mutacao: false,
  argumentos: "{ busca?: string, limite?: number }",
  schema: z.object({ busca: texto(120).optional(), limite: LIMITE }),
  async executar(a, ctx) {
    await ensurePermission(ctx.supabase, ctx.userId, "auditoria.visualizar");
    let q = ctx.supabase
      .from("audit_log")
      .select("acao, operacao, tabela, created_at")
      .order("created_at", { ascending: false })
      .limit(a.limite);
    if (a.busca) q = q.ilike("acao", `%${a.busca}%`);
    const { data, error } = await q;
    erro(error);
    return { resumo: `${(data ?? []).length} evento(s) de auditoria.`, dados: data ?? [] };
  },
};

// -----------------------------------------------------------------------------
// Ferramentas de ESCRITA (exigem confirmação explícita do usuário)
// -----------------------------------------------------------------------------

const marcarNotificacoesLidas: ToolDef = {
  nome: "marcarNotificacoesLidas",
  descricao: "Marca todas as notificações não lidas do usuário logado como lidas.",
  permissao: "notificacao.visualizar",
  mutacao: true,
  argumentos: "{}",
  schema: z.object({}),
  async executar(_a, ctx) {
    await ensurePermission(ctx.supabase, ctx.userId, "notificacao.visualizar");
    const { data, error } = await ctx.supabase
      .from("notificacoes")
      .update({ lida: true, lida_em: new Date().toISOString() })
      .eq("usuario_id", ctx.userId)
      .eq("lida", false)
      .select("id");
    erro(error);
    return {
      resumo: `${(data ?? []).length} notificação(ões) marcada(s) como lida(s).`,
      dados: { atualizadas: (data ?? []).length },
    };
  },
};

// -----------------------------------------------------------------------------
// Registro
// -----------------------------------------------------------------------------

export const FERRAMENTAS: ToolDef[] = [
  listarProfissionais,
  contarProfissionais,
  buscarProfissional,
  listarUnidades,
  listarCompetencias,
  listarFrequencias,
  listarPendencias,
  resumoPisoEnfermagem,
  listarNotificacoes,
  consultarAuditoria,
  marcarNotificacoesLidas,
];

const METADATA: Record<string, Omit<ToolCatalogItem, "nome" | "descricao" | "permissao" | "mutacao" | "argumentos">> = {
  listarProfissionais: {
    modulo: "Profissionais",
    categoria: "consulta",
    risco: "baixo",
    versao: "1.0.0",
    agentes: ["rh", "cadastro", "geral"],
    palavras_chave: ["profissionais", "servidores", "cadastro", "cpf", "cargo", "função", "unidade"],
    exemplos: ["Liste profissionais ativos da UBS Centro", "Mostre técnicos de enfermagem"],
  },
  contarProfissionais: {
    modulo: "Profissionais",
    categoria: "analise",
    risco: "baixo",
    versao: "1.0.0",
    agentes: ["rh", "gestao", "geral"],
    palavras_chave: ["quantos", "total", "agrupado", "unidade", "setor", "cargo"],
    exemplos: ["Quantos profissionais por unidade?", "Distribua profissionais por cargo"],
  },
  buscarProfissional: {
    modulo: "Profissionais",
    categoria: "consulta",
    risco: "medio",
    versao: "1.0.0",
    agentes: ["rh", "cadastro", "geral"],
    palavras_chave: ["ficha", "profissional", "cpf", "matrícula", "dados cadastrais"],
    exemplos: ["Busque a ficha de Maria", "Localize o profissional pela matrícula"],
  },
  listarUnidades: {
    modulo: "Unidades",
    categoria: "consulta",
    risco: "baixo",
    versao: "1.0.0",
    agentes: ["unidades", "gestao", "geral"],
    palavras_chave: ["unidades", "cnes", "ubs", "hospital", "secretaria"],
    exemplos: ["Liste as unidades ativas", "Quais unidades têm CNES?"],
  },
  listarCompetencias: {
    modulo: "Competências",
    categoria: "consulta",
    risco: "baixo",
    versao: "1.0.0",
    agentes: ["frequencia", "gestao", "geral"],
    palavras_chave: ["competência", "mês", "prazo", "fechamento", "status"],
    exemplos: ["Quais competências estão abertas?", "Mostre os prazos de envio"],
  },
  listarFrequencias: {
    modulo: "Frequência",
    categoria: "consulta",
    risco: "baixo",
    versao: "1.0.0",
    agentes: ["frequencia", "gestao", "geral"],
    palavras_chave: ["frequência", "folha", "envio", "aprovação", "unidade"],
    exemplos: ["Mostre folhas em análise", "Como está o envio das frequências?"],
  },
  listarPendencias: {
    modulo: "Pendências",
    categoria: "consulta",
    risco: "baixo",
    versao: "1.0.0",
    agentes: ["pendencias", "gestao", "geral"],
    palavras_chave: ["pendências", "prazo", "prioridade", "abertas", "sla"],
    exemplos: ["Liste pendências críticas", "Quais pendências estão abertas?"],
  },
  resumoPisoEnfermagem: {
    modulo: "Piso da Enfermagem",
    categoria: "analise",
    risco: "baixo",
    versao: "1.0.0",
    agentes: ["piso", "folha", "gestao", "geral"],
    palavras_chave: ["piso", "enfermagem", "consolidado", "categoria", "divergência", "competência"],
    exemplos: ["Resumo do piso na competência atual", "Divergências do piso por unidade"],
  },
  listarNotificacoes: {
    modulo: "Notificações",
    categoria: "consulta",
    risco: "baixo",
    versao: "1.0.0",
    agentes: ["geral"],
    palavras_chave: ["notificações", "avisos", "não lidas", "alertas"],
    exemplos: ["Tenho notificações não lidas?", "Liste meus alertas"],
  },
  consultarAuditoria: {
    modulo: "Auditoria",
    categoria: "auditoria",
    risco: "medio",
    versao: "1.0.0",
    agentes: ["auditoria", "master", "geral"],
    palavras_chave: ["auditoria", "logs", "ações", "rastreabilidade", "histórico"],
    exemplos: ["Consulte eventos de auditoria recentes", "Mostre ações relacionadas a frequência"],
  },
  marcarNotificacoesLidas: {
    modulo: "Notificações",
    categoria: "acao",
    risco: "medio",
    versao: "1.0.0",
    agentes: ["geral"],
    palavras_chave: ["marcar", "lidas", "notificações", "limpar"],
    exemplos: ["Marque minhas notificações como lidas"],
  },
};

const INDICE = new Map(FERRAMENTAS.map((f) => [f.nome, f]));

/** Whitelist: só existe ferramenta que está no registro. */
export function ferramenta(nome: string): ToolDef | null {
  return INDICE.get(nome) ?? null;
}

function itemCatalogo(f: ToolDef): ToolCatalogItem {
  const meta = METADATA[f.nome] ?? {
    modulo: "Sistema",
    categoria: f.mutacao ? "acao" : "consulta",
    risco: f.mutacao ? "medio" : "baixo",
    versao: "1.0.0",
    agentes: ["geral"],
    palavras_chave: [f.nome],
    exemplos: [],
  };
  return {
    nome: f.nome,
    descricao: f.descricao,
    permissao: f.permissao,
    mutacao: f.mutacao,
    argumentos: f.argumentos,
    ...meta,
  };
}

/** Catálogo público para administração e agentes especializados — sem SQL/tabelas. */
export function catalogoPublico(): ToolCatalogItem[] {
  return FERRAMENTAS.map(itemCatalogo);
}

/** Catálogo enviado ao planejador — sem SQL, sem nomes de tabela. */
export function catalogoParaPrompt(permitidas: ToolDef[]): string {
  return permitidas
    .map((f) => {
      const c = itemCatalogo(f);
      return `- ${c.nome}${c.mutacao ? " (ALTERA DADOS)" : ""}: ${c.descricao} Módulo: ${c.modulo}. Risco: ${c.risco}. Agentes: ${c.agentes.join(", ")}. Argumentos: ${c.argumentos}`;
    })
    .join("\n");
}

/** Ferramentas realmente disponíveis para o usuário (filtro por permissão). */
export async function ferramentasPermitidas(ctx: ToolCtx): Promise<ToolDef[]> {
  const { data } = await ctx.supabase.rpc("get_my_permissions");
  const codigos = new Set<string>(((data as string[]) ?? []).map(String));
  const { data: master } = await ctx.supabase.rpc("is_master", { _user_id: ctx.userId });
  if (master) return FERRAMENTAS;
  return FERRAMENTAS.filter((f) => codigos.has(f.permissao));
}

/**
 * Fase 8 — recorte por agente especializado. Nunca amplia o conjunto: apenas
 * restringe as ferramentas já permitidas ao perfil. Se o recorte ficar vazio,
 * mantém a lista original para não deixar o agente sem nenhuma capacidade.
 */
export function filtrarPorAgente(ferramentas: ToolDef[], agente: string | null | undefined): ToolDef[] {
  if (!agente || agente === "geral") return ferramentas;
  const recorte = ferramentas.filter((f) => itemCatalogo(f).agentes.includes(agente));
  return recorte.length > 0 ? recorte : ferramentas;
}
