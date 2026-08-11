import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/use-permissions';
import { verificarEstadoManutencao, desativarModoManutencao } from '@/lib/manutencao.functions';
import { useServerFn } from '@tanstack/react-start';

interface AvisoManutencao {
  titulo: string;
  mensagem: string;
  criado_em: string;
  previsao_termino: string | null;
}

interface EstadoManutencao {
  ativo: boolean;
  aviso: AvisoManutencao | null;
}

export function useModoManutencao() {
  const { data: userCtx, isLoading: userLoading } = useCurrentUser();
  const [estado, setEstado] = useState<EstadoManutencao>({ ativo: false, aviso: null });
  const [loading, setLoading] = useState(true);
  /** true quando já obtivemos (ou falhamos ao obter) uma resposta do servidor */
  const [resolvido, setResolvido] = useState(false);
  const [erro, setErro] = useState(false);

  const fetchEstado = useServerFn(verificarEstadoManutencao);
  const callDesativar = useServerFn(desativarModoManutencao);

  const isFetchingRef = useRef(false);

  // Somente MASTER confirmado escapa do bloqueio (fail-safe).
  const isMaster = !!userCtx && (
    userCtx.is_master || 
    userCtx.perfil_codigo === 'MASTER' ||
    userCtx.perfil_codigo === 'ADMINISTRADOR_MASTER' ||
    (Array.isArray(userCtx.unidades) && userCtx.unidades.length > 0 && userCtx.acesso_todas_secretarias)
  );

  const verificarEstado = useCallback(async () => {
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    setLoading(true);
    try {
      const data = await fetchEstado();

      if (data.erro) {
        // Fail-safe: não sabemos o estado real -> tratamos como manutenção.
        setErro(true);
        setEstado((prev) => (prev.ativo ? prev : { ativo: true, aviso: prev.aviso }));
      } else {
        setErro(false);
        setEstado({
          ativo: !!data.modo_manutencao_ativo,
          aviso: (data.aviso as AvisoManutencao | null) ?? null,
        });
      }
    } catch (error) {
      console.error('[Manutencao] Erro na verificação (fail-safe: bloqueando):', error);
      setErro(true);
      setEstado((prev) => ({ ativo: true, aviso: prev.aviso }));
    } finally {
      setResolvido(true);
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [fetchEstado]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    void verificarEstado();
  }, [verificarEstado]);

  const userId = userCtx?.id;

  // Realtime sem dependência de id fixo: qualquer mudança em sistema_config revalida.
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`manutencao-config-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sistema_config' },
        (payload) => {
          console.log('[Manutencao] Realtime payload recebido:', payload.eventType, payload.new);
          void verificarEstado();
        },
      )
      .subscribe((status) => {
        console.log(`[Manutencao] Realtime status: ${status}`);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, verificarEstado]);

  const desativar = useCallback(async () => {
    if (!isMaster) throw new Error('Apenas MASTER pode desativar');
    await callDesativar();
    await verificarEstado();
  }, [isMaster, callDesativar, verificarEstado]);

  // Enquanto não sabemos quem é o usuário ou qual o estado, nada é decidido.
  const decidindo = !resolvido || userLoading;
  const bloqueado = !decidindo && estado.ativo && !isMaster;

  return {
    estado,
    loading,
    decidindo,
    erro,
    bloqueado,
    isMaster,
    verificarEstado,
    desativar,
  };
}
