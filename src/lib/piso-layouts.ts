// Perfis de layout das folhas de pagamento do Piso Nacional da Enfermagem.
// Puro (sem I/O). Cada tipo de folha (Contratados / Efetivos) pode ter colunas,
// ordem e nomes diferentes — a arquitetura permite cadastrar novos layouts.

import {
  CAMPOS_CALCULADOS,
  contemAlias,
  normalize,
  suggestDestino,
  type PisoDestino,
} from "./piso-mapping";
import type { Mapeamento } from "./piso-import";

export type TipoFolha = "contratados" | "efetivos";

export type LayoutFolha = {
  tipo: TipoFolha;
  label: string;
  descricao: string;
  /** Modelo usado no histórico/mapeamentos salvos. */
  modelo: "Contratados" | "Efetivos";
  /** Origem da consolidação (piso = planilha de cálculo; fopag = folha bruta). */
  tipoPlanilha: "piso" | "fopag";
  /** Campos obrigatórios para a linha ser considerada válida. */
  obrigatorios: PisoDestino[];
  /** Aliases específicos do layout (já normalizados). */
  aliases: Partial<Record<PisoDestino, string[]>>;
  /** Pistas no nome do arquivo. */
  arquivoHints: RegExp[];
  /** Pistas nos cabeçalhos (normalizadas). */
  headerHints: string[];
};

/**
 * Mapeamento exato do modelo institucional "SAUDE - UBS'S" (cabeçalho na linha 6).
 * Chave = cabeçalho normalizado; valor = destino interno (null = ignorar).
 * Tem prioridade sobre aliases e heurísticas, garantindo 100% de compatibilidade.
 */
export const MAPA_EXATO_UBS: Record<string, PisoDestino | null> = {
  n: null,
  no: null,
  nome: "nome",
  "data admissao": "data_admissao",
  "c p f": "cpf",
  cpf: "cpf",
  lotacao: "unidade",
  cargo: "cargo",
  dias: "dias_trabalhados",
  base: "salario_base",
  insalubridade: "insalubridade",
  "h e": "hora_extra_50",
  "ad noturno": "adicional_noturno",
  bruto: "total_proventos",
  iss: "iss",
  total: "total_liquido_base",
  "grat incentivo": "gratificacao_incentivo",
  "aux transp": "auxilio_transporte",
  "v liquido": "valor_liquido",
  conta: "conta_bancaria",
};

export const LAYOUT_CONTRATADOS: LayoutFolha = {
  tipo: "contratados",
  label: "Contratados",
  descricao:
    "Folha de serviços prestados enviada pelo RH (layout com Nº, NOME, C.P.F., LOTAÇÃO, CARGO, BASE...).",
  modelo: "Contratados",
  tipoPlanilha: "fopag",
  obrigatorios: ["cpf", "nome"],
  aliases: {
    cpf: ["c p f", "cpf", "n cpf"],
    nome: ["nome", "nome do prestador", "prestador"],
    data_admissao: ["data admissao", "admissao"],
    unidade: ["lotacao", "unidade", "local"],
    cargo: ["cargo", "funcao"],
    dias_trabalhados: ["dias", "dias trabalhados"],
    salario_base: ["base", "valor base", "salario base"],
    insalubridade: ["insalubridade", "insalub"],
    hora_extra_50: ["h e", "he", "hora extra", "horas extras"],
    adicional_noturno: ["ad noturno", "adicional noturno", "adn"],
    plantao: ["plantai e sobreaviso", "plantao e sobreaviso", "plantao"],
    total_proventos: ["bruto", "total bruto", "total proventos"],
    iss: ["iss", "issqn"],
    total_liquido_base: ["total"],
    gratificacao_incentivo: ["grat incentivo", "gratificacao incentivo", "incentivo"],
    auxilio_transporte: ["aux transp", "auxilio transporte"],
    total_descontos: ["pensao alimenticia", "total descontos", "descontos"],
    valor_liquido: ["v liquido", "liquido", "valor liquido"],
    conta_bancaria: ["conta", "conta bancaria"],
  },
  arquivoHints: [/contrat/, /hmsds/, /h m s d s/, /prestad/, /ubs/, /saude/],
  headerHints: ["lotacao", "data admissao", "dias", "bruto", "liquido"],
};


