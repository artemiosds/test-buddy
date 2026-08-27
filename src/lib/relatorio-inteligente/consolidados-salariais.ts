/**
 * Tabelas sintéticas consolidadas do bloco "Dados Salariais".
 * Módulo puro: recebe as linhas JÁ FILTRADAS e devolve estruturas prontas
 * para a prévia (Etapa 6) e para as exportações (Etapa 7).
 */
import type { Row } from "./tipos";

export type ConsolidadoTabela = {
  titulo: string;
  descricao?: string;
  colunas: { header: string; key: string; width?: number }[];
  linhas: Row[];
  /** Índices das linhas que devem ser destacadas (totais). */
  totaisIdx: number[];
};

export const BLOCO_SALARIAL_ID = "dados_salariais";

const num = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const clean = v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(clean);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const txt = (v: unknown, fallback = "Não informado"): string => {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? fallback : s;
};

/** Normaliza cargos: "ENFERMEIRO(A)" e "Enfermeiro " => "Enfermeiro". */
export function normalizarCargo(v: unknown): string {
  const base = txt(v, "Cargo não informado");
  const semSufixo = base
    .replace(/\s*\((a|o|as|os)\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return titulo(semSufixo);
}

function titulo(s: string): string {
  const minusculas = new Set(["de", "da", "do", "das", "dos", "e", "em", "para"]);
  return s
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((w, i) =>
      i > 0 && minusculas.has(w) ? w : w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1),
    )
    .join(" ");
}

const ORDEM_VINCULO = [
  "efetivo",
  "comissionado",
  "prestador de servicos",
  "prestador de serviços",
  "terceirizado",
];

function normalizarVinculo(v: unknown): string {
  const base = txt(v, "Vínculo não informado");
  return titulo(base.replace(/\s+/g, " ").trim());
}

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

type Acc = {
  qtd: number;
  base: number;
  bruto: number;
  liquido: number;
  extras: number;
};

const novoAcc = (): Acc => ({ qtd: 0, base: 0, bruto: 0, liquido: 0, extras: 0 });

function acumular(a: Acc, r: Row) {
  a.qtd += 1;
  a.base += num(r.salario_base ?? r.valor_piso);
  a.bruto += num(r.salario_bruto ?? r.valor_bruto ?? r.remuneracao_bruta);
  a.liquido += num(r.salario_liquido ?? r.valor_liquido ?? r.remuneracao_liquida);
  a.extras +=
    num(r.horas_extras) + num(r.adicional_noturno) + num(r.gratificacao_incentivo);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function construirConsolidadosSalariais(rows: Row[]): ConsolidadoTabela[] {
  if (!rows?.length) return [];

  const porUnidade = new Map<string, Acc>();
  const porSetor = new Map<string, Acc & { setor: string; unidade: string }>();
  const porCargo = new Map<string, Acc>();
  const porVinculo = new Map<string, Acc>();
  const geral = novoAcc();

  for (const r of rows) {
    const unidade = txt(r.unidade, "Sem unidade");
    const setor = txt(r.setor, "Sem setor");
    const cargo = normalizarCargo(r.cargo);
    const vinculo = normalizarVinculo(r.vinculo);

    if (!porUnidade.has(unidade)) porUnidade.set(unidade, novoAcc());
    acumular(porUnidade.get(unidade)!, r);

    const chaveSetor = `${unidade}||${setor}`;
    if (!porSetor.has(chaveSetor))
      porSetor.set(chaveSetor, { ...novoAcc(), setor, unidade });
    acumular(porSetor.get(chaveSetor)!, r);

    if (!porCargo.has(cargo)) porCargo.set(cargo, novoAcc());
    acumular(porCargo.get(cargo)!, r);

    if (!porVinculo.has(vinculo)) porVinculo.set(vinculo, novoAcc());
    acumular(porVinculo.get(vinculo)!, r);

    acumular(geral, r);
  }

  const tabelas: ConsolidadoTabela[] = [];

  // A) Consolidado por Unidade
  const linhasUnidade: Row[] = [...porUnidade.entries()]
    .sort((a, b) => b[1].bruto - a[1].bruto || a[0].localeCompare(b[0], "pt-BR"))
    .map(([unidade, a]) => ({
      unidade,
      qtd: a.qtd,
      total_salario_base: r2(a.base),
      total_salario_bruto: r2(a.bruto),
      total_salario_liquido: r2(a.liquido),
      valor_custo_total: r2(a.bruto + a.extras),
    }));
  linhasUnidade.push({
    unidade: "TOTAL GERAL DA SECRETARIA",
    qtd: geral.qtd,
    total_salario_base: r2(geral.base),
    total_salario_bruto: r2(geral.bruto),
    total_salario_liquido: r2(geral.liquido),
    valor_custo_total: r2(geral.bruto + geral.extras),
  });
  tabelas.push({
    titulo: "Consolidado Financeiro por Unidade",
    descricao:
      "Custo Total = Salário Bruto + Horas Extras + Adicional Noturno + Gratificação de Incentivo.",
    colunas: [
      { header: "Unidade", key: "unidade", width: 42 },
      { header: "Qtd Profissionais", key: "qtd", width: 14 },
      { header: "Total Salário Base", key: "total_salario_base", width: 20 },
      { header: "Total Salário Bruto", key: "total_salario_bruto", width: 20 },
      { header: "Total Salário Líquido", key: "total_salario_liquido", width: 20 },
      { header: "Custo Total", key: "valor_custo_total", width: 20 },
    ],
    linhas: linhasUnidade,
    totaisIdx: [linhasUnidade.length - 1],
  });

  // B) Consolidado por Setor
  const linhasSetor: Row[] = [...porSetor.values()]
    .sort(
      (a, b) =>
        a.unidade.localeCompare(b.unidade, "pt-BR") ||
        a.setor.localeCompare(b.setor, "pt-BR"),
    )
    .map((a) => ({
      setor: a.setor,
      unidade: a.unidade,
      qtd: a.qtd,
      total_salario_bruto: r2(a.bruto),
      total_salario_liquido: r2(a.liquido),
    }));
  linhasSetor.push({
    setor: "TOTAL GERAL",
    unidade: "—",
    qtd: geral.qtd,
    total_salario_bruto: r2(geral.bruto),
    total_salario_liquido: r2(geral.liquido),
  });
  tabelas.push({
    titulo: "Consolidado Financeiro por Setor",
    colunas: [
      { header: "Setor", key: "setor", width: 34 },
      { header: "Unidade", key: "unidade", width: 34 },
      { header: "Qtd Profissionais", key: "qtd", width: 14 },
      { header: "Total Bruto", key: "total_salario_bruto", width: 20 },
      { header: "Total Líquido", key: "total_salario_liquido", width: 20 },
    ],
    linhas: linhasSetor,
    totaisIdx: [linhasSetor.length - 1],
  });

  // C) Consolidado por Cargos
  const totalBruto = geral.bruto || 0;
  const linhasCargo: Row[] = [...porCargo.entries()]
    .sort((a, b) => b[1].bruto - a[1].bruto || a[0].localeCompare(b[0], "pt-BR"))
    .map(([cargo, a]) => ({
      cargo,
      qtd: a.qtd,
      salario_medio: r2(a.qtd ? a.bruto / a.qtd : 0),
      valor_massa_bruta: r2(a.bruto),
      pct_folha: totalBruto
        ? `${((a.bruto / totalBruto) * 100).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}%`
        : "0,00%",
    }));
  linhasCargo.push({
    cargo: "TOTAL GERAL",
    qtd: geral.qtd,
    salario_medio: r2(geral.qtd ? geral.bruto / geral.qtd : 0),
    valor_massa_bruta: r2(geral.bruto),
    pct_folha: totalBruto ? "100,00%" : "0,00%",
  });
  tabelas.push({
    titulo: "Consolidado Financeiro por Cargo",
    descricao: "Cargos normalizados (variações de grafia são somadas no mesmo grupo).",
    colunas: [
      { header: "Cargo", key: "cargo", width: 40 },
      { header: "Qtd Ocupantes", key: "qtd", width: 14 },
      { header: "Salário Médio", key: "salario_medio", width: 20 },
      { header: "Massa Salarial Bruta", key: "valor_massa_bruta", width: 22 },
      { header: "% da Folha", key: "pct_folha", width: 14 },
    ],
    linhas: linhasCargo,
    totaisIdx: [linhasCargo.length - 1],
  });

  // D) Consolidado por Vínculo Funcional
  const ordemIdx = (v: string) => {
    const i = ORDEM_VINCULO.indexOf(semAcento(v));
    return i === -1 ? 999 : i;
  };
  const linhasVinculo: Row[] = [...porVinculo.entries()]
    .sort(
      (a, b) =>
        ordemIdx(a[0]) - ordemIdx(b[0]) ||
        b[1].bruto - a[1].bruto ||
        a[0].localeCompare(b[0], "pt-BR"),
    )
    .map(([vinculo, a]) => ({
      vinculo,
      qtd: a.qtd,
      total_salario_base: r2(a.base),
      total_salario_bruto: r2(a.bruto),
      total_salario_liquido: r2(a.liquido),
    }));
  linhasVinculo.push({
    vinculo: "TOTAL GERAL",
    qtd: geral.qtd,
    total_salario_base: r2(geral.base),
    total_salario_bruto: r2(geral.bruto),
    total_salario_liquido: r2(geral.liquido),
  });
  tabelas.push({
    titulo: "Consolidado Financeiro por Vínculo Funcional",
    colunas: [
      { header: "Vínculo", key: "vinculo", width: 34 },
      { header: "Qtd", key: "qtd", width: 12 },
      { header: "Total Base", key: "total_salario_base", width: 20 },
      { header: "Total Bruto", key: "total_salario_bruto", width: 20 },
      { header: "Total Líquido", key: "total_salario_liquido", width: 20 },
    ],
    linhas: linhasVinculo,
    totaisIdx: [linhasVinculo.length - 1],
  });

  return tabelas;
}
