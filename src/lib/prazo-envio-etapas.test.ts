import { describe, expect, it } from "vitest";
import { etapaDoPrazo } from "./prazo-envio-etapas";

// Prazo 2026-11-10 → corte 2026-11-11T02:59:59Z (23:59:59 em Brasília)
const P = "2026-11-10";
describe("etapaDoPrazo", () => {
  it("3 dias antes", () => expect(etapaDoPrazo(P, new Date("2026-11-08T12:00:00Z"))).toBe("3_dias"));
  it("1 dia antes", () => expect(etapaDoPrazo(P, new Date("2026-11-10T12:00:00Z"))).toBe("1_dia"));
  it("1 hora antes", () => expect(etapaDoPrazo(P, new Date("2026-11-11T02:10:00Z"))).toBe("1_hora"));
  it("vencido após 23:59 de Brasília", () => expect(etapaDoPrazo(P, new Date("2026-11-11T03:00:00Z"))).toBe("vencido"));
  it("mais de 3 dias: nada", () => expect(etapaDoPrazo(P, new Date("2026-11-05T12:00:00Z"))).toBeNull());
});
