import { describe, expect, it } from "vitest";
import { destinatariosDaCobranca, unidadesQuePrecisamEnviar, gestorPodeReceber } from "./cobranca-folhas";

describe("cobrança automática das folhas por unidade", () => {
  const gestores = [
    { id: "master", diretor: false },
    { id: "admin-da-secretaria", diretor: false },
    { id: "diretor-a", diretor: true },
    { id: "diretor-b", diretor: true },
  ];
  const vinculos = new Map<string, ReadonlySet<string>>([
    ["diretor-a", new Set(["A"])],
    ["diretor-b", new Set(["B"])],
  ]);

  it("não cobra ninguém se todas as unidades entregaram", () => {
    const pendentes = unidadesQuePrecisamEnviar(["A", "B"], [
      { unidadeId: "A", status: "enviada" },
      { unidadeId: "B", status: "aprovada" },
    ]);
    expect(pendentes.size).toBe(0);
    expect(destinatariosDaCobranca(gestores, pendentes, vinculos)).toEqual([]);
  });

  it("não considera a unidade concluída se apenas uma das folhas foi enviada", () => {
    const pendentes = unidadesQuePrecisamEnviar(["A", "B"], [
      { unidadeId: "A", status: "enviada" },
      { unidadeId: "A", status: "rascunho" },
      { unidadeId: "B", status: "aprovada" },
    ]);
    expect([...pendentes]).toEqual(["A"]);
    expect(destinatariosDaCobranca(gestores, pendentes, vinculos)).toEqual([
      "master", "admin-da-secretaria", "diretor-a",
    ]);
  });

  it("inclui unidades sem folha criada, pois ainda não enviaram", () => {
    const pendentes = unidadesQuePrecisamEnviar(["A", "B"], [
      { unidadeId: "A", status: "arquivada" },
    ]);
    expect([...pendentes]).toEqual(["B"]);
    expect(destinatariosDaCobranca(gestores, pendentes, vinculos)).toEqual([
      "master", "admin-da-secretaria", "diretor-b",
    ]);
  });

  it("cobra devoluções e divergências enquanto houver ação pendente", () => {
    const pendentes = unidadesQuePrecisamEnviar(["A", "B"], [
      { unidadeId: "A", status: "devolvida" },
      { unidadeId: "B", status: "com_pendencias" },
    ]);
    expect([...pendentes]).toEqual(["A", "B"]);
  });

  it("diretor sem vínculo atual não recebe cobrança de outras unidades", () => {
    const gestoresComDesvinculado = [
      ...gestores, { id: "diretor-sem-vinculo", diretor: true },
    ];
    const pendentes = new Set(["B"]);
    expect(destinatariosDaCobranca(gestoresComDesvinculado, pendentes, vinculos))
      .not.toContain("diretor-sem-vinculo");
  });

  it("diretor com mais de uma unidade recebe aviso se qualquer uma está pendente", () => {
    const vinculosMultiplo = new Map(vinculos);
    vinculosMultiplo.set("diretor-a", new Set(["A", "B"]));
    const pendentes = new Set(["B"]);
    expect(destinatariosDaCobranca(gestores, pendentes, vinculosMultiplo)).toContain("diretor-a");
  });
  it("respeita secretaria do ADMIN_SMS e acesso global explícito", () => {
    expect(gestorPodeReceber("ADMIN_SMS", "sms-a", "sms-b", false)).toBe(false);
    expect(gestorPodeReceber("ADMIN_SMS", "sms-a", "sms-a", false)).toBe(true);
    expect(gestorPodeReceber("ADMIN_SMS", "sms-a", "sms-b", true)).toBe(true);
    expect(gestorPodeReceber("MASTER", null, "sms-b", false)).toBe(true);
    expect(gestorPodeReceber("OPERACIONAL", "sms-b", "sms-b", false)).toBe(false);
  });

});
