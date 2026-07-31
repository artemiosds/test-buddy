// =============================================================================
// MOTOR DE LAYOUTS DE IMPORTAÇÃO — núcleo puro (sem I/O, sem Supabase).
//
// Genérico e desacoplado: NÃO conhece Piso Nacional, Contratados, Efetivos,
// BPA, CNES ou qualquer outro módulo. Trabalha apenas com "Layouts" carregados
// de configuração (banco), seus campos internos e seus sinônimos (aliases).
//
// Responsabilidades: identificar o layout de um arquivo, mapear colunas por
// aliases e validar a estrutura. A gravação dos dados é responsabilidade do
// fluxo de importação de cada módulo.
//
// Preparado para OCR/IA: a etapa de extração apenas precisa produzir
// { headers, rows } — o motor segue idêntico.
// =============================================================================

/** Remove acentos, pontuação e normaliza para minúsculas com espaços simples. */
export function normalizarTexto(s: string): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
}

export type TipoDado = "texto" | "numero" | "moeda" | "data" | "cpf" | "competencia";

export type LayoutCampo = {
  campo_interno: string;
  label: string | null;
  coluna_padrao: string | null;
  aliases: string[];
  obrigatorio: boolean;
  ignorado: boolean;
  tipo_dado: TipoDado | string;
  ordem: number;
  /**
   * "Obrigatório se existir": quando true, o campo é lido caso a coluna exista
   * no arquivo, mas a ausência nunca bloqueia a importação.
   * Campos antigos (sem a propriedade) continuam com o comportamento original.
   */
  condicional?: boolean;
  /** Peso (0..100) por sinônimo — usado como desempate na detecção automática. */
  pesos?: Record<string, number>;
};


export type LayoutVersaoResolvida = {
  layout_id: string;
  layout_codigo: string;
  layout_nome: string;
  modulo: string;
  tipo: string;
  ativo: boolean;
  versao_id: string;
  versao: number;
  situacao: string;
  arquivo_hints: string[];
  header_hints: string[];
  config: Record<string, string | number | boolean | null>;
  campos: LayoutCampo[];
};

// -----------------------------------------------------------------------------
// Aliases
// -----------------------------------------------------------------------------

/** Todos os termos reconhecidos de um campo (coluna padrão + aliases + nome). */
export function termosDoCampo(campo: LayoutCampo): string[] {
  const brutos = [campo.coluna_padrao ?? "", campo.label ?? "", ...campo.aliases];
  const set = new Set<string>();
  for (const t of brutos) {
    const n = normalizarTexto(t);
    if (n) set.add(n);
  }
  return Array.from(set);
}

/** Versão compacta (sem espaços): trata "C.P.F." e "CPF" como o mesmo termo. */
function compacto(s: string): string {
  return s.replace(/\s+/g, "");
}

function combina(headerNorm: string, termos: string[]): "exato" | "parcial" | null {
  if (!headerNorm) return null;
  const hc = compacto(headerNorm);
  if (termos.some((t) => t === headerNorm || compacto(t) === hc)) return "exato";
  if (
    termos.some((t) => {
      const tc = compacto(t);
      return tc.length >= 3 && (hc.includes(tc) || tc.includes(hc));
    })
  )
    return "parcial";
  return null;
}

// -----------------------------------------------------------------------------
// Mapeamento coluna → campo interno
// -----------------------------------------------------------------------------

export type Mapeamento = Record<string, string | null>;

/** Termos genéricos demais para decidir sozinhos um mapeamento. */
const TERMOS_GENERICOS = new Set([
  "total",
  "valor",
  "documento",
  "numero",
  "num",
  "codigo",
  "data",
  "descricao",
  "tipo",
  "referencia",
]);

/**
 * Peso (0..100) do casamento entre um cabeçalho normalizado e um campo.
 * Pesos explícitos (campo.pesos) têm prioridade; senão usa a heurística:
 * nome/coluna padrão = 100, sinônimos decrescem conforme a ordem cadastrada e
 * termos genéricos valem pouco.
 */
export function pesoDoCampoParaHeader(campo: LayoutCampo, headerNorm: string): number {
  const alvo = headerNorm.replace(/\s+/g, "");
  const pesos = campo.pesos ?? {};
  for (const [alias, peso] of Object.entries(pesos)) {
    const n = normalizarTexto(alias).replace(/\s+/g, "");
    if (n && n === alvo) return Math.max(0, Math.min(100, Number(peso) || 0));
  }
  const principais = [campo.coluna_padrao ?? "", campo.label ?? "", campo.campo_interno];
  if (principais.some((t) => normalizarTexto(t).replace(/\s+/g, "") === alvo)) return 100;
  const idx = campo.aliases.findIndex(
    (a) => normalizarTexto(a).replace(/\s+/g, "") === alvo,
  );
  if (TERMOS_GENERICOS.has(headerNorm)) return 20;
  if (idx >= 0) return Math.max(40, 95 - idx * 5);
  return 30;
}

