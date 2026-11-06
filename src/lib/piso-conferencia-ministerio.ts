/**
 * Conciliação local FOPAG + Prestadores -> planilha-modelo do Ministério.
 * Não escreve no banco nem modifica o arquivo original em disco.
 * A IA pode extrair documentos, mas não participa dos cálculos.
 */
import * as Namespace from "xlsx-js-style";
import type * as XLSX from "xlsx-js-style";
import type { FopagExtracao } from "./piso-fopag-parser";
const XL = ((Namespace as unknown as { default?: typeof Namespace }).default ?? Namespace) as typeof Namespace;

export type OrigemPiso = {
  cpf: string;
  nome: string;
  origem: "FOPAG" | "PRESTADORES";
  unidade: string;
  adicional: number;
  encargo: number;
  variavel: number;
};
export type PendenciaPiso = { tipo: "bloqueio" | "aviso"; mensagem: string };
export type AnalisePiso = {
  pendencias: PendenciaPiso[];
  fontes: OrigemPiso[];
  encontrados: number;
  totalModelo: number;
  alteracoes: number;
  competenciaFopag: string | null;
  competenciaPrestadores: string | null;
  valores: Map<number, { g: number; i: number; k: number }>;
};

const erro = (pendencias: PendenciaPiso[], mensagem: string) =>
  pendencias.push({ tipo: "bloqueio", mensagem });
const normalizar = (v: unknown) => String(v ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const cpf = (v: unknown) => {
  const digits = String(v ?? "").replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11 ? digits.padStart(11, "0") : "";
};
const centavos = (v: unknown): number => {
  if (typeof v === "number") return Math.round(v * 100);
  let t = String(v ?? "").replace(/[^\d,.-]/g, "");
  if (!t) return 0;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const moeda = (cent: number) => Math.round(cent) / 100;
const linhas = (sheet: XLSX.WorkSheet): unknown[][] =>
  XL.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true }) as unknown[][];
const cabecalho = (row: unknown[]) => row.map(normalizar);
const coluna = (headers: string[], ...nomes: string[]) =>
  headers.findIndex(h => nomes.some(n => h === normalizar(n)));
const cel = (row: unknown[], pos: number) => pos < 0 ? null : row[pos];
const tituloCompetencia = (sheet: XLSX.WorkSheet): string | null => {
  const texto = String(linhas(sheet).slice(0, 3).flat().filter(Boolean).join(" "));
  const m = /(?:COMPET[EÊ]NCIA\s*)?(0?[1-9]|1[0-2])[\/-](20\d{2})/i.exec(texto);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;
  const n = /\b(20\d{2})[\/-](0[1-9]|1[0-2])\b/.exec(texto);
  return n ? `${n[1]}-${n[2]}` : null;
};
const planilha = (wb: XLSX.WorkBook, padrao: RegExp) =>
  wb.Sheets[wb.SheetNames.find(n => padrao.test(n)) ?? wb.SheetNames[0]];

export function carregarXlsx(bytes: ArrayBuffer): XLSX.WorkBook {
  return XL.read(new Uint8Array(bytes), { type: "array", cellStyles: true, cellFormula: true });
}

