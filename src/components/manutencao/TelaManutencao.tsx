'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useManutencaoContext } from '@/providers/ManutencaoProvider';
import { 
  Wrench, Clock, AlertTriangle, LogOut, 
  RefreshCw, Mail, Phone
} from 'lucide-react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { SafeHtml } from '@/components/shared/SafeHtml';

export function TelaManutencao() {
  const { aviso: avisoCtx } = useManutencaoContext();
  const [tempoDecorrido, setTempoDecorrido] = useState('');

  const aviso = avisoCtx;
  const dataInicio = aviso?.criado_em ? parseISO(aviso.criado_em) : null;
  const previsaoTermino = aviso?.previsao_termino ? parseISO(aviso.previsao_termino) : null;

  useEffect(() => {
    if (!dataInicio) return;

    const interval = setInterval(() => {
      const agora = new Date();
      const diff = Math.floor((agora.getTime() - dataInicio.getTime()) / 1000);
      
      const horas = Math.floor(diff / 3600);
      const minutos = Math.floor((diff % 3600) / 60);
      
      if (horas > 0) {
        setTempoDecorrido(`${horas}h${minutos > 0 ? ` ${minutos}min` : ''}`);
      } else {
        setTempoDecorrido(`${minutos}min`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [dataInicio]);

  const formatarData = (data: Date) => {
    return format(data, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  };

  const tempoRestante = previsaoTermino ? 
    formatDistanceToNow(previsaoTermino, { locale: ptBR, addSuffix: true }) :
    null;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth';
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-50 p-4 overflow-y-auto">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        
        <div className="bg-yellow-50 p-8 flex justify-center">
          <div className="bg-yellow-100 p-4 rounded-full">
            <div className="bg-yellow-500 p-3 rounded-full shadow-lg">
              <Wrench className="w-10 h-10 text-white animate-pulse" />
            </div>
          </div>
        </div>

        <div className="p-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {aviso?.titulo || 'Sistema em Manutenção Programada'}
          </h1>

          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-gray-500 mb-8">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full font-medium border border-yellow-200">
              <AlertTriangle className="w-4 h-4" />
              Manutenção em andamento
            </div>
            {tempoDecorrido && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full border border-gray-200">
                <Clock className="w-4 h-4" />
                {tempoDecorrido}
              </div>
            )}
            {previsaoTermino && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                <Clock className="w-4 h-4" />
                Termina {tempoRestante}
              </div>
            )}
          </div>

          {aviso?.mensagem && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-6 mb-8 text-left">
              <SafeHtml html={aviso.mensagem} className="text-gray-600 leading-relaxed" />
            </div>
          )}

          {dataInicio && (
            <div className="space-y-1 mb-8 text-sm text-gray-500">
              <p>Iniciado em: {formatarData(dataInicio)}</p>
              {previsaoTermino && (
                <p className="font-medium text-blue-600">Previsão de término: {formatarData(previsaoTermino)}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="flex flex-col items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
              <AlertTriangle className="w-6 h-6 text-yellow-600 mb-2" />
              <p className="text-sm font-medium text-gray-900">Indisponibilidade</p>
              <p className="text-xs text-gray-500 text-center">O sistema está temporariamente em manutenção</p>
            </div>
            <div className="flex flex-col items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
              <Wrench className="w-6 h-6 text-blue-600 mb-2" />
              <p className="text-sm font-medium text-gray-900">Urgência</p>
              <p className="text-xs text-gray-500 text-center">Contate o suporte em caso de necessidade real</p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-8 mb-8">
            <p className="text-sm text-gray-500 mb-4">Contatos para suporte:</p>
            <div className="flex flex-wrap justify-center gap-6">
              <a href="mailto:suporte@exemplo.com" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                <Mail className="w-4 h-4" />
                suporte@exemplo.com
              </a>
              <span className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="w-4 h-4" />
                (93) 99999-9999
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="outline" 
              className="flex-1 gap-2 py-6"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="w-4 h-4" />
              Verificar novamente
            </Button>
            <Button 
              variant="destructive" 
              className="flex-1 gap-2 py-6"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4" />
              Sair do Sistema
            </Button>
          </div>
        </div>

        <div className="bg-gray-50 px-8 py-4 text-center border-t border-gray-100">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
            Sistema de Gestão Hospitalar • SMS Oriximiná
          </p>
        </div>
      </div>
    </div>
  );
}
