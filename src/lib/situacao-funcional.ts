/**
 * Helpers puros de conferência gerencial — não altera cálculos nem regras
 * de negócio, apenas deriva rótulos/estatísticas para a camada de UI das
 * telas de Folha (Efetivos / Contratados) e Piso da Enfermagem.
 *
 * Todos os campos consumidos aqui já existem no cadastro do profissional
 * (`profissionais`) — este módulo não bate no banco.
 */

export type SituacaoFuncional =
  | "ativo"
  | "ferias"
  | "licenca"
  | "afastado"
  | "cedido"
  | "desligado"
  | "inativo";

/** Domínio do StatusBadge central que já cobre estes rótulos com as cores certas. */
export const SITUACAO_STATUS_DOMAIN = "profissional" as const;

export type ProfConferencia = {
  id: string;
  nome?: string | null;
  cpf?: string | null;
  cargo?: string | null;
  funcao?: string | null;
  setor?: string | null;
  banco?: string | null;
  agencia?: string | null;
  conta_corrente?: string | null;
  matricula?: string | null;
  status?: string | null;
  situacao_funcional?: string | null;
  vinculo?: string | null;
  cargo_id?: string | null;
  funcao_id?: string | null;
  setor_id?: string | null;
  unidade_id?: string | null;
  tem_pendencia?: boolean | null;
};

export type AlertaCadastral =
  | "sem_cpf"
  | "sem_cargo"
  | "sem_funcao"
  | "sem_lotacao"
  | "sem_banco"
  | "sem_agencia"
  | "sem_conta"
  | "pendencia_aberta";

export const ALERTA_LABEL: Record<AlertaCadastral, string> = {
  sem_cpf: "Sem CPF",
  sem_cargo: "Sem cargo",
  sem_funcao: "Sem função",
  sem_lotacao: "Sem lotação",
  sem_banco: "Sem banco",
  sem_agencia: "Sem agência",
  sem_conta: "Sem conta corrente",
  pendencia_aberta: "Pendência cadastral",
};

/**
 * Deriva a situação funcional a partir dos campos já existentes do
 * profissional. Preferência: `situacao_funcional` explícito; caindo para
 * `status` (que também usa os mesmos rótulos). Retorna `"ativo"` quando
 * nenhum dos dois está presente — mantém o comportamento otimista atual.
 */
export function derivarSituacao(p: ProfConferencia): SituacaoFuncional {
  const raw = (p.situacao_funcional || p.status || "ativo").toLowerCase();
  if (raw === "ferias" || raw === "férias") return "ferias";
  if (raw === "licenca" || raw === "licença") return "licenca";
  if (raw === "afastado" || raw === "cedido") return raw as SituacaoFuncional;
  if (raw === "desligado") return "desligado";
  if (raw === "inativo") return "inativo";
  return "ativo";
}

export function derivarAlertas(p: ProfConferencia): AlertaCadastral[] {
  const out: AlertaCadastral[] = [];
  if (!p.cpf || String(p.cpf).replace(/\D/g, "").length !== 11) out.push("sem_cpf");
  if (!p.cargo && !p.cargo_id) out.push("sem_cargo");
  if (!p.funcao && !p.funcao_id) out.push("sem_funcao");
  if (!p.setor && !p.setor_id && !p.unidade_id) out.push("sem_lotacao");
  if (!p.banco) out.push("sem_banco");
  if (!p.agencia) out.push("sem_agencia");
  if (!p.conta_corrente) out.push("sem_conta");
  if (p.tem_pendencia) out.push("pendencia_aberta");
  return out;
}

/** Cargos considerados elegíveis ao Piso Nacional da Enfermagem. */
const CARGOS_ENFERMAGEM = /(enfermeir|t[eé]cnic[oa]?\s+de\s+enfermagem|auxiliar\s+de\s+enfermagem|parteir)/i;

export type Elegibilidade = "elegivel" | "revisar" | "nao_elegivel";

export function derivarElegibilidadePiso(p: ProfConferencia): Elegibilidade {
  const cargo = (p.cargo ?? "").toString();
  const isEnfermagem = CARGOS_ENFERMAGEM.test(cargo);
  if (!isEnfermagem) return "nao_elegivel";
  const situ = derivarSituacao(p);
  if (situ === "desligado" || situ === "inativo") return "nao_elegivel";
  const alertas = derivarAlertas(p);
  // pequenas pendências puramente cadastrais viram "revisar" — não bloqueiam
  const bloqueadores: AlertaCadastral[] = ["sem_cpf", "sem_cargo"];
  if (alertas.some((a) => bloqueadores.includes(a))) return "revisar";
  if (situ === "ferias" || situ === "licenca" || situ === "afastado" || situ === "cedido") return "revisar";
  if (alertas.length > 0) return "revisar";
  return "elegivel";
}

export type ResumoSituacao = {
  total: number;
  ativos: number;
  ferias: number;
  licenca: number;
  afastados: number;
  desligados: number;
  pendencias: number;
  nao_elegiveis: number;
};

export function contarSituacoes(rows: ProfConferencia[]): ResumoSituacao {
  const r: ResumoSituacao = {
    total: rows.length,
    ativos: 0, ferias: 0, licenca: 0, afastados: 0, desligados: 0,
    pendencias: 0, nao_elegiveis: 0,
  };
  for (const p of rows) {
    const s = derivarSituacao(p);
    if (s === "ativo") r.ativos++;
    else if (s === "ferias") r.ferias++;
    else if (s === "licenca") r.licenca++;
    else if (s === "afastado" || s === "cedido") r.afastados++;
    else if (s === "desligado" || s === "inativo") r.desligados++;
    if (derivarAlertas(p).length > 0) r.pendencias++;
    if (derivarElegibilidadePiso(p) === "nao_elegivel") r.nao_elegiveis++;
  }
  return r;
}

export const SITUACAO_ORDER: SituacaoFuncional[] = [
  "ativo", "ferias", "licenca", "afastado", "cedido", "desligado", "inativo",
];

export const SITUACAO_LABEL: Record<SituacaoFuncional, string> = {
  ativo: "Ativo",
  ferias: "Férias",
  licenca: "Licença",
  afastado: "Afastado",
  cedido: "Cedido",
  desligado: "Desligado",
  inativo: "Inativo",
};