export function extrairFopagPlanilha(wb: XLSX.WorkBook, pendencias: PendenciaPiso[]): {
  fontes: OrigemPiso[]; competencia: string | null;
} {
  const sheet = planilha(wb, /CALCULO_PISO/);
  if (!sheet) { erro(pendencias, "Arquivo FOPAG sem aba de cálculo."); return { fontes: [], competencia: null }; }
  const data = linhas(sheet);
  const h = data.findIndex(r => r.some(v => normalizar(v) === "TOTAL POSITIVOS") && r.some(v => normalizar(v) === "CPF"));
  if (h < 0) { erro(pendencias, "FOPAG: cabeçalho TOTAL POSITIVOS/CPF não encontrado."); return { fontes: [], competencia: tituloCompetencia(sheet) }; }
  const headers = cabecalho(data[h]);
  const iCpf = coluna(headers, "CPF"), iNome = coluna(headers, "NOME DO PROFISSIONAL");
  const iPos = coluna(headers, "TOTAL POSITIVOS"), iAdn = coluna(headers, "ADN");
  const iInss = coluna(headers, "INSS"), iIrrf = coluna(headers, "IRRF");
  if ([iCpf, iPos, iAdn, iInss, iIrrf].some(i => i < 0)) erro(pendencias, "FOPAG: colunas de CPF, vantagens, INSS, IRRF ou ADN ausentes.");
  const out: OrigemPiso[] = [];
  for (const [idx, row] of data.entries()) {
    if (idx <= h || !/^\d{11}$/.test(cpf(cel(row, iCpf)))) continue;
    const id = cpf(cel(row, iCpf));
    // O TOTAL POSITIVOS pode ser uma fórmula sem cache; sempre recalculamos B:P (ou C:Q).
    const inicio = iNome >= 0 ? iNome + 1 : iCpf + 1;
    const variavel = row.slice(inicio, iPos).reduce<number>((s, v) => s + centavos(v), 0);
    out.push({ cpf: id, nome: String(cel(row, iNome) ?? ""), origem: "FOPAG",
      unidade: "FOPAG", adicional: moeda(centavos(cel(row, iAdn))),
      encargo: moeda(centavos(cel(row, iInss)) + centavos(cel(row, iIrrf))),
      variavel: moeda(variavel) });
  }
  if (!out.length) erro(pendencias, "FOPAG: nenhum CPF reconhecido na aba de cálculo.");
  return { fontes: out, competencia: tituloCompetencia(sheet) };
}

export function extrairFopagPdf(extracoes: FopagExtracao[], pendencias: PendenciaPiso[]) {
  const fontes: OrigemPiso[] = [];
  const competencias = new Set<string>();
  for (const e of extracoes) {
    if (e.competencia) competencias.add(e.competencia);
    for (const f of e.funcionarios) {
      if (!f.cpf) { erro(pendencias, `FOPAG PDF: ${f.nome ?? "sem nome"} sem CPF válido.`); continue; }
      if (f.divergencias.length) erro(pendencias, `FOPAG PDF: ${f.nome}: ${f.divergencias.join("; ")}`);
      const r = f.rubricas;
      const positivas = [
        "aux_financeiro", "tempo_servico", "insalubridade", "hora_extra_50", "hora_extra_100",
        "plantao", "sobreaviso", "vale_transporte", "grat_funcao_vr", "grat_funcao_pct",
        "grat_nivel_superior", "incentivos",
      ].reduce((s, k) => s + centavos(r[k as keyof typeof r]), 0);
      // Férias e outras rubricas exigem conferência com o PDF original.
      fontes.push({ cpf: cpf(f.cpf), nome: f.nome ?? "", origem: "FOPAG", unidade: "FOPAG",
        adicional: moeda(centavos(r.adicional_noturno)),
        encargo: moeda(centavos(r.inss) + centavos(r.irrf)), variavel: moeda(positivas) });
    }
  }
  // O parser pode não reconhecer todas as rubricas de férias e vantagens.
  // Impedir liberação silenciosa quando faltam valores cuja origem é o PDF.
  for (const extracao of extracoes) {
    if (extracao.rubricasNaoReconhecidas.length || extracao.comDivergencia || extracao.cpfInvalido)
      erro(pendencias, "FOPAG PDF exige revisão de rubricas não reconhecidas, valores ou CPFs.");
  }
  if (competencias.size > 1) erro(pendencias, "Os PDFs FOPAG contêm competências diferentes.");
  if (!fontes.length) erro(pendencias, "Nenhum profissional extraído dos PDFs FOPAG.");
  // Rubricas de férias devem ser conferidas antes da exportação ministerial.
  pendencias.push({ tipo: "aviso", mensagem: "FOPAG PDF: conferir rubricas de férias e vantagens não reconhecidas antes de gerar o arquivo oficial." });
  return { fontes, competencia: competencias.size === 1 ? [...competencias][0] : null };
}

