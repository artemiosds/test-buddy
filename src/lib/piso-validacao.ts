// Validação das linhas de folha antes da importação (Piso Nacional da Enfermagem).
// Puro: sem I/O. Usado tanto pelo fluxo de Contratados quanto pelo de Efetivos.

import type { ResolvedRow } from "./piso-import";
import type { PisoDestino } from "./piso-mapping";

export type TipoIssue =
  | "cpf_ausente"
  | "cpf_invalido"
  | "cpf_duplicado"
  | "campo_obrigatorio"
  | "profissional_nao_encontrado"
  | "competencia_ausente"
  | "competencia_divergente";

export type Issue = {
  linha: number; // 1-based, relativo às linhas de dados
  tipo: TipoIssue;
  mensagem: string;
  cpf: string | null;
  nome: string | null;
  matricula: string | null;
};

export type ResumoValidacao = {
  total: number;
  validas: number;
  comProblema: number;
  bloqueantes: number;
  duplicados: number;
  semCpf: number;
  cpfInvalido: number;
  naoLocalizados: number;
  competenciaDivergente: number;
};

/** Validação de dígitos verificadores do CPF (aceita apenas 11 dígitos). */
export function isCpfValido(valor: string | null | undefined): boolean {
  const cpf = String(valor ?? "").replace(/\D+/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (base: number) => {
    let soma = 0;
    for (let i = 0; i < base; i++) soma += Number(cpf[i]) * (base + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

const LABEL: Partial<Record<PisoDestino, string>> = {
  cpf: "CPF",
  nome: "Nome",
  matricula: "Matrícula",
  competencia: "Competência",
  cargo: "Cargo",
  unidade: "Unidade",
};

/** Tipos que impedem a gravação da linha. */
const BLOQUEANTES = new Set<TipoIssue>([
  "cpf_ausente",
  "cpf_invalido",
  "cpf_duplicado",
  "campo_obrigatorio",
  "profissional_nao_encontrado",
]);

export function validarLinhas(
  rows: ResolvedRow[],
  opts: { competencia: string | null; obrigatorios: PisoDestino[] },
): { issues: Issue[]; resumo: ResumoValidacao; linhasValidas: ResolvedRow[] } {
  const issues: Issue[] = [];
  const vistos = new Map<string, number>();
  const bloqueada = new Set<number>();
  const compAlvo = (opts.competencia ?? "").trim().toLowerCase();

  rows.forEach((r, idx) => {
    const linha = idx + 1;
    const push = (tipo: TipoIssue, mensagem: string) => {
      issues.push({
        linha,
        tipo,
        mensagem,
        cpf: r.cpf,
        nome: r.nome,
        matricula: r.matricula,
      });
      if (BLOQUEANTES.has(tipo)) bloqueada.add(idx);
    };

    const cpf = (r.cpf ?? "").replace(/\D+/g, "");
    if (!cpf) push("cpf_ausente", "Linha sem CPF informado.");
    else if (!isCpfValido(cpf)) push("cpf_invalido", `CPF inválido: ${r.cpf}.`);
    else if (vistos.has(cpf)) {
      push("cpf_duplicado", `CPF repetido (também na linha ${vistos.get(cpf)}).`);
    } else vistos.set(cpf, linha);

    for (const campo of opts.obrigatorios) {
      if (campo === "cpf") continue; // já tratado acima
      const v = (r as unknown as Record<string, unknown>)[campo];
      if (v == null || v === "") {
        push("campo_obrigatorio", `Campo obrigatório ausente: ${LABEL[campo] ?? campo}.`);
      }
    }

    if (r.status_match === "nao_localizado") {
      push(
        "profissional_nao_encontrado",
        "Profissional não localizado no Cadastro (CPF → matrícula → nome).",
      );
    }

    if (!compAlvo) {
      if (linha === 1) push("competencia_ausente", "Competência não informada para a importação.");
    } else if (r.competencia && r.competencia.trim().toLowerCase() !== compAlvo) {
      push(
        "competencia_divergente",
        `Competência da linha ("${r.competencia}") difere da competência selecionada.`,
      );
    }
  });

  const conta = (t: TipoIssue) => issues.filter((i) => i.tipo === t).length;
  const linhasComProblema = new Set(issues.map((i) => i.linha));

  return {
    issues,
    linhasValidas: rows.filter((_, idx) => !bloqueada.has(idx)),
    resumo: {
      total: rows.length,
      validas: rows.length - bloqueada.size,
      comProblema: linhasComProblema.size,
      bloqueantes: bloqueada.size,
      duplicados: conta("cpf_duplicado"),
      semCpf: conta("cpf_ausente"),
      cpfInvalido: conta("cpf_invalido"),
      naoLocalizados: conta("profissional_nao_encontrado"),
      competenciaDivergente: conta("competencia_divergente"),
    },
  };
}

export const LABEL_ISSUE: Record<TipoIssue, string> = {
  cpf_ausente: "CPF inexistente",
  cpf_invalido: "CPF inválido",
  cpf_duplicado: "CPF duplicado",
  campo_obrigatorio: "Campo obrigatório ausente",
  profissional_nao_encontrado: "Profissional não encontrado",
  competencia_ausente: "Competência ausente",
  competencia_divergente: "Competência diferente",
};
