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

export type DadosPlanilhaPiso = {
  linhas: LinhaPlanilha[];
  competencia: string;
  tipo: "contratados" | "efetivos" | "calculo_piso" | "piso_enfermagem";
  incentivos?: MapaIncentivos | null;
  total: number;
  filename: string;
};

/** Monta o base64 do .xlsx a partir dos dados devolvidos pelo servidor. */
export function montarBase64Planilha(r: DadosPlanilhaPiso): string {
  const linhas = r.linhas ?? [];
  const competencia = r.competencia ?? "";
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
