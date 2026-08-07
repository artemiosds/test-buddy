import { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Utilitário para gerar um relatório de status offline/funcionalidade do sistema.
 */
export function gerarRelatorioOffline() {
  const status = {
    navegacao: 'Funcional (Service Worker ativo)',
    dados: 'Somente Leitura (Cache TanStack Query)',
    escrita: 'Bloqueada (Prevenção de inconsistência)',
    pwa: 'Instalável (Manifest configurado)',
    timestamp: new Date().toLocaleString('pt-BR'),
  };

  const report = `
RELATÓRIO DE FUNCIONAMENTO OFFLINE
----------------------------------
Gerado em: ${status.timestamp}
Status: OFFLINE

1. NAVEGAÇÃO: ${status.navegacao}
   - O sistema utiliza Service Worker para servir assets estáticos (JS, CSS, Imagens).
   - Telas já visitadas permanecem acessíveis.

2. DADOS (LEITURA): ${status.dados}
   - Informações carregadas anteriormente são mantidas via cache do TanStack Query.
   - Novas consultas que não estão em cache falharão até a reconexão.

3. DADOS (ESCRITA): ${status.escrita}
   - Por segurança e integridade, o sistema bloqueia salvamentos enquanto offline.
   - Isso evita conflitos de versão e perda de dados em operações complexas.

4. SINCRONIZAÇÃO:
   - O sistema detecta automaticamente a volta da internet e atualiza os dados.
  `.trim();

  console.log(report);
  return report;
}

export function configureMutationCache(queryClient: QueryClient) {
  // TanStack Query Mutation Cache integration
}

export function offlineGuard() {
  if (typeof window !== 'undefined' && !window.navigator.onLine) {
    const report = gerarRelatorioOffline();
    toast.error("Você está offline. Ações de alteração bloqueadas.", {
      id: 'offline-guard-toast',
      description: "Clique para ver o relatório técnico.",
      action: {
        label: "Relatório",
        onClick: () => {
          alert(report);
        }
      }
    });
    return true;
  }
  return false;
}
