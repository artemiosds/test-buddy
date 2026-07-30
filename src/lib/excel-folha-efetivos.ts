/**
 * Gerador Excel — "Frequência de Efetivos" (padrão SMS).
 *
 * Layout de linhas fixo (equivalente ao gerador de Contratados):
 *   1  ESTADO DO PARÁ
 *   2  PREFEITURA MUNICIPAL DE <MUNICIPIO>
 *   3  SECRETARIA MUNICIPAL DE SAÚDE
 *   4  <UNIDADE>
 *   5  FREQUÊNCIA DOS EFETIVOS DE <UNIDADE> - MÊS <MES/ANO>
 *   6  cabeçalho da tabela
 *   7+ dados
 */
import * as XLSX from "xlsx";
import { loadMunicipioInfo } from "@/lib/pdf-institucional";
import { fmtCPF } from "@/lib/excel-folha-contratados";

export type ItemEfetivo = {
  profissional: {
    matricula: string | number | null;
    nome: string;
    cpf: string | null;
    cargo: string | null;
    setor: string | null;
  };
  linha: {
    faltas_injustificadas?: number | null;
    atestado?: number | null;
    he_50?: number | null;
    he_100?: number | null;
    ferias_terco?: number | null;
    ferias_integral?: number | null;
    sal_sub_h?: number | null;
    adicional_noturno?: number | null;
    aulas_suplementares?: number | null;
    plantoes_extras?: number | null;
    sobreaviso?: number | null;
    incentivo?: number | null;
  } | null;
};

export type ExcelEfetivosInput = {
  competencia: { mes: number; ano: number };
  unidadeNome: string;
  itens: ItemEfetivo[];
};

const MESES = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];

function n(v: number | null | undefined): number | string {
  const x = Number(v ?? 0);
  return x || "";
}

export async function gerarExcelFolhaEfetivos(input: ExcelEfetivosInput): Promise<void> {
  const info = await loadMunicipioInfo();
  const uf = info.data?.uf ?? "PA";
  const nomeMun = (info.data?.nome_municipio ?? "ORIXIMINÁ").toUpperCase();
  const estado = uf === "PA" ? "PARÁ" : (uf ?? "");
  const mesNome = MESES[(input.competencia.mes - 1 + 12) % 12];
  const compStr = `${mesNome}/${input.competencia.ano}`;
  const unidadeUp = (input.unidadeNome || "-").toUpperCase();

  const header = [
    "Nº",
    "MATRÍCULA",
    "NOME",
    "C.P.F.",
    "CARGO",
    "LOTAÇÃO",
    "FALTAS",
    "ATT",
    "H.E 50%",
    "H.E 100%",
    "FÉRIAS 1/3",
    "FÉRIAS INT.",
    "SAL. SUB. H",
    "AD. NOTURNO",
    "AULAS SUPL.",
    "PLANTÕES",
    "SOBREAVISOS",
    "INCENTIVO",
  ];

  const rows: (string | number)[][] = [
    [`ESTADO DO ${estado}`],
    [`PREFEITURA MUNICIPAL DE ${nomeMun}`],
    ["SECRETARIA MUNICIPAL DE SAÚDE"],
    [unidadeUp],
    [`FREQUÊNCIA DOS EFETIVOS DE ${unidadeUp} - MÊS ${compStr}`],
    header,
  ];

  input.itens.forEach((it, i) => {
    const p = it.profissional;
    const l = it.linha ?? {};
    rows.push([
      i + 1,
      p.matricula ?? "",
      p.nome ?? "",
      fmtCPF(p.cpf),
      p.cargo ?? "-",
      p.setor ?? "-",
      n(l.faltas_injustificadas as number),
      n(l.atestado as number),
      n(l.he_50 as number),
      n(l.he_100 as number),
      n(l.ferias_terco as number),
      n(l.ferias_integral as number),
      n(l.sal_sub_h as number),
      n(l.adicional_noturno as number),
      n(l.aulas_suplementares as number),
      n(l.plantoes_extras as number),
      n(l.sobreaviso as number),
      n(l.incentivo as number),
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  const lastCol = header.length - 1;
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: lastCol } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: lastCol } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: lastCol } },
  ];

  ws["!cols"] = [
    { wch: 4 },
    { wch: 12 },
    { wch: 34 },
    { wch: 16 },
    { wch: 24 },
    { wch: 24 },
    { wch: 8 },
    { wch: 7 },
    { wch: 9 },
    { wch: 10 },
    { wch: 10 },
    { wch: 11 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 11 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Efetivos");

  const fileName = `frequencia-efetivos-${String(input.competencia.mes).padStart(2, "0")}-${input.competencia.ano}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
