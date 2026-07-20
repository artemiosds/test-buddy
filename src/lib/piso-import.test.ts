import { describe, it, expect } from "vitest";
import { resolveRows, statsFrom, type MatchMaps, type Mapeamento } from "./piso-import";

describe("piso-import", () => {
  const map: Mapeamento = {
    "CPF": "cpf",
    "FUNCIONÁRIO": "nome",
    "MATRÍCULA": "matricula",
    "VENCIMENTO": "salario_base",
    "PISO": "piso_complementacao",
    "INSS": "inss",
  };
  const maps: MatchMaps = {
    byCpf: { "12345678900": "prof-1" },
    byMatricula: { "M-42": "prof-2" },
  };

  it("match por CPF tem prioridade", () => {
    const rows = [{ "CPF": "123.456.789-00", "FUNCIONÁRIO": "Ana", "MATRÍCULA": "M-99", "VENCIMENTO": "R$ 3.000,00" }];
    const out = resolveRows(rows, map, maps);
    expect(out[0].profissional_id).toBe("prof-1");
    expect(out[0].status_match).toBe("cpf");
    expect(out[0].salario_base).toBe(3000);
    expect(out[0].cpf).toBe("12345678900");
  });

  it("cai para matrícula quando CPF não bate", () => {
    const rows = [{ "CPF": "999.999.999-99", "FUNCIONÁRIO": "Beto", "MATRÍCULA": "M-42" }];
    const out = resolveRows(rows, map, maps);
    expect(out[0].profissional_id).toBe("prof-2");
    expect(out[0].status_match).toBe("matricula");
  });

  it("marca não localizado quando nada bate", () => {
    const rows = [{ "CPF": "", "FUNCIONÁRIO": "X", "MATRÍCULA": "" }];
    const out = resolveRows(rows, map, maps);
    expect(out[0].status_match).toBe("nao_localizado");
    expect(out[0].profissional_id).toBeNull();
  });

  it("statsFrom conta corretamente", () => {
    const rows = resolveRows(
      [
        { "CPF": "123.456.789-00" },
        { "MATRÍCULA": "M-42" },
        { "CPF": "" },
      ],
      map,
      maps,
    );
    const s = statsFrom(rows);
    expect(s).toEqual({ total: 3, importados: 2, divergentes: 0, nao_localizados: 1 });
  });

  it("parseia valores INSS/PISO em formato brasileiro", () => {
    const rows = [{ "CPF": "123.456.789-00", "INSS": "R$ 550,25", "PISO": "1.500,00" }];
    const out = resolveRows(rows, map, maps);
    expect(out[0].inss).toBe(550.25);
    expect(out[0].piso_complementacao).toBe(1500);
  });
});