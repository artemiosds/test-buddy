import { describe, expect, it } from "vitest";
import { detalheFalhaPiso, extracaoLocalApta, falhaEtapaPiso } from "./piso-conferencia-diagnostico";
import type { FopagExtracao } from "./piso-fopag-parser";

const extracao = (patch: Partial<FopagExtracao> = {}): FopagExtracao => ({
  funcionarios: [{ cpf: "52998224725", divergencias: [] }],
  cpfInvalido: 0, comDivergencia: 0, rubricasNaoReconhecidas: [],
  ...patch,
} as FopagExtracao);

describe("diagnóstico seguro do Piso da Enfermagem", () => {
  it("usa leitura local quando o PDF contém profissionais e não há inconsistências", () => {
    expect(extracaoLocalApta(extracao())).toBe(true);
  });
  it("não considera documento complementar vazio como extração concluída", () => {
    expect(extracaoLocalApta(extracao({ funcionarios: [] }))).toBe(false);
  });
  it("não aceita automaticamente CPF inválido, divergências ou rubricas desconhecidas", () => {
    expect(extracaoLocalApta(extracao({ cpfInvalido: 1 }))).toBe(false);
    expect(extracaoLocalApta(extracao({ comDivergencia: 1 }))).toBe(false);
    expect(extracaoLocalApta(extracao({ rubricasNaoReconhecidas: ["RUBRICA X"] }))).toBe(false);
  });
  it("mostra erro serializado de provedor sem substituí-lo pela mensagem genérica", () => {
    expect(detalheFalhaPiso({ message: "Limite de IA atingido (429)" })).toContain("429");
    expect(detalheFalhaPiso({ error: { message: "Falha na autenticação" } })).toContain("autenticação");
  });
  it("identifica arquivo e etapa de cada falha", () => {
    expect(falhaEtapaPiso('PDF "CARLOS BETA.pdf" — leitura por IA', { message: "timeout" }).message)
      .toContain('CARLOS BETA.pdf" — leitura por IA: timeout');
    expect(falhaEtapaPiso('Prestadores "UBS.xlsx"', "Formato não reconhecido").message)
      .toContain('UBS.xlsx": Formato não reconhecido');
  });
});