export function extrairPrestadores(wb: XLSX.WorkBook, pendencias: PendenciaPiso[]) {
  const sheet = planilha(wb, /CONSOLIDADO_GERAL/);
  if (!sheet || !wb.SheetNames.some(n => /CONSOLIDADO_GERAL/.test(n))) {
    erro(pendencias, "Prestadores: é necessária a aba CONSOLIDADO_GERAL para evitar duplicidades entre unidades.");
    return { fontes: [] as OrigemPiso[], competencia: null as string | null };
  }
  const data = linhas(sheet);
  const h = data.findIndex(r => r.some(v => normalizar(v) === "CPF" || normalizar(v) === "C P F") &&
    r.some(v => normalizar(v) === "UNIDADE"));
  if (h < 0) { erro(pendencias, "Prestadores: cabeçalho da aba consolidada não encontrado."); return { fontes: [], competencia: tituloCompetencia(sheet) }; }
  const headers = cabecalho(data[h]);
  const c = (...n: string[]) => coluna(headers, ...n);
  const cpfCol = c("CPF", "C.P.F."), unidadeCol = c("UNIDADE"), nomeCol = c("NOME");
  const base = c("BASE"), ins = c("INSALUBRIDADE"), he = c("H.E."), ad = c("AD.NOTURNO");
  const plantao = c("PLANTÃO"), incentivo = c("INCENTIVO");
  const grat = c("GRAT. INCENTIVO"), transp = c("AUX. TRANSP.");
  if ([cpfCol, unidadeCol, nomeCol, base, ins, he, ad, plantao, incentivo].some(i => i < 0))
    erro(pendencias, "Prestadores: faltam campos financeiros ou de identificação na aba consolidada.");
  const fontes: OrigemPiso[] = [];
  for (const [index, row] of data.entries()) {
    if (index <= h || !/^\d{11}$/.test(cpf(cel(row, cpfCol)))) continue;
    const unidade = String(cel(row, unidadeCol) ?? "");
    const u = normalizar(unidade).replace(/\s/g, "");
    const ce = centavos(cel(row, he)), cp = centavos(cel(row, plantao));
    const ci = centavos(cel(row, incentivo)), cg = centavos(cel(row, grat)), ct = centavos(cel(row, transp));
    const bruto = [base, ins, he, ad, plantao].reduce((s, i) => s + centavos(cel(row, i)), 0);
    const variavel = /HMSDS/.test(u) ? ci :
      /SAMU/.test(u) ? cp :
      /UBS/.test(u) ? ce + ci + cg + ct : ce + ci;
    fontes.push({ cpf: cpf(cel(row, cpfCol)), nome: String(cel(row, nomeCol) ?? ""),
      origem: "PRESTADORES", unidade, adicional: moeda(centavos(cel(row, ad))),
      encargo: moeda(Math.round(bruto * 0.05)), variavel: moeda(variavel) });
  }
  if (!fontes.length) erro(pendencias, "Prestadores: não foram encontrados CPFs na aba consolidada.");
  return { fontes, competencia: tituloCompetencia(sheet) };
}