/**
 * Mapeia cada cabeçalho encontrado no arquivo para um campo interno do layout.
 * Prioriza correspondências exatas; um campo nunca recebe duas colunas.
 * Havendo mais de um campo compatível, vence o de maior peso de sinônimo.
 */
export function mapearColunas(headers: string[], versao: LayoutVersaoResolvida): Mapeamento {
  const campos = versao.campos.filter((c) => !c.ignorado);
  const termos = new Map(campos.map((c) => [c.campo_interno, termosDoCampo(c)]));
  const out: Mapeamento = {};
  const usados = new Set<string>();

  const resolver = (modo: "exato" | "parcial") => {
    for (const h of headers) {
      if (out[h]) continue;
      const norm = normalizarTexto(h);
      let melhor: { campo: LayoutCampo; peso: number } | null = null;
      for (const c of campos) {
        if (usados.has(c.campo_interno)) continue;
        if (combina(norm, termos.get(c.campo_interno) ?? []) === modo) {
          const peso = pesoDoCampoParaHeader(c, norm);
          if (!melhor || peso > melhor.peso) melhor = { campo: c, peso };
        }
      }
      if (melhor) {
        out[h] = melhor.campo.campo_interno;
        usados.add(melhor.campo.campo_interno);
      }
    }
  };

  resolver("exato");
  resolver("parcial");
  for (const h of headers) if (!(h in out)) out[h] = null;
  return out;
}


// -----------------------------------------------------------------------------
// Detecção automática de layout
// -----------------------------------------------------------------------------

export type PontuacaoLayout = {
  versao: LayoutVersaoResolvida;
  score: number;
  camposReconhecidos: number;
  obrigatoriosAusentes: string[];
  compatibilidade: number; // 0..1
};

/** Pontua uma versão de layout contra o nome do arquivo e os cabeçalhos. */
export function pontuarLayout(
  versao: LayoutVersaoResolvida,
  nomeArquivo: string,
  headers: string[],
): PontuacaoLayout {
  const nome = normalizarTexto(nomeArquivo);
  const hs = headers.map(normalizarTexto).filter(Boolean);
  let score = 0;

  for (const hint of versao.arquivo_hints) {
    const h = normalizarTexto(hint);
    if (h && nome.includes(h)) score += 3;
  }
  for (const hint of versao.header_hints) {
    const h = normalizarTexto(hint);
    if (h && hs.some((x) => x.includes(h))) score += 2;
  }

  const mapa = mapearColunas(headers, versao);
  const reconhecidos = new Set(Object.values(mapa).filter(Boolean) as string[]);
  score += reconhecidos.size;

  const obrigatorios = versao.campos.filter((c) => c.obrigatorio && !c.condicional && !c.ignorado);
  const ausentes = obrigatorios
    .filter((c) => !reconhecidos.has(c.campo_interno))
    .map((c) => c.campo_interno);
  if (obrigatorios.length > 0 && ausentes.length === 0) score += 4;
  score -= ausentes.length * 2;

  const uteis = versao.campos.filter((c) => !c.ignorado).length || 1;
  const compatibilidade = Math.max(0, Math.min(1, reconhecidos.size / uteis));

  return { versao, score, camposReconhecidos: reconhecidos.size, obrigatoriosAusentes: ausentes, compatibilidade };
}

export type ResultadoDeteccao = {
  ranking: PontuacaoLayout[];
  escolhido: PontuacaoLayout | null;
  /** Empate ou baixa confiança: a UI deve pedir confirmação do usuário. */
  requerEscolha: boolean;
  motivo: "unico" | "melhor" | "empate" | "sem_candidato" | "baixa_confianca";
};

/**
 * Seleciona automaticamente o layout mais compatível. Em caso de empate ou
 * baixa confiança nunca assume um layout: exige confirmação do usuário.
 */
export function detectarLayout(
  versoes: LayoutVersaoResolvida[],
  nomeArquivo: string,
  headers: string[],
): ResultadoDeteccao {
  const ranking = versoes
    .map((v) => pontuarLayout(v, nomeArquivo, headers))
    .sort((a, b) => b.score - a.score || b.camposReconhecidos - a.camposReconhecidos);

  if (ranking.length === 0 || ranking[0].score <= 0)
    return { ranking, escolhido: null, requerEscolha: true, motivo: "sem_candidato" };

  const [primeiro, segundo] = ranking;
  if (segundo && segundo.score === primeiro.score)
    return { ranking, escolhido: null, requerEscolha: true, motivo: "empate" };
  if (primeiro.obrigatoriosAusentes.length > 0 || primeiro.compatibilidade < 0.4)
    return { ranking, escolhido: primeiro, requerEscolha: true, motivo: "baixa_confianca" };

  return {
    ranking,
    escolhido: primeiro,
    requerEscolha: false,
    motivo: ranking.length === 1 ? "unico" : "melhor",
  };
}

