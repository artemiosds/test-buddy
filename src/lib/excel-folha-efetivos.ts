/**
 * Gerador Excel — "Frequência de Efetivos" (padrão SMS).
 * 
 * Layout simplificado conforme padrão anterior solicitado pelo usuário.
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
    faltas_injustificadas?: number | string | null;
    atestado?: number | string | null;
    he_50?: number | string | null;
    he_100?: number | string | null;
    ferias_terco?: number | string | null;
    ferias_integral?: number | string | null;
    sal_sub_h?: number | string | null;
    adicional_noturno?: number | string | null;
    aulas_suplementares?: number | string | null;
    plantoes_extras?: number | string | null;
    sobreaviso?: number | string | null;
    incentivo?: number | string | null;
  } | null;
};

export type ExcelEfetivosInput = {
  competencia: { mes: number; ano: number };
  unidadeNome: string;
  itens: ItemEfetivo[];
};

const MESES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];

function num(v: number | string | null | undefined): string | number {
  if (v == null || v === 0 || v === "") return "";
  if (typeof v === "string") return v;
  return v;
}

export async function gerarExcelFolhaEfetivos(input: ExcelEfetivosInput): Promise<void> {
  const info = await loadMunicipioInfo();
  const uf = info.data?.uf ?? "PA";
  const nomeMun = (info.data?.nome_municipio ?? "ORIXIMINÁ").toUpperCase();
  const estado = uf === "PA" ? "PARÁ" : (uf ?? "");
  const mesNome = MESES[(input.competencia.mes - 1 + 12) % 12];
  const compStr = `${mesNome}/${input.competencia.ano}`;
  const unidadeUp = (input.unidadeNome || "-").toUpperCase();

  const headers = [
    "Nº", "MATRÍCULA", "NOME", "C.P.F.", "CARGO", "LOTAÇÃO",
    "FALTAS", "ATT", "H.E 50%", "H.E 100%", "FÉRIAS 1/3", "FÉRIAS INT.",
    "SAL. SUB. H", "AD. NOTURNO", "AULAS SUPL.", "PLANTÕES", "SOBREAVISOS", "INCENTIVO"
  ];

  const rows: (string | number)[][] = [
    [`ESTADO DO ${estado}`],
    [`PREFEITURA MUNICIPAL DE ${nomeMun}`],
    ["SECRETARIA MUNICIPAL DE SAÚDE"],
    [unidadeUp],
    [`FREQUÊNCIA DOS EFETIVOS DE ${unidadeUp} - MÊS ${compStr}`],
    headers,
  ];

  input.itens.forEach((it, i) => {
    const p = it.profissional;
    const l = it.linha ?? {};
    rows.push([
      i + 1,
      p.matricula ?? "",
      p.nome,
      fmtCPF(p.cpf),
      p.cargo ?? "-",
      p.setor ?? "-",
      num(l.faltas_injustificadas),
      num(l.atestado),
      num(l.he_50),
      num(l.he_100),
      num(l.ferias_terco ? "X" : ""),
      num(l.ferias_integral),
      num(l.sal_sub_h),
      num(l.adicional_noturno),
      num(l.aulas_suplementares),
      num(l.plantoes_extras),
      num(l.sobreaviso),
      num(l.incentivo)
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const lastCol = headers.length - 1;
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: lastCol } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: lastCol } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: lastCol } },
  ];

  ws["!cols"] = [
    { wch: 4 }, { wch: 12 }, { wch: 36 }, { wch: 16 }, { wch: 26 }, { wch: 26 },
    { wch: 8 }, { wch: 7 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 11 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 11 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Efetivos");

  const fileName = `frequencia-efetivos-${String(input.competencia.mes).padStart(2, "0")}-${input.competencia.ano}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
