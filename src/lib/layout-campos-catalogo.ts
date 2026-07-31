// =============================================================================
// CATÁLOGO ÚNICO DE CAMPOS INTERNOS DO MOTOR DE LAYOUTS
//
// Fonte única de verdade dos campos internos disponíveis para mapeamento nos
// Layouts de Importação. É apenas um catálogo de sugestão/UI: o motor
// (layout-engine.ts) continua trabalhando com strings livres, portanto layouts
// já cadastrados permanecem 100% válidos mesmo com campos fora desta lista.
//
// Regras:
//  - NUNCA remover chaves existentes (quebraria layouts salvos).
//  - Adicionar novos campos apenas acrescentando entradas aqui.
// =============================================================================

import type { TipoDado } from "./layout-engine";

export type GrupoCampo =
  | "Identificação"
  | "Dados Funcionais"
  | "Remuneração"
  | "Totais"
  | "Descontos"
  | "Bancários"
  | "Controle";

export type CampoCatalogo = {
  /** Chave gravada em import_layout_campos.campo_interno. */
  key: string;
  label: string;
  grupo: GrupoCampo;
  tipo_dado: TipoDado;
  /** Sinônimos padrão usados no mapeamento automático. */
  aliases: string[];
};

export const CATALOGO_CAMPOS: CampoCatalogo[] = [
  // ------------------------------------------------------------------ Identificação
  {
    key: "matricula",
    label: "Matrícula",
    grupo: "Identificação",
    tipo_dado: "texto",
    aliases: ["matricula", "matrícula", "mat", "matr", "registro", "chapa", "n matricula"],
  },
  {
    key: "cpf",
    label: "CPF",
    grupo: "Identificação",
    tipo_dado: "cpf",
    aliases: ["cpf", "c.p.f.", "c p f", "n cpf", "num cpf", "cpf do servidor", "cpf funcionario"],
  },
  {
    key: "nome",
    label: "Nome",
    grupo: "Identificação",
    tipo_dado: "texto",
    aliases: [
      "nome",
      "nome completo",
      "servidor",
      "funcionario",
      "funcionário",
      "colaborador",
      "prestador",
    ],
  },
  {
    key: "data_nascimento",
    label: "Data de Nascimento",
    grupo: "Identificação",
    tipo_dado: "data",
    aliases: ["data nascimento", "data de nascimento", "dt nascimento", "nascimento", "dt nasc"],
  },
  {
    key: "sexo",
    label: "Sexo",
    grupo: "Identificação",
    tipo_dado: "texto",
    aliases: ["sexo", "genero", "gênero"],
  },
  {
    key: "cns",
    label: "CNS",
    grupo: "Identificação",
    tipo_dado: "texto",
    aliases: ["cns", "cartao sus", "cartão sus", "cartao nacional de saude"],
  },
  {
    key: "cargo",
    label: "Cargo",
    grupo: "Identificação",
    tipo_dado: "texto",
    aliases: ["cargo", "descricao cargo", "cargo funcao"],
  },
  {
    key: "funcao",
    label: "Função",
    grupo: "Identificação",
    tipo_dado: "texto",
    aliases: ["funcao", "função", "funcao exercida", "atividade"],
  },
  {
    key: "vinculo",
    label: "Vínculo",
    grupo: "Identificação",
    tipo_dado: "texto",
    aliases: ["vinculo", "vínculo", "tipo vinculo", "regime", "natureza vinculo"],
  },
  {
    key: "situacao_funcional",
    label: "Situação Funcional",
    grupo: "Identificação",
    tipo_dado: "texto",
    aliases: ["situacao funcional", "situação funcional", "sit funcional"],
  },
  {
    key: "lotacao",
    label: "Lotação",
    grupo: "Identificação",
    tipo_dado: "texto",
    aliases: ["lotacao", "lotação", "local de trabalho", "local trabalho"],
  },
  {
    key: "unidade",
    label: "Unidade",
    grupo: "Identificação",
    tipo_dado: "texto",
    aliases: ["unidade", "estabelecimento", "unidade lotacao", "ubs"],
  },
  {
    key: "setor",
    label: "Setor",
    grupo: "Identificação",
    tipo_dado: "texto",
    aliases: ["setor", "departamento", "sub setor", "area", "área"],
  },
  {
    key: "secretaria",
    label: "Secretaria",
    grupo: "Identificação",
    tipo_dado: "texto",
    aliases: ["secretaria", "orgao", "órgão", "sms"],
  },
  {
    key: "competencia",
    label: "Competência",
    grupo: "Identificação",
    tipo_dado: "competencia",
    aliases: ["competencia", "competência", "referencia", "mes referencia", "mes ano", "periodo"],
  },
  {
    key: "codigo_servidor",
    label: "Código Servidor",
    grupo: "Identificação",
    tipo_dado: "texto",
    aliases: ["codigo servidor", "código servidor", "cod servidor", "id servidor", "codigo"],
  },

  // --------------------------------------------------------------- Dados Funcionais
  {
    key: "data_admissao",
    label: "Data Admissão",
    grupo: "Dados Funcionais",
    tipo_dado: "data",
    aliases: [
      "data admissao",
      "data admissão",
      "admissao",
      "admissão",
      "dt admissao",
      "data contratacao",
      "data contratação",
    ],
  },
  {
    key: "data_demissao",
    label: "Data Demissão",
    grupo: "Dados Funcionais",
    tipo_dado: "data",
    aliases: [
      "data demissao",
      "data demissão",
      "demissao",
      "dt demissao",
      "data desligamento",
      "rescisao",
    ],
  },
  {
    key: "dias_trabalhados",
    label: "Dias Trabalhados",
    grupo: "Dados Funcionais",
    tipo_dado: "numero",
    aliases: ["dias", "dias trabalhados", "qtde dias", "quantidade dias", "qtd dias", "n dias"],
  },
  {
    key: "horas_trabalhadas",
    label: "Horas Trabalhadas",
    grupo: "Dados Funcionais",
    tipo_dado: "numero",
    aliases: ["horas", "horas trabalhadas", "qtde horas", "total horas", "h trabalhadas"],
  },
  {
    key: "carga_horaria",
    label: "Carga Horária",
    grupo: "Dados Funcionais",
    tipo_dado: "numero",
    aliases: ["carga horaria", "carga horária", "ch", "ch semanal", "carga"],
  },
  {
    key: "jornada",
    label: "Jornada",
    grupo: "Dados Funcionais",
    tipo_dado: "texto",
    aliases: ["jornada", "escala", "turno", "regime horario"],
  },
  {
    key: "tempo_servico",
    label: "Tempo de Serviço",
    grupo: "Dados Funcionais",
    tipo_dado: "moeda",
    aliases: [
      "tempo de servico",
      "tempo de serv",
      "tempo servico",
      "anuenio",
      "trienio",
      "quinquenio",
      "ats",
    ],
  },

  // -------------------------------------------------------------------- Remuneração
  {
    key: "salario_base",
    label: "Salário Base",
    grupo: "Remuneração",
    tipo_dado: "moeda",
    aliases: [
      "salario base",
      "salário base",
      "vencimento",
      "salario",
      "base",
      "sal base",
      "venc base",
    ],
  },
  {
    key: "piso_nacional",
    label: "Piso Nacional",
    grupo: "Remuneração",
    tipo_dado: "moeda",
    aliases: ["piso nacional", "piso", "valor piso", "piso enfermagem"],
  },
  {
    key: "piso_complementacao",
    label: "Complemento Piso",
    grupo: "Remuneração",
    tipo_dado: "moeda",
    aliases: [
      "complemento piso",
      "complementacao piso",
      "compl piso",
      "complementacao",
      "compl salarial",
    ],
  },
  {
    key: "insalubridade",
    label: "Insalubridade",
    grupo: "Remuneração",
    tipo_dado: "moeda",
    aliases: ["insalubridade", "insalub", "adic insalubridade", "ad insalub"],
  },
  {
    key: "periculosidade",
    label: "Periculosidade",
    grupo: "Remuneração",
    tipo_dado: "moeda",
    aliases: ["periculosidade", "pericul", "adic periculosidade"],
  },
  {
    key: "gratificacao",
    label: "Gratificação",
    grupo: "Remuneração",
    tipo_dado: "moeda",
    aliases: ["gratificacao", "gratificação", "gratif", "grat", "grat fun", "gratificacao funcao"],
  },
  {
    key: "gratificacao_incentivo",
    label: "Gratificação Incentivo",
    grupo: "Remuneração",
    tipo_dado: "moeda",
    aliases: [
      "grat.incentivo",
      "grat incentivo",
      "gratificacao incentivo",
      "gratificação incentivo",
      "incentivo",
    ],
  },
  {
    key: "gratificacao_sus",
    label: "Gratificação SUS",
    grupo: "Remuneração",
    tipo_dado: "moeda",
    aliases: ["grat sus", "grat.sus", "gratificacao sus", "gratificação sus", "incentivo sus"],
  },
  {
    key: "adicional_noturno",
    label: "Adicional Noturno",
    grupo: "Remuneração",
    tipo_dado: "moeda",
    aliases: ["adicional noturno", "adic noturno", "ad noturno", "adn", "ad not"],
  },
  {
    key: "hora_extra_50",
    label: "Hora Extra 50%",
    grupo: "Remuneração",
    tipo_dado: "moeda",
    aliases: [
      "hora extra 50",
      "hora extra 50%",
      "he 50",
      "he 50%",
      "hr ex 50",
      "hr ex 50%",
      "h.e.",
    ],
  },
  {
    key: "hora_extra_100",
    label: "Hora Extra 100%",
    grupo: "Remuneração",
    tipo_dado: "moeda",
    aliases: ["hora extra 100", "hora extra 100%", "he 100", "he 100%", "hr ex 100", "hr ex 100%"],
  },
  {
    key: "plantao",
    label: "Plantão",
    grupo: "Remuneração",
    tipo_dado: "moeda",
    aliases: ["plantao", "plantão", "plantoes", "adic plantao"],
  },
  {
    key: "sobreaviso",
    label: "Sobreaviso",
    grupo: "Remuneração",
    tipo_dado: "moeda",
    aliases: ["sobreaviso", "sobreavisos", "sobre aviso"],
  },
  {
    key: "auxilio_transporte",
    label: "Auxílio Transporte",
    grupo: "Remuneração",
    tipo_dado: "moeda",
    aliases: ["aux transp", "auxilio transporte", "auxílio transporte", "vale transporte", "vt"],
  },
  {
    key: "vale_transporte",
    label: "Vale Transporte (legado)",
    grupo: "Remuneração",
    tipo_dado: "moeda",
    aliases: ["vale transp", "vale transporte"],
  },
  {
    key: "auxilio_alimentacao",
    label: "Auxílio Alimentação",
    grupo: "Remuneração",
    tipo_dado: "moeda",
    aliases: [
      "aux alimentacao",
      "auxilio alimentacao",
      "auxílio alimentação",
      "vale alimentacao",
      "va",
      "ticket",
    ],
  },
  {
    key: "auxilio_moradia",
    label: "Auxílio Moradia",
    grupo: "Remuneração",
    tipo_dado: "moeda",
    aliases: ["aux moradia", "auxilio moradia", "auxílio moradia", "moradia"],
  },
  {
    key: "auxilio_saude",
    label: "Auxílio Saúde",
    grupo: "Remuneração",
    tipo_dado: "moeda",
    aliases: ["aux saude", "auxilio saude", "auxílio saúde", "plano de saude"],
  },
  {
    key: "auxilio_financeiro",
    label: "Auxílio Financeiro",
    grupo: "Remuneração",
    tipo_dado: "moeda",
    aliases: ["aux financ", "auxilio financeiro", "aux fin", "ajuda de custo"],
  },
  {
    key: "ferias",
    label: "Férias",
    grupo: "Remuneração",
    tipo_dado: "moeda",
    aliases: ["ferias", "férias", "ferias normas"],
  },
  {
    key: "ferias_1_3",
    label: "1/3 Férias",
    grupo: "Remuneração",
    tipo_dado: "moeda",
    aliases: ["1 3 ferias", "terco ferias", "abono ferias", "1 3 constitucional"],
  },

  // ------------------------------------------------------------------------- Totais
  {
    key: "total_proventos",
    label: "Total Proventos",
    grupo: "Totais",
    tipo_dado: "moeda",
    aliases: [
      "total proventos",
      "total de proventos",
      "proventos",
      "tot prov",
      "total vantagens",
      "positivos",
    ],
  },
  {
    key: "total_descontos",
    label: "Total Descontos",
    grupo: "Totais",
    tipo_dado: "moeda",
    aliases: ["total descontos", "total desconto", "total de descontos", "descontos", "tot desc"],
  },
  {
    key: "valor_liquido",
    label: "Valor Líquido",
    grupo: "Totais",
    tipo_dado: "moeda",
    aliases: [
      "v.liquido",
      "v liquido",
      "v líquido",
      "valor liquido",
      "valor líquido",
      "liquido",
      "líquido",
      "salario liquido",
    ],
  },
  {
    key: "valor_bruto",
    label: "Valor Bruto",
    grupo: "Totais",
    tipo_dado: "moeda",
    aliases: ["valor bruto", "v bruto", "bruto", "total bruto"],
  },
  {
    key: "total_liquido_base",
    label: "Total Líquido Base",
    grupo: "Totais",
    tipo_dado: "moeda",
    aliases: ["total", "total liquido base", "total base"],
  },
  {
    key: "valor_final",
    label: "Valor Final",
    grupo: "Totais",
    tipo_dado: "moeda",
    aliases: ["valor final", "total geral", "total liquido"],
  },


  // ---------------------------------------------------------------------- Descontos
  {
    key: "inss",
    label: "INSS",
    grupo: "Descontos",
    tipo_dado: "moeda",
    aliases: ["inss", "desc inss", "desconto inss", "previdencia"],
  },
  {
    key: "irrf",
    label: "IRRF",
    grupo: "Descontos",
    tipo_dado: "moeda",
    aliases: ["irrf", "ir", "irpf", "imposto renda", "desc irrf"],
  },
  {
    key: "iss",
    label: "ISS",
    grupo: "Descontos",
    tipo_dado: "moeda",
    aliases: ["iss", "issqn", "imposto sobre servicos"],
  },
  {
    key: "pensao_alimenticia",
    label: "Pensão Alimentícia",
    grupo: "Descontos",
    tipo_dado: "moeda",
    aliases: ["pensao alimenticia", "pensão alimentícia", "pensao", "pensao alim"],
  },
  {
    key: "emprestimo_consignado",
    label: "Empréstimo Consignado",
    grupo: "Descontos",
    tipo_dado: "moeda",
    aliases: ["emprestimo consignado", "empréstimo consignado", "consignado", "emprestimo"],
  },
  {
    key: "sindicato",
    label: "Sindicato",
    grupo: "Descontos",
    tipo_dado: "moeda",
    aliases: ["sindicato", "contribuicao sindical", "mensalidade sindical"],
  },
  {
    key: "outros_descontos",
    label: "Outros Descontos",
    grupo: "Descontos",
    tipo_dado: "moeda",
    aliases: ["outros descontos", "outros desc", "demais descontos"],
  },

  // ---------------------------------------------------------------------- Bancários
  {
    key: "banco",
    label: "Banco",
    grupo: "Bancários",
    tipo_dado: "texto",
    aliases: ["banco", "cod banco", "código banco", "codigo banco"],
  },
  {
    key: "agencia",
    label: "Agência",
    grupo: "Bancários",
    tipo_dado: "texto",
    aliases: ["agencia", "agência", "ag"],
  },
  {
    key: "conta_bancaria",
    label: "Conta Bancária",
    grupo: "Bancários",
    tipo_dado: "texto",
    aliases: ["conta", "conta bancaria", "conta bancária", "c/c", "conta corrente"],
  },
  {
    key: "tipo_conta",
    label: "Tipo de Conta",
    grupo: "Bancários",
    tipo_dado: "texto",
    aliases: ["tipo conta", "tipo de conta", "tp conta"],
  },
  {
    key: "pix",
    label: "PIX",
    grupo: "Bancários",
    tipo_dado: "texto",
    aliases: ["pix", "chave pix"],
  },

  // ----------------------------------------------------------------------- Controle
  {
    key: "observacao",
    label: "Observação",
    grupo: "Controle",
    tipo_dado: "texto",
    aliases: ["observacao", "observação", "obs", "observacoes", "justificativa"],
  },
  {
    key: "situacao",
    label: "Situação",
    grupo: "Controle",
    tipo_dado: "texto",
    aliases: ["situacao", "situação", "sit"],
  },
  {
    key: "status",
    label: "Status",
    grupo: "Controle",
    tipo_dado: "texto",
    aliases: ["status", "estado"],
  },
  {
    key: "origem",
    label: "Origem",
    grupo: "Controle",
    tipo_dado: "texto",
    aliases: ["origem", "fonte", "procedencia"],
  },
];

export const GRUPOS_CAMPOS: GrupoCampo[] = [
  "Identificação",
  "Dados Funcionais",
  "Remuneração",
  "Totais",
  "Descontos",
  "Bancários",
  "Controle",
];

const POR_KEY = new Map(CATALOGO_CAMPOS.map((c) => [c.key, c]));

/** Campo do catálogo pela chave interna (null quando é um campo personalizado). */
export function campoCatalogo(key: string): CampoCatalogo | null {
  return POR_KEY.get(key) ?? null;
}

/** Rótulo amigável de um campo interno (retorna a própria chave se desconhecida). */
export function labelCampoInterno(key: string): string {
  return POR_KEY.get(key)?.label ?? key;
}

/** Campos agrupados para exibição em selects. */
export function camposPorGrupo(): { grupo: GrupoCampo; campos: CampoCatalogo[] }[] {
  return GRUPOS_CAMPOS.map((grupo) => ({
    grupo,
    campos: CATALOGO_CAMPOS.filter((c) => c.grupo === grupo),
  })).filter((g) => g.campos.length > 0);
}
