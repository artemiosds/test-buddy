'use client';

import React, { createContext, useContext } from 'react';
import { useModoManutencao } from '@/hooks/useModoManutencao';
import { TelaManutencao } from '@/components/manutencao/TelaManutencao';
import { BadgeManutencao } from '@/components/manutencao/BadgeManutencao';

const ManutencaoContext = createContext<{
  isManutencao: boolean;
  isMaster: boolean;
} | null>(null);

export function ManutencaoProvider({ children }: { children: React.ReactNode }) {
  const { estado, bloqueado, isMaster } = useModoManutencao();

  const contextValue = React.useMemo(() => ({
    isManutencao: estado.ativo,
    isMaster: !!isMaster
  }), [estado.ativo, isMaster]);

  // Bloqueio apenas se não estiver no servidor
  const isSSR = typeof window === "undefined";
  const showBloqueio = !isSSR && bloqueado;

  return (
    <ManutencaoContext.Provider value={contextValue}>
      {showBloqueio && <TelaManutencao />}
      <div style={{ display: showBloqueio ? 'none' : 'contents' }}>
        <BadgeManutencao />
        {children}
      </div>
    </ManutencaoContext.Provider>
  );
}


export const useManutencaoContext = () => {
  const context = useContext(ManutencaoContext);
  if (!context) {
    throw new Error('useManutencaoContext deve ser usado dentro de ManutencaoProvider');
  }
  return context;
};
