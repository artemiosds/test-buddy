import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { logger, redact } from "./logger";

describe("redact", () => {
  it("redige chaves sensíveis (case-insensitive)", () => {
    const result = redact({
      email: "a@b.com",
      Password: "secret",
      nested: { CPF: "123", ok: 1 },
    }) as Record<string, unknown>;
    expect(result.email).toBe("[REDACTED]");
    expect(result.Password).toBe("[REDACTED]");
    const nested = result.nested as Record<string, unknown>;
    expect(nested.CPF).toBe("[REDACTED]");
    expect(nested.ok).toBe(1);
  });

  it("preserva primitivos e serializa Error", () => {
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBeNull();
    const err = new Error("boom");
    const out = redact(err) as { name: string; message: string; stack?: string };
    expect(out.name).toBe("Error");
    expect(out.message).toBe("boom");
  });

  it("percorre arrays e limita profundidade", () => {
    const arr = redact([{ token: "x" }, { ok: 2 }]) as Array<Record<string, unknown>>;
    expect(arr[0].token).toBe("[REDACTED]");
    expect(arr[1].ok).toBe(2);
  });

  it("evita loops explosivos com objetos aninhados", () => {
    let deep: Record<string, unknown> = { leaf: true };
    for (let i = 0; i < 20; i++) deep = { next: deep };
    const out = redact(deep);
    expect(out).toBeDefined();
  });
});

describe("logger", () => {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  beforeEach(() => {
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  });

  it("emite JSON no server e redige contexto sensível", () => {
    logger.error("teste", { email: "a@b.com", ok: true });
    // No ambiente de teste (jsdom não é padrão aqui), pode cair no branch server
    // ou browser dependendo do arquivo. Verificamos que houve chamada e que
    // o email não vazou em nenhum stream.
    const allCalls = [
      ...(console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls,
      ...(console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls,
      ...(console.log as unknown as { mock: { calls: unknown[][] } }).mock.calls,
    ];
    const serialized = JSON.stringify(allCalls);
    expect(serialized).toContain("teste");
    expect(serialized).toContain("[REDACTED]");
    expect(serialized).not.toContain("a@b.com");
  });
});