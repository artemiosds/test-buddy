/**
 * HSM Expert — memoização curta em memória (por isolate).
 *
 * Objetivo: reduzir a latência percebida do assistente evitando repetir, a cada
 * mensagem, consultas que praticamente não mudam entre dois turnos da mesma
 * conversa (configuração, permissões, contexto institucional).
 *
 * SEGURANÇA: toda chave inclui o `userId` quando o valor depende do usuário —
 * nunca há reaproveitamento entre usuários, então o RLS continua respeitado.
 * Nada é persistido: o cache vive apenas na memória do runtime e expira por TTL.
 */
const armazem = new Map();
const MAX = 500;
export async function memo(chave, ttlMs, calcular) {
    const agora = Date.now();
    const atual = armazem.get(chave);
    if (atual && atual.expiraEm > agora)
        return atual.valor;
    const valor = await calcular();
    if (armazem.size > MAX) {
        for (const [k, e] of armazem)
            if (e.expiraEm <= agora)
                armazem.delete(k);
        while (armazem.size > MAX) {
            const primeira = armazem.keys().next().value;
            if (!primeira)
                break;
            armazem.delete(primeira);
        }
    }
    armazem.set(chave, { valor, expiraEm: agora + ttlMs });
    return valor;
}
/** Invalida entradas cujo prefixo casa (ex.: após salvar a configuração). */
export function limparMemo(prefixo) {
    if (!prefixo) {
        armazem.clear();
        return;
    }
    for (const k of [...armazem.keys()])
        if (k.startsWith(prefixo))
            armazem.delete(k);
}
