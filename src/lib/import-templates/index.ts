// Registro de templates de importação (padrão Strategy).
// Para adicionar um modelo novo: crie `calculators/<nome>Calculator.ts` e
// registre a config aqui. Nada mais precisa ser alterado no assistente.

import { UBS_SAUDE } from "./calculators/ubsCalculator";
import {
  normalizarCabecalho,
  type ImportTemplateConfig,
  type LinhaCalculavel,
} from "./types";

export * from "./types";
export {
  UBS_SAUDE,
  calcularUbs,
  montarPlanilhaUbs,
  COLUNAS_SAIDA_UBS,
  ISS_ALIQUOTA,
} from "./calculators/ubsCalculator";

export const IMPORT_TEMPLATES: ImportTemplateConfig[] = [UBS_SAUDE];

export type DeteccaoTemplate = {
  template: ImportTemplateConfig;
  /** 0..1 — proporção dos cabeçalhos esperados presentes no arquivo. */
  aderencia: number;
  casouNome: boolean;
};

/**
 * Detecta o template pelo nome do arquivo e/ou pelos cabeçalhos lidos.
 * Retorna `null` quando nenhum template atinge confiança mínima.
 */
export function detectarTemplate(
  nomeArquivo: string,
  cabecalhos: string[],
): DeteccaoTemplate | null {
  const normalizados = new Set(cabecalhos.map(normalizarCabecalho).filter(Boolean));
  let melhor: DeteccaoTemplate | null = null;

  for (const template of IMPORT_TEMPLATES) {
    const casouNome = template.filePattern.test(nomeArquivo);
    const esperados = template.cabecalhosEsperados.map(normalizarCabecalho);
    const encontrados = esperados.filter((h) =>
      [...normalizados].some((n) => n === h || n.includes(h)),
    );
    const aderencia = esperados.length ? encontrados.length / esperados.length : 0;
    const confiante = casouNome ? aderencia >= 0.5 : aderencia >= 0.9;
    if (!confiante) continue;
    const cand: DeteccaoTemplate = { template, aderencia, casouNome };
    if (
      !melhor ||
      Number(cand.casouNome) - Number(melhor.casouNome) > 0 ||
      (cand.casouNome === melhor.casouNome && cand.aderencia > melhor.aderencia)
    ) {
      melhor = cand;
    }
  }
  return melhor;
}

/** Aplica as regras do template em todas as linhas resolvidas. */
export function aplicarTemplate<T extends LinhaCalculavel>(
  template: ImportTemplateConfig,
  linhas: T[],
): T[] {
  return linhas.map((l) => template.calculationRules(l) as T);
}
