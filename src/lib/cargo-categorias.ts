/**
 * Camada de consolidação de cargos (De-Para) — NÃO DESTRUTIVA.
 *
 * O cargo cadastrado de cada profissional continua intacto no banco; aqui
 * apenas mapeamos as variações de escrita para uma categoria consolidada,
 * usada nas telas gerenciais (Geral Cargos) e nas exportações.
 *
 * Módulo puro: nenhuma consulta, nenhum side-effect.
 */

export type GrupoCategoria = "geral" | "medico";

export type CategoriaCargo = {
  slug: string;
  nome: string;
  grupo: GrupoCategoria;
  /** Cargos cadastrados que caem nesta categoria (qualquer grafia). */
  cargos: string[];
  /** Programa Mais Médicos (marcação informativa na seção médica). */
  is_pmm?: boolean;
};

/** Normaliza o nome do cargo: sem acento, sem pontuação, maiúsculo. */
export function normalizarCargo(nome: string | null | undefined): string {
  return (nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export const CATEGORIAS: CategoriaCargo[] = [
  {
    slug: "tecnico-enfermagem",
    nome: "Técnico em Enfermagem",
    grupo: "geral",
    cargos: ["TEC. EM ENFERMAGEM", "Técnica de Enfermagem", "Técnico de Enfermagem"],
  },
  {
    slug: "auxiliar-enfermagem",
    nome: "Auxiliar de Enfermagem",
    grupo: "geral",
    cargos: ["AUX. DE ENFERMAGEM"],
  },
  {
    slug: "enfermeiro",
    nome: "Enfermeiro(a)",
    grupo: "geral",
    cargos: ["ENFERMEIRO(A)", "Enfermeira", "Enfermeiro"],
  },
  {
    slug: "servicos-gerais",
    nome: "Auxiliar de Serviços Gerais / Faxineiros",
    grupo: "geral",
    cargos: [
      "AUX. SERV.GERAIS(I)",
      "Auxiliar de Serviços Gerais",
      "Ajudante Geral",
      "AGENTE DE ZELADORIA",
      "ZELADOR",
    ],
  },
  {
    slug: "administrativo",
    nome: "Administrativo (recepção/digitação)",
    grupo: "geral",
    cargos: [
      "Assistente Administrativo",
      "ASSIST. AADM (I)",
      "AUXILIAR ADM (VII)",
      "AGENTE ADM (VII)",
    ],
  },
  {
    slug: "coordenadores",
    nome: "Coordenadores",
    grupo: "geral",
    cargos: ["COORDENADOR (A)", "COORDENADOR DE UBS", "COORDENADOR DE PROGRAMAS E PROJETOS"],
  },
  {
    slug: "chefias-divisao",
    nome: "Chefias de Divisão",
    grupo: "geral",
    cargos: ["CHEFE DE DIVISAO"],
  },
  { slug: "diretores", nome: "Diretores", grupo: "geral", cargos: ["DIRETOR (A)"] },
  {
    slug: "motoristas",
    nome: "Motoristas",
    grupo: "geral",
    cargos: [
      "Motorista",
      "MOTORISTA VEICULOS LEVES",
      "MOTORISTA VEICULOS PESADOS",
      "MOTORISTA II (VII)",
    ],
  },
  {
    slug: "cozinheiros",
    nome: "Cozinheiros",
    grupo: "geral",
    cargos: ["Cozinheira", "Cozinheiro", "AGENTE DE ALIMENTACAO"],
  },
  {
    slug: "radiologia",
    nome: "Técnicos de Radiologia",
    grupo: "geral",
    cargos: ["Técnica em Radiologia", "Técnico em Radiologia"],
  },
  {
    slug: "auxiliar-odontologia",
    nome: "Auxiliar de Odontologia",
    grupo: "geral",
    cargos: ["AUXILIAR ODONTOLOGIA", "Auxiliar de Saúde Bucal"],
  },
  {
    slug: "biomedico-bioquimico",
    nome: "Biomédico/Bioquímico",
    grupo: "geral",
    cargos: ["BIOMEDICO", "BIOQUIMICO"],
  },
  {
    slug: "psicologos",
    nome: "Psicólogos",
    grupo: "geral",
    cargos: ["PSICOLOGO(A)", "Psicóloga"],
  },
  {
    slug: "farmaceuticos",
    nome: "Farmacêuticos",
    grupo: "geral",
    cargos: ["Farmacêutica", "Farmacêutico", "FARMACEUTICO(A)"],
  },
  {
    slug: "vigilancia",
    nome: "Vigilância",
    grupo: "geral",
    cargos: ["TECNICO VIG. SANITARIA", "FISCAL DE VIGILANCIA SANITARIA"],
  },
  {
    slug: "endemias",
    nome: "Endemias / Controle de Vetores",
    grupo: "geral",
    cargos: ["Agente de Endemias", "BORRIFADOR"],
  },
  {
    slug: "assessoria-juridica",
    nome: "Assessoria Jurídica",
    grupo: "geral",
    cargos: ["ASSESSOR(A)JURIDICO (A)"],
  },
  {
    slug: "assessoria-administrativa",
    nome: "Assessoria Administrativa",
    grupo: "geral",
    cargos: [
      "ASSES.ESP. SET. DAS",
      "ASSES ESP. SET. DAS",
      "ASSES.ESP.SET.DAS",
      "ASSES.ESP.SET.DAS 01",
    ],
  },

  /* ----------------------------- seção médica ----------------------------- */
  {
    slug: "medico-clinico",
    nome: "Clínico Geral",
    grupo: "medico",
    cargos: ["MEDICO CLINICO GERAL", "CLINICO GERAL", "CLINICO GERAL/ PLANTONISTA"],
  },
  { slug: "medico-pediatra", nome: "Pediatra", grupo: "medico", cargos: ["MEDICO PEDIATRA"] },
  {
    slug: "medico-ginecologista",
    nome: "Ginecologista / Obstetra",
    grupo: "medico",
    cargos: ["GINECOLOGISTA", "GINECOLOGISTA OBSTETRA"],
  },
  { slug: "medico-ortopedista", nome: "Ortopedista", grupo: "medico", cargos: ["ORTOPEDISTA"] },
  { slug: "medico-anestesista", nome: "Anestesista", grupo: "medico", cargos: ["ANESTESISTA"] },
  { slug: "medico-psiquiatra", nome: "Psiquiatra", grupo: "medico", cargos: ["PSIQUIATRA"] },
  {
    slug: "medico-cardiologista",
    nome: "Cardiologista",
    grupo: "medico",
    cargos: ["MEDICO CARDIOLOGISTA"],
  },
  { slug: "medico-urologista", nome: "Urologista", grupo: "medico", cargos: ["MEDICO UROLOGISTA"] },
  {
    slug: "medico-cirurgiao",
    nome: "Cirurgião Geral",
    grupo: "medico",
    cargos: ["MEDICO CIRURGIÃO GERAL"],
  },
  {
    slug: "medico-neurologista",
    nome: "Neurologista",
    grupo: "medico",
    cargos: ["MEDICO ESPECIALISTA NEUROLOGIA"],
  },
  {
    slug: "medico-ultrassonografista",
    nome: "Ultrassonografista",
    grupo: "medico",
    cargos: ["MÉDICO ULTRASSONOGRAFISTA"],
  },
  { slug: "medico-auditor", nome: "Médico Auditor", grupo: "medico", cargos: ["MEDICO AUDITOR"] },
];

/** Índice normalizado cargo → categoria. */
const INDICE = new Map<string, CategoriaCargo>();
for (const cat of CATEGORIAS) {
  for (const cargo of cat.cargos) INDICE.set(normalizarCargo(cargo), cat);
}

/**
 * Categoria consolidada de um cargo cadastrado. Cargos isolados (sem De-Para)
 * viram uma categoria própria com o próprio nome, no grupo geral.
 */
export function categoriaDoCargo(nomeCargo: string | null | undefined): CategoriaCargo {
  const chave = normalizarCargo(nomeCargo);
  const achada = INDICE.get(chave);
  if (achada) return achada;
  const nome = (nomeCargo ?? "").trim() || "Sem cargo";
  return { slug: `isolado:${chave || "sem-cargo"}`, nome, grupo: "geral", cargos: [nome] };
}

/** Verdadeiro quando o cargo pertence à seção médica. */
export function ehCargoMedico(nomeCargo: string | null | undefined): boolean {
  return categoriaDoCargo(nomeCargo).grupo === "medico";
}

/** De-Para em formato de tabela, para a tela de manutenção/conferência. */
export function listarDePara(): Array<{
  categoria: string;
  grupo: GrupoCategoria;
  cargo: string;
}> {
  return CATEGORIAS.flatMap((c) =>
    c.cargos.map((cargo) => ({ categoria: c.nome, grupo: c.grupo, cargo })),
  );
}
