import { useEffect, useState, useRef, Suspense, lazy } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listarAvisosAtivos, marcarComoLido, confirmarCiencia } from "@/lib/mural-avisos.functions";
import { useServerFn } from "@tanstack/react-start";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-permissions";
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";
import { AlertTriangle, Info, Settings, Paperclip, Download, Eye, FileText, CheckCircle2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SafeHtml } from "@/components/shared/SafeHtml";

export function AvisoModal() {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const fetchAvisos = useServerFn(listarAvisosAtivos);
  const markAsRead = useServerFn(marcarComoLido);
  const confirm = useServerFn(confirmarCiencia);

  const [currentAviso, setCurrentAviso] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const avisosMostradosRef = useRef<Set<string>>(new Set());

  const { data: avisos } = useQuery({
    queryKey: ["mural-avisos-popup", user?.id],
    queryFn: () => fetchAvisos(),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const handleOpenAviso = (e: CustomEvent<any>) => {
      setCurrentAviso(e.detail);
      setOpen(true);
    };

    window.addEventListener('open-mural-aviso' as any, handleOpenAviso as any);
    return () => window.removeEventListener('open-mural-aviso' as any, handleOpenAviso as any);
  }, []);

  useEffect(() => {
    if (avisos && Array.isArray(avisos) && avisos.length > 0) {
      const pendingAvisos = avisos.filter((a: any) => {
        // Se já mostramos este aviso nesta sessão (sem fechar o modal ou recarregar), pulamos
        if (avisosMostradosRef.current.has(a.id) && !open) return false;
        
        const leitura = a.leituras?.find((l: any) => l.usuario_id === user?.id);
        if (!leitura) return true;
        if (a.confirmacao_obrigatoria && !leitura.confirmado) return true;
        return false;
      });

      if (pendingAvisos.length > 0 && !open) {
        const sorted = [...pendingAvisos].sort((a: any, b: any) => {
          if (a.prioridade === 'critica' && b.prioridade !== 'critica') return -1;
          if (b.prioridade === 'critica' && a.prioridade !== 'critica') return 1;
          return 0;
        });
        
        const nextAviso = sorted[0];
        setCurrentAviso(nextAviso);
        avisosMostradosRef.current.add(nextAviso.id);
        setOpen(true);
      }
    }
  }, [avisos, user?.id, open]);

  const handleClose = async () => {
    if (!currentAviso) {
      setOpen(false);
      return;
    }
    
    // Se for confirmação obrigatória, não fechamos sem o clique no botão específico
    if (currentAviso.confirmacao_obrigatoria) {
      return;
    }

    try {
      // Otimização: Fecha o modal imediatamente para o usuário sentir a resposta
      setOpen(false);
      
      // Chamamos a função de marcar como lido em background
      await markAsRead({ data: { avisoId: currentAviso.id } });
      
      // Invalida a query para que o aviso não apareça novamente
      queryClient.invalidateQueries({ queryKey: ["mural-avisos-popup"] });
    } catch (err) {
      console.error("Erro ao marcar como lido:", err);
    }
  };

  const handleConfirm = async () => {
    if (!currentAviso) return;
    try {
      // Otimização: Fecha imediatamente para UX instantânea
      setOpen(false);
      
      await confirm({ data: { avisoId: currentAviso.id } });
      queryClient.invalidateQueries({ queryKey: ["mural-avisos-popup"] });
      toast.success("Ciência registrada com sucesso");
    } catch (err) {
      console.error("Erro ao confirmar ciência:", err);
      toast.error("Erro ao registrar ciência");
    }
  };

  const formatarData = (dataStr: string) => {
    try {
      return format(new Date(dataStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "";
    }
  };

  const handleDownload = async (anexo: any) => {
    try {
      const { data, error } = await supabase.storage
        .from(anexo.bucket || 'mural_anexos')
        .download(anexo.path);
      
      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', anexo.nome);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao baixar anexo");
    }
  };

  if (!currentAviso) return null;

  const podeEditar =
    user?.perfil_codigo === 'MASTER' ||
    user?.perfil_codigo === 'GESTOR' ||
    !!user?.is_master ||
    currentAviso.criado_por === user?.id;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-white/10">
              {currentAviso.tipo === 'urgente' ? (
                <AlertTriangle className="h-6 w-6 text-white" />
              ) : currentAviso.tipo === 'manutencao' ? (
                <Settings className="h-6 w-6 text-white" />
              ) : (
                <Info className="h-6 w-6 text-white" />
              )}
            </div>
            <div className="flex flex-col">
              <DialogTitle className="text-xl font-bold">{currentAviso.titulo}</DialogTitle>
              {currentAviso.subtitulo && (
                <p className="text-sm text-white/80 font-medium">
                  {currentAviso.subtitulo}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs mt-4 text-white/70">
            <span>Publicado em: {formatarData(currentAviso.criado_em)}</span>
            <span>•</span>
            <span className="uppercase font-bold tracking-wider">{currentAviso.prioridade}</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <SafeHtml html={currentAviso.mensagem} className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed" />

          {currentAviso.anexos && currentAviso.anexos.length > 0 && (
            <div className="space-y-4 pt-8 border-t mt-8">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-primary" />
                Arquivos Anexados ({currentAviso.anexos.length})
              </h4>
              <div className="grid gap-2">
                {currentAviso.anexos.map((anexo: any, idx: number) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold truncate">
                          {anexo.nome}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {(anexo.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-8 gap-2" onClick={() => handleDownload(anexo)}>
                        <Download className="h-4 w-4" />
                        Baixar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 p-6 border-t bg-muted/20 gap-2">
          {podeEditar && (
            <Button
              variant="outline"
              className="h-11"
              onClick={() => {
                setOpen(false);
                window.dispatchEvent(
                  new CustomEvent('open-mural-editar-aviso', { detail: currentAviso }),
                );
              }}
            >
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </Button>
          )}
          {currentAviso.confirmacao_obrigatoria ? (
            <Button onClick={handleConfirm} className="w-full h-11 font-bold shadow-lg shadow-blue-500/20">
              <CheckCircle2 className="h-4 w-4 mr-2" /> Li e estou ciente
            </Button>
          ) : (
            <Button onClick={handleClose} variant="secondary" className="w-full h-11">
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
