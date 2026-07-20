/**
 * Catálogo declarativo de blocos do Gerador Corporativo.
 * Cada bloco produz suas linhas a partir do agregado `useGerencial`
 * (sem novas queries) e do fetch opcional de profissionais.
 * Adicionar bloco = adicionar item aqui, sem tocar no wizard.
 */
import type { BlockDef, Row } from "./tipos";

const num = (n: number | null | undefined): number => (typeof n === "number" ? n : 0);

/** Utilitário: transforma {nome, qtd} em linhas do bloco. */
function fromNameCount(itens: { nome: string; qtd?: number; valor?: number }[]): Row[] {
  const total = itens.reduce((s, i) => s + num(i.qtd ?? i.valor), 0);
  return itens.map((i) => {
    const q = num(i.qtd ?? i.valor);
    return {
      nome: i.nome,
      quantidade: q,
      percentual: total ? Math.round((q / total) * 1000) / 10 : 0,
    };
  });
}

const distField = [
  { id: "nome", label: "Descrição", default: true, groupable: true },
  { id: "quantidade", label: "Quantidade", default: true, tipo: "number" as const },
  { id: "percentual", label: "% do total", default: true, tipo: "number" as const },
];

/** Bloco de "sem X" — cria uma linha por indicador. */
function pendRow(rotulo: string, qtd: number, total: number): Row {
  return {
    indicador: rotulo,
    quantidade: qtd,
    "percentual": total ? Math.round((qtd / total) * 1000) / 10 : 0,
  };
}

