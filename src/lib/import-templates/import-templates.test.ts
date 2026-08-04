import { describe, expect, it } from "vitest";
import { calcularUbs } from "./calculators/ubsCalculator";
import { detectarTemplate, cpfFormatado, numero } from "./index";
import { calcularHmsds, montarPlanilhaHmsds } from "./calculators/hmsdsCalculator";
import { calcularCaps, montarPlanilhaCaps } from "./calculators/capsCalculator";
import { calcularPadraoAdm, montarPlanilhaPadraoAdm } from "./calculators/padraoAdmCalculator";

describe("template UBS", () => {
  it("aplica a matemática do modelo", () => {
    const r = calcularUbs({
      nome: "  maria  silva ",
      cpf: "123.456.789-09",
      cargo: "enfermeira",
      salario_base: "4.654,80",
      insalubridade: 517.2,
      hora_extra_50: 100,
      adicional_noturno: 0,
      gratificacao: 200,
      vale_transporte: 50,
      auxilio_financeiro: 30,
    });
    expect(r.total_proventos).toBe(5272);
    expect(r.total_descontos).toBe(263.6);
    expect(r.valor_liquido).toBe(5008.4);
    expect(r.valor_final).toBe(380);
    expect(r.nome).toBe("MARIA SILVA");
    expect(r.cpf).toBe("12345678909");
  });

  it("aplica insalubridade fixa e incentivo dos enfermeiros", () => {
    const r = calcularUbs({ nome: "x", cargo: "ENFERMEIRA", salario_base: 4654.78 });
    expect(r.insalubridade).toBe(517.2);
    expect(r.incentivo).toBe(2068.79);
    expect(r.total_proventos).toBeCloseTo(5171.98, 2);
  });

  it("aplica insalubridade 20% e sem incentivo para técnicos", () => {
    const r = calcularUbs({ nome: "y", cargo: "TEC. EM ENFERMAGEM", salario_base: 1621 });
    expect(r.insalubridade).toBe(324.2);
    expect(r.incentivo).toBe(0);
  });


  it("detecta pelo nome do arquivo e cabeçalhos", () => {
    const det = detectarTemplate("SAUDE - UBS'S.xlsx", [
      "NOME",
      "C.P.F.",
      "LOTAÇÃO",
      "CARGO",
      "BASE",
    ]);
    expect(det?.template.id).toBe("UBS_SAUDE");
  });

  it("prioriza H.M.O quando os cabeçalhos básicos também servem para UBS", () => {
    const det = detectarTemplate("SAUDE - H.M.O.xlsx", [
      "NOME",
      "C.P.F.",
      "LOTAÇÃO",
      "CARGO",
      "PLANTÃO E SOBREAVISO",
      "BRUTO",
      "ISS",
      "INCENTIVO",
      "TOTAL",
    ]);
    expect(det?.template.id).toBe("HMO_SAUDE");
  });

  it("não detecta arquivo alheio", () => {
    expect(detectarTemplate("educacao.xlsx", ["ALGO", "OUTRO"])).toBeNull();
  });

  it("formata cpf e converte números pt-BR", () => {
    expect(cpfFormatado("12345678909")).toBe("123.456.789-09");
    expect(numero("1.234,56")).toBe(1234.56);
    expect(numero("R$ 517,20")).toBe(517.2);
  });
});

