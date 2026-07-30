// Perfis de layout das folhas de pagamento do Piso Nacional da Enfermagem.
// Puro (sem I/O). Cada tipo de folha (Contratados / Efetivos) pode ter colunas,
// ordem e nomes diferentes — a arquitetura permite cadastrar novos layouts.

import {
  CAMPOS_CALCULADOS,
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
    unidade: ["lotacao", "unidade", "local"],
    cargo: ["cargo", "funcao"],
    salario_base: ["base", "valor base", "salario base"],
    insalubridade: ["insalubridade", "insalub"],
    hora_extra_50: ["h e", "he", "hora extra", "horas extras"],
    adicional_noturno: ["ad noturno", "adicional noturno", "adn"],
    plantao: ["plantai e sobreaviso", "plantao e sobreaviso", "plantao"],
    total_proventos: ["bruto", "total bruto", "total proventos"],
    total_descontos: ["iss", "pensao alimenticia", "total descontos", "descontos"],
    valor_liquido: ["liquido", "valor liquido"],
  },
  arquivoHints: [/contrat/, /hmsds/, /h m s d s/, /prestad/],
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
  return aliases.some((a) => a.length >= 3 && norm.includes(a));
}

/**
 * Mapeamento automático usando primeiro os aliases do layout e, como fallback,
 * a heurística global. Nunca mapeia campos recalculados pelo sistema.
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
    if (norm) {
      // 1) alias exato do layout
      for (const [d, al] of entradas) {
        if (al.some((a) => a === norm)) {
          dest = d;
          break;
        }
      }
      // 2) alias por inclusão do layout
      if (!dest) {
        for (const [d, al] of entradas) {
          if (matchAlias(norm, al)) {
            dest = d;
            break;
          }
        }
      }
      // 3) heurística global
      if (!dest) dest = suggestDestino(h);
    }
    if (dest && !usados.has(dest) && !CAMPOS_CALCULADOS.has(dest)) {
      out[h] = dest;
      usados.add(dest);
    } else {
      out[h] = null;
    }
  }
  return out;
}
