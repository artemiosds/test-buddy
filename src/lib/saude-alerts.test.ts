import { describe, it, expect } from "vitest";
import { computeSaudeAlerts } from "./saude-alerts";

describe("computeSaudeAlerts", () => {
  it("retorna vazio quando tudo está saudável", () => {
    const alerts = computeSaudeAlerts({
      eventos: { por_status: { pendente: 3 }, retry_alto: 0, mais_antigo_pendente: null },
      sla: { vencidas: 0, proximas_24h: 0 },
      cron: { disponivel: true, falhas_24h: [] },
      travados: { rows: [] },
      breakers: [],
    });
    expect(alerts).toEqual([]);
  });

  it("emite crítico para eventos em falha definitiva e SLA vencido", () => {
    const alerts = computeSaudeAlerts({
      eventos: { por_status: { falhou: 2 } },
      sla: { vencidas: 5, proximas_24h: 0 },
    });
    expect(alerts.filter((a) => a.severity === "critical").map((a) => a.id))
      .toEqual(expect.arrayContaining(["eventos.falhou", "sla.vencidas"]));
  });

  it("classifica fila alta, retry alto e SLA próximo como warn", () => {
    const alerts = computeSaudeAlerts({
      eventos: { por_status: { pendente: 60 }, retry_alto: 3 },
      sla: { vencidas: 0, proximas_24h: 4 },
    });
    const ids = alerts.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining([
      "eventos.pendentes_altos", "eventos.retry_alto", "sla.proximas",
    ]));
    expect(alerts.every((a) => a.severity === "warn")).toBe(true);
  });

  it("promove 'mais antigo pendente' a crítico após 6h", () => {
    const now = Date.parse("2026-07-17T12:00:00Z");
    const alerts = computeSaudeAlerts({
      eventos: { mais_antigo_pendente: "2026-07-17T05:00:00Z" },
      now,
    });
    const a = alerts.find((x) => x.id === "eventos.mais_antigo");
    expect(a?.severity).toBe("critical");
  });

  it("sinaliza disjuntores abertos como crítico e meia-abertura como warn", () => {
    const alerts = computeSaudeAlerts({
      breakers: [
        { key: "rpc.a", state: "open", failures: 5, totalTrips: 1, nextAttemptAt: 0, lastFailureAt: 0, openedAt: 0 },
        { key: "rpc.b", state: "half_open", failures: 0, totalTrips: 2, nextAttemptAt: 0, lastFailureAt: 0, openedAt: 0 },
        { key: "rpc.c", state: "closed", failures: 0, totalTrips: 0, nextAttemptAt: 0, lastFailureAt: 0, openedAt: 0 },
      ],
    });
    expect(alerts.find((a) => a.id === "breakers.abertos")?.severity).toBe("critical");
    expect(alerts.find((a) => a.id === "breakers.half_open")?.severity).toBe("warn");
  });

  it("ordena críticos antes de warns", () => {
    const alerts = computeSaudeAlerts({
      eventos: { por_status: { falhou: 1, pendente: 100 } },
    });
    expect(alerts[0].severity).toBe("critical");
  });
});