export function auditarPiso(args: {
  fopag: OrigemPiso[];
  prestadores: OrigemPiso[];
  modelo: XLSX.WorkBook;
  competencia: string;
  competenciaFopag: string | null;
  competenciaPrestadores: string | null;
  pendencias?: PendenciaPiso[];
}): AnalisePiso {
  const pendencias = [...(args.pendencias ?? [])];
  for (const [rotulo, competencia] of [["FOPAG", args.competenciaFopag], ["PRESTADORES", args.competenciaPrestadores]] as const) {
    if (!competencia) erro(pendencias, `${rotulo}: competência não identificada; revise o documento original.`);
    else if (competencia !== args.competencia)
      erro(pendencias, `${rotulo}: documento indica ${competencia}, mas foi escolhida ${args.competencia}.`);
  }
  const fontes = [...args.fopag, ...args.prestadores];
  const porCpf = new Map<string, OrigemPiso>();
  for (const registro of fontes) {
    if (!/^\d{11}$/.test(registro.cpf)) {
      erro(pendencias, `CPF inválido na origem ${registro.origem}: ${registro.nome}.`); continue;
    }
    if (porCpf.has(registro.cpf)) erro(pendencias, `CPF repetido nas origens: final ${registro.cpf.slice(-4)}.`);
    else porCpf.set(registro.cpf, registro);
    if (![registro.adicional, registro.encargo, registro.variavel].every(Number.isFinite))
      erro(pendencias, `Valor financeiro inválido: ${registro.nome}.`);
  }
  const sheet = args.modelo.Sheets[args.modelo.SheetNames[0]];
  const headers = sheet ? cabecalho(linhas(sheet)[0] ?? []) : [];
  if (headers[0] !== "CPF PROFISSIONAL" || headers[6] !== "ADICIONAL NOTURNO" ||
      headers[8] !== "ENCARGO TRABALHISTA" || headers[10] !== "VANTAGEM VARIAVEL VPVT") {
    erro(pendencias, "Modelo do Ministério: estrutura A:K incompatível. Nenhuma célula será alterada.");
  }
  const data = sheet ? linhas(sheet) : [];
  const vistos = new Set<string>();
  const valores = new Map<number, { g: number; i: number; k: number }>();
  for (let n = 1; n < data.length; n++) {
    const row = data[n], id = cpf(row[0]);
    if (!/^\d{11}$/.test(id)) continue;
    if (vistos.has(id)) erro(pendencias, `CPF duplicado no modelo, final ${id.slice(-4)}.`);
    vistos.add(id);
    const registro = porCpf.get(id);
    if (!registro) { erro(pendencias, `Linha ${n + 1}: CPF final ${id.slice(-4)} sem correspondência nas origens.`); continue; }
    valores.set(n + 1, { g: registro.adicional, i: registro.encargo, k: registro.variavel });
  }
  for (const id of porCpf.keys()) if (!vistos.has(id))
    erro(pendencias, `CPF final ${id.slice(-4)} consta nas origens, mas não existe no modelo.`);
  if (!valores.size) erro(pendencias, "Nenhuma correspondência entre origens e modelo.");
  return { pendencias, fontes, encontrados: valores.size, totalModelo: vistos.size,
    alteracoes: valores.size * 3, competenciaFopag: args.competenciaFopag,
    competenciaPrestadores: args.competenciaPrestadores, valores };
}

/** Mantém o arquivo modelo, sua ordem, fórmulas e colunas; escreve somente G, I e K. */
export function exportarPisoConferido(modelo: XLSX.WorkBook, analise: AnalisePiso): Uint8Array {
  if (analise.pendencias.some(p => p.tipo === "bloqueio")) throw new Error("Pendências de conciliação impedem a exportação.");
  const sheet = modelo.Sheets[modelo.SheetNames[0]];
  for (const [linha, valores] of analise.valores) {
    for (const [col, value] of [["G", valores.g], ["I", valores.i], ["K", valores.k]] as const) {
      const addr = `${col}${linha}`;
      const original = sheet[addr] as XLSX.CellObject | undefined;
      sheet[addr] = value === 0
        ? { ...original, t: "z", v: undefined, f: undefined }
        : { ...original, t: "n", v: value, f: undefined, z: original?.z ?? "#,##0.00" };
    }
  }
  const output = XL.write(modelo, { type: "array", bookType: "xlsx", cellStyles: true }) as ArrayBuffer;
  return new Uint8Array(output);
}
