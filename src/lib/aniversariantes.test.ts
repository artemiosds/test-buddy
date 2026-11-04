import { describe, it, expect } from "vitest";
import { calcularAniversariantes } from "./aniversariantes";

const hoje = new Date(2026, 10, 28); // 28/11/2026

describe("aniversariantes", () => {
  it("detecta aniversariante de hoje", () => {
    const r = calcularAniversariantes([{ id: "1", nome: "A", data_nascimento: "1990-11-28" }], hoje);
    expect(r.hoje.map((x) => x.id)).toEqual(["1"]);
  });
  it("inclui virada de mês nos próximos 7 dias", () => {
    const r = calcularAniversariantes([{ id: "2", nome: "B", data_nascimento: "1985-12-02" }], hoje);
    expect(r.proximos[0].emDias).toBe(4);
  });
  it("exclui aniversário a 8 dias", () => {
    const r = calcularAniversariantes([{ id: "3", nome: "C", data_nascimento: "1985-12-06" }], hoje);
    expect(r.proximos).toHaveLength(0);
  });
  it("ignora data ausente ou inválida", () => {
    const r = calcularAniversariantes(
      [
        { id: "4", nome: "D", data_nascimento: null },
        { id: "5", nome: "E", data_nascimento: "abc" },
      ],
      hoje,
    );
    expect(r.hoje.length + r.proximos.length + r.mes.length).toBe(0);
  });
});
