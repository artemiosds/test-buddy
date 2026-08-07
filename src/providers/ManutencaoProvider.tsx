'use client';

import React, { createContext, useContext } from 'react';
import { useModoManutencao } from '@/hooks/useModoManutencao';
import { TelaManutencao } from '@/components/manutencao/TelaManutencao';
import { BadgeManutencao } from '@/components/manutencao/BadgeManutencao';
import { Loader2 } from 'lucide-react';

interface AvisoManutencao {
  titulo: string;
  mensagem: string;
  criado_em: string;
  previsao_termino: string | null;
}

const ManutencaoContext = createContext<{
  isManutencao: boolean;
  isMaster: boolean;
  aviso: AvisoManutencao | null;
  desativar: () => Promise<void>;
} | null>(null);

function TelaVerificando() {
  return (
    <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Verificando disponibilidade do sistema…</p>
    </div>
  );
}

export function ManutencaoProvider({ children }: { children: React.ReactNode }) {
  const { estado, bloqueado, decidindo, isMaster, desativar } = useModoManutencao();

  const contextValue = React.useMemo(
    () => ({
      isManutencao: estado.ativo,
      isMaster: !!isMaster,
      aviso: estado.aviso,
      desativar,
    }),
    [estado.ativo, estado.aviso, isMaster, desativar],
  );

  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    setHydrated(true);
  }, []);

  // Antes da hidratação/decisão nada da aplicação é renderizado: elimina o "flash".
  if (!hydrated || decidindo) {
    return (
      <ManutencaoContext.Provider value={contextValue}>
        <TelaVerificando />
      </ManutencaoContext.Provider>
    );
  }

  if (bloqueado) {
    return (
      <ManutencaoContext.Provider value={contextValue}>
        <TelaManutencao />
      </ManutencaoContext.Provider>
    );
  }

  return (
    <ManutencaoContext.Provider value={contextValue}>
      <BadgeManutencao />
      {children}
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
