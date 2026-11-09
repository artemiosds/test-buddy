import type { FopagExtracao } from "./piso-fopag-parser";

/** Só reutiliza o texto local quando há profissionais e nenhuma inconsistência reconhecida. */
export function extracaoLocalApta(extracao: FopagExtracao | null | undefined): extracao is FopagExtracao {
  return Boolean(extracao &&
    extracao.funcionarios.length > 0 &&
    extracao.cpfInvalido === 0 &&
    extracao.comDivergencia === 0 &&
    extracao.rubricasNaoReconhecidas.length === 0 &&
    extracao.funcionarios.every(f => f.cpf && f.divergencias.length === 0));
}

/** Erros de server functions podem chegar como objetos serializados, não Error. */
export function detalheFalhaPiso(erro: unknown): string {
  if (erro instanceof Error && erro.message.trim()) return erro.message.trim();
  if (typeof erro === "string" && erro.trim()) return erro.trim();
  if (erro && typeof erro === "object") {
    const obj = erro as Record<string, unknown>;
    for (const campo of ["message", "mensagem", "error", "detail"]) {
      const detalhe = obj[campo];
      if (typeof detalhe === "string" && detalhe.trim()) return detalhe.trim();
      if (detalhe && typeof detalhe === "object" && "message" in detalhe &&
        typeof (detalhe as { message?: unknown }).message === "string") {
        return (detalhe as { message: string }).message;
      }
    }
  }
  return "Falha inesperada na leitura. Confira a conexão, o arquivo e o provedor de IA.";
}

export function falhaEtapaPiso(etapa: string, erro: unknown): Error {
  return new Error(`${etapa}: ${detalheFalhaPiso(erro)}`);
}
