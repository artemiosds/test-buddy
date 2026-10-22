// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FolhaFinanceiraSection } from "./folha-financeira-section";
import { calcularFolha, parseFinanceiro, type ParametrosFinanceiros } from "@/lib/folha-financeira";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
afterEach(cleanup);

it("digitação nas regras grava tarifas monetárias e mantém a simulação entre abas", async () => {
  let atual: ParametrosFinanceiros = parseFinanceiro({});
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["folha-financeira", "cargos"], [{ id: "e", nome: "ENFERMEIRO(A)", nivel: "superior", carga_horaria_semanal: 30 }]);
  function Tela() {
    const [p, setP] = useState(atual);
    return <FolhaFinanceiraSection value={p} onChange={(v) => { atual = v; setP(v); }} />;
  }
  render(<QueryClientProvider client={client}><Tela /></QueryClientProvider>);
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Regras de cálculo" }), { button: 0, ctrlKey: false });
  fireEvent.change(screen.getByLabelText("Hora extra 50% (R$/h)"), { target: { value: "15" } });
  fireEvent.change(screen.getByLabelText("Superior valor_he50"), { target: { value: "25.54" } });
  fireEvent.change(screen.getByLabelText("Superior valor_he100"), { target: { value: "34.48" } });
  fireEvent.change(screen.getByLabelText("Superior valor_adn"), { target: { value: "20.69" } });
  expect(atual.modo_horas).toBe("unitario");
  expect(atual.valor_he50).toBe(15);
  expect(atual.niveis.superior?.valor_he50).toBe(25.54);
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Simulador" }), { button: 0, ctrlKey: false });
  fireEvent.change(screen.getByLabelText("Cargo"), { target: { value: "e" } });
  fireEvent.change(screen.getByLabelText("Horas extras 50%"), { target: { value: "20" } });
  fireEvent.change(screen.getByLabelText("Horas extras 100%"), { target: { value: "20" } });
  fireEvent.change(screen.getByLabelText("Horas noturnas"), { target: { value: "120" } });
  const resultado = calcularFolha({ tipo: "efetivos", cargo_id: "e", nivel_cargo: "superior", salario_proprio: null, carga_cargo: 30, diasTrabalhados: 30, faltasInjustificadas: 0, faltasJustificadas: 0, atestado: 0, he50: 20, he100: 20, adn: 120, plantoes: 0, sobreaviso: 0, incentivo: 0 }, atual);
  expect(resultado.vHe50).toBe(510.8);
  expect(resultado.vHe100).toBe(689.6);
  expect(resultado.vAdn).toBe(2482.8);
  await waitFor(() => expect(screen.getByText(/510,80/)).toBeDefined());
  expect(screen.getByText(/689,60/)).toBeDefined();
  expect(screen.getByText(/2\.482,80/)).toBeDefined();
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Regras de cálculo" }), { button: 0, ctrlKey: false });
  expect((screen.getByLabelText("Superior valor_he50") as HTMLInputElement).value).toBe("25.54");
  client.clear();
});