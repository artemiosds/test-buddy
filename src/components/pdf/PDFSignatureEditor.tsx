import React, { useState, useEffect, useRef } from "react";
import { Rnd } from "react-rnd";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Save, 
  X, 
  Plus, 
  Trash2, 
  Type, 
  Image as ImageIcon,
  Loader2,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { getPdfjs } from "@/lib/piso-pdf";
import { applySignaturesToPdf, type SignatureInstance } from "@/lib/pdf-editor";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-permissions";
import { registrarDocumentoAssinado, armazenarPdfAssinado } from "@/lib/pdf-signature";

interface PDFSignatureEditorProps {
  fileUrl: string;
  fileName: string;
}

export function PDFSignatureEditor({ fileUrl, fileName }: PDFSignatureEditorProps) {
  const { data: me } = useCurrentUser();
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [signatures, setSignatures] = useState<SignatureInstance[]>([]);
  const [availableSignatures, setAvailableSignatures] = useState<any[]>([]);
  const [showSigPicker, setShowSigPicker] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<any>(null);

  // Carregar assinaturas do usuário
  useEffect(() => {
    async function loadSigs() {
      if (!me?.id) return;
      const { data } = await supabase
        .from("assinaturas_institucionais")
        .select("*")
        .eq("usuario_id", me.id)
        .eq("ativa", true)
        .is("deleted_at", null);
      
      const sigsWithUrls = await Promise.all((data || []).map(async (sig) => {
        if (sig.storage_path && !sig.storage_path.startsWith('institutional_')) {
          const { data: signed } = await supabase.storage
            .from("assinaturas")
            .createSignedUrl(`${me.id}/${sig.storage_path}`, 3600);
          return { ...sig, imageUrl: signed?.signedUrl };
        }
        return sig;
      }));
      
      setAvailableSignatures(sigsWithUrls);
    }
    loadSigs();
  }, [me?.id]);

  // Carregar PDF
  useEffect(() => {
    async function loadPDF() {
      try {
        setLoading(true);
        const pdfjs = await getPdfjs();
        const loadingTask = pdfjs.getDocument({ url: fileUrl });
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setLoading(false);
      } catch (err) {
        console.error("Erro ao carregar PDF:", err);
        toast.error("Não foi possível carregar o PDF.");
        setLoading(false);
      }
    }
    loadPDF();
  }, [fileUrl]);

  // Renderizar página atual
  useEffect(() => {
    async function renderPage() {
      if (!pdfDoc || !canvasRef.current) return;
      const page = await pdfDoc.getPage(currentPage);
      const scale = 1.5;
      const vp = page.getViewport({ scale });
      setViewport(vp);
      
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      canvas.height = vp.height;
      canvas.width = vp.width;

      const renderContext = {
        canvasContext: context!,
        viewport: vp,
      };
      await page.render(renderContext).promise;
    }
    renderPage();
  }, [pdfDoc, currentPage]);

  const addSignature = (sig: any) => {
    const isInstitutional = sig.storage_path?.startsWith('institutional_');
    
    const newSig: SignatureInstance = {
      id: Math.random().toString(36).substr(2, 9),
      type: isInstitutional ? "institutional" : "image",
      page: currentPage - 1,
      x: 50,
      y: 50,
      width: isInstitutional ? 150 : 100,
      height: isInstitutional ? 60 : 40,
      imageData: sig.imageUrl,
      institutionalData: isInstitutional ? {
        nome: sig.titular_nome,
        cargo: sig.titular_cargo || "",
        matricula: sig.metadata?.matricula || "",
        data: new Date().toLocaleString('pt-BR'),
        codigo: sig.metadata?.institutional_hash || ""
      } : undefined
    };

    setSignatures([...signatures, newSig]);
    setShowSigPicker(false);
  };

  const removeSignature = (id: string) => {
    setSignatures(signatures.filter(s => s.id !== id));
  };

  const updateSignature = (id: string, patch: Partial<SignatureInstance>) => {
    setSignatures(signatures.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const handleSave = async () => {
    if (signatures.length === 0) {
      toast.error("Adicione pelo menos uma assinatura.");
      return;
    }

    try {
      setGenerating(true);
      const response = await fetch(fileUrl);
      const pdfBuffer = await response.arrayBuffer();

      // Converter coordenadas da tela (baseadas no viewport do canvas) para unidades PDF (points)
      // O viewport.scale é 1.5. No PDF, 1 unit = 1/72 inch.
      const scale = viewport.scale;
      const pdfSignatures = signatures.map(sig => ({
        ...sig,
        x: sig.x / scale,
        y: sig.y / scale,
        width: sig.width / scale,
        height: sig.height / scale,
      }));

      const signedBlob = await applySignaturesToPdf(pdfBuffer, pdfSignatures);
      
      // Registrar na auditoria/documentos_assinados se houver institucional
      const hasInst = signatures.find(s => s.type === "institutional");
      if (hasInst) {
         try {
           const sigRes = await registrarDocumentoAssinado({
             tipo: "pdf_assinatura_livre",
             descricao: `Assinatura em PDF: ${fileName}`,
             dados: { fileName, pages: numPages, signatureCount: signatures.length },
             termoAceite: true
           });
           await armazenarPdfAssinado(sigRes, signedBlob);
         } catch (e) {
           console.error("Erro auditoria:", e);
         }
      }

      // Download
      const url = URL.createObjectURL(signedBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName.replace(".pdf", "_assinado.pdf");
      link.click();
      URL.revokeObjectURL(url);
      
      toast.success("PDF assinado com sucesso!");
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Falha ao gerar o PDF assinado.");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Carregando visualizador...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-slate-100 dark:bg-slate-900">
      {/* Sidebar */}
      <div className="w-80 border-r bg-white p-4 dark:bg-slate-800 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Assinar PDF</h2>
        
        <div className="space-y-4">
          <Button 
            className="w-full justify-start" 
            variant="outline"
            onClick={() => setShowSigPicker(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Assinatura
          </Button>

          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium mb-2 text-muted-foreground">Assinaturas no Documento</h3>
            {signatures.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhuma assinatura adicionada.</p>
            ) : (
              <div className="space-y-2">
                {signatures.map((sig) => (
                  <Card key={sig.id} className="p-3 text-xs flex items-center justify-between">
                    <div>
                      <p className="font-medium">{sig.type === 'institutional' ? 'Institucional' : 'Imagem'}</p>
                      <p className="text-muted-foreground">Página {sig.page + 1}</p>
                    </div>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeSignature(sig.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 pt-4 border-t space-y-2">
          <Button 
            className="w-full" 
            onClick={handleSave}
            disabled={generating || signatures.length === 0}
          >
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Gerar PDF Assinado
          </Button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="h-12 border-b bg-white dark:bg-slate-800 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Página {currentPage} de {numPages}
            </span>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
              disabled={currentPage === numPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm font-medium truncate max-w-xs">{fileName}</p>
        </div>

        {/* PDF Viewport */}
        <div className="flex-1 overflow-auto p-8 flex justify-center">
          <div 
            ref={containerRef}
            className="relative bg-white shadow-lg"
            style={{ 
              width: viewport?.width, 
              height: viewport?.height 
            }}
          >
            <canvas ref={canvasRef} />
            
            {/* Draggable Signatures for Current Page */}
            {signatures.filter(s => s.page === currentPage - 1).map((sig) => (
              <Rnd
                key={sig.id}
                size={{ width: sig.width, height: sig.height }}
                position={{ x: sig.x, y: sig.y }}
                onDragStop={(e, d) => updateSignature(sig.id, { x: d.x, y: d.y })}
                onResizeStop={(e, direction, ref, delta, position) => {
                  updateSignature(sig.id, {
                    width: parseInt(ref.style.width),
                    height: parseInt(ref.style.height),
                    ...position,
                  });
                }}
                bounds="parent"
                className="border-2 border-primary/50 bg-primary/5 cursor-move flex items-center justify-center overflow-hidden"
              >
                {sig.type === "image" && sig.imageData ? (
                  <img src={sig.imageData} alt="Assinatura" className="w-full h-full object-contain pointer-events-none" />
                ) : (
                  <div className="p-1 text-[8px] leading-tight select-none pointer-events-none bg-slate-50 w-full h-full border border-slate-200">
                    <p className="font-bold text-slate-800 uppercase mb-1">Assinado Eletronicamente</p>
                    <p>Nome: {sig.institutionalData?.nome}</p>
                    <p>Cargo: {sig.institutionalData?.cargo}</p>
                    <p>Matrícula: {sig.institutionalData?.matricula}</p>
                    <p className="mt-1 text-[6px] text-slate-500">{sig.institutionalData?.codigo}</p>
                  </div>
                )}
                <div className="absolute top-0 right-0 p-0.5 bg-primary text-white">
                   <Type className="h-2 w-2" />
                </div>
              </Rnd>
            ))}
          </div>
        </div>
      </div>

      {/* Signature Picker Dialog */}
      {showSigPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6 bg-white dark:bg-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Selecionar Assinatura</h3>
              <Button size="icon" variant="ghost" onClick={() => setShowSigPicker(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {availableSignatures.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Nenhuma assinatura cadastrada.</p>
                  <Button variant="link" className="mt-2" asChild>
                    <a href="/assinaturas">Ir para Cadastros</a>
                  </Button>
                </div>
              ) : (
                availableSignatures.map((sig) => (
                  <Card 
                    key={sig.id} 
                    className="p-4 cursor-pointer hover:border-primary transition-colors flex items-center gap-4"
                    onClick={() => addSignature(sig)}
                  >
                    <div className="w-16 h-12 bg-slate-50 flex items-center justify-center border rounded">
                      {sig.storage_path?.startsWith('institutional_') ? (
                        <ShieldCheck className="h-6 w-6 text-primary" />
                      ) : (
                        sig.imageUrl ? <img src={sig.imageUrl} className="max-w-full max-h-full" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{sig.titular_nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {sig.storage_path?.startsWith('institutional_') ? 'Assinatura Eletrônica' : 'Assinatura por Imagem'}
                      </p>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
