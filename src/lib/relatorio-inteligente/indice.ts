/**
 * Índice Automático do Relatório (0 a 100).
 * Combina: qualidade cadastral (peso 50), volume/cobertura (20),
 * dispersão média dos blocos numéricos (15), alertas ativos (15, invertido).
 */
import type { GerencialAggregate } from "@/lib/relatorios-gerenciais-intelligence";
import type { BlockDef, Row } from "./tipos";
import { statsFor, numericFields } from "./agregacoes";

export type IndiceAutomatico = {
  score: number;
  nivel: "excelente" | "bom" | "regular" | "critico";
  componentes: { rotulo: string; peso: number; valor: number }[];
  interpretacao: string;
};

export function calcularIndice(params: {
  aggregate: GerencialAggregate;
  blocos: Array<{ block: BlockDef; rows: Row[]; fields: string[] }>;
}): IndiceAutomatico {
  const { aggregate: a, blocos } = params;

  const qualidade = a.qualidade.geral ?? 0;
  const cobertura = Math.min(100, Math.round(((a.totais.unidadesAtivas || 0) / Math.max(1, a.totais.unidades)) * 100));

  // Dispersão média (100 - CV médio, clampado).
  let cvs: number[] = [];
  for (const b of blocos) {
    for (const f of numericFields(b.rows).filter((x) => b.fields.includes(x))) {
      const s = statsFor(b.rows, f);
      if (s.media > 0) cvs.push(Math.min(200, (s.desvio / s.media) * 100));
    }
  }
  const cvMedio = cvs.length ? cvs.reduce((x, y) => x + y, 0) / cvs.length : 40;
  const dispersao = Math.max(0, Math.min(100, 100 - cvMedio));

  const alertasCriticos = a.alertas.filter((x) => x.gravidade === "vermelho").length;
  const alertasAtencao = a.alertas.filter((x) => x.gravidade === "amarelo").length;
  const penal = Math.min(100, alertasCriticos * 20 + alertasAtencao * 8);
  const saudeAlertas = 100 - penal;

  const score = Math.round(
    qualidade * 0.5 + cobertura * 0.2 + dispersao * 0.15 + saudeAlertas * 0.15,
  );

  const nivel: IndiceAutomatico["nivel"] =
    score >= 85 ? "excelente" : score >= 70 ? "bom" : score >= 55 ? "regular" : "critico";

  const interpretacao = ({
    excelente: "Cenário sólido: qualidade cadastral alta, boa cobertura, baixa dispersão e poucos alertas.",
    bom: "Cenário estável com pontos de atenção pontuais — vale acompanhar os alertas e as concentrações destacadas.",
    regular: "Requer atenção da gestão: sanear cadastros, equilibrar distribuição e mitigar alertas amarelos/vermelhos.",
    critico: "Situação crítica — priorizar saneamento cadastral, reforçar cobertura e endereçar alertas vermelhos imediatamente.",
  } as const)[nivel];

  return {
    score,
    nivel,
    componentes: [
      { rotulo: "Qualidade Cadastral", peso: 50, valor: Math.round(qualidade) },
      { rotulo: "Cobertura de Unidades Ativas", peso: 20, valor: cobertura },
      { rotulo: "Homogeneidade (dispersão)", peso: 15, valor: Math.round(dispersao) },
      { rotulo: "Saúde dos Alertas", peso: 15, valor: Math.round(saudeAlertas) },
    ],
    interpretacao,
  };
}