// -----------------------------------------------------------------------------
// Validação de estrutura (antes da importação)
// -----------------------------------------------------------------------------

export type TipoIssueEstrutura =
  | "campo_obrigatorio_ausente"
  | "coluna_duplicada"
  | "coluna_nao_reconhecida"
  | "campo_sem_coluna"
  | "tipo_incompativel";

export type IssueEstrutura = {
  tipo: TipoIssueEstrutura;
  severidade: "erro" | "alerta";
  referencia: string;
  mensagem: string;
};

const RE_NUM = /^-?\s*R?\$?\s*[\d.\s]*\d([,.]\d+)?\s*%?$/;

function valorCompativel(valor: unknown, tipo: string): boolean {
  const s = String(valor ?? "").trim();
  if (!s) return true;
  switch (tipo) {
    case "numero":
    case "moeda":
      return RE_NUM.test(s);
    case "cpf":
      return s.replace(/\D+/g, "").length >= 11;
    case "data":
      return !Number.isNaN(Date.parse(s)) || /^\d{2}[/-]\d{2}[/-]\d{2,4}$/.test(s);
    case "competencia":
      return /\d{2}[/-]?\d{4}|\d{4}-\d{2}/.test(s);
    default:
      return true;
  }
}

/**
 * Valida a estrutura do arquivo contra o layout selecionado.
 * Amostra as primeiras linhas para checagem de tipos.
 */
export function validarEstrutura(
  headers: string[],
  mapeamento: Mapeamento,
  versao: LayoutVersaoResolvida,
  amostra: Record<string, unknown>[] = [],
): { issues: IssueEstrutura[]; erros: number; alertas: number } {
  const issues: IssueEstrutura[] = [];
  const campos = new Map(versao.campos.map((c) => [c.campo_interno, c]));
  const usados = new Map<string, string[]>();

  for (const h of headers) {
    const destino = mapeamento[h] ?? null;
    if (!destino) {
      issues.push({
        tipo: "coluna_nao_reconhecida",
        severidade: "alerta",
        referencia: h,
        mensagem: `Coluna "${h}" não está mapeada em nenhum campo do layout (será ignorada).`,
      });
      continue;
    }
    usados.set(destino, [...(usados.get(destino) ?? []), h]);
  }

  for (const [destino, cols] of usados) {
    if (cols.length > 1) {
      issues.push({
        tipo: "coluna_duplicada",
        severidade: "erro",
        referencia: destino,
        mensagem: `O campo "${campos.get(destino)?.label ?? destino}" recebeu ${cols.length} colunas: ${cols.join(", ")}.`,
      });
    }
  }

  for (const c of versao.campos) {
    if (c.ignorado) continue;
    if (usados.has(c.campo_interno)) continue;
    // "Obrigatório se existir": ausência nunca bloqueia.
    const bloqueia = c.obrigatorio && !c.condicional;
    issues.push({
      tipo: bloqueia ? "campo_obrigatorio_ausente" : "campo_sem_coluna",
      severidade: bloqueia ? "erro" : "alerta",
      referencia: c.campo_interno,
      mensagem: bloqueia
        ? `Campo obrigatório "${c.label ?? c.campo_interno}" não foi encontrado no arquivo.`
        : c.condicional
          ? `Campo "${c.label ?? c.campo_interno}" (obrigatório se existir) não está presente no arquivo — a importação segue normalmente.`
          : `Campo opcional "${c.label ?? c.campo_interno}" não foi encontrado no arquivo.`,
    });
  }


  const linhas = amostra.slice(0, 25);
  for (const [destino, cols] of usados) {
    const campo = campos.get(destino);
    if (!campo || campo.tipo_dado === "texto") continue;
    const col = cols[0];
    const invalidas = linhas.filter((l) => !valorCompativel(l[col], String(campo.tipo_dado))).length;
    if (invalidas > 0) {
      issues.push({
        tipo: "tipo_incompativel",
        severidade: "alerta",
        referencia: destino,
        mensagem: `${invalidas} valor(es) da coluna "${col}" não parecem do tipo ${campo.tipo_dado}.`,
      });
    }
  }

  return {
    issues,
    erros: issues.filter((i) => i.severidade === "erro").length,
    alertas: issues.filter((i) => i.severidade === "alerta").length,
  };
}
