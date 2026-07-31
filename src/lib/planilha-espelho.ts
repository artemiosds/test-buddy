// =============================================================================
// MOTOR DE CÓPIA (COPY ENGINE) — sem inferência, sem regra geral.
//
// Regra de ouro: o sistema SÓ copia o que está escrito na célula do modelo.
// Ele não deduz, não generaliza, não calcula e não inventa nada.
//
// Como funciona:
//   1. Lê a planilha modelo célula por célula e monta uma MATRIZ DE DEPENDÊNCIAS
//      por LINHA e por COLUNA:
//        - célula com fórmula  → guarda a fórmula EXATA daquela linha
//                                (linha 10: INSALUBRIDADE = J10*20%)
//        - célula com número   → guarda "valor fixo"
//                                (linha 6: INSALUBRIDADE = 517,20)
//   2. Na exportação, a fórmula da célula fonte é escrita na célula destino
//      da MESMA coluna e da LINHA CORRESPONDENTE. Linha sem fórmula no modelo
//      continua sem fórmula (valor fixo preservado).
//   3. Estrutura, ordem das colunas, cabeçalhos, estilos, mesclagens e larguras
//      permanecem intocados; o Excel recalcula ao abrir (fórmulas ativas).
//
// Não usa IA, não usa catálogo de campos, não depende de mapeamento manual.
// =============================================================================

/** O que existe em uma célula do modelo, exatamente como está lá. */
export type CelulaModelo = {
  /** Linha do modelo (1-based, como no exceljs). */
  linha: number;
  /** Índice da coluna (1 = A). */
  coluna: number;
  /** Letra da coluna, para exibição. */
  letra: string;
  /** "formula" = célula calculada no modelo; "fixo" = valor digitado. */
  tipo: "formula" | "fixo";
  /** Fórmula original daquela célula, sem "=" (vazio quando `tipo === "fixo"`). */
  formula: string;
  /** Colunas referenciadas por ESTA célula (dependências da própria linha). */
  dependencias: string[];
};

/** Matriz de dependências: `matriz[linha][coluna] = CelulaModelo`. */
export type MatrizModelo = Map<number, Map<number, CelulaModelo>>;

export type AbaEspelho = {
  nome: string;
  /** Linhas do modelo que possuem ao menos uma fórmula própria. */
  linhasComFormula: number;
  /** Células com fórmula copiadas linha a linha (uma entrada por célula). */
  celulas: CelulaModelo[];
};

export type ResumoEspelho = {
  abas: AbaEspelho[];
  /** Total de células com fórmula copiadas (não é "regra geral"). */
  totalFormulas: number;
  /** Total de linhas que receberam ao menos uma fórmula própria. */
  totalLinhas: number;
};

// -----------------------------------------------------------------------------
// Referências de célula
// -----------------------------------------------------------------------------

