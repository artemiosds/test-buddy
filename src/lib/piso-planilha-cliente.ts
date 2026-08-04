// Geração do arquivo .xlsx no navegador.
//
// O servidor devolve apenas os dados consolidados; montar o binário aqui evita
// o erro "Failed to fetch" (o runtime serverless caía ao montar a planilha e a
// resposta binária grande era abortada pelo navegador).

import {
  gerarPlanilhaContratados,
  gerarPlanilhaEfetivos,
  gerarPlanilhaCalculoPiso,
  gerarPlanilhaPisoEnfermagem,
  type LinhaPlanilha,
  type MapaIncentivos,
} from "./piso-planilha";
import * as XLSXNamespace from "xlsx-js-style";
import { calcularUbs, montarPlanilhaUbs } from "./import-templates/calculators/ubsCalculator";
import {
  calcularHmo,
  montarPlanilhaHmo,
  ABA_HMO,
} from "./import-templates/calculators/hmoCalculator";
import {
  calcularHmsds,
  montarPlanilhaHmsds,
  ABA_HMSDS,
} from "./import-templates/calculators/hmsdsCalculator";
import {
  calcularCaps,
  montarPlanilhaCaps,
  ABA_CAPS,
} from "./import-templates/calculators/capsCalculator";
import {
  calcularPadraoAdm,
  montarPlanilhaPadraoAdm,
  ABA_PADRAO_ADM,
} from "./import-templates/calculators/padraoAdmCalculator";

const XLSX = ((XLSXNamespace as unknown as { default?: typeof XLSXNamespace }).default ??
  XLSXNamespace) as typeof XLSXNamespace;

export type OrigemModelo =
  | "UBS_SAUDE"
  | "HMO_SAUDE"
  | "HMSDS_SAUDE"
  | "CAPS_SAUDE"
  | "PADRAO_ADM";


export type DadosPlanilhaPiso = {
  linhas: LinhaPlanilha[];
  competencia: string;
  tipo: "contratados" | "efetivos" | "calculo_piso" | "piso_enfermagem";
  incentivos?: MapaIncentivos | null;
  total: number;
  filename: string;
  origem_modelo?: OrigemModelo | null;
};

/** Converte a linha consolidada no formato aceito pelos calculadores. */
function paraLinhaCalculavel(l: LinhaPlanilha): Record<string, unknown> {
  const x = l as unknown as Record<string, unknown>;
  return {
    nome: l.nome,
    cpf: l.cpf,
    unidade: l.lotacao,
    cargo: l.cargo,
    dias_trabalhados: l.dias,
    salario_base: l.salario_base,
    insalubridade: l.insalubridade,
    hora_extra_50: l.hora_extra,
    adicional_noturno: l.adicional_noturno,
    plantao: x.plantao ?? x.sobreaviso,
    gratificacao_incentivo: l.gratificacao_incentivo ?? l.gratificacoes,
    auxilio_transporte: l.auxilio_transporte ?? l.vale_transporte,
    incentivo: l.incentivo,
    total_liquido_base: l.total_liquido_base,
    pensao_alimenticia: x.pensao_alimenticia,
    valor_final: l.valor_final,

  };
}

/** Escreve a matriz (valores + fórmulas) numa aba do xlsx. */
function escreverAba(
  aoa: unknown[][],
  larguras: number[],
  aba: string,
  colunaMoedaInicial: number,
): string {
  const ws: import("xlsx-js-style").WorkSheet = {};
  aoa.forEach((row, r) =>
    row.forEach((value, c) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (value && typeof value === "object" && "f" in value) {
        ws[ref] = { t: "n", f: String((value as { f: unknown }).f), z: "#,##0.00" };
      } else if (typeof value === "number") {
        ws[ref] = { t: "n", v: value, z: c >= colunaMoedaInicial ? "#,##0.00" : undefined };
      } else {
        ws[ref] = { t: "s", v: String(value ?? "") };
      }
    }),
  );
  const ultimaColuna = Math.max(0, larguras.length - 1);
  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(0, aoa.length - 1), c: ultimaColuna },
  });
  ws["!cols"] = larguras.map((wch) => ({ wch }));
  ws["!autofilter"] = {
    ref: `A1:${XLSX.utils.encode_col(ultimaColuna)}${Math.max(1, aoa.length)}`,
  };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, aba);
  return XLSX.write(wb, { type: "base64", bookType: "xlsx" }) as string;
}