export const CATALOG: BlockDef[] = [
  /* ===== Executivo ===== */
  {
    id: "resumo_executivo",
    label: "Resumo Executivo",
    categoria: "Executivo",
    descricao: "Frases automáticas geradas a partir dos dados reais.",
    fields: [{ id: "frase", label: "Parecer", default: true }],
    build: ({ aggregate }) => aggregate.resumoExecutivo.map((f) => ({ frase: f })),
  },
  {
    id: "indicadores_gerais",
    label: "Indicadores Gerais",
    categoria: "Executivo",
    fields: [
      { id: "indicador", label: "Indicador", default: true },
      { id: "valor", label: "Valor", default: true, tipo: "number" },
    ],
    build: ({ aggregate: a }) => [
      { indicador: "Total de Profissionais", valor: a.totais.profissionais },
      { indicador: "Ativos", valor: a.status["ativo"] ?? 0 },
      { indicador: "Afastados", valor: a.status["afastado"] ?? 0 },
      { indicador: "Férias", valor: a.status["ferias"] ?? 0 },
      { indicador: "Licenciados", valor: a.status["licenciado"] ?? 0 },
      { indicador: "Inativos", valor: (a.status["inativo"] ?? 0) + (a.status["desligado"] ?? 0) },
      { indicador: "Unidades", valor: a.totais.unidades },
      { indicador: "Unidades Ativas", valor: a.totais.unidadesAtivas },
      { indicador: "Setores", valor: a.totais.setores },
      { indicador: "Cargos cadastrados", valor: a.totais.cargos },
      { indicador: "Funções cadastradas", valor: a.totais.funcoes },
      { indicador: "Vínculos", valor: a.totais.vinculos },
      { indicador: "Integridade Cadastral (%)", valor: a.qualidade.integridadeCadastral },
      { indicador: "Cobertura de Responsáveis (%)", valor: a.qualidade.coberturaResponsaveis },
      { indicador: "Índice Geral de Qualidade (%)", valor: a.qualidade.geral },
    ],
    graficos: ["barra"],
  },

  /* ===== Distribuições ===== */
  { id: "indicadores_unidade", label: "Indicadores por Unidade", categoria: "Distribuição", fields: distField, graficos: ["barra", "pizza"],
    build: ({ aggregate: a }) => fromNameCount(a.distribuicoes.porUnidade) },
  { id: "indicadores_setor", label: "Indicadores por Setor", categoria: "Distribuição", fields: distField, graficos: ["barra"],
    build: ({ aggregate: a }) => fromNameCount(a.distribuicoes.porSetor) },
  { id: "indicadores_cargo", label: "Indicadores por Cargo", categoria: "Distribuição", fields: distField, graficos: ["barra", "pizza"],
    build: ({ aggregate: a }) => fromNameCount(a.distribuicoes.porCargo) },
  { id: "indicadores_funcao", label: "Indicadores por Função", categoria: "Distribuição", fields: distField,
    build: ({ aggregate: a }) => fromNameCount(a.distribuicoes.porFuncao) },
  { id: "distribuicao_vinculo", label: "Distribuição por Vínculo", categoria: "Distribuição", fields: distField, graficos: ["pizza", "rosca"],
    build: ({ aggregate: a }) => fromNameCount(a.distribuicoes.porVinculo) },
  { id: "situacao_funcional", label: "Situação Funcional", categoria: "Distribuição", fields: distField, graficos: ["pizza"],
    build: ({ aggregate: a }) => fromNameCount(a.distribuicoes.porStatus) },
  { id: "distribuicao_sexo", label: "Distribuição por Sexo", categoria: "Distribuição", fields: distField, graficos: ["pizza"],
    build: ({ aggregate: a }) => fromNameCount(a.distribuicoes.porSexo) },
  { id: "distribuicao_faixa_etaria", label: "Distribuição por Faixa Etária", categoria: "Distribuição", fields: distField, graficos: ["barra"],
    build: ({ aggregate: a }) => fromNameCount(a.distribuicoes.porFaixaEtaria) },
  { id: "distribuicao_tempo_servico", label: "Distribuição por Tempo de Serviço", categoria: "Distribuição", fields: distField, graficos: ["barra"],
    build: ({ aggregate: a }) => fromNameCount(a.distribuicoes.porTempoServico) },
  { id: "distribuicao_tipo_unidade", label: "Distribuição por Tipo de Unidade", categoria: "Distribuição", fields: distField,
    build: ({ aggregate: a }) => fromNameCount(a.distribuicoes.porTipoUnidade) },
  { id: "distribuicao_porte", label: "Distribuição por Porte de Unidade", categoria: "Distribuição", fields: distField,
    build: ({ aggregate: a }) => fromNameCount(a.distribuicoes.porPorte) },

  /* ===== Cadastro Geral ===== */
  {
    id: "cadastro_profissionais",
    label: "Cadastro Geral de Profissionais",
    categoria: "Cadastros",
    descricao: "Lista completa (respeita filtros da Etapa 3).",
    fields: [
      { id: "nome_completo", label: "Nome", default: true, groupable: true },
      { id: "cpf", label: "CPF", default: true },
      { id: "matricula", label: "Matrícula", default: true },
      { id: "cargo", label: "Cargo", default: true, groupable: true },
      { id: "funcao", label: "Função", groupable: true },
      { id: "unidade", label: "Unidade", default: true, groupable: true },
      { id: "setor", label: "Setor", default: true, groupable: true },
      { id: "vinculo", label: "Vínculo", default: true, groupable: true },
      { id: "status", label: "Situação", default: true, groupable: true },
      { id: "sexo", label: "Sexo" },
      { id: "data_nascimento", label: "Nascimento" },
      { id: "data_admissao", label: "Admissão" },
      { id: "telefone", label: "Telefone" },
      { id: "email", label: "E-mail" },
      { id: "carga_horaria_semanal", label: "CH Semanal", tipo: "number" },
    ],
    build: ({ profissionais }) => profissionais ?? [],
  },

  /* ===== Pendências Cadastrais ===== */
  {
    id: "profissionais_sem_dados",
    label: "Profissionais com Cadastro Incompleto",
    categoria: "Pendências",
    descricao: "Sem Unidade, Setor, Cargo, Função, Matrícula, CPF, Telefone, E-mail, Nascimento, CH.",
    fields: [
      { id: "indicador", label: "Campo faltante", default: true },
      { id: "quantidade", label: "Quantidade", default: true, tipo: "number" },
      { id: "percentual", label: "% do total", default: true, tipo: "number" },
    ],
    build: ({ aggregate: a }) => {
      const t = a.totais.profissionais;
      const p = a.pendencias;
      return [
        pendRow("Sem Unidade", p.semUnidade, t),
        pendRow("Sem Setor", p.semSetor, t),
        pendRow("Sem Cargo", p.semCargo, t),
        pendRow("Sem Função", p.semFuncao, t),
        pendRow("Sem Matrícula", p.semMatricula, t),
        pendRow("Sem CPF", p.semCpf, t),
        pendRow("Sem Telefone", p.semTelefone, t),
        pendRow("Sem E-mail", p.semEmail, t),
        pendRow("Sem Data de Nascimento", p.semNascimento, t),
        pendRow("Sem Carga Horária", p.semCargaHoraria, t),
      ];
    },
    graficos: ["barra"],
  },
  {
    id: "unidades_pendencias",
    label: "Pendências de Unidades",
    categoria: "Pendências",
    fields: [
      { id: "indicador", label: "Item", default: true },
      { id: "quantidade", label: "Quantidade", default: true, tipo: "number" },
    ],
    build: ({ aggregate: a }) => {
      const u = a.unidadesPend;
      return [
        { indicador: "Sem Diretor", quantidade: u.semDiretor },
        { indicador: "Sem CNES", quantidade: u.semCnes },
        { indicador: "Sem CNPJ", quantidade: u.semCnpj },
        { indicador: "Sem Telefone", quantidade: u.semTelefone },
        { indicador: "Sem E-mail", quantidade: u.semEmail },
        { indicador: "Sem Tipo", quantidade: u.semTipo },
        { indicador: "Sem Profissionais", quantidade: u.semProfissionais },
      ];
    },
  },
  {
    id: "setores_pendencias",
    label: "Pendências de Setores",
    categoria: "Pendências",
    fields: [
      { id: "indicador", label: "Item", default: true },
      { id: "quantidade", label: "Quantidade", default: true, tipo: "number" },
    ],
    build: ({ aggregate: a }) => {
      const s = a.setoresPend;
      return [
        { indicador: "Sem Coordenador", quantidade: s.semCoordenador },
        { indicador: "Sem Profissionais", quantidade: s.semProfissionais },
        { indicador: "Apenas 1 profissional", quantidade: s.umServidor },
      ];
    },
  },

  /* ===== Rankings ===== */
  { id: "ranking_unidades_maiores", label: "Ranking · Maiores Unidades", categoria: "Rankings",
    fields: [{ id: "nome", label: "Unidade", default: true }, { id: "quantidade", label: "Profissionais", default: true, tipo: "number" }],
    build: ({ aggregate: a }) => a.rankings.maioresUnidades.map((r) => ({ nome: r.nome, quantidade: r.valor })), graficos: ["barra"] },
  { id: "ranking_unidades_menores", label: "Ranking · Menores Unidades", categoria: "Rankings",
    fields: [{ id: "nome", label: "Unidade", default: true }, { id: "quantidade", label: "Profissionais", default: true, tipo: "number" }],
    build: ({ aggregate: a }) => a.rankings.menoresUnidades.map((r) => ({ nome: r.nome, quantidade: r.valor })) },
  { id: "ranking_setores_maiores", label: "Ranking · Maiores Setores", categoria: "Rankings",
    fields: [{ id: "nome", label: "Setor", default: true }, { id: "quantidade", label: "Profissionais", default: true, tipo: "number" }],
    build: ({ aggregate: a }) => a.rankings.maioresSetores.map((r) => ({ nome: r.nome, quantidade: r.valor })) },
  { id: "ranking_cargos", label: "Ranking · Cargos mais utilizados", categoria: "Rankings",
    fields: [{ id: "nome", label: "Cargo", default: true }, { id: "quantidade", label: "Profissionais", default: true, tipo: "number" }],
    build: ({ aggregate: a }) => a.rankings.cargosMaisUtilizados.map((r) => ({ nome: r.nome, quantidade: r.valor })) },
  { id: "ranking_funcoes", label: "Ranking · Funções mais utilizadas", categoria: "Rankings",
    fields: [{ id: "nome", label: "Função", default: true }, { id: "quantidade", label: "Profissionais", default: true, tipo: "number" }],
    build: ({ aggregate: a }) => a.rankings.funcoesMaisUtilizadas.map((r) => ({ nome: r.nome, quantidade: r.valor })) },

  /* ===== Qualidade ===== */
  {
    id: "integridade_cadastral",
    label: "Integridade Cadastral",
    categoria: "Qualidade",
    fields: [
      { id: "rotulo", label: "Métrica", default: true },
      { id: "ok", label: "Preenchidos", default: true, tipo: "number" },
      { id: "total", label: "Total", default: true, tipo: "number" },
      { id: "percentual", label: "%", default: true, tipo: "number" },
    ],
    build: ({ aggregate: a }) => a.qualidade.metricas.map((m) => ({
      rotulo: m.rotulo, ok: m.ok, total: m.total, percentual: m.percentual,
    })),
    graficos: ["barra"],
  },

  /* ===== Auditoria ===== */
  { id: "auditoria_operacao", label: "Auditoria · por Operação (30 dias)", categoria: "Auditoria",
    fields: [{ id: "nome", label: "Operação", default: true }, { id: "qtd", label: "Eventos", default: true, tipo: "number" }],
    build: ({ aggregate: a }) => a.auditoria.porOperacao.map((r) => ({ nome: r.nome, qtd: r.qtd })), graficos: ["pizza"] },
  { id: "auditoria_tabela", label: "Auditoria · por Tabela (30 dias)", categoria: "Auditoria",
    fields: [{ id: "nome", label: "Tabela", default: true }, { id: "qtd", label: "Eventos", default: true, tipo: "number" }],
    build: ({ aggregate: a }) => a.auditoria.porTabela.map((r) => ({ nome: r.nome, qtd: r.qtd })) },
  { id: "auditoria_usuario", label: "Auditoria · por Usuário (30 dias)", categoria: "Auditoria",
    fields: [{ id: "nome", label: "Usuário", default: true }, { id: "qtd", label: "Eventos", default: true, tipo: "number" }],
    build: ({ aggregate: a }) => a.auditoria.porUsuario.map((r) => ({ nome: r.nome, qtd: r.qtd })) },
  { id: "auditoria_dia", label: "Auditoria · por Dia", categoria: "Auditoria",
    fields: [{ id: "dia", label: "Dia", default: true }, { id: "qtd", label: "Eventos", default: true, tipo: "number" }],
    build: ({ aggregate: a }) => a.auditoria.porDia.map((r) => ({ dia: r.dia, qtd: r.qtd })), graficos: ["linha", "area"] },
];

