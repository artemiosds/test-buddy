/**
 * HSM Expert — Server Functions.
 *
 * Toda comunicação com a IA passa por aqui: rotas autenticadas
 * (`requireSupabaseAuth`), nunca `/api/public/*`. Todas as leituras e escritas
 * de dados acontecem através do Tool Registry, com `ensurePermission()` e o
 * cliente autenticado do usuário (RLS). O modelo nunca toca o banco.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { montarExportacao } from "./hsm/exportacao";
// -----------------------------------------------------------------------------
// Histórico
// -----------------------------------------------------------------------------
export const listarConversasHSM = createServerFn({ method: "GET" })
    .middleware([requireSupabaseAuth])
    .handler(async ({ context }) => {
    const { data, error } = await context.supabase
        .from("hsm_conversas")
        .select("id, titulo, favorito, modelo, tokens, created_at, updated_at")
        .eq("arquivada", false)
        .order("favorito", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(100);
    if (error)
        throw new Error(error.message);
    return (data ?? []);
});
export const lerMensagensHSM = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((d) => z.object({ conversa_id: z.string().uuid() }).parse(d))
    .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
        .from("hsm_mensagens")
        .select("id, papel, conteudo, modelo, provedor, duracao_ms, ferramentas, erro, created_at")
        .eq("conversa_id", data.conversa_id)
        .order("created_at")
        .limit(400);
    if (error)
        throw new Error(error.message);
    return (rows ?? []);
});
export const atualizarConversaHSM = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((d) => z
    .object({
    conversa_id: z.string().uuid(),
    titulo: z.string().trim().min(1).max(120).optional(),
    favorito: z.boolean().optional(),
    excluir: z.boolean().optional(),
})
    .parse(d))
    .handler(async ({ data, context }) => {
    if (data.excluir) {
        const { error } = await context.supabase
            .from("hsm_conversas")
            .delete()
            .eq("id", data.conversa_id);
        if (error)
            throw new Error(error.message);
        return { ok: true };
    }
    const patch = {};
    if (data.titulo !== undefined)
        patch.titulo = data.titulo;
    if (data.favorito !== undefined)
        patch.favorito = data.favorito;
    if (Object.keys(patch).length === 0)
        return { ok: true };
    const { error } = await context.supabase
        .from("hsm_conversas")
        .update(patch)
        .eq("id", data.conversa_id);
    if (error)
        throw new Error(error.message);
    return { ok: true };
});
// -----------------------------------------------------------------------------
// Conversa
// -----------------------------------------------------------------------------
const ContextoSchema = z.object({
    rota: z.string().trim().max(200).nullish(),
    competencia: z.string().trim().max(40).nullish(),
    unidade: z.string().trim().max(120).nullish(),
    profissional: z.string().trim().max(120).nullish(),
    filtros: z.string().trim().max(400).nullish(),
});
const EnviarInput = z.object({
    conversa_id: z.string().uuid().nullish(),
    texto: z.string().trim().min(1).max(4000),
    agente: z.string().trim().max(40).default("geral"),
    contexto: ContextoSchema.default({}),
});
const ConfirmarInput = z.object({
    conversa_id: z.string().uuid(),
    ferramenta: z.string().trim().min(1).max(60),
    argumentos_json: z.string().max(4000).default("{}"),
    agente: z.string().trim().max(40).default("geral"),
    contexto: ContextoSchema.default({}),
});
/** Fase 5 — nome amigável do arquivo exportado. */
function tituloExportacao(ferramenta, pergunta) {
    const base = pergunta.trim().replace(/\s+/g, " ").slice(0, 50);
    return base || ferramenta;
}
function historicoTexto(msgs) {
    // Otimização: Não limitamos mais o histórico severamente, permitindo melhor memória.
    // Mantemos um teto razoável de 30 mensagens para evitar overhead excessivo,
    // mas removemos o limite rígido de 10.
    return msgs
        .slice(-30)
        .map((m) => `${m.papel === "user" ? "Usuário" : "HSM Expert"}: ${m.conteudo}`)
        .join("\n");
}
async function contextoTexto(supabase, ctx, perfil, userId, unidadeId) {
    const { resolverContexto } = await import("./hsm/contexto.server");
    const { memo } = await import("./hsm/memo.server");
    // Os indicadores institucionais mudam pouco entre dois turnos da conversa:
    // memoizar por 45s corta várias consultas do caminho crítico da resposta.
    const chave = userId
        ? `hsm:ctx:${userId}:${JSON.stringify([ctx?.rota, ctx?.unidade, ctx?.competencia, ctx?.profissional, ctx?.filtros])}`
        : "";
    const calcular = async () => (await resolverContexto(supabase, perfil, ctx, unidadeId)).texto;
    return chave ? memo(chave, 45000, calcular) : calcular();
}
async function auditar(supabase, userId, registro) {
    try {
        await supabase.from("hsm_auditoria").insert({ user_id: userId, ...registro });
    }
    catch {
        /* auditoria nunca derruba a resposta */
    }
}
async function garantirConversa(supabase, conversaId, primeiroTexto, agente) {
    if (conversaId)
        return conversaId;
    const titulo = primeiroTexto.slice(0, 60) + (primeiroTexto.length > 60 ? "…" : "");
    const { data, error } = await supabase
        .from("hsm_conversas")
        .insert({ titulo, agente })
        .select("id")
        .single();
    if (error)
        throw new Error(error.message);
    return data.id;
}
async function gravarAssistente(supabase, conversaId, campos) {
    const { data, error } = await supabase
        .from("hsm_mensagens")
        .insert({
        conversa_id: conversaId,
        papel: "assistant",
        conteudo: campos.conteudo,
        modelo: campos.modelo ?? null,
        provedor: campos.provedor ?? null,
        duracao_ms: campos.duracao_ms ?? null,
        ferramentas: campos.ferramentas ?? [],
        erro: campos.erro ?? null,
    })
        .select("id, papel, conteudo, modelo, provedor, duracao_ms, ferramentas, erro, created_at")
        .single();
    if (error)
        throw new Error(error.message);
    await supabase
        .from("hsm_conversas")
        .update({ modelo: campos.modelo ?? null, updated_at: new Date().toISOString() })
        .eq("id", conversaId);
    return data;
}
/**
 * Uso do usuário no dia (e no último minuto) em uma única leitura.
 * Antes eram quatro consultas sequenciais no caminho crítico da resposta.
 */
