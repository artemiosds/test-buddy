// =============================================================================
// CLONE DE PLANILHA MODELO
//
// Não existe "aprendizado de matemática" aqui. Nenhuma regra geral é criada,
// nada é deduzido, nada é recalculado pelo sistema.
//
// 1) LEITURA DO MODELO  → monta um MAPA DE REFERÊNCIA célula a célula:
//      linha 7 (Técnica)   → INSALUBRIDADE = "H7*20%"   (fórmula)
//      linha 12 (Enfermeira)→ INSALUBRIDADE = 517,20     (valor fixo)
//      linha 12            → AUX. TRANSP.  = 0           (valor fixo)
//    Cada célula guarda a sua própria receita: fórmula EXATA ou valor fixo.
//
// 2) IMPORTAÇÃO DO MÊS  → para cada registro novo (casado por CPF, senão por
//    nome, senão pelo CARGO) o sistema escreve na linha destino a MESMA receita
//    da linha modelo correspondente:
//      - célula de fórmula no modelo → a mesma fórmula, apenas com a linha
//        deslocada para a linha destino (nada mais é alterado);
//      - célula de valor fixo no modelo → o dado novo do mês quando a coluna
//        existe no arquivo importado; senão o próprio valor fixo do modelo.
//
// Teste de fogo: a INSALUBRIDADE de uma enfermeira sai 517,20 (valor fixo
// copiado do modelo) e nunca 20% da base, porque no modelo aquela célula não é
// fórmula. A técnica continua com "=H*20%" porque no modelo dela é fórmula.
//
// Estrutura, ordem das colunas, cabeçalhos, estilos, mesclagens e larguras
// permanecem intocados: o arquivo gerado é o próprio modelo com dados novos.
// =============================================================================

import { deslocarLinhas, letraColuna } from "./planilha-espelho";

export type ReceitaCelula =
  | { tipo: "formula"; formula: string }
  | { tipo: "fixo"; valor: unknown };

export type ReceitaLinha = {
  /** Linha do modelo (1-based). */
  linha: number;
  cpf: string;
  nome: string;
  cargo: string;
  /** Receita de cada coluna daquela linha (índice da coluna → receita). */
  celulas: Map<number, ReceitaCelula>;
};

export type MapaModelo = {
  aba: string;
  /** Linha de cabeçalho detectada no modelo (ex.: 6). */
  linhaCabecalho: number;
  /** Índice da coluna → título do cabeçalho, como está escrito no modelo. */
  titulos: Map<number, string>;
  /** Última coluna usada. */
  ultimaColuna: number;
  linhas: ReceitaLinha[];
};

export type ResumoClone = {
  aba: string;
  linhaCabecalho: number;
  registros: number;
  casadosPorCpf: number;
  casadosPorNome: number;
  casadosPorCargo: number;
  semReceita: number;
  formulasCopiadas: number;
  valoresFixosCopiados: number;
  colunasIgnoradas: string[];
  /** Colunas ESTRUTURAIS do modelo (fórmula em todas as linhas com conteúdo). */
  colunasEstruturais: string[];
  /** Colunas do modelo sem dado correspondente no arquivo do mês. */
  colunasModeloSemDado: string[];
  /** Pessoas do mês que não casaram com nenhuma linha do modelo. */
  linhasSemCasamento: { linha: number; nome: string; cpf: string }[];
};


// -----------------------------------------------------------------------------
// Normalização de chaves
// -----------------------------------------------------------------------------

