import { describe, expect, it } from "vitest";
import {
  detectarCompetenciaFopag,
  janelasContinuas,
  fopagParaAoa,
  normalizarCpf,
  normalizarValor,
  parseFopagTexto,
} from "./piso-fopag-parser";

const PAGINA = `PREFEITURA MUNICIPAL - FOLHA DE PAGAMENTO JUNHO/2026
Funcionário(a): 001234 MARIA DA SILVA SOUZA   CPF: 529.982.247-25
Cargo: TEC. EM ENFERMAGEM   Lotação: HOSPITAL MUNICIPAL
Cod Descricao        Referencia   Base       Integral
1 SALARIO BASE        30,00      1.200,00    2.544,02
207 INSALUBRIDADE      20,00       500,00      254,40
61 COMPLEMENTO FINANCEIRO PISO ENFERMAGEM   0,00   0,00  1.100,50
INSS                                                  280,15
Total de Proventos                                  3.898,92
Total de Descontos                                    280,15
Total Líquido                                       3.618,77
Funcionário(a): 004321 JOAO PEREIRA LIMA   CPF: 111.444.777-35
Cargo: MOTORISTA
1 SALARIO BASE 30,00 1.500,00 1.500,00
Total Líquido 1.500,00`;

describe("piso-fopag-parser", () => {
  it("normaliza CPF e valores monetários", () => {
    expect(normalizarCpf("031.067.932-01")).toBe("03106793201");
    expect(normalizarCpf("123")).toBeNull();
    expect(normalizarValor("R$ 2.544,02")).toBe(2544.02);
    expect(normalizarValor("")).toBe(0);
  });

  it("detecta a competência em YYYY-MM", () => {
    expect(detectarCompetenciaFopag("FOLHA JUNHO/2026")).toBe("2026-06");
    expect(detectarCompetenciaFopag("competencia 06/2026")).toBe("2026-06");
  });

  it("extrai apenas profissionais da enfermagem usando a coluna Integral", () => {
    const r = parseFopagTexto([PAGINA]);
    expect(r.competencia).toBe("2026-06");
    expect(r.funcionarios).toHaveLength(1);
    expect(r.ignorados).toBe(1);
    const f = r.funcionarios[0];
    expect(f.cpf).toBe("52998224725");
    expect(f.categoria).toBe("TECNICO_ENFERMAGEM");
    expect(f.rubricas.salario_base).toBe(2544.02);
    expect(f.rubricas.insalubridade).toBe(254.4);
    expect(f.rubricas.auxilio_financeiro).toBe(1100.5);
    expect(f.rubricas.hora_extra_50).toBe(0);
    expect(f.rubricas.valor_liquido).toBe(3618.77);
  });

  it("gera AOA com cabeçalhos reconhecidos pelo motor de layouts", () => {
    const aoa = fopagParaAoa(parseFopagTexto([PAGINA]));
    expect(aoa[0]).toContain("CPF");
    expect(aoa[0]).toContain("AUXILIO FINANCEIRO");
    expect(aoa).toHaveLength(2);
  });

  it("gera janelas que só cortam onde começa um novo funcionário", () => {
    const paginas = Array.from({ length: 8 }, (_, i) =>
      i % 3 === 0 ? "Funcionário(a): 1 FULANO" : "continuação de rubricas",
    );
    expect(janelasContinuas(8, paginas, 8)).toEqual([[1, 2, 3, 4, 5, 6, 7, 8]]);
    // Blocos começam nas páginas 1, 4 e 7 — o corte cai exatamente no início de um bloco.
    expect(janelasContinuas(8, paginas, 5)).toEqual([
      [1, 2, 3],
      [4, 5, 6, 7, 8],
    ]);
    // Sem indício de início de bloco, a janela seguinte repete a última página.
    const semMarcas = janelasContinuas(6, Array(6).fill("rubricas"), 3);
    expect(semMarcas[0]).toEqual([1, 2, 3]);
    expect(semMarcas[1][0]).toBe(3);
  });
});