export const LAYOUT_EFETIVOS: LayoutFolha = {
  tipo: "efetivos",
  label: "Efetivos",
  descricao:
    "Planilha de cálculo/FOPAG dos efetivos (layout com CPF, AUX. FINANC., TEMPO DE SERV., INSALUBRIDADE...).",
  modelo: "Efetivos",
  tipoPlanilha: "piso",
  obrigatorios: ["cpf"],
  aliases: {
    cpf: ["cpf", "c p f"],
    auxilio_financeiro: ["aux financ", "aux fin piso", "auxilio financeiro", "aux fin"],
    tempo_servico: ["tempo de serv", "tempo de servico", "tempo serv"],
    insalubridade: ["insalubridade", "insalub"],
    ferias_1_3: ["1 3 ferias"],
    ferias: ["ferias normas", "ferias"],
    hora_extra_50: ["hr ex 50%", "hr ex 50", "he 50%"],
    hora_extra_100: ["hr ex 100%", "hr ex 100", "he 100%"],
    plantao: ["plantao", "plantoes"],
    sobreaviso: ["sobreavisos", "sobreaviso"],
    vale_transporte: ["vale transp", "vale transporte", "vt"],
    gratificacao: [
      "grat fun vr",
      "grat fun %vb",
      "grat nivel sup",
      "gratificacao",
      "incentivos",
    ],
    adicional_noturno: ["adn", "ad noturno", "adicional noturno"],
    inss: ["inss"],
    irrf: ["irrf"],
    total_descontos: ["total desconto", "total descontos"],
    total_proventos: ["positivos", "total positivos", "total proventos"],
  },
  arquivoHints: [/efetiv/, /fopag/, /calculo piso/],
  headerHints: ["aux financ", "tempo de serv", "total desconto", "positivos"],
};

export const LAYOUTS: Record<TipoFolha, LayoutFolha> = {
  contratados: LAYOUT_CONTRATADOS,
  efetivos: LAYOUT_EFETIVOS,
};

/** Pontua um layout contra nome do arquivo + cabeçalhos. */
export function scoreLayout(
  layout: LayoutFolha,
  nomeArquivo: string,
  headers: string[],
): number {
  const nome = normalize(nomeArquivo);
  let score = 0;
  for (const re of layout.arquivoHints) if (re.test(nome)) score += 3;
  const hs = headers.map((h) => normalize(h));
  for (const hint of layout.headerHints) {
    if (hs.some((h) => h.includes(hint))) score += 2;
  }
  return score;
}

/** Identifica automaticamente se a folha é de Contratados ou Efetivos. */
export function detectarTipoFolha(
  nomeArquivo: string,
  headers: string[] = [],
): TipoFolha | null {
  const c = scoreLayout(LAYOUT_CONTRATADOS, nomeArquivo, headers);
  const e = scoreLayout(LAYOUT_EFETIVOS, nomeArquivo, headers);
  if (c === 0 && e === 0) return null;
  if (c === e) return null;
  return c > e ? "contratados" : "efetivos";
}

function matchAlias(norm: string, aliases: string[]): boolean {
  if (aliases.some((a) => a === norm)) return true;
  return aliases.some((a) => a.length >= 3 && contemAlias(norm, a));
}

/**
 * Mapeamento automático. Ordem de prioridade:
 *  1) mapa exato do modelo institucional (UBS) — garante 100% de compatibilidade;
 *  2) aliases do layout (exato, depois palavra completa);
 *  3) heurística global.
 * Campos recalculados não recebem auto-map, exceto quando vêm do mapa exato.
 */
export function autoMapLayout(
  headers: string[],
  layout: LayoutFolha,
): Mapeamento {
  const out: Mapeamento = {};
  const usados = new Set<PisoDestino>();
  const entradas = Object.entries(layout.aliases) as [PisoDestino, string[]][];

  for (const h of headers) {
    const norm = normalize(h);
    let dest: PisoDestino | null = null;
    let exato = false;

    if (norm) {
      // 1) mapa exato do modelo institucional
      if (Object.prototype.hasOwnProperty.call(MAPA_EXATO_UBS, norm)) {
        dest = MAPA_EXATO_UBS[norm];
        exato = true;
      }
      // 2) alias exato do layout
      if (!dest && !exato) {
        for (const [d, al] of entradas) {
          if (al.some((a) => a === norm)) {
            dest = d;
            break;
          }
        }
      }
      // 3) alias por palavra completa do layout
      if (!dest && !exato) {
        for (const [d, al] of entradas) {
          if (matchAlias(norm, al)) {
            dest = d;
            break;
          }
        }
      }
      // 4) heurística global
      if (!dest && !exato) dest = suggestDestino(h);
    }

    if (dest && !usados.has(dest) && (exato || !CAMPOS_CALCULADOS.has(dest))) {
      out[h] = dest;
      usados.add(dest);
    } else {
      out[h] = null;
    }
  }

  return out;
}
