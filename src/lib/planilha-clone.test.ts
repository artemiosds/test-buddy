import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { aplicarClone, chaveCpf, lerMapaModelo, lerRegistrosNovos } from "./planilha-clone";

async function modelo() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("UBS");
  ws.getRow(1).values = ["PAGAMENTO"];
  ws.getRow(2).values = ["Nº", "NOME", "C.P.F.", "CARGO", "BASE", "INSALUBRIDADE", "BRUTO"];
  ws.getRow(3).values = [1, "TECNICA UM", "111.111.111-11", "TEC. EM ENFERMAGEM", 1621];
  ws.getCell("F3").value = { formula: "E3*20%" } as never;
  ws.getCell("G3").value = { formula: "E3+F3" } as never;
  ws.getRow(4).values = [2, "ENFERMEIRA UM", "222.222.222-22", "ENFERMEIRA", 4654.78, 517.2];
  ws.getCell("G4").value = { formula: "E4+F4" } as never;
  return { wb, ws };
}

async function mesNovo() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("mes");
  ws.getRow(1).values = ["NOME", "C.P.F.", "CARGO", "BASE", "INSALUBRIDADE"];
  ws.getRow(2).values = ["ENFERMEIRA UM", "222.222.222-22", "ENFERMEIRA", 4654.78, 517.2];
  ws.getRow(3).values = ["TECNICA UM", "111.111.111-11", "TEC. EM ENFERMAGEM", 1700, 340];
  return ws;
}

describe("clone de planilha modelo", () => {
  it("copia a receita de cada célula, sem regra geral", async () => {
    const { ws } = await modelo();
    const mapa = lerMapaModelo(ws);
    expect(mapa.linhaCabecalho).toBe(2);
    expect(mapa.linhas).toHaveLength(2);

    const { registros } = lerRegistrosNovos(await mesNovo());
    const resumo = aplicarClone(ws, mapa, registros);
    expect(resumo.casadosPorCpf).toBe(2);

    // Teste de fogo: enfermeira mantém o valor FIXO 517,20 (não 20% da base).
    expect(ws.getCell("F3").value).toBe(517.2);
    // Coluna mista (fórmula em uma linha, valor em outra) não é estrutural:
    // o dado do mês vence a fórmula, nada é recalculado pelo sistema.
    expect(ws.getCell("F4").value).toBe(340);
    // Estrutura preservada: BRUTO é estrutural e segue calculado nas duas linhas.
    expect((ws.getCell("G3").value as { formula: string }).formula).toBe("E3+F3");
    expect((ws.getCell("G4").value as { formula: string }).formula).toBe("E4+F4");

    // Dados novos entram nas células de valor fixo.
    expect(ws.getCell("E4").value).toBe(1700);
    // Numeração sequencial da planilha gerada.
    expect(ws.getCell("A3").value).toBe(1);
    expect(ws.getCell("A4").value).toBe(2);
  });

  it("normaliza CPF para o casamento", () => {
    expect(chaveCpf("222.222.222-22")).toBe("22222222222");
  });
});
