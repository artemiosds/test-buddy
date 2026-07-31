// =============================================================================
// CATÁLOGO INTELIGENTE DE LAYOUTS — núcleo puro (sem I/O).
//
// Camada ADITIVA sobre o motor de layouts (layout-engine.ts): pesos de
// sinônimos, pré-visualização do reconhecimento, obrigatoriedade condicional,
// classificação da biblioteca e pacote de exportação/importação.
//
// Nada aqui altera o motor de importação, a detecção automática ou os
// layouts já cadastrados.
// =============================================================================

import {
  normalizarTexto,
  pesoDoCampoParaHeader,
  type LayoutCampo,
  type LayoutVersaoResolvida,
  type Mapeamento,
} from "./layout-engine";
import { labelCampoInterno } from "./layout-campos-catalogo";

// -----------------------------------------------------------------------------
// 6) Obrigatoriedade em três estados
// -----------------------------------------------------------------------------

export type EstadoObrigatoriedade = "obrigatorio" | "condicional" | "opcional";

export const LABEL_OBRIGATORIEDADE: Record<EstadoObrigatoriedade, string> = {
  obrigatorio: "Obrigatório",
  condicional: "Obrigatório se existir",
  opcional: "Não obrigatório",
};

export function estadoObrigatoriedade(campo: {
  obrigatorio?: boolean;
  condicional?: boolean;
}): EstadoObrigatoriedade {
  if (campo.condicional) return "condicional";
  return campo.obrigatorio ? "obrigatorio" : "opcional";
}

export function aplicarObrigatoriedade(
  estado: EstadoObrigatoriedade,
): { obrigatorio: boolean; condicional: boolean } {
  if (estado === "obrigatorio") return { obrigatorio: true, condicional: false };
  if (estado === "condicional") return { obrigatorio: true, condicional: true };
  return { obrigatorio: false, condicional: false };
}

// -----------------------------------------------------------------------------
// 9) Biblioteca oficial — classificação do layout
// -----------------------------------------------------------------------------

export const CLASSIFICACOES = [
  "oficial_sms",
  "homologado",
  "experimental",
  "arquivado",
] as const;

export type Classificacao = (typeof CLASSIFICACOES)[number];

export const LABEL_CLASSIFICACAO: Record<Classificacao, string> = {
  oficial_sms: "Oficial SMS",
  homologado: "Homologado",
  experimental: "Experimental",
  arquivado: "Arquivado",
};

export function classificacaoValida(v: string | null | undefined): Classificacao {
  return (CLASSIFICACOES as readonly string[]).includes(String(v))
    ? (v as Classificacao)
    : "experimental";
}

// -----------------------------------------------------------------------------
// 2) Score dos sinônimos
// -----------------------------------------------------------------------------

/** Peso sugerido para um sinônimo novo, conforme sua forma. */
export function pesoSugeridoAlias(campo_interno: string, alias: string): number {
  const a = normalizarTexto(alias);
  const chave = normalizarTexto(campo_interno);
  const rotulo = normalizarTexto(labelCampoInterno(campo_interno));
  const compacto = (s: string) => s.replace(/\s+/g, "");
  if (!a) return 0;
  if (compacto(a) === compacto(chave) || compacto(a) === compacto(rotulo)) return 100;
  if (compacto(a).includes(compacto(chave)) || compacto(a).includes(compacto(rotulo))) return 90;
  if (a.split(" ").length === 1 && a.length <= 4) return 60;
  if (["total", "valor", "documento", "numero", "codigo", "data"].includes(a)) return 20;
  return 75;
}

/** Ordena sinônimos do mais forte para o mais fraco. */
export function ordenarPorPeso<T extends { alias: string; peso?: number | null }>(
  campo_interno: string,
  itens: T[],
): T[] {
  return [...itens].sort(
    (x, y) =>
      (y.peso ?? pesoSugeridoAlias(campo_interno, y.alias)) -
      (x.peso ?? pesoSugeridoAlias(campo_interno, x.alias)),
  );
}

// -----------------------------------------------------------------------------
// 8) Pré-visualização do reconhecimento
// -----------------------------------------------------------------------------

export type StatusColuna =
  | "reconhecido"
  | "nao_reconhecido"
  | "ignorado"
  | "vazio";

export type LinhaReconhecimento = {
  header: string;
  campo: string | null;
  label: string;
  status: StatusColuna;
  peso: number | null;
};

export type Reconhecimento = {
  linhas: LinhaReconhecimento[];
  /** Total bruto de colunas do arquivo (apenas informativo). */
  total: number;
  /** Colunas que realmente contam: total − ignoradas − vazias. */
  relevantes: number;
  reconhecidas: number;
  naoReconhecidas: number;
  ignoradas: number;
  vazias: number;
  /** reconhecidas / relevantes (0 quando não há colunas relevantes). */
  percentual: number;
  camposFaltando: { campo: string; label: string; estado: EstadoObrigatoriedade }[];
  obrigatoriosAusentes: number;
  opcionaisAusentes: number;
  /** Nada pendente: todas as colunas relevantes reconhecidas e sem obrigatórios faltando. */
  compativel: boolean;
};

