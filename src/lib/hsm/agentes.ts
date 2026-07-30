/**
 * HSM Expert — Fase 8: Agentes especializados como configuração.
 *
 * Um agente é apenas um RECORTE de comportamento: ele restringe as ferramentas
 * disponíveis (pelos slugs já declarados no Tool Registry) e acrescenta uma
 * instrução de foco ao prompt institucional. Nenhum agente amplia permissões:
 * o filtro por perfil (RLS + `ensurePermission`) continua acontecendo antes.
 */

export type HsmAgente = {
  slug: string;
  nome: string;
  descricao: string;
  /** Instrução adicional de foco anexada ao prompt institucional. */
  instrucao: string;
  /** Sugestões exibidas no chat quando o agente está selecionado. */
  sugestoes: string[];
};

export const HSM_AGENTES: HsmAgente[] = [
  {
    slug: "geral",
    nome: "Generalista",
    descricao: "Acesso a todas as ferramentas liberadas para o perfil do usuário.",
    instrucao: "Atue como assistente geral do ERP, cobrindo qualquer módulo disponível.",
    sugestoes: [
      "Quantos profissionais estão ativos?",
      "Mostre as pendências em aberto",
      "Qual unidade possui mais profissionais?",
    ],
  },
  {
    slug: "rh",
    nome: "Gestão de Pessoas",
    descricao: "Cadastro funcional, lotação, cargos, funções e situação dos profissionais.",
    instrucao:
      "Você é o agente de Gestão de Pessoas. Priorize dados funcionais: cadastro, cargo, função, vínculo, lotação e situação do profissional. Sempre destaque inconsistências cadastrais que encontrar.",
    sugestoes: [
      "Liste os profissionais de licença",
      "Distribua profissionais por cargo",
      "Quantos servidores efetivos existem?",
    ],
  },
  {
    slug: "frequencia",
    nome: "Frequência e Competências",
    descricao: "Envio, análise e aprovação das folhas de frequência por competência.",
    instrucao:
      "Você é o agente de Frequência. Foque em competências, prazos, status de envio e aprovação das folhas. Aponte unidades atrasadas.",
    sugestoes: [
      "Quais competências estão abertas?",
      "Mostre folhas em análise",
      "Quais unidades ainda não enviaram?",
    ],
  },
  {
    slug: "piso",
    nome: "Piso da Enfermagem",
    descricao: "Elegibilidade, consolidação e acompanhamento do Piso Nacional da Enfermagem.",
    instrucao:
      "Você é o agente do Piso Nacional da Enfermagem. Foque em elegíveis, categorias de enfermagem, competências e consolidação da folha. Nunca cite valores de referência que não tenham vindo de uma ferramenta.",
    sugestoes: [
      "Resumo do piso na competência atual",
      "Quantos elegíveis por unidade?",
      "Como está a consolidação do mês?",
    ],
  },
  {
    slug: "pendencias",
    nome: "Pendências e SLA",
    descricao: "Acompanhamento de pendências abertas, prazos e prioridades.",
    instrucao:
      "Você é o agente de Pendências. Priorize prazos, prioridade e SLA. Ordene sempre da mais crítica para a menos crítica.",
    sugestoes: [
      "Liste pendências críticas",
      "Quais pendências estão vencidas?",
      "Pendências abertas por unidade",
    ],
  },
  {
    slug: "unidades",
    nome: "Rede e Unidades",
    descricao: "Unidades de saúde, setores, CNES e estrutura da rede.",
    instrucao:
      "Você é o agente da Rede Assistencial. Foque em unidades, setores, CNES e estrutura organizacional.",
    sugestoes: ["Liste as unidades ativas", "Quais unidades têm CNES?", "Unidades por secretaria"],
  },
  {
    slug: "gestao",
    nome: "Painel Gerencial",
    descricao: "Indicadores consolidados e análises comparativas entre módulos.",
    instrucao:
      "Você é o agente Gerencial. Priorize números consolidados, comparações e tendências. Sempre apresente os dados em tabela e destaque o indicador mais relevante.",
    sugestoes: [
      "Panorama geral do mês",
      "Compare profissionais por unidade",
      "Principais indicadores de frequência",
    ],
  },
  {
    slug: "auditoria",
    nome: "Auditoria e Conformidade",
    descricao: "Trilha de auditoria, rastreabilidade e conformidade dos registros.",
    instrucao:
      "Você é o agente de Auditoria. Foque em rastreabilidade: quem fez, o quê e quando. Seja rigoroso e nunca especule sobre intenção.",
    sugestoes: [
      "Últimas alterações registradas",
      "Consulte a auditoria de hoje",
      "Quem alterou cadastros esta semana?",
    ],
  },
];

export function agentePorSlug(slug: string | null | undefined): HsmAgente {
  return HSM_AGENTES.find((a) => a.slug === slug) ?? HSM_AGENTES[0];
}

/** Agentes efetivamente disponíveis conforme a configuração administrativa. */
export function agentesDisponiveis(habilitados: string[]): HsmAgente[] {
  if (!habilitados || habilitados.length === 0) return HSM_AGENTES;
  const set = new Set(habilitados);
  set.add("geral");
  return HSM_AGENTES.filter((a) => set.has(a.slug));
}
