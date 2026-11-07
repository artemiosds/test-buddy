import { describe, expect, it } from "vitest";
import * as XNamespace from "xlsx-js-style";
import { processarPrestadoresLote } from "./piso-prestadores-lote";
import type { PendenciaPiso } from "./piso-conferencia-ministerio";
const XL = ((XNamespace as unknown as { default?: typeof XNamespace }).default ?? XNamespace) as typeof XNamespace;
function arquivo(nome:string, titulo:string, rows:unknown[][]) {
  const wb = XL.utils.book_new();
  XL.utils.book_append_sheet(wb, XL.utils.aoa_to_sheet([[titulo],[],[],
    ["NOME","C.P.F.","CARGO","DIAS","BASE","INSALUBRIDADE","H.E.","AD.NOTURNO","PLANTÃO E SOBREAVISO","INCENTIVO","GRAT.INCENTIVO","AUX. TRANSP."],...rows]), "Planilha1");
  return {nome,workbook:wb};
}
describe("lote de Prestadores com arquivos de cada unidade", () => {
  it("calcula HMO e HMSDS sem misturar plantão com incentivo", () => {
    const pendencias:PendenciaPiso[]=[];
    const arquivos=[
      arquivo("SAUDE-HMO.xlsx","Competência 09/2026",[["Pessoa A","01234567890","ENFERMEIRO",30,3000,500,100,200,300,2068.79,0,0]]),
      arquivo("SAUDE-HMSDS.xlsx","Competência 09/2026",[["Pessoa B","09876543210","ENFERMEIRA",30,3000,500,100,200,300,2068.79,0,0]]),
    ];
    const r=processarPrestadoresLote(arquivos,"2026-09",pendencias);
    expect(pendencias).toHaveLength(0);
    expect(r.fontes).toHaveLength(2);
    expect(r.fontes[0]).toMatchObject({adicional:200,encargo:205,variavel:2168.79});
    expect(r.fontes[1]).toMatchObject({adicional:200,encargo:205,variavel:2068.79});
    expect(r.workbook.SheetNames).toContain("CONSOLIDADO_GERAL");
    expect(r.workbook.SheetNames).toContain("H.M.O.");
  });
  it("soma incentivo, gratificação e auxílio somente na UBS", () => {
    const pendencias:PendenciaPiso[]=[];
    const r=processarPrestadoresLote([
      arquivo("SAUDE-UBS.xlsx","Competência 09/2026",[["Pessoa C","01234567890","ENFERMEIRO",30,3000,500,100,0,0,2068.79,50,20]])
    ],"2026-09",pendencias);
    expect(r.fontes[0].variavel).toBe(2238.79);
  });
  it("impede misturar títulos de agosto com competência setembro", () => {
    const pendencias:PendenciaPiso[]=[];
    processarPrestadoresLote([
      arquivo("SAUDE-HMO.xlsx","HMO - AGOSTO 2026",[["Pessoa A","01234567890","ENFERMEIRO",30,3000,500,0,0,0,2068.79]])
    ],"2026-09",pendencias);
    expect(pendencias.some(p=>p.tipo==="bloqueio" && p.mensagem.includes("divergente"))).toBe(true);
  });
  it("bloqueia duplicação de unidade entre arquivos", () => {
    const pendencias:PendenciaPiso[]=[];
    const f=arquivo("SAUDE-HMO.xlsx","Competência 09/2026",[["Pessoa A","01234567890","ENFERMEIRO",30,3000,500,0,0,0,2068.79]]);
    processarPrestadoresLote([f,f],"2026-09",pendencias);
    expect(pendencias.some(p=>p.mensagem.includes("mais de um arquivo"))).toBe(true);
  });
});