/** Termos reconhecidos de um campo, para casar cabeçalhos com campos ignorados. */
function termosNormalizados(campo: LayoutCampo): string[] {
  const brutos = [campo.coluna_padrao ?? "", campo.label ?? "", campo.campo_interno, ...campo.aliases];
  return brutos.map((t) => normalizarTexto(t).replace(/\s+/g, "")).filter(Boolean);
}

/**
 * Resumo visual do que o motor entendeu do arquivo, antes de importar.
 * Somente leitura: não altera mapeamento nem layout.
 *
 * `ignorarHeaders` = colunas que o usuário marcou explicitamente como
 * "Ignorar coluna" na tela de mapeamento.
 */
export function previsualizarReconhecimento(
  headers: string[],
  mapeamento: Mapeamento,
  versao: LayoutVersaoResolvida | null,
  labelDe?: (campo: string) => string,
  ignorarHeaders?: Iterable<string>,
): Reconhecimento {
  const rotulo = (campo: string) => {
    const doLayout = versao?.campos.find((c) => c.campo_interno === campo);
    return labelDe?.(campo) ?? doLayout?.label ?? labelCampoInterno(campo);
  };
  const camposIgnorados = (versao?.campos ?? []).filter((c) => c.ignorado);
  const ignorados = new Set(camposIgnorados.map((c) => c.campo_interno));
  const termosIgnorados = new Set(camposIgnorados.flatMap(termosNormalizados));
  const manuaisIgnorados = new Set(ignorarHeaders ?? []);

  const linhas: LinhaReconhecimento[] = headers.map((h) => {
    const destino = mapeamento[h] ?? null;
    const norm = normalizarTexto(h).replace(/\s+/g, "");
    if (!String(h ?? "").trim())
      return { header: h, campo: null, label: "Coluna vazia", status: "vazio", peso: null };
    if (destino && ignorados.has(destino))
      return { header: h, campo: destino, label: rotulo(destino), status: "ignorado", peso: null };
    if (!destino) {
      // Ignorada de propósito: pelo usuário na tela ou por campo marcado como
      // "ignorar coluna" no layout. Não é o mesmo que "não reconhecida".
      if (manuaisIgnorados.has(h) || (norm && termosIgnorados.has(norm)))
        return { header: h, campo: null, label: "Ignorada pelo layout", status: "ignorado", peso: null };
      return {
        header: h,
        campo: null,
        label: "Sem mapeamento",
        status: "nao_reconhecido",
        peso: null,
      };
    }
    const campo = versao?.campos.find((c) => c.campo_interno === destino);
    return {
      header: h,
      campo: destino,
      label: rotulo(destino),
      status: "reconhecido",
      peso: campo ? pesoDoCampoParaHeader(campo, normalizarTexto(h)) : null,
    };
  });

  const reconhecidas = linhas.filter((l) => l.status === "reconhecido").length;
  const ignoradas = linhas.filter((l) => l.status === "ignorado").length;
  const vazias = linhas.filter((l) => l.status === "vazio").length;
  const naoReconhecidas = linhas.filter((l) => l.status === "nao_reconhecido").length;
  const relevantes = reconhecidas + naoReconhecidas;

  const usados = new Set(linhas.map((l) => l.campo).filter(Boolean) as string[]);
  const camposFaltando = (versao?.campos ?? [])
    .filter((c) => !c.ignorado && !usados.has(c.campo_interno))
    .map((c) => ({
      campo: c.campo_interno,
      label: c.label ?? labelCampoInterno(c.campo_interno),
      estado: estadoObrigatoriedade(c),
    }));
  const obrigatoriosAusentes = camposFaltando.filter((c) => c.estado === "obrigatorio").length;
  const opcionaisAusentes = camposFaltando.length - obrigatoriosAusentes;

  return {
    linhas,
    total: linhas.length,
    relevantes,
    reconhecidas,
    naoReconhecidas,
    ignoradas,
    vazias,
    percentual: relevantes ? Math.round((reconhecidas / relevantes) * 100) : 0,
    camposFaltando,
    obrigatoriosAusentes,
    opcionaisAusentes,
    compativel: naoReconhecidas === 0 && obrigatoriosAusentes === 0 && reconhecidas > 0,
  };
}


// -----------------------------------------------------------------------------
// 10/11) Pacote de exportação/importação de layouts (JSON versionado)
// -----------------------------------------------------------------------------

export const PACOTE_VERSAO = 1;

export type PacoteLayout = {
  pacote: "layout-importacao";
  versao_pacote: number;
  exportado_em: string;
  layout: {
    codigo: string;
    nome: string;
    descricao: string | null;
    tipo: string;
    modulo: string;
    classificacao: Classificacao;
  };
  versao: {
    versao: number;
    notas: string | null;
    arquivo_hints: string[];
    header_hints: string[];
    regras: Record<string, unknown>;
    config: Record<string, unknown>;
  };
  campos: LayoutCampo[];
};

export function nomeArquivoPacote(codigo: string, versao: number): string {
  return `LAYOUT-${codigo.toUpperCase()}-V${versao}.json`;
}