describe("template H.M.S.D.S", () => {
  it("detecta pelo nome e cabeçalhos do modelo institucional", () => {
    const det = detectarTemplate("SAUDE - H.M.S.D.S.xlsx", [
      "Nº","NOME","DATA ADMISSÃO","C.P.F.","LOTAÇÃO","CARGO","DIAS","BASE",
      "INSALUBRIDADE","H.E.","AD.NOTURNO","PLANTÃI E SOBREAVISO","BRUTO","ISS",
      "TOTAL","PENSÃO ALIMENTICIA","LIQUIDO","CONTA",
    ]);
    expect(det?.template.id).toBe("HMSDS_SAUDE");
  });

  it("aplica insalubridade, incentivo e totais do modelo", () => {
    const l = calcularHmsds({
      nome: "andrea",
      cpf: "782.337.632-68",
      cargo: "ENFERMEIRA",
      unidade: "hmsds",
      dias_trabalhados: 30,
      salario_base: 4654.78,
      adicional_noturno: 827.6,
    });
    expect(l.insalubridade).toBe(517.2);
    expect(l.total_proventos).toBe(5999.58);
    expect(l.iss).toBe(299.98);
    expect(l.incentivo).toBe(2068.79);
    expect(l.valor_final).toBe(2068.79);
  });

  it("gera 16 colunas com fórmulas vivas", () => {
    const aoa = montarPlanilhaHmsds([
      calcularHmsds({ nome: "x", cargo: "TEC.EM ENFERMAGEM", salario_base: 1621 }),
    ]);
    expect(aoa[0]).toHaveLength(16);
    expect(aoa[1][6]).toEqual({ f: "F2*20%" });
    expect(aoa[1][10]).toEqual({ f: "F2+G2+H2+I2+J2" });
    expect(aoa[1][12]).toEqual({ f: "K2-L2" });
    expect(aoa[1][15]).toEqual({ f: "SUM(H2,J2,O2)" });
  });
});

describe("template CAPS", () => {
  it("detecta pelo nome do arquivo", () => {
    const det = detectarTemplate("SAUDE - CAPS.xlsx", [
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
      "BRUTO",
      "ISS",
      "LIQUIDO",
      "CONTA",
    ]);
    expect(det?.template.id).toBe("CAPS_SAUDE");
  });

  it("calcula bruto sem ad. noturno e plantão", () => {
    const r = calcularCaps({ nome: "z", cargo: "TEC.ENFERMAGEM", salario_base: 1621, hora_extra_50: 0 });
    expect(r.insalubridade).toBe(324.2);
    expect(r.total_proventos).toBe(1945.2);
    expect(r.total_descontos).toBe(97.26);
    expect(r.total_liquido_base).toBe(1847.94);
  });

  it("gera 13 colunas com fórmulas vivas", () => {
    const aoa = montarPlanilhaCaps([
      calcularCaps({ nome: "a", cargo: "ENFERMEIRA", salario_base: 4654.78, hora_extra_50: 608.3 }),
    ]);
    expect(aoa[0]).toHaveLength(13);
    expect(aoa[1][8]).toEqual({ f: "F2+G2+H2" });
    expect(aoa[1][9]).toEqual({ f: "I2*5%" });
    expect(aoa[1][10]).toEqual({ f: "I2-J2" });
    expect(aoa[1][12]).toEqual({ f: "SUM(H2,L2)" });
  });
});

describe("template PADRAO ADM (CER)", () => {
  it("detecta pelo nome do arquivo CER e pelo alias PADRAO ADM", () => {
    const cab = [
      "NOME","C.P.F.","LOTAÇÃO","CARGO","DIAS","BASE","INSALUBRIDADE","H.E.",
      "AD.NOTURNO","BRUTO","ISS","INCENTIVO","TOTAL",
    ];
    expect(detectarTemplate("SAUDE - CENTRO ESPECIALIZADO -CER.xlsx", cab)?.template.id).toBe("PADRAO_ADM");
    expect(detectarTemplate("PADRAO ADM - unidade nova.xlsx", cab)?.template.id).toBe("PADRAO_ADM");
  });

  it("calcula bruto com ad. noturno e total = H.E. + incentivo", () => {
    const r = calcularPadraoAdm({
      nome: "artemio",
      cargo: "ENFERMEIRO",
      salario_base: 4654.78,
      hora_extra_50: 1206.8,
    });
    expect(r.insalubridade).toBe(517.2);
    expect(r.total_proventos).toBe(6378.78);
    expect(r.incentivo).toBe(2068.79);
    expect(r.valor_final).toBe(3275.59);
  });

  it("gera 13 colunas com fórmulas vivas", () => {
    const aoa = montarPlanilhaPadraoAdm([
      calcularPadraoAdm({ nome: "b", cargo: "TEC. EM ENFERMAGEM", salario_base: 1621 }),
    ]);
    expect(aoa[0]).toHaveLength(13);
    expect(aoa[1][6]).toEqual({ f: "F2*20%" });
    expect(aoa[1][9]).toEqual({ f: "F2+G2+H2+I2" });
    expect(aoa[1][10]).toEqual({ f: "J2*5%" });
    expect(aoa[1][12]).toEqual({ f: "SUM(H2,L2)" });
  });
});