function montarUbsBase64(linhas: LinhaPlanilha[]): string {
  const aoa = montarPlanilhaUbs(linhas.map((l) => calcularUbs(paraLinhaCalculavel(l))));
  return escreverAba(
    aoa,
    [38, 16, 30, 26, 8, 14, 16, 14, 16, 14, 14, 14, 18, 16, 16, 14],
    "UBS (3)",
    5,
  );
}

function montarHmoBase64(linhas: LinhaPlanilha[]): string {
  const aoa = montarPlanilhaHmo(linhas.map((l) => calcularHmo(paraLinhaCalculavel(l))));
  return escreverAba(
    aoa,
    [38, 16, 20, 26, 8, 14, 16, 14, 16, 20, 14, 14, 16, 14],
    ABA_HMO,
    5,
  );
}

function montarHmsdsBase64(linhas: LinhaPlanilha[]): string {
  const aoa = montarPlanilhaHmsds(linhas.map((l) => calcularHmsds(paraLinhaCalculavel(l))));
  return escreverAba(
    aoa,
    [38, 16, 20, 26, 8, 14, 16, 14, 16, 20, 14, 14, 14, 18, 16, 14],
    ABA_HMSDS,
    5,
  );
}

function montarCapsBase64(linhas: LinhaPlanilha[]): string {
  const aoa = montarPlanilhaCaps(linhas.map((l) => calcularCaps(paraLinhaCalculavel(l))));
  return escreverAba(aoa, [38, 16, 20, 26, 8, 14, 16, 14, 14, 14, 16, 16, 14], ABA_CAPS, 5);
}

function montarPadraoAdmBase64(linhas: LinhaPlanilha[]): string {
  const aoa = montarPlanilhaPadraoAdm(
    linhas.map((l) => calcularPadraoAdm(paraLinhaCalculavel(l))),
  );
  return escreverAba(
    aoa,
    [38, 16, 20, 26, 8, 14, 16, 14, 16, 14, 14, 16, 14],
    ABA_PADRAO_ADM,
    5,
  );
}

/** Monta o base64 do .xlsx a partir dos dados devolvidos pelo servidor. */
export function montarBase64Planilha(r: DadosPlanilhaPiso): string {
  const linhas = r.linhas ?? [];
  const competencia = r.competencia ?? "";
  if (r.tipo === "contratados" && r.origem_modelo === "UBS_SAUDE") {
    return montarUbsBase64(linhas);
  }
  if (r.tipo === "contratados" && r.origem_modelo === "HMO_SAUDE") {
    return montarHmoBase64(linhas);
  }
  if (r.tipo === "contratados" && r.origem_modelo === "HMSDS_SAUDE") {
    return montarHmsdsBase64(linhas);
  }
  if (r.tipo === "contratados" && r.origem_modelo === "CAPS_SAUDE") {
    return montarCapsBase64(linhas);
  }
  if (r.tipo === "contratados" && r.origem_modelo === "PADRAO_ADM") {
    return montarPadraoAdmBase64(linhas);
  }


  switch (r.tipo) {
    case "contratados":
      return gerarPlanilhaContratados(linhas, {
        competencia,
        incentivos: r.incentivos ?? undefined,
      });
    case "calculo_piso":
      return gerarPlanilhaCalculoPiso(linhas, { competencia });
    case "piso_enfermagem":
      return gerarPlanilhaPisoEnfermagem(linhas, { competencia });
    default:
      return gerarPlanilhaEfetivos(linhas, { competencia });
  }
}

/** Dispara o download do arquivo .xlsx no navegador. */
export function baixarPlanilhaPiso(r: DadosPlanilhaPiso, filename?: string) {
  const base64 = montarBase64Planilha(r);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? r.filename;
  a.click();
  URL.revokeObjectURL(url);
}
