import { describe, expect, it } from "vitest";
import {
  detectarLayout,
  mapearColunas,
  normalizarTexto,
  validarEstrutura,
  type LayoutVersaoResolvida,
} from "./layout-engine";

function campo(
  campo_interno: string,
  aliases: string[],
  obrigatorio = false,
  tipo_dado = "texto",
  ordem = 0,
) {
  return {
    campo_interno,
    label: campo_interno,
    coluna_padrao: aliases[0] ?? null,
    aliases,
    obrigatorio,
    ignorado: false,
    tipo_dado,
    ordem,
  };
}

function versao(
  codigo: string,
  campos: ReturnType<typeof campo>[],
  arquivo_hints: string[] = [],
  header_hints: string[] = [],
): LayoutVersaoResolvida {
  return {
    layout_id: `l-${codigo}`,
    layout_codigo: codigo,
    layout_nome: codigo,
    modulo: "piso",
    tipo: "planilha",
    ativo: true,
    versao_id: `v-${codigo}`,
    versao: 1,
    situacao: "ativa",
    arquivo_hints,
    header_hints,
    config: {},
    campos,
  };
}

const contratados = versao(
  "folha-contratados",
  [campo("cpf", ["CPF"], true, "cpf"), campo("nome", ["NOME"], true), campo("salario_base", ["BASE"], false, "moeda")],
  ["contrat"],
  ["lotacao"],
);

const efetivos = versao(
  "folha-efetivos",
  [campo("cpf", ["CPF"], true, "cpf"), campo("auxilio_financeiro", ["AUX. FINANC."], false, "moeda")],
  ["fopag"],
  ["aux financ"],
);

describe("normalizarTexto", () => {
  it("remove acentos, pontuação e espaços duplicados", () => {
    expect(normalizarTexto("  AUX.  FINANC. Sérvidor ")).toBe("aux financ servidor");
  });
});

describe("mapearColunas", () => {
  it("mapeia por sinônimo sem depender de maiúsculas ou acentos", () => {
    const m = mapearColunas(["c.p.f.", "Nome", "Coluna X"], contratados);
    expect(m["c.p.f."]).toBe("cpf");
    expect(m["Nome"]).toBe("nome");
    expect(m["Coluna X"]).toBeNull();
  });

  it("nunca atribui o mesmo campo interno a duas colunas", () => {
    const m = mapearColunas(["CPF", "CPF "], contratados);
    expect(Object.values(m).filter((v) => v === "cpf")).toHaveLength(1);
  });
});

describe("detectarLayout", () => {
  it("escolhe o layout mais compatível pelo arquivo e cabeçalhos", () => {
    const r = detectarLayout([contratados, efetivos], "folha_fopag_06_2026.xlsx", [
      "CPF",
      "AUX. FINANC.",
    ]);
    expect(r.escolhido?.versao.layout_codigo).toBe("folha-efetivos");
    expect(r.requerEscolha).toBe(false);
  });

  it("pede confirmação quando não há candidato", () => {
    const r = detectarLayout([contratados, efetivos], "planilha.xlsx", ["AAA", "BBB"]);
    expect(r.requerEscolha).toBe(true);
    expect(r.escolhido).toBeNull();
  });
});

describe("validarEstrutura", () => {
  it("acusa campo obrigatório ausente e tipo incompatível", () => {
    const headers = ["NOME", "BASE"];
    const m = mapearColunas(headers, contratados);
    const res = validarEstrutura(headers, m, contratados, [{ NOME: "Ana", BASE: "não é número" }]);
    expect(res.erros).toBeGreaterThan(0);
    expect(res.issues.some((i) => i.tipo === "campo_obrigatorio_ausente")).toBe(true);
  });

  it("não acusa erro quando o arquivo está completo", () => {
    const headers = ["CPF", "NOME", "BASE"];
    const m = mapearColunas(headers, contratados);
    const res = validarEstrutura(headers, m, contratados, [
      { CPF: "123.456.789-00", NOME: "Ana", BASE: "R$ 1.234,56" },
    ]);
    expect(res.erros).toBe(0);
  });
});