/** Letra da coluna a partir do índice 1-based (1 → A, 27 → AA). */
export function letraColuna(indice: number): string {
  let n = indice;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Desloca as referências de linha de uma fórmula, preservando tudo o mais:
 * funções, textos entre aspas, referências absolutas ($A$2), faixas e sinais.
 * Usado APENAS quando a célula destino está em outra linha que a fonte —
 * jamais para transformar a fórmula em regra geral.
 */
export function deslocarLinhas(formula: string, delta: number): string {
  if (delta === 0) return formula;
  let out = "";
  let i = 0;
  while (i < formula.length) {
    const ch = formula[i];
    // texto literal entre aspas: copiado sem qualquer alteração
    if (ch === '"' || ch === "'") {
      const fim = formula.indexOf(ch, i + 1);
      const corte = fim === -1 ? formula.length : fim + 1;
      out += formula.slice(i, corte);
      i = corte;
      continue;
    }
    const resto = formula.slice(i);
    const m = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})/.exec(resto);
    if (m) {
      const anterior = i > 0 ? formula[i - 1] : "";
      const seguinte = formula[i + m[0].length] ?? "";
      const nomeDeFuncao = seguinte === "(";
      const parteDeIdentificador = /[A-Za-z0-9_.$]/.test(anterior);
      if (!nomeDeFuncao && !parteDeIdentificador) {
        const linhaFixa = m[3] === "$";
        const linha = linhaFixa ? Number(m[4]) : Number(m[4]) + delta;
        out += `${m[1]}${m[2]}${m[3]}${Math.max(1, linha)}`;
        i += m[0].length;
        continue;
      }
      out += m[0];
      i += m[0].length;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** Colunas referenciadas por uma fórmula — dependências daquela célula. */
export function dependenciasDaFormula(formula: string): string[] {
  const encontradas = new Set<string>();
  const re = /(^|[^A-Za-z0-9_.$])(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(formula))) {
    const seguinte = formula[m.index + m[0].length] ?? "";
    if (seguinte === "(") continue;
    encontradas.add(m[3].toUpperCase());
  }
  return Array.from(encontradas);
}

// -----------------------------------------------------------------------------
// Leitura da matriz (linha × coluna) — nada é deduzido
// -----------------------------------------------------------------------------

function ehFormula(v: unknown): string {
  return v && typeof v === "object" && "formula" in (v as any)
    ? String((v as any).formula ?? "")
    : "";
}

function ehValorFixo(v: unknown): boolean {
  if (v == null || v === "") return false;
  if (typeof v === "object") return false;
  return String(v).trim() !== "";
}

/**
 * Monta a matriz de dependências de uma aba: para CADA linha e CADA coluna,
 * registra a fórmula exata daquela célula ou marca o valor como fixo.
 */
export function lerMatrizDaAba(ws: any): { matriz: MatrizModelo; celulas: CelulaModelo[] } {
  const matriz: MatrizModelo = new Map();
  const celulas: CelulaModelo[] = [];

  ws.eachRow({ includeEmpty: false }, (row: any, linha: number) => {
    const daLinha = new Map<number, CelulaModelo>();
    row.eachCell({ includeEmpty: false }, (cell: any, coluna: number) => {
      const f = ehFormula(cell.value);
      if (f) {
        const item: CelulaModelo = {
          linha,
          coluna,
          letra: letraColuna(coluna),
          tipo: "formula",
          formula: f,
          dependencias: dependenciasDaFormula(f),
        };
        daLinha.set(coluna, item);
        celulas.push(item);
        return;
      }
      if (ehValorFixo(cell.value)) {
        daLinha.set(coluna, {
          linha,
          coluna,
          letra: letraColuna(coluna),
          tipo: "fixo",
          formula: "",
          dependencias: [],
        });
      }
    });
    if (daLinha.size) matriz.set(linha, daLinha);
  });

  return { matriz, celulas };
}

/**
 * Aplica a matriz na própria aba: cada célula com fórmula recebe de volta a
 * fórmula EXATA da sua linha; células de valor fixo não são tocadas.
 * Nenhuma fórmula é criada em linha que não a tinha no modelo.
 */
export function aplicarMatrizNaAba(ws: any, matriz: MatrizModelo): number {
  let linhasAfetadas = 0;
  for (const [linha, colunas] of matriz) {
    let tocou = false;
    const row = ws.getRow(linha);
    for (const [coluna, item] of colunas) {
      if (item.tipo !== "formula") continue; // valor fixo permanece fixo
      const destino = row.getCell(coluna);
      destino.value = { formula: item.formula } as any;
      tocou = true;
    }
    if (tocou) {
      row.commit?.();
      linhasAfetadas += 1;
    }
  }
  return linhasAfetadas;
}

// -----------------------------------------------------------------------------
// Motor
// -----------------------------------------------------------------------------

/**
 * Abre o arquivo, lê a matriz linha × coluna e devolve um novo .xlsx com a
 * MESMA estrutura, ordem, cabeçalhos e formatação — com a fórmula de cada
 * célula preservada exatamente como está no modelo (fórmulas ativas).
 */
export async function gerarPlanilhaEspelho(
  buffer: ArrayBuffer,
): Promise<{ blob: Blob; resumo: ResumoEspelho }> {
  const ExcelJS = (await import("exceljs")).default ?? (await import("exceljs"));
  const wb = new (ExcelJS as any).Workbook();
  await wb.xlsx.load(buffer);

  const abas: AbaEspelho[] = [];
  let totalFormulas = 0;
  let totalLinhas = 0;

  wb.eachSheet((ws: any) => {
    const { matriz, celulas } = lerMatrizDaAba(ws);
    const linhas = aplicarMatrizNaAba(ws, matriz);
    totalFormulas += celulas.length;
    totalLinhas += linhas;
    abas.push({ nome: ws.name, linhasComFormula: linhas, celulas });
  });

  // Excel/LibreOffice recalculam tudo ao abrir: as fórmulas ficam ATIVAS.
  wb.calcProperties = { ...(wb.calcProperties ?? {}), fullCalcOnLoad: true };

  const saida = await wb.xlsx.writeBuffer();
  const blob = new Blob([saida as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return { blob, resumo: { abas, totalFormulas, totalLinhas } };
}
