'use client';

import { useModoManutencao } from '@/hooks/useModoManutencao';
import { Wrench, AlertTriangle, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from 'sonner';

export function BadgeManutencao() {
  const { estado, isMaster, desativar } = useModoManutencao();

  if (!estado.ativo || !isMaster) return null;

  const handleDesativar = async () => {
    try {
      await desativar();
      toast.success('Modo manutenção desativado');
    } catch (error: any) {
      toast.error('Erro ao desativar: ' + error.message);
    }
  };

  return (
    <div className="bg-yellow-500 text-yellow-950 px-4 py-1.5 flex items-center justify-between gap-4 border-b border-yellow-600/20 animate-in fade-in slide-in-from-top duration-300">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
        <Wrench className="w-3.5 h-3.5 animate-pulse" />
        <span>Modo Manutenção Ativo</span>
        <span className="hidden sm:inline-block opacity-60 font-normal">|</span>
        <span className="hidden sm:inline-block font-medium normal-case tracking-normal">
          {estado.aviso?.titulo || 'Sistema restrito a administradores'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 px-2 text-yellow-950 hover:bg-yellow-600/20 hover:text-yellow-950 border border-yellow-600/30"
                onClick={handleDesativar}
              >
                <Power className="w-3.5 h-3.5 mr-1.5" />
                Desativar
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Finaliza a manutenção para todos os usuários</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="hidden lg:flex items-center gap-1.5 bg-yellow-600/20 px-2 py-0.5 rounded border border-yellow-600/10 text-[10px] font-medium">
          <AlertTriangle className="w-3 h-3" />
          <span>VISÍVEL APENAS PARA MASTER</span>
        </div>
      </div>
    </div>
  );
}
