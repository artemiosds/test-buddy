import type { CategoriaPiso } from "./piso-categorias";

/**
 * Memória de cálculo do Piso Nacional da Enfermagem.
 *
 * Valor de referência (piso legal) proporcional à carga horária contratada.
 * Base legal: jornada de 44h semanais.
 */

/**
 * Jornada base legal usada apenas quando a competência não define a sua.
 * NÃO há valores de piso fixos no código: os valores de referência vêm
 * exclusivamente da Tabela de Referência (piso_referencia), por competência
 * e categoria, administrada pelo usuário autorizado.
 */
export const PISO_JORNADA_BASE = 44;


export type EntradaCalculo = {
  categoria: CategoriaPiso | null;
  cargaHoraria?: number | null;
  salarioBase?: number | null;
  insalubridade?: number | null;
  /** Valor de complementação informado pela planilha importada. */
  auxilioImportado?: number | null;
  /** Valor de referência vindo da tabela parametrizável (competência/categoria). */
  valorReferenciaBase?: number | null;
  /** Jornada base da tabela parametrizável (padrão 44h). */
  jornadaBase?: number | null;
};

export type MemoriaCalculo = {
  salarioBase: number;
  insalubridade: number;
  baseConsiderada: number;
  valorReferencia: number;
  complementacao: number;
  totalRemuneracao: number;
  auxilioImportado: number | null;
  divergencia: boolean;
  diferenca: number;
  /** false quando a competência/categoria ainda não tem valor cadastrado. */
  referenciaConfigurada: boolean;
};

/**
 * Valor de referência proporcional à carga horária.
 * Sem valor cadastrado na Tabela de Referência, retorna 0 (nunca "chuta").
 */
export function valorReferencia(
  categoria: CategoriaPiso | null,
  cargaHoraria?: number | null,
  valorIntegral?: number | null,
  jornadaBase?: number | null,
): number {
  if (!categoria) return 0;
  if (!valorIntegral || valorIntegral <= 0) return 0;
  const base = jornadaBase && jornadaBase > 0 ? jornadaBase : PISO_JORNADA_BASE;
  const ch = cargaHoraria && cargaHoraria > 0 ? cargaHoraria : base;
  const proporcional = (valorIntegral * Math.min(ch, base)) / base;
  return Math.round(proporcional * 100) / 100;
}

export function calcularPiso(e: EntradaCalculo): MemoriaCalculo {
  const salarioBase = e.salarioBase ?? 0;
  const insalubridade = e.insalubridade ?? 0;
  const baseConsiderada = round2(salarioBase + insalubridade);
  const referenciaConfigurada = !!(
    e.categoria &&
    e.valorReferenciaBase &&
    e.valorReferenciaBase > 0
  );
  const ref = valorReferencia(e.categoria, e.cargaHoraria, e.valorReferenciaBase, e.jornadaBase);
  const complementacao = referenciaConfigurada ? round2(Math.max(0, ref - baseConsiderada)) : 0;
  const totalRemuneracao = round2(baseConsiderada + complementacao);
  const auxilioImportado = e.auxilioImportado ?? null;
  const diferenca =
    auxilioImportado == null ? 0 : round2(Math.abs(auxilioImportado - complementacao));
  return {
    salarioBase,
    insalubridade,
    baseConsiderada,
    valorReferencia: ref,
    complementacao,
    totalRemuneracao,
    auxilioImportado,
    divergencia: referenciaConfigurada && auxilioImportado != null && diferenca > 0.01,
    diferenca,
    referenciaConfigurada,
  };
}


function round2(n: number) {
  return Math.round(n * 100) / 100;
}