export function findBlock(id: string): BlockDef | undefined {
  return CATALOG.find((b) => b.id === id);
}

export function defaultFields(b: BlockDef): string[] {
  const d = b.fields.filter((f) => f.default).map((f) => f.id);
  return d.length ? d : b.fields.map((f) => f.id);
}

/** Presets por tipo de relatório. */
export const PRESETS: Record<string, string[]> = {
  executivo: [
    "resumo_executivo", "indicadores_gerais", "situacao_funcional",
    "indicadores_unidade", "ranking_cargos", "profissionais_sem_dados",
    "integridade_cadastral", "auditoria_operacao",
  ],
  tecnico: [
    "indicadores_gerais", "cadastro_profissionais", "indicadores_unidade",
    "indicadores_setor", "indicadores_cargo", "indicadores_funcao",
    "distribuicao_vinculo", "distribuicao_faixa_etaria",
    "distribuicao_tempo_servico", "integridade_cadastral",
  ],
  administrativo: [
    "indicadores_gerais", "unidades_pendencias", "setores_pendencias",
    "profissionais_sem_dados", "auditoria_tabela",
  ],
  rh: [
    "cadastro_profissionais", "situacao_funcional", "distribuicao_vinculo",
    "indicadores_cargo", "indicadores_funcao", "distribuicao_faixa_etaria",
    "distribuicao_tempo_servico",
  ],
  auditoria: [
    "auditoria_operacao", "auditoria_tabela", "auditoria_usuario", "auditoria_dia",
  ],
  personalizado: [],
};
