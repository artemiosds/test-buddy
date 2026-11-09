/** Resume ações da competência sem alterar folhas e sem supor que setor equivale à Geral. */
import { unidadesQuePrecisamEnviar } from "./cobranca-folhas";
export type LinhaComando = { id: string; unidade_id: string; tipo: string; setor_id: string | null; status: string };
export type ResumoUnidade = { unidadeId: string; pendente: boolean; correcao: boolean; paraAprovacao: boolean; folhas: number };
export type ResumoComando = { unidades: number; pendentes: number; emCorrecao: number; prontasAprovacao: number; concluidas: number; porUnidade: ResumoUnidade[] };

const CORRECOES = new Set(["devolvida", "rejeitada", "com_pendencias"]);
const AGUARDANDO_APROVACAO = new Set(["enviada", "em_analise"]);

/** Com Geral presente, suas informações oficiais prevalecem sobre setores. */
export function resumirComando(unidadeIds: readonly string[], folhas: readonly LinhaComando[]): ResumoComando {
  const idSet = new Set(unidadeIds);
  const gerais = new Set(folhas.filter(f => !f.setor_id).map(f => f.unidade_id + ":" + f.tipo));
  const oficiais = folhas.filter(f =>
    idSet.has(f.unidade_id) && (!f.setor_id || !gerais.has(f.unidade_id + ":" + f.tipo))
  );
  const pendentes = unidadesQuePrecisamEnviar(unidadeIds, oficiais.map(f => ({
    unidadeId: f.unidade_id, status: f.status,
  })));
  const porUnidade = unidadeIds.map(unidadeId => {
    const linhas = oficiais.filter(f => f.unidade_id === unidadeId);
    return {
      unidadeId,
      pendente: pendentes.has(unidadeId),
      correcao: linhas.some(f => CORRECOES.has(f.status)),
      paraAprovacao: linhas.some(f => AGUARDANDO_APROVACAO.has(f.status)),
      folhas: linhas.length,
    };
  });
  return {
    unidades: unidadeIds.length,
    pendentes: porUnidade.filter(u => u.pendente).length,
    emCorrecao: porUnidade.filter(u => u.correcao).length,
    prontasAprovacao: porUnidade.filter(u => u.paraAprovacao).length,
    concluidas: porUnidade.filter(u => !u.pendente).length,
    porUnidade,
  };
}
