/**
 * Gerador Excel — "Frequência de Prestadores / Contratados" (padrão CER / HMO).
 *
 * Estrutura de linhas fixa:
 *   1  ESTADO DO PARÁ
 *   2  PREFEITURA MUNICIPAL DE <MUNICIPIO>
 *   3  SECRETARIA MUNICIPAL DE SAÚDE
 *   4  <UNIDADE>
 *   5  FREQUENCIA DOS PRESTADORES DE <UNIDADE> - MÊS <MES/ANO>
 *   6  cabeçalho da tabela
 *   7+ dados
 */
import * as XLSX from "xlsx";
import { loadMunicipioInfo } from "@/lib/pdf-institucional";

export type ItemContratado = {
  profissional: {
    matricula: string | number | null;
    nome: string;
    cpf: string | null;
    cargo: string | null;
    setor: string | null;
    banco: string | null;
    agencia: string | null;
    conta_corrente: string | null;
  };
  linha: {
    dias_falta?: number | null;
    atestado?: number | null;
    he_50?: number | null;
    he_100?: number | null;
    adn?: number | null;
    plantoes?: number | null;
    sobreaviso?: number | null;
    incentivo?: number | null;
  } | null;
};

export type ExcelContratadosInput = {
  competencia: { mes: number; ano: number };
  unidadeNome: string;
  itens: ItemContratado[];
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

export function fmtCPF(cpf: string | null | undefined): string {
  if (!cpf) return "-";
  const d = String(cpf).replace(/\D/g, "");
  if (d.length !== 11) return String(cpf);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function fmtConta(p: ItemContratado["profissional"]): string {
  const partes: string[] = [];
  if (p.agencia) partes.push(`AG: ${p.agencia}`);
  if (p.conta_corrente) partes.push(`CC: ${p.conta_corrente}`);
  if (p.banco) partes.push(String(p.banco));
  return partes.length ? partes.join(" ") : "-";
}

function n(v: number | null | undefined): number | string {
  const x = Number(v ?? 0);
  return x || "";
}

export async function gerarExcelFolhaContratados(input: ExcelContratadosInput): Promise<void> {
  const info = await loadMunicipioInfo();
  const uf = info.data?.uf ?? "PA";
  const nomeMun = (info.data?.nome_municipio ?? "ORIXIMINÁ").toUpperCase();
  const estado = uf === "PA" ? "PARÁ" : (uf ?? "");
  const mesNome = MESES[(input.competencia.mes - 1 + 12) % 12];
  const compStr = `${mesNome}/${input.competencia.ano}`;
  const unidadeUp = (input.unidadeNome || "-").toUpperCase();

  const header = [
    "Nº",
    "NOME",
    "C.P.F.",
    "CARGO",
    "LOTAÇÃO",
    "DIAS",
    "FALTA",
    "ATT",
    "H.E 50%",
    "H.E 100%",
    "ADN",
    "PLANTÕES",
    "SOBREAVISOS",
    "INCENTIVO",
    "CONTA",
  ];

  const rows: (string | number)[][] = [
    [`ESTADO DO ${estado}`],
    [`PREFEITURA MUNICIPAL DE ${nomeMun}`],
    ["SECRETARIA MUNICIPAL DE SAÚDE"],
    [unidadeUp],
    [`FREQUENCIA DOS PRESTADORES DE ${unidadeUp} - MÊS ${compStr}`],
    header,
  ];

  input.itens.forEach((it, i) => {
    const p = it.profissional;
    const l = it.linha ?? {};
    rows.push([
      i + 1,
      p.nome ?? "",
      fmtCPF(p.cpf),
      p.cargo ?? "-",
      p.setor ?? "-",
      "", // DIAS trabalhados (não persistido — deixado em branco)
      n(l.dias_falta as number),
      n(l.atestado as number),
      n(l.he_50 as number),
      n(l.he_100 as number),
      n(l.adn as number),
      n(l.plantoes as number),
      n(l.sobreaviso as number),
      n(l.incentivo as number),
      fmtConta(p),
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Mescla as 5 primeiras linhas ao longo de todas as colunas do cabeçalho
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
    { wch: 36 },
    { wch: 16 },
    { wch: 26 },
    { wch: 26 },
    { wch: 7 },
    { wch: 7 },
    { wch: 7 },
    { wch: 10 },
    { wch: 10 },
    { wch: 7 },
    { wch: 12 },
    { wch: 14 },
    { wch: 13 },
    { wch: 44 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Prestadores");

  const fileName = `frequencia-contratados-${String(input.competencia.mes).padStart(2, "0")}-${input.competencia.ano}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
