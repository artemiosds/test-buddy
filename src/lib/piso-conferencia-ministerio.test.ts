import { describe, expect, it } from "vitest";
import * as XL from "xlsx-js-style";
import {
  auditarPiso, extrairFopagPlanilha, extrairPrestadores, exportarPisoConferido,
  type PendenciaPiso,
} from "./piso-conferencia-ministerio";

function livro(nome: string, rows: unknown[][]) {
  const wb = XL.utils.book_new();
  XL.utils.book_append_sheet(wb, XL.utils.aoa_to_sheet(rows), nome);
  return wb;
}
const cpf1 = "01234567890";
const cpf2 = "09876543210";
const fopag = () => livro("CALCULO_PISO_ENFERMAGEM", [
  ["CALCULO PISO ENFERMAGEM - Competência 09/2026"],
  [],
  [],
  ["CPF", "NOME DO PROFISSIONAL", "AUX. FINANC.", "TEMPO DE SERV.", "INSALUBRIDADE",
   "1/3 FÉRIAS", "FÉRIAS NORMAS", "HR. EX. 50%", "HR. EX.100%", "PLANTÃO",
   "SOBREAVISOS", "VALE TRANSP.", "GRAT. FUN VR", "GRAT. FUN %VB",
   "GRAT. NIVEL SUP.", "INCENTIVOS", "AUX. FIN. PISO", "TOTAL  POSITIVOS",
   "INSS", "IRRF", "TOTAL DESCONTO", "ADN"],
  [cpf1, "PROFISSIONAL FOPAG", 100, 20, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
   null, 30, 10, null, 15],
]);
const prest = () => livro("CONSOLIDADO_GERAL", [
  ["PRESTADORES DE SERVIÇO - Competência 09/2026"],
  [], [], ["UNIDADE", "NOME", "C.P.F.", "CARGO", "DIAS", "BASE", "INSALUBRIDADE",
    "H.E.", "AD.NOTURNO", "PLANTÃO", "BRUTO", "ISS (5%)", "INCENTIVO",
    "GRAT. INCENTIVO", "AUX. TRANSP.", "TOTAL FINAL"],
  ["UBS", "PROFISSIONAL UBS", cpf2, "ENFERMEIRO", 30, 3000, 500, 200, 100, 0,
   null, null, 2068.79, 50, 20, null],
]);
const ministerio = (id2 = cpf2) => livro("PisoEnfermagem", [
  ["CPF PROFISSIONAL", "CNES EMPREGADOR", "CBO", "JORNADA SEMANAL (CARGA HORARIA)",
   "SALÁRIO BASE (MENSAL)", "INSALUBRIDADE", "ADICIONAL NOTURNO", "ENCARGO PATRONAL",
   "ENCARGO TRABALHISTA", "VANTAGEM FIXA (VFPG)", "VANTAGEM VARIÁVEL (VPVT)"],
  [cpf1, "0123456", "322230", 40, 1600, 320, null, 250, null, null, null],
  [id2, "0999888", "223565", 40, 3000, 500, null, 480, null, null, null],
]);

describe("conciliação do modelo original do Ministério", () => {
  function analisar(modelo = ministerio(), competencia = "2026-09") {
    const pendencias: PendenciaPiso[] = [];
    const f = extrairFopagPlanilha(fopag(), pendencias);
    const p = extrairPrestadores(prest(), pendencias);
    const resultado = auditarPiso({ fopag: f.fontes, prestadores: p.fontes,
      modelo, competencia, competenciaFopag: f.competencia,
      competenciaPrestadores: p.competencia, pendencias });
    return { resultado, modelo };
  }

  it("cruza por CPF e calcula G, I e K em centavos", () => {
    const { resultado } = analisar();
    expect(resultado.pendencias.filter(p => p.tipo === "bloqueio")).toHaveLength(0);
    expect(resultado.encontrados).toBe(2);
    expect(resultado.valores.get(2)).toEqual({ g: 15, i: 40, k: 170 });
    // UBS: HE + incentivo + gratificação + auxílio transporte.
    expect(resultado.valores.get(3)).toEqual({ g: 100, i: 190, k: 2338.79 });
  });

  it("preserva CPF, CNES, CBO, base e encargo patronal do modelo", () => {
    const { resultado, modelo } = analisar();
    const antes = ["A2", "B2", "C2", "D2", "E2", "F2", "H2", "J2"]
      .map(addr => modelo.Sheets.PisoEnfermagem[addr]?.v);
    const bytes = exportarPisoConferido(modelo, resultado);
    expect(bytes.byteLength).toBeGreaterThan(1000);
    const depois = ["A2", "B2", "C2", "D2", "E2", "F2", "H2", "J2"]
      .map(addr => modelo.Sheets.PisoEnfermagem[addr]?.v);
    expect(depois).toEqual(antes);
    expect(modelo.Sheets.PisoEnfermagem.G2.v).toBe(15);
    expect(modelo.Sheets.PisoEnfermagem.I3.v).toBe(190);
  });

  it("bloqueia competência divergente e não escreve o modelo", () => {
    const { resultado, modelo } = analisar(ministerio(), "2026-08");
    expect(resultado.pendencias.some(p => p.mensagem.includes("mas foi escolhida"))).toBe(true);
    expect(() => exportarPisoConferido(modelo, resultado)).toThrow(/Pendências/);
  });

  it("bloqueia CPF ausente em vez de fazer correspondência por nome", () => {
    const { resultado, modelo } = analisar(ministerio("09999999999"));
    expect(resultado.pendencias.some(p => p.mensagem.includes("sem correspondência"))).toBe(true);
    expect(() => exportarPisoConferido(modelo, resultado)).toThrow();
  });
});
