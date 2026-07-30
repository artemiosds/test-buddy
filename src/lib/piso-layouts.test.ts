import { describe, expect, it } from "vitest";
import {
  LAYOUT_CONTRATADOS,
  LAYOUT_EFETIVOS,
  autoMapLayout,
  detectarTipoFolha,
} from "./piso-layouts";

const HEADERS_CONTRATADOS = [
  "Nº",
  "NOME",
  "DATA ADMISSÃO",
  "C.P.F.",
  "LOTAÇÃO",
  "CARGO",
  "DIAS",
  "BASE",
  "INSALUBRIDADE",
  "H.E.",
  "AD.NOTURNO",
  "PLANTÃI E SOBREAVISO",
  "BRUTO",
  "ISS",
  "TOTAL",
  "PENSÃO ALIMENTICIA",
  "LIQUIDO",
];

const HEADERS_EFETIVOS = [
  "CPF",
  "AUX. FINANC.",
  "TEMPO DE SERV.",
  "INSALUBRIDADE",
  "1/3 FÉRIAS",
  "FÉRIAS NORMAS",
  "HR. EX. 50%",
  "HR. EX.100%",
  "PLANTÃO",
  "SOBREAVISOS",
  "VALE TRANSP.",
  "INSS",
  "IRRF",
  "TOTAL DESCONTO",
  "ADN",
];

describe("detectarTipoFolha", () => {
  it("identifica contratados pelo nome do arquivo", () => {
    expect(detectarTipoFolha("SAUDE - H.M.S.D.S.xlsx", HEADERS_CONTRATADOS)).toBe("contratados");
  });
  it("identifica efetivos pelo nome do arquivo", () => {
    expect(detectarTipoFolha("CALCULO PISO FOPAG.xlsx", HEADERS_EFETIVOS)).toBe("efetivos");
  });
  it("identifica pelos cabeçalhos quando o nome é neutro", () => {
    expect(detectarTipoFolha("folha.xlsx", HEADERS_EFETIVOS)).toBe("efetivos");
    expect(detectarTipoFolha("folha.xlsx", HEADERS_CONTRATADOS)).toBe("contratados");
  });
  it("retorna null sem pistas", () => {
    expect(detectarTipoFolha("arquivo.xlsx", ["A", "B"])).toBeNull();
  });
});

describe("autoMapLayout", () => {
  it("mapeia o layout dos contratados", () => {
    const m = autoMapLayout(HEADERS_CONTRATADOS, LAYOUT_CONTRATADOS);
    expect(m["C.P.F."]).toBe("cpf");
    expect(m["NOME"]).toBe("nome");
    expect(m["LOTAÇÃO"]).toBe("unidade");
    expect(m["BASE"]).toBe("salario_base");
    expect(m["INSALUBRIDADE"]).toBe("insalubridade");
    expect(m["H.E."]).toBe("hora_extra_50");
    expect(m["BRUTO"]).toBe("total_proventos");
    // valor_liquido é recalculado pelo sistema — nunca recebe auto-map
    expect(m["LIQUIDO"]).toBeNull();
  });

  it("mapeia o layout dos efetivos", () => {
    const m = autoMapLayout(HEADERS_EFETIVOS, LAYOUT_EFETIVOS);
    expect(m["CPF"]).toBe("cpf");
    expect(m["AUX. FINANC."]).toBe("auxilio_financeiro");
    expect(m["TEMPO DE SERV."]).toBe("tempo_servico");
    expect(m["HR. EX. 50%"]).toBe("hora_extra_50");
    expect(m["HR. EX.100%"]).toBe("hora_extra_100");
    expect(m["SOBREAVISOS"]).toBe("sobreaviso");
    expect(m["TOTAL DESCONTO"]).toBe("total_descontos");
  });

  it("não mapeia o mesmo destino duas vezes", () => {
    const m = autoMapLayout(HEADERS_EFETIVOS, LAYOUT_EFETIVOS);
    const usados = Object.values(m).filter(Boolean);
    expect(new Set(usados).size).toBe(usados.length);
  });
});
