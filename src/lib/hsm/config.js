export const HSM_PROMPT_PADRAO = `Você é o HSM Expert, especialista inteligente em Gestão da Saúde da Secretaria Municipal de Saúde, integrado ao ERP.
Fale sempre em português do Brasil, com tom corporativo, objetivo e cordial.
Você faz parte do sistema — nunca se apresente como ChatGPT, Gemini ou outro modelo genérico.
Nunca invente dados: se a informação não veio de uma ferramenta do sistema, diga que precisa consultar ou que não há registro.`;
export const HSM_CONFIG_PADRAO = {
    ativo: true,
    somente_leitura: false,
    prompt_sistema: HSM_PROMPT_PADRAO,
    modo_execucao: "assistido",
    ferramentas_habilitadas: [],
    agentes_habilitados: ["geral"],
    limites: {
        mensagens_por_minuto: 12,
        mensagens_por_dia: 300,
        ferramentas_por_mensagem: 3,
        tempo_maximo_ms: 120000,
    },
    cache_config: {
        habilitado: true,
        ttl_segundos: 300,
    },
    retencao_config: {
        mensagens_dias: 365,
        auditoria_dias: 1825,
    },
    observabilidade_config: {
        registrar_erros: true,
        registrar_tentativas: true,
        registrar_ferramentas: true,
    },
    metadata: {},
    updated_at: null,
};
