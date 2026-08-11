import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Loader2, AlertCircle, CheckCircle2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { extractPdfAoa } from "@/lib/piso-pdf";
import { useServerFn } from "@tanstack/react-start";
import { extrairSalariosPDF, salvarSalariosImportados, type SalarioExtraido } from "@/lib/salarios-ia.functions";
import { supabase } from "@/integrations/supabase/client";

interface PreviewItem extends SalarioExtraido {
  status: "pronto" | "ambiguo" | "nao_encontrado";
  profissionalId?: string;
  profissionalNome?: string;
  selecionado: boolean;
}

export function ImportSalariosPdfDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState<"upload" | "processing" | "preview" | "summary">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({ total: 0, atualizados: 0 });
  
  const processarIA = useServerFn(extrairSalariosPDF);
  const salvarImport = useServerFn(salvarSalariosImportados);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setPreviewData([]);
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.type === "application/pdf") {
      setFile(f);
    } else {
      toast.error("Por favor, selecione um arquivo PDF válido.");
    }
  };

  const iniciarExtracao = async () => {
    if (!file) return;
    setLoading(true);
    setStep("processing");

    try {
      // 1. Extração de texto bruta do PDF
      const aoa = await extractPdfAoa(file);
      const texto = aoa.map(row => row.join(" | ")).join("\n");

      // 2. IA para estruturar os dados
      const { dados } = await processarIA({ data: { texto } });

      // 3. Casamento com banco de dados
      const processados: PreviewItem[] = [];
      for (const item of dados) {
        // Tenta por matrícula ou CPF
        const ident = item.identificador?.replace(/\D/g, "");
        const { data: matches } = await supabase
          .from("profissionais")
          .select("id, nome_completo, matricula, cpf")
          .or(`matricula.eq.${item.identificador},cpf.eq.${ident}`)
          .is("deleted_at", null);

        let status: PreviewItem["status"] = "nao_encontrado";
        let pId: string | undefined;
        let pNome: string | undefined;

        if (matches && matches.length === 1) {
          status = "pronto";
          pId = matches[0].id;
          pNome = matches[0].nome_completo;
        } else if (matches && matches.length > 1) {
          status = "ambiguo";
        }

        processados.push({
          ...item,
          status,
          profissionalId: pId,
          profissionalNome: pNome,
          selecionado: status === "pronto"
        });
      }

      setPreviewData(processados);
      setStep("preview");
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar PDF");
      setStep("upload");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const paraSalvar = previewData
      .filter(item => item.selecionado && item.profissionalId)
      .map(item => ({
        id: item.profissionalId!,
        salario_base: item.salario_base,
        salario_bruto: item.salario_bruto,
        salario_liquido: item.salario_liquido,
        horas_extras: item.horas_extras,
        adicional_noturno: item.adicional_noturno,
        gratificacao_incentivo: item.gratificacao_incentivo,
        vencimento_liquido: item.vencimento_liquido,
      }));

    if (paraSalvar.length === 0) {
      toast.warning("Nenhum profissional válido selecionado.");
      return;
    }

    setLoading(true);
    try {
      const res = await salvarImport({ data: paraSalvar });
      setSummary({ total: previewData.length, atualizados: res.sucesso });
      setStep("summary");
      toast.success("Importação concluída com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar dados.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!loading) onOpenChange(o); }}>
      <DialogContent className={step === "preview" ? "max-w-6xl w-[95vw]" : "max-w-md"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Importar Salários via PDF (IA)
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center space-y-2">
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                id="pdf-upload"
                onChange={handleFileChange}
              />
              <label htmlFor="pdf-upload" className="cursor-pointer block">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Clique para selecionar o PDF</p>
                <p className="text-xs text-muted-foreground">Relatórios com tabelas de profissionais</p>
              </label>
              {file && (
                <div className="mt-4 p-2 bg-primary/5 rounded border border-primary/20 flex items-center justify-between">
                  <span className="text-xs font-mono truncate">{file.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFile(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button disabled={!file} onClick={iniciarExtracao}>Processar com IA</Button>
            </DialogFooter>
          </div>
        )}

        {step === "processing" && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <div>
              <p className="font-medium">Extraindo dados e consultando IA...</p>
              <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos dependendo do tamanho do PDF.</p>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-3 rounded text-xs text-blue-700 flex gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Revisão Obrigatória: Os valores abaixo foram lidos por IA. Confira se os identificadores batem com os profissionais do sistema antes de salvar.
            </div>

            <div className="max-h-[50vh] overflow-y-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Alt.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>ID Lido</TableHead>
                    <TableHead>Profissional Sistema</TableHead>
                    <TableHead>Base</TableHead>
                    <TableHead>Bruto</TableHead>
                    <TableHead>Líquido</TableHead>
                    <TableHead>Horas Ex.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((item, idx) => (
                    <TableRow key={idx} className={item.status !== 'pronto' ? 'bg-muted/30' : ''}>
                      <TableCell>
                        <input 
                          type="checkbox" 
                          checked={item.selecionado} 
                          disabled={item.status === 'nao_encontrado'}
                          onChange={(e) => {
                            const newDate = [...previewData];
                            newDate[idx].selecionado = e.target.checked;
                            setPreviewData(newDate);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {item.status === 'pronto' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                        {item.status === 'ambiguo' && <AlertCircle className="h-4 w-4 text-yellow-600" />}
                        {item.status === 'nao_encontrado' && <X className="h-4 w-4 text-red-600" />}
                      </TableCell>

                      <TableCell className="text-xs font-mono">{item.identificador}</TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate">
                        {item.profissionalNome || <span className="text-red-500 italic">Não identificado</span>}
                      </TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          className="h-7 text-xs w-20" 
                          value={item.salario_base || 0} 
                          onChange={(e) => {
                            const newDate = [...previewData];
                            newDate[idx].salario_base = parseFloat(e.target.value);
                            setPreviewData(newDate);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          className="h-7 text-xs w-20" 
                          value={item.salario_bruto || 0}
                          onChange={(e) => {
                            const newDate = [...previewData];
                            newDate[idx].salario_bruto = parseFloat(e.target.value);
                            setPreviewData(newDate);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          className="h-7 text-xs w-20" 
                          value={item.salario_liquido || 0}
                          onChange={(e) => {
                            const newDate = [...previewData];
                            newDate[idx].salario_liquido = parseFloat(e.target.value);
                            setPreviewData(newDate);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                         <Input 
                          type="number" 
                          className="h-7 text-xs w-20" 
                          value={item.horas_extras || 0}
                          onChange={(e) => {
                            const newDate = [...previewData];
                            newDate[idx].horas_extras = parseFloat(e.target.value);
                            setPreviewData(newDate);
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={reset}>Recomeçar</Button>
              <Button disabled={loading} onClick={handleSave}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmar e Salvar {previewData.filter(d => d.selecionado).length} itens
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "summary" && (
          <div className="py-8 text-center space-y-6">
            <div className="bg-green-100 h-16 w-16 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Importação Concluída</h3>
              <p className="text-sm text-muted-foreground">
                Foram atualizados {summary.atualizados} profissionais de um total de {summary.total} extraídos do documento.
              </p>
            </div>
            <Button className="w-full" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
