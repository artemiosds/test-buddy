/**
 * Exportação Excel da tela Geral Cargos — layout da planilha institucional,
 * com uma aba por bloco (Resumo, Unidades, Cargos, Médicos, Afastamentos).
 * Somente leitura: recebe os dados já exibidos na tela.
 */
import * as XLSX from "xlsx-js-style";
import type { GeralCargosDados, ModoGeralCargos } from "@/lib/geral-cargos";

const BORDA = { style: "thin", color: { rgb: "D9D9D9" } } as const;

const ESTILO_TITULO = {
  font: { bold: true, sz: 13, color: { rgb: "1F2937" } },
  alignment: { horizontal: "left", vertical: "center" },
} as const;

const ESTILO_CABECALHO = {
  font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
  fill: { fgColor: { rgb: "B45309" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA },
} as const;

function aba(
  wb: XLSX.WorkBook,
  nome: string,
  titulo: string,
  cabecalho: string[],
  linhas: Array<Array<string | number>>,
  totalizador?: Array<string | number>,
) {
  const aoa: Array<Array<string | number>> = [[titulo], cabecalho, ...linhas];
  if (totalizador) aoa.push(totalizador);
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(cabecalho.length - 1, 1) } }];
  const refTitulo = XLSX.utils.encode_cell({ r: 0, c: 0 });
  if (ws[refTitulo]) ws[refTitulo].s = ESTILO_TITULO;

  cabecalho.forEach((_, c) => {
    const ref = XLSX.utils.encode_cell({ r: 1, c });
    if (ws[ref]) ws[ref].s = ESTILO_CABECALHO;
  });

  const ultima = aoa.length - 1;
  for (let r = 2; r <= ultima; r++) {
    const ehTotal = Boolean(totalizador) && r === ultima;
    cabecalho.forEach((_, c) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      const cell = ws[ref];
      if (!cell) return;
      const numerico = typeof cell.v === "number";
      if (numerico) cell.z = "#,##0";
      cell.s = {
        font: ehTotal ? { bold: true } : undefined,
        alignment: { horizontal: numerico ? "right" : "left", vertical: "center" },
        fill: ehTotal ? { fgColor: { rgb: "F5F5F4" } } : r % 2 === 1 ? undefined : { fgColor: { rgb: "FAFAF9" } },
        border: { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA },
      };
    });
  }

  ws["!cols"] = cabecalho.map((h, c) => {
    const maior = aoa
      .slice(1)
      .reduce((max, row) => Math.max(max, String(row[c] ?? "").length), h.length);
    return { wch: Math.min(48, Math.max(12, maior + 2)) };
  });
  ws["!freeze"] = { xSplit: "0", ySplit: "2" };

  XLSX.utils.book_append_sheet(wb, ws, nome.slice(0, 31));
}

export function exportarGeralCargosXlsx(
  dados: GeralCargosDados,
  opts: { modo: ModoGeralCargos; competencia: string; agrupamento: string },
) {
  const wb = XLSX.utils.book_new();
  const modoLabel = opts.modo === "ativos" ? "Ativos" : "Geral — todos";

  aba(
    wb,
    "Resumo",
    `Geral Cargos — ${modoLabel} · ${opts.competencia}`,
    ["Indicador", "Quantidade"],
    [
      ["Total de cadastros", dados.total],
      ["Ativos (ativo + férias + licença prêmio)", dados.ativos],
      ["Disponível para escala (ativo)", dados.disponivel],
      ["Efetivos ativos", dados.efetivosAtivos],
      ["Prestadores/Contratados", dados.prestadoresAtivos],
      ["— Prestadores de Serviços", dados.prestadoresServicoAtivos],
      ["— Comissionados", dados.comissionadosAtivos],
      ["— Terceirizados", dados.terceirizadosAtivos],
      ["Ativos fora de escala (férias/licença prêmio)", dados.foraDeEscala],
      ["Fora dos ativos", dados.foraDosAtivos],
    ],
  );

  aba(
    wb,
    "Unidades",
    "Servidores na Secretaria de Saúde",
    ["Local", "Efetivos", "Prestadores/Contratados", "Total"],
    dados.unidades.map((u) => [
      u.sigla ? `${u.nome} (${u.sigla})` : u.nome,
      u.efetivos,
      u.prestadores,
      u.total,
    ]),
    [
      "TOTAL",
      dados.unidades.reduce((a, u) => a + u.efetivos, 0),
      dados.unidades.reduce((a, u) => a + u.prestadores, 0),
      dados.unidades.reduce((a, u) => a + u.total, 0),
    ],
  );

  const colsCargo = ["Nome do cargo", "Efetivos", "Prestadores", "Ativos", "Disponível", "Total"];
  const linhasCargo = (lista: typeof dados.cargos) =>
    lista.map((c) => [c.nome, c.efetivos, c.prestadores, c.ativos, c.disponivel, c.total]);
  const totalCargo = (lista: typeof dados.cargos) => [
    "TOTAL",
    lista.reduce((a, c) => a + c.efetivos, 0),
    lista.reduce((a, c) => a + c.prestadores, 0),
    lista.reduce((a, c) => a + c.ativos, 0),
    lista.reduce((a, c) => a + c.disponivel, 0),
    lista.reduce((a, c) => a + c.total, 0),
  ];

  aba(
    wb,
    "Cargos",
    `Lista de cargos (${opts.agrupamento})`,
    colsCargo,
    linhasCargo(dados.cargos),
    totalCargo(dados.cargos),
  );

  aba(
    wb,
    "Médicos",
    "Específicos médicos: clínicos e especialistas",
    colsCargo,
    linhasCargo(dados.medicos),
    totalCargo(dados.medicos),
  );

  aba(
    wb,
    "Afastamentos",
    "Afastamentos e ausências",
    ["Tipo", "Qtd", "Principais cargos afetados"],
    dados.afastamentos.map((a) => [a.label, a.qtd, a.cargos.join(" · ")]),
    ["TOTAL", dados.afastamentos.reduce((s, a) => s + a.qtd, 0), ""],
  );

  XLSX.writeFile(wb, `geral-cargos-${opts.modo}.xlsx`, { bookType: "xlsx" });
}
