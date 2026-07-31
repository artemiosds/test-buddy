// =============================================================================
// GERAÇÃO PELO MODELO SALVO (100% no navegador).
//
// Em vez do gerador fixo antigo (colunas escritas em código), as linhas
// consolidadas do mês são escritas numa pasta de trabalho temporária com os
// MESMOS títulos de coluna do modelo salvo, e o motor de clone copia célula a
// célula a receita do modelo (fórmula ou valor fixo). Resultado: a planilha
// baixada nas Importações sai idêntica à do modelo (ex.: "UBS").
// =============================================================================

import { chaveColuna, clonarPlanilhaModelo, type ResumoClone } from "./planilha-clone";
import type { LinhaPlanilha } from "./piso-planilha";

/** Título de coluna (normalizado) → campo da linha consolidada. */
const CAMPO_POR_COLUNA: Record<string, keyof LinhaPlanilha> = {
  NOME: "nome",
  NOMEDOPRESTADOR: "nome",
  PRESTADOR: "nome",
  CPF: "cpf",
  LOTACAO: "lotacao",
  UNIDADE: "lotacao",
  LOCAL: "lotacao",
  CARGO: "cargo",
  FUNCAO: "cargo",
  CATEGORIA: "categoria",
  DIAS: "dias",
  BASE: "salario_base",
  VALORBASE: "salario_base",
  SALARIOBASE: "salario_base",
  INSALUBRIDADE: "insalubridade",
  INSALUB: "insalubridade",
  HE: "hora_extra",
  HORAEXTRA: "hora_extra",
  HORASEXTRAS: "hora_extra",
  HREX50: "hora_extra_50",
  HREX100: "hora_extra_100",
  ADNOTURNO: "adicional_noturno",
  ADICIONALNOTURNO: "adicional_noturno",
  ADN: "adicional_noturno",
  PLANTAOESOBREAVISO: "plantao_sobreaviso",
  PLANTAIESOBREAVISO: "plantao_sobreaviso",
  PLANTAO: "plantao",
  SOBREAVISO: "sobreaviso",
  PENSAOALIMENTICIA: "pensao_alimenticia",
  GRATINCENTIVO: "incentivo",
  INCENTIVO: "incentivo",
  INCENTIVOS: "incentivo",
  AUXTRANSP: "vale_transporte",
  VALETRANSPORTE: "vale_transporte",
  VT: "vale_transporte",
  MATRICULA: "matricula",
  VINCULO: "vinculo",
  CARGAHORARIA: "carga_horaria",
  TEMPODESERV: "tempo_servico",
  TEMPODESERVICO: "tempo_servico",
  GRATIFICACAO: "gratificacoes",
  GRATIFICACOES: "gratificacoes",
  INSS: "inss",
  IRRF: "irrf",
  CNES: "cnes",
  CBO: "cbo",
};

const COLUNAS_NUMERACAO = new Set(["N", "NO", "N0", "ITEM", "ORDEM", "SEQ"]);

/**
 * Colunas do modelo que recebem dado do mês. As demais (BRUTO, ISS, TOTAL,
 * DATA ADMISSÃO, GRAT.INCENTIVO quando não consolidada...) ficam de fora para
 * que o clone preserve a fórmula ou o valor fixo do próprio modelo.
 */
export function colunasAproveitadas(colunasModelo: string[]): string[] {
  return colunasModelo.filter((t) => {
    const k = chaveColuna(t);
    return Boolean(CAMPO_POR_COLUNA[k]) || COLUNAS_NUMERACAO.has(k);
  });
}

/** Monta a planilha temporária "do mês" com os títulos do modelo. */
async function montarPlanilhaDoMes(
  colunasModelo: string[],
  linhas: LinhaPlanilha[],
): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default ?? (await import("exceljs"));
  const wb = new (ExcelJS as any).Workbook();
  const ws = wb.addWorksheet("MES");

  const usadas = colunasModelo.filter((t) => {
    const k = chaveColuna(t);
    return Boolean(CAMPO_POR_COLUNA[k]) || COLUNAS_NUMERACAO.has(k);
  });
  ws.addRow(usadas);

  linhas.forEach((linha, i) => {
    ws.addRow(
      usadas.map((t) => {
        const k = chaveColuna(t);
        if (COLUNAS_NUMERACAO.has(k)) return i + 1;
        const campo = CAMPO_POR_COLUNA[k];
        const v = campo ? (linha as Record<string, unknown>)[campo as string] : null;
        return v === undefined ? null : v;
      }),
    );
  });

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

function base64ParaArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/** Gera e baixa a planilha do mês usando o modelo salvo. */
export async function baixarPeloModeloSalvo(opts: {
  modeloBase64: string;
  colunasModelo: string[];
  linhas: LinhaPlanilha[];
  filename: string;
}): Promise<ResumoClone> {
  if (opts.linhas.length === 0) throw new Error("Nenhum profissional consolidado para gerar.");
  const bufferModelo = base64ParaArrayBuffer(opts.modeloBase64);
  const bufferMes = await montarPlanilhaDoMes(opts.colunasModelo, opts.linhas);
  const { blob, resumo } = await clonarPlanilhaModelo(bufferModelo, bufferMes);

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.filename;
  a.click();
  URL.revokeObjectURL(url);
  return resumo;
}
