import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/use-permissions';
import { verificarEstadoManutencao, desativarModoManutencao } from '@/lib/manutencao.functions';
import { useServerFn } from '@tanstack/react-start';

interface EstadoManutencao {
  ativo: boolean;
  aviso: {
    titulo: string;
    mensagem: string;
    criado_em: string;
    previsao_termino: string | null;
  } | null;
}

export function useModoManutencao() {
  const { data: userCtx } = useCurrentUser();
  const [estado, setEstado] = useState<EstadoManutencao>({ 
    ativo: false, 
    aviso: null 
  });
  const [loading, setLoading] = useState(true);
  const [bloqueado, setBloqueado] = useState(false);

  const fetchEstado = useServerFn(verificarEstadoManutencao);
  const callDesativar = useServerFn(desativarModoManutencao);
  
  // Ref to prevent concurrent calls
  const isFetchingRef = useRef(false);

  const isMaster = userCtx?.is_master;

  const verificarEstado = useCallback(async () => {
    if (isFetchingRef.current) return;
    
    try {
      isFetchingRef.current = true;
      setLoading(true);
      const data = await fetchEstado();
      
      const novoEstado = {
        ativo: data.modo_manutencao_ativo || false,
        aviso: data.aviso || null,
      };

      setEstado(prev => {
        // Prevent unnecessary state updates if values are identical
        if (prev.ativo === novoEstado.ativo && 
            prev.aviso?.criado_em === novoEstado.aviso?.criado_em) {
          return prev;
        }
        return novoEstado;
      });

      // Bloquear se ativo, não for MASTER e estiver logado
      const deveBloquear = novoEstado.ativo && !isMaster && !!userCtx;
      setBloqueado(deveBloquear);

    } catch (error) {
      console.error('[Maintenance] Error checking status:', error);
      // Fallback safe: in case of error, assume no maintenance to avoid locking users out
      setEstado(prev => prev.ativo ? { ativo: false, aviso: null } : prev);
      setBloqueado(false);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [userCtx, isMaster, fetchEstado]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      verificarEstado();
    }
  }, [verificarEstado]);

  // Memoize stable check callback
  const stableVerificar = useCallback(() => {
    verificarEstado();
  }, [verificarEstado]);

  const userId = userCtx?.id;

  useEffect(() => {
    if (!userId) return;

    console.log('[Maintenance] Connecting Realtime channel...');
    
    // Create channel instance and chain .on() calls BEFORE .subscribe()
    // This follows the pattern: .channel().on().subscribe()
    let channel: any;
    try {
      channel = supabase
        .channel('sistema_config_global')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'sistema_config',
            filter: 'id=eq.1',
          },
          (payload) => {
            console.log('[Maintenance] Realtime update detected:', payload);
            stableVerificar();
          }
        )
        .subscribe((status: string) => {
          console.log(`[Maintenance] Realtime status: ${status}`);
        });
    } catch (err) {
      console.error('[Maintenance] Realtime setup failed:', err);
    }

    return () => {
      if (channel) {
        console.log('[Maintenance] Cleaning up Realtime channel');
        void supabase.removeChannel(channel);
      }
    };
  }, [userId, stableVerificar]);


  const desativar = useCallback(async () => {
    if (!isMaster) {
      throw new Error('Apenas MASTER pode desativar');
    }
    await callDesativar();
    await verificarEstado();
  }, [isMaster, callDesativar, verificarEstado]);

  return {
    estado,
    loading,
    bloqueado,
    isMaster,
    verificarEstado,
    desativar,
  };
}
