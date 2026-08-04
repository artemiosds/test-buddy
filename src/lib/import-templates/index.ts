// Registro de templates de importação (padrão Strategy).
// Para adicionar um modelo novo: crie `calculators/<nome>Calculator.ts` e
// registre a config aqui. Nada mais precisa ser alterado no assistente.

import { UBS_SAUDE } from "./calculators/ubsCalculator";
import { HMO_SAUDE } from "./calculators/hmoCalculator";
import { HMSDS_SAUDE } from "./calculators/hmsdsCalculator";
import { CAPS_SAUDE } from "./calculators/capsCalculator";
import { PADRAO_ADM } from "./calculators/padraoAdmCalculator";
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
export {
  HMO_SAUDE,
  calcularHmo,
  montarPlanilhaHmo,
  COLUNAS_SAIDA_HMO,
  ABA_HMO,
} from "./calculators/hmoCalculator";
export {
  HMSDS_SAUDE,
  calcularHmsds,
  montarPlanilhaHmsds,
  COLUNAS_SAIDA_HMSDS,
  ABA_HMSDS,
} from "./calculators/hmsdsCalculator";
export {
  CAPS_SAUDE,
  calcularCaps,
  montarPlanilhaCaps,
  COLUNAS_SAIDA_CAPS,
  ABA_CAPS,
} from "./calculators/capsCalculator";
export {
  PADRAO_ADM,
  calcularPadraoAdm,
  montarPlanilhaPadraoAdm,
  COLUNAS_SAIDA_PADRAO_ADM,
  ABA_PADRAO_ADM,
} from "./calculators/padraoAdmCalculator";

// Modelos mais específicos devem vir primeiro. H.M.S.D.S e H.M.O compartilham
// quase todos os cabeçalhos básicos da UBS; o H.M.S.D.S é o mais específico
// (plantão + pensão alimentícia). PADRAO_ADM é o genérico e fica por último.
export const IMPORT_TEMPLATES: ImportTemplateConfig[] = [
  HMSDS_SAUDE,
  HMO_SAUDE,
  CAPS_SAUDE,
  UBS_SAUDE,
  PADRAO_ADM,
];



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
    // RegExp com flag global/sticky mantém estado entre chamadas de test().
    template.filePattern.lastIndex = 0;
    const casouNome = template.filePattern.test(nomeArquivo);
    const esperados = template.cabecalhosEsperados.map(normalizarCabecalho);
    const encontrados = esperados.filter((h) =>
      [...normalizados].some((n) => n === h || n.includes(h)),
    );
    const aderencia = esperados.length ? encontrados.length / esperados.length : 0;
    const confiante = casouNome ? aderencia >= 0.5 : aderencia >= 0.9;
    if (!confiante) continue;
    const cand: DeteccaoTemplate = { template, aderencia, casouNome };
    const especificidade = template.cabecalhosEsperados.length;
    const melhorEspecificidade = melhor?.template.cabecalhosEsperados.length ?? 0;
    if (
      !melhor ||
      Number(cand.casouNome) - Number(melhor.casouNome) > 0 ||
      (cand.casouNome === melhor.casouNome && cand.aderencia > melhor.aderencia) ||
      (cand.casouNome === melhor.casouNome &&
        cand.aderencia === melhor.aderencia &&
        especificidade > melhorEspecificidade)
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
