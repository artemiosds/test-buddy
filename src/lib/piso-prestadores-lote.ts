/**
 * Processa planilhas brutas de Prestadores sem gravar no banco de dados.
 * Identifica modelos, padroniza cargos e calcula os valores em centavos.
 */
import * as XLSXNamespace from "xlsx-js-style";
import type * as XLSX from "xlsx-js-style";
import type { OrigemPiso, PendenciaPiso } from "./piso-conferencia-ministerio";
const XL = ((XLSXNamespace as unknown as { default?: typeof XLSXNamespace }).default ?? XLSXNamespace) as typeof XLSXNamespace;

const norm = (v: unknown) => String(v ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "").trim();
const dinheiro = (v: unknown) => {
  if (typeof v === "number") return Math.round(v * 100);
  let s = String(v ?? "").replace(/[^\d,.-]/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const reais = (cent: number) => Math.round(cent) / 100;
const cpf = (v: unknown) => {
  const s = String(v ?? "").replace(/\D/g, "");
  return s.length === 10 || s.length === 11 ? s.padStart(11, "0") : "";
};
const enfermeiro = (cargo: string) => /ENFERMEIR/.test(cargo) && !/TEC|AUX/.test(cargo);
const tecnico = (cargo: string) => /(?:TEC|TECNIC|AUX|AUXILIAR)/.test(cargo) && /ENFERM/.test(cargo);
const get = (r: unknown[], col: number) => col < 0 ? null : r[col];

function unidadeDoNome(nome: string) {
  const n = norm(nome);
  if (/HMSDS|MATERNIDADE|SAO DOMINGOS/.test(n)) return "H.M.S.D.S.";
  if (/HMO|HOSPITAL MUNICIPAL/.test(n)) return "H.M.O.";
  if (/UBS|UNIDADE BASICA/.test(n)) return "UBS_S";
  if (/SAMU/.test(n)) return "SAMU_I";
  if (/CAPS/.test(n)) return "CAPS";
  if (/CER|CENTRO ESPECIALIZADO/.test(n)) return "CER";
  if (/CTA|VIG SAUDE/.test(n)) return "CTA_VIG_SAUDE";
  if (/EPIDEMIOLOG/.test(n)) return "VIG_EPIDEMIOLOGICA";
  if (/TFD/.test(n)) return "TFD";
  if (/PREDIO|SECRETARIA/.test(n)) return "PREDIO_SECRETARIA";
  return null;
}
const MESES = ["JANEIRO","FEVEREIRO","MARCO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
function detectarCompetencia(s: string): string | null {
  const txt = String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const a = /(?:COMPETENCIA\s*)?(0?[1-9]|1[0-2])[\/.-](20\d\d)/.exec(txt);
  if (a) return `${a[2]}-${a[1].padStart(2,"0")}`;
  const b = /\b(20\d\d)[\/.-](0[1-9]|1[0-2])\b/.exec(txt);
  if (b) return `${b[1]}-${b[2]}`;
  const m = MESES.findIndex(m => new RegExp(`\\b${m}\\b`).test(txt));
  const year = /\b20\d\d\b/.exec(txt)?.[0];
  return m >= 0 && year ? `${year}-${String(m+1).padStart(2,"0")}` : null;
}
export type ArquivoPrestadores = { nome: string; workbook: XLSX.WorkBook };
export type LotePrestadores = {
  fontes: OrigemPiso[];
  competencia: string | null;
  workbook: XLSX.WorkBook;
  totaisPorUnidade: Record<string, number>;
};
const HEADERS = ["UNIDADE","NOME","C.P.F.","CARGO","DIAS","BASE","INSALUBRIDADE","H.E.",
  "AD.NOTURNO","PLANTÃO","BRUTO","ISS (5%)","INCENTIVO","GRAT. INCENTIVO",
  "AUX. TRANSP.","TOTAL FINAL"];

/** Aceita arquivos XLSX separados; nunca confunde um consolidado pronto com arquivos brutos. */
export function processarPrestadoresLote(
  arquivos: ArquivoPrestadores[], competenciaEsperada: string, pendencias: PendenciaPiso[],
): LotePrestadores {
  const fontes: OrigemPiso[] = [];
  const linhasPorUnidade = new Map<string, unknown[][]>();
  const competencias = new Set<string>();
  const nomesUsados = new Set<string>();
  const totalUnidades: Record<string, number> = {};
  for (const arquivo of arquivos) {
    const unidadeArquivo = unidadeDoNome(arquivo.nome);
    const sheets = arquivo.workbook.SheetNames.filter(n => !/CONSOLIDADO/.test(norm(n)));
    for (const nomeAba of sheets) {
      const unidade = unidadeDoNome(nomeAba) ?? unidadeArquivo;
      if (!unidade) {
        pendencias.push({ tipo:"bloqueio", mensagem:`Unidade desconhecida: ${arquivo.nome}, aba ${nomeAba}.` });
        continue;
      }
      if (nomesUsados.has(unidade)) {
        pendencias.push({ tipo:"bloqueio", mensagem:`Unidade ${unidade} apareceu em mais de um arquivo ou aba.` });
        continue;
      }
      nomesUsados.add(unidade);
      const ws = arquivo.workbook.Sheets[nomeAba];
      const data = XL.utils.sheet_to_json(ws, { header:1, raw:true, defval:null }) as unknown[][];
      const titulo = String(data.slice(0,3).flat().filter(Boolean).join(" "));
      const comp = detectarCompetencia(titulo);
      if (comp) competencias.add(comp);
      else pendencias.push({tipo:"bloqueio",mensagem:`Competência não identificada em ${arquivo.nome} / ${nomeAba}.`});
      if (comp && comp !== competenciaEsperada)
        pendencias.push({tipo:"bloqueio",mensagem:`Competência divergente: ${arquivo.nome} / ${nomeAba} indica ${comp} (esperada ${competenciaEsperada}).`});
      const hi = data.findIndex(r => r.some(v => norm(v) === "NOME") &&
        r.some(v => ["CPF","CPF"].includes(norm(v))) &&
        r.some(v => norm(v) === "CARGO"));
      if (hi < 0) {
        pendencias.push({tipo:"bloqueio",mensagem:`Cabeçalho de CPF/NOME/CARGO ausente em ${nomeAba}.`});
        continue;
      }
      const h = data[hi].map(norm);
      const c = (...aliases:string[]) => h.findIndex(x => aliases.some(a=>norm(a)===x));
      const nm = c("NOME"), cp = c("CPF", "C.P.F."), cargoCol = c("CARGO");
      const dias = c("DIAS"), base = c("BASE"), ins = c("INSALUBRIDADE", "INSALUBIRADE");
      const he = c("H.E.","H E"), ad = c("AD.NOTURNO","AD. NOTURNO","AD NOTURNO");
      const plantao = c("PLANTÃO","PLANTÃO E SOBREAVISO","PLANTÃI E SOBREAVISO","PLANTO E SOBREAVISO");
      const grat = c("GRAT.INCENTIVO","GRAT. INCENTIVO"), trans = c("AUX. TRANSP.","AUX TRANSP");
      const inc = c("INCENTIVO");
      if ([base,ins,he,ad].some(i=>i<0)) pendencias.push({
        tipo:"bloqueio",mensagem:`Colunas financeiras faltando na unidade ${unidade}.`
      });
      let cont = 0;
      const registros: unknown[][] = [];
      for (let i = hi+1;i<data.length;i++) {
        const row = data[i];
        const cargo = norm(get(row,cargoCol));
        if (!enfermeiro(cargo) && !tecnico(cargo)) continue;
        const id = cpf(get(row,cp));
        if (!id) {pendencias.push({tipo:"bloqueio",mensagem:`CPF ausente/incorreto em ${unidade}, linha ${i+1}.`});continue;}
        const baseC = dinheiro(get(row,base)), insC = dinheiro(get(row,ins));
        const heC = dinheiro(get(row,he)), adC = dinheiro(get(row,ad));
        const plantC = dinheiro(get(row,plantao));
        const incentiveC = inc >= 0 && get(row,inc) != null
          ? dinheiro(get(row,inc)) : enfermeiro(cargo) ? 206879 : 0;
        const gratC = dinheiro(get(row,grat)), transC = dinheiro(get(row,trans));
        const bruto = baseC + insC + heC + adC + plantC;
        const iss = Math.round(bruto*0.05);
        const final = unidade === "H.M.S.D.S." ? incentiveC :
          unidade === "SAMU_I" ? plantC :
          unidade === "UBS_S" ? heC + incentiveC + gratC + transC : heC + incentiveC;
        fontes.push({ cpf:id, nome:String(get(row,nm)??""), origem:"PRESTADORES",
          unidade, adicional:reais(adC), encargo:reais(iss), variavel:reais(final) });
        registros.push([unidade,String(get(row,nm)??""),id,cargo,get(row,dias),reais(baseC),
          reais(insC),reais(heC),reais(adC),reais(plantC),reais(bruto),
          reais(iss),reais(incentiveC),reais(gratC),reais(transC),reais(final)]);
        cont++;
      }
      totalUnidades[unidade] = (totalUnidades[unidade]??0)+cont;
      linhasPorUnidade.set(unidade, registros);
      if ((unidade === "TFD" || unidade === "PREDIO_SECRETARIA") && cont)
        pendencias.push({tipo:"bloqueio",mensagem:`${unidade} possui ${cont} profissional(is) de enfermagem; confira a exceção.`});
    }
  }
  if (competencias.size > 1)
    pendencias.push({tipo:"bloqueio",mensagem:"Arquivos de Prestadores possuem competências diferentes."});
  if (!fontes.length) pendencias.push({tipo:"bloqueio",mensagem:"Nenhum prestador de enfermagem encontrado."});
  const wb = XL.utils.book_new();
  const allRows = [[`PRESTADORES ENFERMAGEM - COMPETÊNCIA ${competenciaEsperada}`],[],[],HEADERS,
    ...[...linhasPorUnidade.values()].flat()];
  XL.utils.book_append_sheet(wb, XL.utils.aoa_to_sheet(allRows), "CONSOLIDADO_GERAL");
  for(const [unidade, registros] of linhasPorUnidade) {
    XL.utils.book_append_sheet(wb, XL.utils.aoa_to_sheet([
      [`PRESTADORES - ${unidade} - COMPETÊNCIA ${competenciaEsperada}`],[],[],HEADERS,...registros
    ]), unidade.slice(0,31));
  }
  return { fontes, competencia:competencias.size===1?[...competencias][0]:null,
    workbook:wb, totaisPorUnidade:totalUnidades };
}

export function baixarConsolidadoPrestadores(wb: XLSX.WorkBook): Uint8Array {
  const data = XL.write(wb, {type:"array",bookType:"xlsx",cellStyles:true}) as ArrayBuffer;
  return new Uint8Array(data);
}
