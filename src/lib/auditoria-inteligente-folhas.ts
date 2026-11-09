/**
 * Pré-auditoria de envio: somente leitura, sem alterar persistência,
 * cálculos, aprovações ou regras de bloqueio existentes.
 */
export type AuditoriaSeveridade = "aviso" | "informacao";
export type AchadoPreEnvio = {
  codigo: "DIAS_NAO_PREENCHIDOS" | "ENVIO_SETORIAL_PARCIAL" | "SETOR_SEM_ENVIO" | "SETOR_CORRECAO_PENDENTE";
  severidade: AuditoriaSeveridade;
  titulo: string;
  detalhe: string;
  quantidade: number;
};
export type ProfissionalConferencia = { id?: string; nome: string };
export type SetorConferencia = { id: string; nome: string; status: string; jaEnviado: boolean };

export function auditarPreEnvioFolha(args: {
  profissionaisSemDias?: readonly ProfissionalConferencia[];
  setoresEnvio?: readonly SetorConferencia[];
}): AchadoPreEnvio[] {
  const achados: AchadoPreEnvio[] = [];
  const profissionais = args.profissionaisSemDias ?? [];
  const setores = args.setoresEnvio ?? [];
  if (profissionais.length) {
    achados.push({
      codigo: "DIAS_NAO_PREENCHIDOS", severidade: "aviso",
      titulo: "Dias zerados ou não preenchidos",
      detalhe: "Confira os profissionais listados abaixo. Este aviso não impede o envio.",
      quantidade: profissionais.length,
    });
  }
  if (setores.length) {
    const enviados = setores.filter(s => s.jaEnviado).length;
    if (enviados && enviados < setores.length) {
      achados.push({
        codigo: "ENVIO_SETORIAL_PARCIAL", severidade: "informacao",
        titulo: "Envio setorial parcial",
        detalhe: "Os setores já enviados serão preservados; somente os pendentes seguem para envio.",
        quantidade: setores.length - enviados,
      });
    }
    const corrigir = setores.filter(s =>
      ["devolvida", "rejeitada", "com_pendencias"].includes(s.status.toLowerCase())
    );
    if (corrigir.length) {
      achados.push({
        codigo: "SETOR_CORRECAO_PENDENTE", severidade: "aviso",
        titulo: "Setores com correção pendente",
        detalhe: "Verifique os setores devolvidos ou rejeitados antes de finalizar a competência.",
        quantidade: corrigir.length,
      });
    }
    if (!enviados && setores.length) {
      achados.push({
        codigo: "SETOR_SEM_ENVIO", severidade: "informacao",
        titulo: "Setores ainda não enviados",
        detalhe: "Nenhum setor consta como enviado nesta conferência.",
        quantidade: setores.length,
      });
    }
  }
  return achados;
}

/**
 * Visão de conferência institucional a partir das folhas já carregadas.
 * Não interpreta uma folha Geral como equivalente a todas as folhas setoriais;
 * não autoriza, bloqueia nem efetua qualquer aprovação.
 */
export type LinhaAprovacaoAuditavel = {
  id: string;
  competencia_unidade_id: string;
  tipo: string;
  setor_id: string | null;
  status: string;
  total_profissionais: number | null;
};
export function auditarResumoAprovacoes(folhas: readonly LinhaAprovacaoAuditavel[]) {
  const porId = new Set<string>();
  let duplicadas = 0;
  let semProfissionais = 0;
  let aguardando = 0;
  let correcao = 0;
  for (const folha of folhas) {
    if (porId.has(folha.id)) duplicadas++;
    porId.add(folha.id);
    if (folha.total_profissionais === 0 && ["enviada", "em_analise", "aprovada"].includes(folha.status))
      semProfissionais++;
    if (["enviada", "em_analise"].includes(folha.status)) aguardando++;
    if (["devolvida", "rejeitada", "com_pendencias"].includes(folha.status)) correcao++;
  }
  return { avaliadas: folhas.length, aguardando, correcao, semProfissionais, duplicadas };
}
