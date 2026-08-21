/**
 * HSM Expert — Fase 6: Contexto Inteligente (resolvido no servidor).
 *
 * PRINCÍPIO DE SEGURANÇA: nada do que o navegador envia é usado como fato.
 * O cliente só manda "pistas de tela" (rota, filtros exibidos) que são tratadas
 * como texto informativo. Identidade, perfil, permissões, unidade e competência
 * são resolvidos aqui, sempre com o cliente autenticado do usuário (RLS ativa)
 * — nunca com `supabaseAdmin` / `service_role`.
 */
const MESES = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
];
async function contar(sb, tabela, aplicar) {
    try {
        const { count, error } = await aplicar(sb.from(tabela).select("id", { count: "exact", head: true }));
        if (error)
            return null;
        return count ?? null;
    }
    catch {
        return null;
    }
}
async function competenciaAtiva(sb) {
    try {
        const { data, error } = await sb
            .from("competencias")
            .select("id, mes, ano, status")
            .in("status", ["aberta", "em_processamento"])
            .order("ano", { ascending: false })
            .order("mes", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error || !data)
            return null;
        return {
            id: data.id,
            status: String(data.status),
            label: `${MESES[(Number(data.mes) || 1) - 1]}/${data.ano}`,
        };
    }
    catch {
        return null;
    }
}
function pistas(ctx) {
    if (!ctx)
        return [];
    return [
        ctx.rota ? `Tela aberta pelo usuário: ${ctx.rota}` : null,
        ctx.unidade ? `Unidade em foco na tela: ${ctx.unidade}` : null,
        ctx.profissional ? `Profissional aberto na tela: ${ctx.profissional}` : null,
        ctx.competencia ? `Competência selecionada na tela: ${ctx.competencia}` : null,
        ctx.filtros ? `Filtros visíveis: ${ctx.filtros}` : null,
    ].filter(Boolean);
}
/**
 * Monta o contexto institucional do usuário logado.
 * Falhas parciais nunca derrubam a conversa — o campo simplesmente fica nulo.
 */
export async function resolverContexto(sb, perfil, pistasCliente, unidadeRestritaId) {
    const isMaster = perfil?.is_master === true;
    const filterByUnit = (q) => {
        let query = q.is("deleted_at", null);
        if (!isMaster && unidadeRestritaId) {
            query = query.eq("unidade_id", unidadeRestritaId);
        }
        return query;
    };
    const [competencia, profissionais, pendencias, unidades] = await Promise.all([
        competenciaAtiva(sb),
        contar(sb, "profissionais", (q) => filterByUnit(q).eq("status", "ativo")),
        contar(sb, "pendencias", (q) => filterByUnit(q).in("status", ["aberta", "em_analise", "respondida"])),
        contar(sb, "unidades", (q) => {
            let query = q.is("deleted_at", null).eq("status", "ativo");
            if (!isMaster && unidadeRestritaId) {
                query = query.eq("id", unidadeRestritaId);
            }
            return query;
        }),
    ]);
    const usuario = {
        nome: typeof perfil?.nome_completo === "string" ? perfil.nome_completo : null,
        perfil: typeof perfil?.perfil_nome === "string" ? perfil.perfil_nome : null,
        master: perfil?.is_master === true,
    };
    const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Belem" });
    const listaPistas = pistas(pistasCliente);
    const linhas = [
        `Data e hora atual: ${agora} (horário de Belém).`,
        usuario.nome ? `Usuário logado: ${usuario.nome}` : null,
        usuario.perfil ? `Perfil de acesso: ${usuario.perfil}${usuario.master ? " (MASTER)" : ""}` : null,
        competencia
            ? `Competência ativa no sistema: ${competencia.label} (status ${competencia.status}).`
            : "Nenhuma competência aberta no momento.",
        profissionais !== null ? `Profissionais ativos no cadastro: ${profissionais}.` : null,
        unidades !== null ? `Unidades ativas: ${unidades}.` : null,
        pendencias !== null ? `Pendências em aberto visíveis para este usuário: ${pendencias}.` : null,
        listaPistas.length ? listaPistas.join("\n") : null,
        !isMaster && unidadeRestritaId ? `RESTRIÇÃO DE DADOS: Suas análises e estatísticas estão limitadas à Unidade ID: ${unidadeRestritaId}.` : null,
        "Os números acima já respeitam as permissões deste usuário (RLS). Se ele perguntar algo fora do que enxerga, explique a restrição em vez de estimar.",
    ].filter(Boolean);
    return {
        usuario,
        competencia,
        indicadores: {
            profissionais_ativos: profissionais,
            pendencias_abertas: pendencias,
            unidades_ativas: unidades,
        },
        pistas_tela: listaPistas,
        texto: linhas.join("\n"),
    };
}
