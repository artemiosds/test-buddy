/**
 * Camada de consolidação de funções (De-Para) — NÃO DESTRUTIVA.
 *
 * A função cadastrada de cada profissional continua intacta no banco; aqui
 * apenas mapeamos as variações de escrita para uma categoria consolidada, usada
 * na tela Geral Cargos e nas exportações quando "categoria consolidada" está
 * ativa.
 *
 * As equivalências são mantidas pelo usuário em
 * `municipio_config.parametros.funcoes_depara`, no formato
 * `{ "nome da função cadastrada": "categoria consolidada" }`. Sem nada
 * cadastrado, cada função continua sendo a própria categoria (comportamento
 * anterior à existência deste módulo).
 *
 * Módulo puro: nenhuma consulta, nenhum side-effect.
 */

/** Mapa mantido pelo usuário: função cadastrada → categoria consolidada. */
export type DeParaFuncoes = Record<string, string>;

/** Índice normalizado → categoria, para consulta rápida durante a agregação. */
export type IndiceFuncoes = Map<string, string>;

export type CategoriaFuncao = { chave: string; nome: string };

/** Normaliza o nome da função: sem acento, sem pontuação, maiúsculo. */
export function normalizarFuncao(nome: string | null | undefined): string {
  return (nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * Lê o De-Para salvo em `municipio_config.parametros`, tolerando conteúdo
 * ausente ou fora do formato (nesse caso o resultado é vazio).
 */
export function parseDeParaFuncoes(parametros: unknown): DeParaFuncoes {
  const bruto = (parametros as Record<string, unknown> | null)?.funcoes_depara;
  const out: DeParaFuncoes = {};
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return out;
  for (const [nome, categoria] of Object.entries(bruto as Record<string, unknown>)) {
    if (typeof categoria !== "string") continue;
    const n = nome.trim();
    const c = categoria.trim();
    if (!n || !c) continue;
    out[n] = c;
  }
  return out;
}

/** Índice de consulta a partir do De-Para mantido pelo usuário. */
export function criarIndiceFuncoes(dePara: DeParaFuncoes): IndiceFuncoes {
  const indice: IndiceFuncoes = new Map();
  for (const [nome, categoria] of Object.entries(dePara)) {
    const chave = normalizarFuncao(nome);
    const c = (categoria ?? "").trim();
    if (chave && c) indice.set(chave, c);
  }
  return indice;
}

/**
 * Categoria consolidada de uma função cadastrada. Sem equivalência — ou quando
 * a equivalência apenas repete o próprio nome — a função vira categoria própria.
 */
export function categoriaDaFuncao(
  nome: string | null | undefined,
  indice: IndiceFuncoes,
): CategoriaFuncao {
  const base = (nome ?? "").trim();
  const chave = normalizarFuncao(base);
  if (!chave) return { chave: "fun:sem-funcao", nome: base || "Sem função" };
  const categoria = (indice.get(chave) ?? "").trim();
  if (categoria && normalizarFuncao(categoria) !== chave) {
    return { chave: `cat:${normalizarFuncao(categoria)}`, nome: categoria };
  }
  return { chave: `fun:${chave}`, nome: base };
}

/** Categorias já usadas no De-Para, para o autocompletar da tela de manutenção. */
export function listarCategoriasFuncoes(dePara: DeParaFuncoes): string[] {
  return Array.from(new Set(Object.values(dePara).map((v) => v.trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );
}

/** De-Para em formato de tabela (categoria → funções), para conferência. */
export function listarDeParaFuncoes(
  dePara: DeParaFuncoes,
): Array<{ categoria: string; funcoes: string[] }> {
  const mapa = new Map<string, string[]>();
  for (const [nome, categoria] of Object.entries(dePara)) {
    const lista = mapa.get(categoria) ?? [];
    if (!lista.includes(nome)) lista.push(nome);
    mapa.set(categoria, lista);
  }
  return Array.from(mapa, ([categoria, funcoes]) => ({
    categoria,
    funcoes: funcoes.sort((a, b) => a.localeCompare(b, "pt-BR")),
  })).sort((a, b) => a.categoria.localeCompare(b.categoria, "pt-BR"));
}
