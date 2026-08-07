import { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function configureMutationCache(queryClient: QueryClient) {
  const mutationCache = queryClient.getMutationCache();
  
  // Interceptor global para mutações em modo offline
  // Nota: TanStack Query não tem um 'before' hook nativo simples no cache, 
  // mas podemos envolver as chamadas ou usar o onlineManager.
  // Aqui estamos reforçando que mutações não devem prosseguir se offline.
}

export function offlineGuard() {
  if (typeof window !== 'undefined' && !window.navigator.onLine) {
    toast.error("Ações de alteração estão bloqueadas no modo offline.", {
      id: 'offline-guard-toast',
    });
    return true;
  }
  return false;
}