export function chaveColuna(titulo: unknown): string {
  return String(titulo ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function chaveCpf(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

export function chaveNome(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const COLUNAS_NUMERACAO = new Set(["N", "NO", "N0", "ITEM", "ORDEM", "SEQ"]);

function valorPlano(v: unknown): unknown {
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("result" in o) return o.result;
    if ("richText" in o && Array.isArray(o.richText))
      return (o.richText as { text?: string }[]).map((t) => t.text ?? "").join("");
    if ("text" in o) return o.text;
    return null;
  }
  return v;
}

function formulaDaCelula(v: unknown): string {
  if (v && typeof v === "object" && "formula" in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>).formula ?? "");
  }
  return "";
}

// -----------------------------------------------------------------------------
// Leitura do mapa de referência (nada é interpretado)
// -----------------------------------------------------------------------------

/** Célula que só repete o valor de uma mesclagem (não é conteúdo próprio). */
function celulaEspelhadaDeMesclagem(cell: any): boolean {
  try {
    return Boolean(cell?.isMerged) && cell?.master && cell.master.address !== cell.address;
  } catch {
    return false;
  }
}

/** Detecta a linha de cabeçalho: a primeira com mais colunas de texto preenchidas. */
export function detectarLinhaCabecalho(ws: any): number {
  let melhor = 1;
  let melhorScore = 0;
  const limite = Math.min(ws.rowCount || 1, 30);
  for (let linha = 1; linha <= limite; linha += 1) {
    const row = ws.getRow(linha);
    const distintos = new Set<string>();
    row.eachCell({ includeEmpty: false }, (cell: any) => {
      if (celulaEspelhadaDeMesclagem(cell)) return; // célula mesclada repete o valor
      const v = valorPlano(cell.value);
      if (typeof v === "string" && v.trim().length > 0 && !/^\d+$/.test(v.trim()))
        distintos.add(v.trim().toUpperCase());
    });
    if (distintos.size >= 3 && distintos.size > melhorScore) {
      melhorScore = distintos.size;
      melhor = linha;
    }
  }
  return melhor;
}

export function lerMapaModelo(ws: any): MapaModelo {
  const linhaCabecalho = detectarLinhaCabecalho(ws);
  const titulos = new Map<number, string>();
  let ultimaColuna = 0;
  ws.getRow(linhaCabecalho).eachCell({ includeEmpty: false }, (cell: any, col: number) => {
    if (celulaEspelhadaDeMesclagem(cell)) return;
    const t = String(valorPlano(cell.value) ?? "").trim();
    if (t) {
      titulos.set(col, t);
      if (col > ultimaColuna) ultimaColuna = col;
    }
  });

  const porChave = new Map<string, number>();
  for (const [col, t] of titulos) porChave.set(chaveColuna(t), col);
  const colNome = porChave.get("NOME") ?? null;
  const colCpf = porChave.get("CPF") ?? null;
  const colCargo = porChave.get("CARGO") ?? porChave.get("FUNCAO") ?? null;

  const linhas: ReceitaLinha[] = [];
  const total = ws.rowCount || linhaCabecalho;
  for (let linha = linhaCabecalho + 1; linha <= total; linha += 1) {
    const row = ws.getRow(linha);
    const nome = colNome ? String(valorPlano(row.getCell(colNome).value) ?? "").trim() : "";
    if (!nome) continue; // linha de rodapé/total: não é registro
    const celulas = new Map<number, ReceitaCelula>();
    for (let col = 1; col <= ultimaColuna; col += 1) {
      const bruto = row.getCell(col).value;
      const f = formulaDaCelula(bruto);
      if (f) celulas.set(col, { tipo: "formula", formula: f });
      else celulas.set(col, { tipo: "fixo", valor: valorPlano(bruto) });
    }
    linhas.push({
      linha,
      cpf: colCpf ? chaveCpf(valorPlano(row.getCell(colCpf).value)) : "",
      nome: chaveNome(nome),
      cargo: chaveColuna(colCargo ? valorPlano(row.getCell(colCargo).value) : ""),
      celulas,
    });
  }

  return { aba: ws.name, linhaCabecalho, titulos, ultimaColuna, linhas };
}

// -----------------------------------------------------------------------------
// Leitura dos dados novos do mês (só dados, nenhuma fórmula)
// -----------------------------------------------------------------------------

export type RegistroNovo = {
  /** chave de coluna normalizada → valor digitado no arquivo do mês. */
  valores: Map<string, unknown>;
  /** Fórmula escrita na própria célula do mês (usada só como último recurso). */
  formulas: Map<string, string>;
  /** Linha de origem no arquivo do mês (para deslocar fórmulas do próprio mês). */
  linhaOrigem: number;
};

export function lerRegistrosNovos(ws: any): { registros: RegistroNovo[]; titulos: string[] } {
  const linhaCabecalho = detectarLinhaCabecalho(ws);
  const cols = new Map<number, string>();
  ws.getRow(linhaCabecalho).eachCell({ includeEmpty: false }, (cell: any, col: number) => {
    if (celulaEspelhadaDeMesclagem(cell)) return;
    const t = String(valorPlano(cell.value) ?? "").trim();
    if (t) cols.set(col, t);
  });
  const chaveNomeCol = Array.from(cols.entries()).find(([, t]) => chaveColuna(t) === "NOME");
  const registros: RegistroNovo[] = [];
  const total = ws.rowCount || linhaCabecalho;
  for (let linha = linhaCabecalho + 1; linha <= total; linha += 1) {
    const row = ws.getRow(linha);
    if (chaveNomeCol) {
      const nome = String(valorPlano(row.getCell(chaveNomeCol[0]).value) ?? "").trim();
      if (!nome) continue;
    }
    const valores = new Map<string, unknown>();
    const formulas = new Map<string, string>();
    for (const [col, titulo] of cols) {
      const chave = chaveColuna(titulo);
      const bruto = row.getCell(col).value;
      valores.set(chave, valorPlano(bruto));
      const f = formulaDaCelula(bruto);
      if (f) formulas.set(chave, f);
    }
    registros.push({ valores, formulas, linhaOrigem: linha });
  }
  return { registros, titulos: Array.from(cols.values()) };
}

// -----------------------------------------------------------------------------
// Casamento registro novo ↔ linha do modelo
// -----------------------------------------------------------------------------

export type Casamento = {
  receita: ReceitaLinha | null;
  via: "cpf" | "nome" | "nenhum";
};

export function casarComModelo(mapa: MapaModelo, registro: RegistroNovo): Casamento {
  const cpf = chaveCpf(registro.valores.get("CPF"));
  if (cpf) {
    const r = mapa.linhas.find((l) => l.cpf && l.cpf === cpf);
    if (r) return { receita: r, via: "cpf" };
  }
  const nome = chaveNome(registro.valores.get("NOME"));
  if (nome) {
    const r = mapa.linhas.find((l) => l.nome === nome);
    if (r) return { receita: r, via: "nome" };
  }
  return { receita: null, via: "nenhum" };
}

// -----------------------------------------------------------------------------
// Motor de clone
// -----------------------------------------------------------------------------

/** Fórmula que o modelo usa nesta coluna (linha mais próxima que a tenha). */
export function formulaDaColunaNoModelo(
  mapa: MapaModelo,
  col: number,
): { formula: string; linha: number } | null {
  for (const l of mapa.linhas) {
    const rec = l.celulas.get(col);
    if (rec && rec.tipo === "formula") return { formula: rec.formula, linha: l.linha };
  }
  return null;
}

/**
 * Coluna ESTRUTURAL: o modelo a calcula em TODAS as linhas com conteúdo e em
 * nenhuma linha ela é valor digitado. Só essas colunas podem ter a fórmula
 * imposta sobre o dado do mês (BRUTO, ISS, TOTAL...). Colunas mistas
 * (INSALUBRIDADE, AUX. TRANSP.) nunca são calculadas pelo sistema.
 */
export function colunasEstruturaisDoModelo(mapa: MapaModelo): Set<number> {
  const out = new Set<number>();
  for (let col = 1; col <= mapa.ultimaColuna; col += 1) {
    if (!(mapa.titulos.get(col) ?? "").trim()) continue;
    let comFormula = 0;
    let comValorDigitado = 0;
    for (const linha of mapa.linhas) {
      const rec = linha.celulas.get(col);
      if (!rec) continue;
      if (rec.tipo === "formula") {
        comFormula += 1;
        continue;
      }
      const v = rec.valor;
      if (v !== null && v !== undefined && String(v).trim() !== "") comValorDigitado += 1;
    }
    if (comFormula > 0 && comValorDigitado === 0) out.add(col);
  }
  return out;
}

function copiarEstilo(origem: any, destino: any) {
  destino.style = { ...(origem.style ?? {}) };
  if (origem.numFmt) destino.numFmt = origem.numFmt;
}

/**
 * Escreve os registros novos no modelo, respeitando a receita de cada célula.
 * Retorna o resumo de auditoria (o que foi copiado e como cada linha casou).
 */
export function aplicarClone(
  ws: any,
  mapa: MapaModelo,
  registros: RegistroNovo[],
): ResumoClone {
  const resumo: ResumoClone = {
    aba: mapa.aba,
    linhaCabecalho: mapa.linhaCabecalho,
    registros: registros.length,
    casadosPorCpf: 0,
    casadosPorNome: 0,
    casadosPorCargo: 0,
    semReceita: 0,
    formulasCopiadas: 0,
    valoresFixosCopiados: 0,
    colunasIgnoradas: [],
    colunasEstruturais: [],
    colunasModeloSemDado: [],
    linhasSemCasamento: [],
  };

  const titulosModelo = new Set(Array.from(mapa.titulos.values()).map(chaveColuna));
  const titulosNovos = new Set<string>();
  for (const r of registros) for (const k of r.valores.keys()) titulosNovos.add(k);
  resumo.colunasIgnoradas = Array.from(titulosNovos).filter((k) => !titulosModelo.has(k));

  const estruturais = colunasEstruturaisDoModelo(mapa);
  resumo.colunasEstruturais = Array.from(estruturais).map((c) => mapa.titulos.get(c) ?? "");
  // Divergência: coluna que existe no modelo, não é calculada por ele e também
  // não vem no arquivo do mês (ex.: GRAT.INCENTIVO ausente na entrada).
  resumo.colunasModeloSemDado = Array.from(mapa.titulos.entries())
    .filter(([col, t]) => {
      const chave = chaveColuna(t);
      if (estruturais.has(col)) return false;
      if (COLUNAS_NUMERACAO.has(chave)) return false;
      return !titulosNovos.has(chave);
    })
    .map(([, t]) => t);

  const primeiraLinhaDados = mapa.linhaCabecalho + 1;
  const ultimaLinhaModelo = mapa.linhas.length
    ? mapa.linhas[mapa.linhas.length - 1].linha
    : mapa.linhaCabecalho;

  registros.forEach((registro, i) => {
    const destinoIdx = primeiraLinhaDados + i;
    const { receita, via } = casarComModelo(mapa, registro);
    if (via === "cpf") resumo.casadosPorCpf += 1;
    else if (via === "nome") resumo.casadosPorNome += 1;
    else {
      resumo.semReceita += 1;
      resumo.linhasSemCasamento.push({
        linha: registro.linhaOrigem,
        nome: String(registro.valores.get("NOME") ?? ""),
        cpf: chaveCpf(registro.valores.get("CPF")),
      });
    }

    // Sem casamento: NÃO herda a receita de outra pessoa. A linha recebe apenas
    // a formatação da primeira linha do modelo e as fórmulas ESTRUTURAIS; todo
    // o resto vem do arquivo do mês.
    const molde = receita;
    const linhaMolde = molde?.linha ?? mapa.linhas[0]?.linha ?? primeiraLinhaDados;
    const destino = ws.getRow(destinoIdx);
    const fonte = ws.getRow(linhaMolde);

    for (let col = 1; col <= mapa.ultimaColuna; col += 1) {
      const cellDestino = destino.getCell(col);
      copiarEstilo(fonte.getCell(col), cellDestino);
      const chave = chaveColuna(mapa.titulos.get(col) ?? "");
      const rec = molde?.celulas.get(col) ?? null;
      const ehEstrutural = estruturais.has(col);
      const temDadoDoMes = registro.valores.has(chave);

      // Coluna de numeração: sequência natural da planilha gerada.
      if (COLUNAS_NUMERACAO.has(chave) && !ehEstrutural) {
        cellDestino.value = i + 1;
        continue;
      }

      // Fórmula só é escrita quando a coluna é estrutural no modelo, ou quando
      // a célula do modelo é fórmula e o mês não traz dado para essa coluna.
      const fonteFormula =
        rec && rec.tipo === "formula"
          ? { formula: rec.formula, linha: linhaMolde }
          : ehEstrutural
            ? formulaDaColunaNoModelo(mapa, col)
            : null;

      if (fonteFormula && (ehEstrutural || !temDadoDoMes)) {
        cellDestino.value = {
          formula: deslocarLinhas(fonteFormula.formula, destinoIdx - fonteFormula.linha),
        } as any;
        resumo.formulasCopiadas += 1;
        continue;
      }

      // Coluna de valor: o dado do mês SEMPRE vence a fórmula não estrutural
      // (é o caso da INSALUBRIDADE: 517,20 fixo nunca vira 20% da base).
      if (temDadoDoMes) {
        const v = registro.valores.get(chave);
        cellDestino.value = (v === undefined ? null : v) as any;
        resumo.valoresFixosCopiados += 1;
        continue;
      }

      // Nada no mês: preserva o valor fixo do próprio modelo daquela pessoa.
      cellDestino.value = (rec && rec.tipo === "fixo" ? (rec.valor ?? null) : null) as any;
      resumo.valoresFixosCopiados += 1;
    }
    destino.commit?.();
  });


  // Sobras do modelo (mês novo com menos pessoas): limpa os valores, mantendo
  // a formatação original da planilha.
  for (let linha = primeiraLinhaDados + registros.length; linha <= ultimaLinhaModelo; linha += 1) {
    const row = ws.getRow(linha);
    for (let col = 1; col <= mapa.ultimaColuna; col += 1) row.getCell(col).value = null;
    row.commit?.();
  }

  return resumo;
}

/**
 * Gera o arquivo clonado: modelo + dados do mês.
 * @param bufferModelo planilha modelo (estrutura, fórmulas e valores fixos)
 * @param bufferNovo   planilha do mês com os dados atualizados
 */
export async function clonarPlanilhaModelo(
  bufferModelo: ArrayBuffer,
  bufferNovo: ArrayBuffer,
): Promise<{ blob: Blob; resumo: ResumoClone; colunasModelo: string[] }> {
  const ExcelJS = (await import("exceljs")).default ?? (await import("exceljs"));

  const wbNovo = new (ExcelJS as any).Workbook();
  await wbNovo.xlsx.load(bufferNovo);
  const wsNovo = wbNovo.worksheets[0];
  if (!wsNovo) throw new Error("A planilha do mês não tem abas legíveis.");
  const { registros } = lerRegistrosNovos(wsNovo);
  if (registros.length === 0) throw new Error("A planilha do mês não tem linhas de dados.");

  const wb = new (ExcelJS as any).Workbook();
  await wb.xlsx.load(bufferModelo);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("A planilha modelo não tem abas legíveis.");

  const mapa = lerMapaModelo(ws);
  if (mapa.linhas.length === 0) throw new Error("A planilha modelo não tem linhas de referência.");

  const resumo = aplicarClone(ws, mapa, registros);

  // Fórmulas ativas: Excel/LibreOffice recalculam ao abrir.
  wb.calcProperties = { ...(wb.calcProperties ?? {}), fullCalcOnLoad: true };
  const saida = await wb.xlsx.writeBuffer();
  return {
    blob: new Blob([saida as ArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    resumo,
    colunasModelo: Array.from(mapa.titulos.entries()).map(
      ([col, t]) => `${letraColuna(col)}: ${t}`,
    ),
  };
}
