/**
 * HSM Expert — Fase 4: Cache Inteligente de resultados de ferramentas.
 *
 * REGRAS DE SEGURANÇA
 * - O cache é SEMPRE particionado por `userId`. Nunca há reaproveitamento de
 *   resultado entre usuários, portanto o RLS continua sendo respeitado: cada
 *   entrada guarda apenas o que aquele usuário já podia ver.
 * - Somente ferramentas de LEITURA são cacheadas. Mutações nunca entram no
 *   cache e, ao serem confirmadas, invalidam as entradas do usuário.
 * - O cache vive na memória do runtime (por isolate) e expira por TTL, logo
 *   nenhum dado sensível é persistido em disco ou banco.
 */
const MAX_ENTRADAS = 300;
const armazem = new Map();
const metricas = { acertos: 0, faltas: 0, gravacoes: 0, invalidacoes: 0 };
/** Hash estável e curto (FNV-1a) — evita chaves gigantes na memória. */
function hash(texto) {
    let h = 0x811c9dc5;
    for (let i = 0; i < texto.length; i++) {
        h ^= texto.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(36);
}
/** Ordena chaves de objetos para que {a,b} e {b,a} gerem a mesma chave. */
function estavel(valor) {
    if (Array.isArray(valor))
        return valor.map(estavel);
    if (valor && typeof valor === "object") {
        return Object.keys(valor)
            .sort()
            .reduce((acc, k) => {
            const v = valor[k];
            if (v !== undefined && v !== null && v !== "")
                acc[k] = estavel(v);
            return acc;
        }, {});
    }
    return valor;
}
/**
 * Chave complexa: usuário + ferramenta + argumentos normalizados + contexto
 * relevante (competência/unidade), pois a mesma pergunta em competências
 * diferentes é uma consulta diferente.
 */
export function chaveCache(p) {
    const base = JSON.stringify({
        f: p.ferramenta,
        a: estavel(p.argumentos ?? {}),
        c: p.contexto?.competencia ?? null,
        u: p.contexto?.unidade ?? null,
    });
    return `${p.userId}:${p.ferramenta}:${hash(base)}`;
}
function limpar(agora) {
    for (const [k, e] of armazem)
        if (e.expiraEm <= agora)
            armazem.delete(k);
    while (armazem.size > MAX_ENTRADAS) {
        const primeira = armazem.keys().next().value;
        if (!primeira)
            break;
        armazem.delete(primeira);
    }
}
export function lerCache(chave) {
    const agora = Date.now();
    const e = armazem.get(chave);
    if (!e) {
        metricas.faltas++;
        return null;
    }
    if (e.expiraEm <= agora) {
        armazem.delete(chave);
        metricas.faltas++;
        return null;
    }
    e.acertos++;
    metricas.acertos++;
    // Renova posição (LRU simples).
    armazem.delete(chave);
    armazem.set(chave, e);
    return e;
}
export function gravarCache(p) {
    const agora = Date.now();
    limpar(agora);
    armazem.set(p.chave, {
        chave: p.chave,
        userId: p.userId,
        ferramenta: p.ferramenta,
        resumo: p.resumo,
        dados: p.dados,
        criadoEm: agora,
        expiraEm: agora + Math.max(30, p.ttlSegundos) * 1000,
        acertos: 0,
    });
    metricas.gravacoes++;
}
/**
 * Invalidação: após qualquer mutação confirmada, os dados daquele usuário
 * podem ter mudado. Removemos todas as entradas dele (opcionalmente apenas as
 * do módulo afetado, quando informado).
 */
export function invalidarCache(userId, prefixoFerramenta) {
    let n = 0;
    for (const [k, e] of armazem) {
        if (e.userId !== userId)
            continue;
        if (prefixoFerramenta && !e.ferramenta.toLowerCase().includes(prefixoFerramenta.toLowerCase()))
            continue;
        armazem.delete(k);
        n++;
    }
    metricas.invalidacoes += n;
    return n;
}
export function estatisticasCache() {
    const total = metricas.acertos + metricas.faltas;
    return {
        entradas: armazem.size,
        ...metricas,
        taxa_acerto: total === 0 ? 0 : Math.round((metricas.acertos / total) * 100),
    };
}
