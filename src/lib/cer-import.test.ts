import { describe, it, expect } from "vitest";
import {
  parseConta,
  detectHeaderRow,
  extractCerRows,
  fuzzyMatchUnidade,
  fuzzyMatchCargo,
  resolveDuplicate,
} from "./cer-import";

describe("cer-import > parseConta", () => {
  it("reconhece AG: / CC:", () => {
    const r = parseConta("AG: 1104-5 CC: 22.681-5");
    expect(r.status).toBe("ok");
    expect(r.agencia).toBe("1104-5");
    expect(r.conta).toBe("22.681-5");
    expect(r.banco).toBeNull();
  });
  it("reconhece AG; / CC; e banco NUBANK", () => {
    const r = parseConta("AG; 0001 CC; 87576792-7 NUBANK");
    expect(r).toMatchObject({ status: "ok", agencia: "0001", conta: "87576792-7", banco: "NUBANK" });
  });
  it("banco BB curto", () => {
    const r = parseConta("AG: 130-9 CC: 126776-0 BB");
    expect(r.banco).toBe("BB");
  });
  it("formato parcial (sem CC)", () => {
    const r = parseConta("AG; 3616 589422562-7");
    expect(r.status).toBe("parcial");
    expect(r.agencia).toBe("3616");
    expect(r.conta).toBeNull();
  });
  it("vazio", () => {
    expect(parseConta("").status).toBe("vazio");
    expect(parseConta(null).status).toBe("vazio");
  });
  it("não reconhecido preserva original em conta", () => {
    const r = parseConta("lorem ipsum");
    expect(r.status).toBe("revisar");
    expect(r.conta).toBe("lorem ipsum");
    expect(r.agencia).toBeNull();
  });
});

describe("cer-import > detectHeaderRow / extractCerRows", () => {
  const aoa = [
    ["ESTADO DO PARÁ"],
    ["PREFEITURA"],
    ["SECRETARIA"],
    ["RH"],
    ["PAGAMENTO..."],
    ["Nº", "NOME", "DATA ADMISSÃO", "C.P.F.", "LOTAÇÃO", "CARGO", "DIAS", "BASE", "BRUTO", "V.LÍQUIDO", "CONTA"],
    [1, "JOÃO", "01.01.2025", "111.111.111-11", "CER", "FISIO", 30, 4000, 4000, 3800, "AG: 1 CC: 2"],
    [2, "TOTAL", null, null, null, null, null, null, null, null, null],
  ];
  it("acha cabeçalho na linha 6", () => {
    expect(detectHeaderRow(aoa)).toBe(5);
  });
  it("acha cabeçalho na linha 1", () => {
    expect(detectHeaderRow([["NOME", "CPF", "LOTAÇÃO", "CARGO", "CONTA"], ["a", "b", "c", "d", "e"]])).toBe(0);
  });
  it("retorna -1 sem cabeçalho", () => {
    expect(detectHeaderRow([["A"], ["B"]])).toBe(-1);
  });
  it("extrai apenas 1 linha (para no TOTAL)", () => {
    const rows = extractCerRows(aoa, 5);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ nome: "JOÃO", cpf: "11111111111", lotacao: "CER", cargo: "FISIO", data_admissao: "2025-01-01" });
  });
});

describe("cer-import > fuzzy match", () => {
  const unidades = [
    { id: "u1", nome: "Centro Especializado em Reabilitação", sigla: "CER" },
    { id: "u2", nome: "UBS Centro", sigla: "UBSC" },
  ];
  it("acerta por sigla exata (CER)", () => {
    const r = fuzzyMatchUnidade("CER", unidades);
    expect(r.id).toBe("u1");
    expect(r.ambiguo).toBe(false);
  });
  it("acerta por nome com acento", () => {
    const r = fuzzyMatchUnidade("Centro Especializado em Reabilitacao", unidades);
    expect(r.id).toBe("u1");
  });
  it("sem match retorna null", () => {
    const r = fuzzyMatchUnidade("XYZ", unidades);
    expect(r.id).toBeNull();
  });
  it("marca ambíguo quando dois candidatos ficam próximos", () => {
    const cargos = [
      { id: "c1", nome: "FONOAUDIOLOGO" },
      { id: "c2", nome: "FONOAUDIOLOGA" },
    ];
    const r = fuzzyMatchCargo("FONOAUDIOLOG", cargos);
    expect(r.ambiguo).toBe(true);
    expect(r.id).toBeNull();
    expect(r.candidatos).toHaveLength(2);
  });
});

describe("cer-import > resolveDuplicate", () => {
  const existing = {
    id: "p1",
    nome_completo: "X",
    banco: null,
    agencia: "1104-5",
    conta_corrente: null,
    unidade_id: "u1",
    cargo_id: null,
  };
  const incoming = {
    nome_completo: "X",
    cpf: "1",
    unidade_id: "u2",
    cargo_id: "c2",
    banco: "BB",
    agencia: "9999",
    conta_corrente: "12-3",
  };
  it("modo merge-vazios só preenche o que estiver vazio", () => {
    const patch = resolveDuplicate(incoming, existing, "merge-vazios");
    expect(patch).toEqual({ banco: "BB", conta_corrente: "12-3", cargo_id: "c2" });
  });
  it("modo pular retorna null", () => {
    expect(resolveDuplicate(incoming, existing, "pular")).toBeNull();
  });
  it("sem campo vazio no destino retorna null (nada a mesclar)", () => {
    const full = { ...existing, banco: "X", conta_corrente: "y", cargo_id: "cx" };
    expect(resolveDuplicate(incoming, full, "merge-vazios")).toBeNull();
  });
});