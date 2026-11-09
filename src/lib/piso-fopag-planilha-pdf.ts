/** Exportação auditável da FOPAG extraída dos PDFs — layout de 21 colunas. */
import * as XNamespace from "xlsx-js-style";
import type { FopagExtracao } from "./piso-fopag-parser";
const XL = ((XNamespace as unknown as { default?: typeof XNamespace }).default ?? XNamespace) as typeof XNamespace;

export const CABECALHO_FOPAG_21 = [
  "CPF","AUX. FINANC.","TEMPO DE SERV.","INSALUBRIDADE","1/3 FÉRIAS",
  "FÉRIAS NORMAS","HR. EX. 50%","HR. EX.100%","PLANTÃO",
  "SOBREAVISOS","VALE TRANSP.","GRAT. FUN VR","GRAT. FUN %VB",
  "GRAT. NIVEL SUP.","INCENTIVOS","AUX. FIN. PISO",
  "TOTAL POSITIVOS","INSS","IRRF","TOTAL DESCONTO","ADN",
] as const;

/** Documento de conferência: os campos de férias podem exigir revisão manual. */
export function criarPlanilhaFopagPdf(extracoes: FopagExtracao[], competencia: string): Uint8Array {
  const cpfs = new Set<string>();
  const dados: (string | number | { f:string })[][] = [];
  for (const e of extracoes) {
    for (const f of e.funcionarios) {
      const id = String(f.cpf ?? "").replace(/\D/g, "");
      if (id.length !== 11) throw new Error(`CPF ausente ou inválido na FOPAG: ${f.nome ?? "sem nome"}.`);
      if (cpfs.has(id)) {
        // Documentos complementares podem repetir o mesmo CPF. O rascunho
        // apenas ignora a repetição; a conciliação separada audita diferenças
        // entre valores e bloqueia o arquivo ministerial quando necessário.
        continue;
      }
      if (f.divergencias.length || f.rubricasNaoReconhecidas.length)
        throw new Error(`FOPAG de ${f.nome}: divergências ou rubricas não reconhecidas.`);
      cpfs.add(id);
      const r=f.rubricas;
      // Férias e a classificação entre auxílio financeiro/complemento devem
      // ser confirmadas na fonte. Não presumir valores que o parser não conhece.
      // A saída é sempre marcada como RASCUNHO, nunca liberada como documento oficial.
      const valores=[
        r.aux_financeiro,r.tempo_servico,r.insalubridade,0,0,r.hora_extra_50,
        r.hora_extra_100,r.plantao,r.sobreaviso,r.vale_transporte,
        r.grat_funcao_vr,r.grat_funcao_pct,r.grat_nivel_superior,r.incentivos,0,
      ];
      const linha = 5+dados.length;
      dados.push([
        id,...valores,{f:`SUM(B${linha}:P${linha})`},r.inss,r.irrf,
        {f:`SUM(R${linha}:S${linha})`},r.adicional_noturno,
      ]);
    }
  }
  const ws = XL.utils.aoa_to_sheet([
    [`RASCUNHO PARA CONFERENCIA — FOPAG COMPETÊNCIA ${competencia} — VALIDAR FÉRIAS E RUBRICAS`],[],[],[...CABECALHO_FOPAG_21], ...dados
  ]);
  ws["!cols"] = CABECALHO_FOPAG_21.map((h,i)=>({wch:i===0?18:16}));
  const wb=XL.utils.book_new();
  XL.utils.book_append_sheet(wb,ws,"CALCULO_PISO_ENFERMAGEM");
  const output = XL.write(wb,{type:"array",bookType:"xlsx"}) as ArrayBuffer;
  return new Uint8Array(output);
}