async function contarUso(supabase) {
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);
    const { data: conversas } = await supabase.from("hsm_conversas").select("id").limit(500);
    const ids = (conversas ?? []).map((c) => c.id);
    if (ids.length === 0)
        return { minuto: 0, dia: 0 };
    const { data } = await supabase
        .from("hsm_mensagens")
        .select("created_at")
        .eq("papel", "user")
        .gte("created_at", inicioDia.toISOString())
        .in("conversa_id", ids)
        .limit(5000);
    const linhas = (data ?? []);
    const corte = Date.now() - 60000;
    return {
        dia: linhas.length,
        minuto: linhas.filter((l) => new Date(l.created_at).getTime() >= corte).length,
    };
}
export const enviarMensagemHSM = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((d) => EnviarInput.parse(d))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const inicio = Date.now();
    const [{ ferramenta, ferramentasPermitidas, catalogoParaPrompt, filtrarPorAgente }, { conversar, classificarIntencao, extrairJson }, { carregarHsmConfig, filtrarFerramentasPorConfig }, { agentePorSlug, agentesDisponiveis }, { memo },] = await Promise.all([
        import("./hsm/tools.server"),
        import("./hsm/router.server"),
        import("./hsm/config.server"),
        import("./hsm/agentes"),
        import("./hsm/memo.server"),
    ]);
    // A configuração é global e muda raramente: memoizar 60s remove uma ida ao
    // banco de todo turno da conversa.
    const config = await memo("hsm:config", 60000, () => carregarHsmConfig(supabase));
    const permitidosSlugs = agentesDisponiveis(config.agentes_habilitados).map((a) => a.slug);
    const agente = agentePorSlug(permitidosSlugs.includes(data.agente) ? data.agente : "geral");
    const conversaId = await garantirConversa(supabase, data.conversa_id, data.texto, agente.slug);
    if (!config.ativo) {
        await supabase
            .from("hsm_mensagens")
            .insert({ conversa_id: conversaId, papel: "user", conteudo: data.texto });
        const mensagem = await gravarAssistente(supabase, conversaId, {
            conteudo: "O HSM Expert está temporariamente desativado pela configuração administrativa.",
            duracao_ms: Date.now() - inicio,
        });
        return { conversa_id: conversaId, mensagem, confirmacao: null, exportacao: null };
    }
    // Otimização: Validação de sessão e perfil injetada no início para evitar re-consultas.
    const { data: userCtx } = await supabase.rpc("get_my_user_context");
    const userCtxObj = userCtx;
    const isMaster = !!userCtxObj?.is_master;
    const unidadeId = userCtxObj?.unidades?.[0];
    const perfilNome = userCtxObj?.perfil_nome || 'usuário';
    const ctxTools = {
        supabase,
        userId: context.userId,
        unidadeId: !isMaster ? unidadeId : undefined
    };
    // Otimização: Paralelismo máximo nas consultas iniciais e cache de ferramentas.
    const [, uso, histRes, perfilRes, todasFerramentas] = await Promise.all([
        supabase
            .from("hsm_mensagens")
            .insert({ conversa_id: conversaId, papel: "user", conteudo: data.texto }),
        contarUso(supabase),
        supabase
            .from("hsm_mensagens")
            .select("papel, conteudo")
            .eq("conversa_id", conversaId)
            .order("created_at", { ascending: false })
            .limit(20), // Histórico expandido para melhor contexto sem degradar performance
        supabase.rpc("get_my_user_context"),
        memo(`hsm:tools:${context.userId}`, 120000, () => ferramentasPermitidas(ctxTools)), // Cache de ferramentas aumentado para 2min
    ]);
    if (uso.minuto > config.limites.mensagens_por_minuto ||
        uso.dia > config.limites.mensagens_por_dia) {
        const mensagem = await gravarAssistente(supabase, conversaId, {
            conteudo: "O limite de uso do HSM Expert foi atingido para este período. Aguarde alguns instantes ou solicite ajuste na configuração administrativa.",
            duracao_ms: Date.now() - inicio,
        });
        return { conversa_id: conversaId, mensagem, confirmacao: null, exportacao: null };
    }
    const historico = (histRes?.data ?? []).slice().reverse();
    const perfil = perfilRes?.data;
    const disponiveis = filtrarPorAgente(filtrarFerramentasPorConfig(todasFerramentas, config), agente.slug);
    const intencao = classificarIntencao(data.texto);
    const ctxTexto = await contextoTexto(supabase, data.contexto, perfil ?? null, context.userId, unidadeId);
    // ---------------------------------------------------------------------
    // Etapa 1 — planejamento: o modelo apenas ESCOLHE uma ferramenta.
    // ---------------------------------------------------------------------
    const planejador = `${config.prompt_sistema}
    
Você está conversando com um ${perfilNome}. 
${!isMaster && unidadeId ? `LIMITE DE CONTEXTO: O usuário é restrito à unidade ID: ${unidadeId}. Suas análises e ferramentas devem focar APENAS nesta unidade.` : ''}

Agente ativo: ${agente.nome}. ${agente.instrucao}

Sua tarefa agora é decidir se precisa consultar o sistema para responder.
Ferramentas disponíveis para este usuário:
${catalogoParaPrompt(disponiveis) || "(nenhuma — responda apenas com orientação geral)"}


Contexto atual:
${ctxTexto || "(sem contexto adicional)"}

Responda SOMENTE com um objeto JSON:
{"ferramenta": "nome exato da lista ou null", "argumentos": { ... }, "motivo": "curto"}
Nunca invente nomes de ferramentas. Se a pergunta não exigir dados do sistema, use "ferramenta": null.`;
    let plano = null;
    let modeloPlano = "";
    let provedorPlano = "";
    // Sem ferramentas disponíveis não há o que planejar: pula uma chamada
    // inteira de IA e responde direto.
    try {
        if (disponiveis.length === 0)
            throw { pular: true };
        const entradaPlano = `Histórico recente:\n${historicoTexto(historico)}\n\nPergunta: ${data.texto}`;
        const r = await conversar({
            supabase,
            intencao: "rapido",
            sistema: planejador,
            usuario: entradaPlano,
        });
        modeloPlano = r.modelo;
        provedorPlano = r.provedor;
        plano = extrairJson(r.texto);
        const { medirUso } = await import("./hsm/custos");
        await auditar(supabase, context.userId, {
            conversa_id: conversaId,
            modelo: r.modelo,
            provedor: r.provedor,
            agente: agente.slug,
            acao: "planejamento",
            sucesso: true,
            duracao_ms: Date.now() - inicio,
            ...medirUso(r.modelo, `${planejador}\n${entradaPlano}`, r.texto),
        });
    }
    catch (e) {
        if (e?.pular !== true) {
            const msg = e instanceof Error ? e.message : "Falha ao contatar a IA.";
            await auditar(supabase, context.userId, {
                conversa_id: conversaId,
                agente: agente.slug,
                sucesso: false,
                erro: msg,
                duracao_ms: Date.now() - inicio,
            });
            const mensagem = await gravarAssistente(supabase, conversaId, {
                conteudo: `Não consegui falar com os provedores de IA agora.\n\n**Detalhe:** ${msg}`,
                erro: msg,
            });
            return { conversa_id: conversaId, mensagem, confirmacao: null, exportacao: null };
        }
    }
    // ---------------------------------------------------------------------
    // Etapa 2 — execução da ferramenta (whitelist + Zod + permissão + RLS).
    // ---------------------------------------------------------------------
    let resultado = null;
    let confirmacao = null;
    const nomeFerramenta = typeof plano?.ferramenta === "string" ? plano.ferramenta : null;
    if (nomeFerramenta) {
        const def = ferramenta(nomeFerramenta);
        const autorizada = def && disponiveis.some((f) => f.nome === def.nome);
        if (def && autorizada) {
            if (def.mutacao) {
                confirmacao = {
                    ferramenta: def.nome,
                    argumentos_json: JSON.stringify(plano?.argumentos ?? {}),
                    descricao: def.descricao,
                };
            }
            else {
                const { chaveCache, lerCache, gravarCache } = await import("./hsm/cache.server");
                const args = (() => {
                    try {
                        return def.schema.parse(plano?.argumentos ?? {});
                    }
                    catch {
                        return null;
                    }
                })();
                const usarCache = config.cache_config.habilitado && args !== null;
                const chave = usarCache
                    ? chaveCache({
                        userId: context.userId,
                        ferramenta: def.nome,
                        argumentos: args,
                        contexto: {
                            competencia: data.contexto?.competencia ?? null,
                            unidade: data.contexto?.unidade ?? null,
                        },
                    })
                    : "";
                const emCache = usarCache ? lerCache(chave) : null;
                if (emCache) {
                    resultado = { nome: def.nome, resumo: emCache.resumo, dados: emCache.dados };
                    await auditar(supabase, context.userId, {
                        conversa_id: conversaId,
                        modelo: modeloPlano,
                        provedor: provedorPlano,
                        agente: agente.slug,
                        ferramenta: def.nome,
                        acao: "consulta_cache",
                        cache_hit: true,
                        sucesso: true,
                        duracao_ms: Date.now() - inicio,
                    });
                }
                else {
                    try {
                        const r = await def.executar(args ?? def.schema.parse(plano?.argumentos ?? {}), ctxTools);
                        resultado = { nome: def.nome, resumo: r.resumo, dados: r.dados };
                        if (usarCache) {
                            gravarCache({
                                chave,
                                userId: context.userId,
                                ferramenta: def.nome,
                                resumo: r.resumo,
                                dados: r.dados,
                                ttlSegundos: config.cache_config.ttl_segundos,
                            });
                        }
                        await auditar(supabase, context.userId, {
                            conversa_id: conversaId,
                            modelo: modeloPlano,
                            provedor: provedorPlano,
                            agente: agente.slug,
                            ferramenta: def.nome,
                            acao: "consulta",
                            sucesso: true,
                            duracao_ms: Date.now() - inicio,
                        });
                    }
                    catch (e) {
                        const msg = e instanceof Error ? e.message : "falha na consulta";
                        resultado = { nome: def.nome, resumo: `Não foi possível consultar: ${msg}`, dados: null };
                        await auditar(supabase, context.userId, {
                            conversa_id: conversaId,
                            modelo: modeloPlano,
                            agente: agente.slug,
                            ferramenta: def.nome,
                            acao: "consulta",
                            sucesso: false,
                            erro: msg,
                            duracao_ms: Date.now() - inicio,
                        });
                    }
                }
            }
        }
    }
    if (confirmacao) {
        const mensagem = await gravarAssistente(supabase, conversaId, {
            conteudo: `Entendi que você quer executar a ação **${confirmacao.ferramenta}** (${confirmacao.descricao}).\n\nEssa operação altera dados do sistema. Confirme abaixo para eu prosseguir.`,
            modelo: modeloPlano,
            provedor: provedorPlano,
            duracao_ms: Date.now() - inicio,
        });
        return { conversa_id: conversaId, mensagem, confirmacao, exportacao: null };
    }
    // ---------------------------------------------------------------------
    // Etapa 3 — redação da resposta final.
    // ---------------------------------------------------------------------
    const mensagem = await responder({
        supabase,
        userId: context.userId,
        conversaId,
        config,
        intencao,
        ctxTexto,
        historico,
        pergunta: data.texto,
        resultado,
        inicio,
        conversar,
        agente: agente.slug,
        instrucaoAgente: agente.instrucao,
    });
    const exportacao = resultado ? montarExportacao(tituloExportacao(resultado.nome, data.texto), resultado.dados) : null;
    return { conversa_id: conversaId, mensagem, confirmacao: null, exportacao };
});
export const confirmarAcaoHSM = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((d) => ConfirmarInput.parse(d))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const inicio = Date.now();
    const { ferramenta, ferramentasPermitidas } = await import("./hsm/tools.server");
    const { conversar } = await import("./hsm/router.server");
    const { carregarHsmConfig, filtrarFerramentasPorConfig } = await import("./hsm/config.server");
    const config = await carregarHsmConfig(supabase);
    if (!config.ativo)
        throw new Error("O HSM Expert está desativado pela configuração administrativa.");
    const ctxTools = { supabase, userId: context.userId };
    const disponiveis = filtrarFerramentasPorConfig(await ferramentasPermitidas(ctxTools), config);
    const def = ferramenta(data.ferramenta);
    if (!def || !disponiveis.some((f) => f.nome === def.nome)) {
        throw new Error("Ação não permitida para o seu perfil.");
    }
    let resumo = "";
    let dados = null;
    let sucesso = true;
    try {
        const args = def.schema.parse(JSON.parse(data.argumentos_json || "{}"));
        const r = await def.executar(args, ctxTools);
        resumo = r.resumo;
        dados = r.dados;
    }
    catch (e) {
        sucesso = false;
        resumo = e instanceof Error ? e.message : "falha ao executar a ação";
    }
    // Fase 4 — a mutação torna obsoleto o cache de leitura deste usuário.
    if (sucesso) {
        const { invalidarCache } = await import("./hsm/cache.server");
        invalidarCache(context.userId);
    }
    const { agentePorSlug } = await import("./hsm/agentes");
    const agente = agentePorSlug(data.agente);
    await auditar(supabase, context.userId, {
        conversa_id: data.conversa_id,
        ferramenta: def.nome,
        agente: agente.slug,
        acao: "execucao",
        sucesso,
        erro: sucesso ? null : resumo,
        duracao_ms: Date.now() - inicio,
        contexto: { rota: data.contexto?.rota ?? null },
    });
    const mensagem = await responder({
        supabase,
        userId: context.userId,
        conversaId: data.conversa_id,
        config,
        intencao: "rapido",
        ctxTexto: await contextoTexto(supabase, data.contexto, null),
        historico: [],
        pergunta: `Ação ${def.nome} confirmada pelo usuário.`,
        resultado: { nome: def.nome, resumo, dados },
        inicio,
        conversar,
        agente: agente.slug,
        instrucaoAgente: agente.instrucao,
    });
    const exportacao = sucesso ? montarExportacao(tituloExportacao(def.nome, def.nome), dados) : null;
    return { conversa_id: data.conversa_id, mensagem, confirmacao: null, exportacao };
});
async function responder(p) {
    const sistema = `${p.config.prompt_sistema}
${p.instrucaoAgente ? `\nOrientação do agente ativo: ${p.instrucaoAgente}\n` : ""}
Formato da resposta:
- Markdown corporativo, direto ao ponto.
- Sempre que houver lista de registros, apresente em TABELA markdown.
- Destaque números importantes em **negrito**.
- Finalize com "Próximos passos" apenas quando fizer sentido.
- Nunca exiba JSON bruto nem nomes técnicos de tabelas/colunas do banco.

Contexto atual:
${p.ctxTexto || "(sem contexto adicional)"}`;
    const dadosTexto = p.resultado
        ? `Resultado da consulta ao sistema (ferramenta ${p.resultado.nome}): ${p.resultado.resumo}\nDados: ${JSON.stringify(p.resultado.dados).slice(0, 12000)}`
        : "Nenhuma consulta ao sistema foi necessária.";
    const entrada = `Histórico recente:\n${historicoTexto(p.historico)}\n\nPergunta do usuário: ${p.pergunta}\n\n${dadosTexto}`;
    try {
        const r = await p.conversar({
            supabase: p.supabase,
            intencao: p.intencao,
            sistema,
            usuario: entrada,
        });
        const { medirUso } = await import("./hsm/custos");
        await auditar(p.supabase, p.userId, {
            conversa_id: p.conversaId,
            modelo: r.modelo,
            provedor: r.provedor,
            agente: p.agente ?? "geral",
            ferramenta: p.resultado?.nome ?? null,
            acao: "resposta",
            sucesso: true,
            duracao_ms: Date.now() - p.inicio,
            ...medirUso(r.modelo, `${sistema}\n${entrada}`, r.texto ?? ""),
        });
        return gravarAssistente(p.supabase, p.conversaId, {
            conteudo: r.texto || "Não consegui gerar uma resposta.",
            modelo: r.modelo,
            provedor: r.provedor,
            duracao_ms: Date.now() - p.inicio,
            ferramentas: p.resultado ? [{ nome: p.resultado.nome, resumo: p.resultado.resumo }] : [],
        });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "falha na IA";
        await auditar(p.supabase, p.userId, {
            conversa_id: p.conversaId,
            agente: p.agente ?? "geral",
            sucesso: false,
            erro: msg,
            duracao_ms: Date.now() - p.inicio,
        });
        const base = p.resultado ? `**${p.resultado.resumo}**\n\n` : "";
        return gravarAssistente(p.supabase, p.conversaId, {
            conteudo: `${base}Não consegui redigir a resposta com a IA agora.\n\n**Detalhe:** ${msg}`,
            erro: msg,
            duracao_ms: Date.now() - p.inicio,
        });
    }
}
/** Fase 7 — feedback do usuário sobre uma resposta do assistente. */
export const registrarFeedbackHSM = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((d) => z
    .object({
    mensagem_id: z.string().uuid(),
    util: z.boolean(),
    comentario: z.string().trim().max(500).nullish(),
})
    .parse(d))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { error } = await supabase
        .from("hsm_feedback")
        .upsert({
        mensagem_id: data.mensagem_id,
        user_id: context.userId,
        util: data.util,
        comentario: data.comentario ?? null,
    }, { onConflict: "mensagem_id,user_id" });
    if (error)
        throw new Error(error.message);
    return { ok: true };
});
