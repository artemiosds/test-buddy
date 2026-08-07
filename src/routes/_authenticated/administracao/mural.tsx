import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute } from '@tanstack/react-router';
import { MuralAvisosList } from '@/components/mural/MuralAvisosList';

import { OfflineButton } from '@/components/shared/OfflineButton';
import { Plus, Megaphone } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { useState, Suspense, lazy, useEffect } from 'react';
import { useCurrentUser } from '@/hooks/use-permissions';
import { ClientOnly } from '@/components/shared/ClientOnly';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MuralArquivoHistorico } from '@/components/mural/MuralArquivoHistorico';
import { useSearch } from '@tanstack/react-router';


const LazyAvisoForm = lazy(() => import('@/components/mural/AvisoForm').then(m => ({ default: m.AvisoForm })));

export const Route = createFileRoute('/_authenticated/administracao/mural')({ errorComponent: ErrorComponent,
  component: MuralAdminPage,
});

function MuralAdminPage() {
  const [open, setOpen] = useState(false);
  const { data: user } = useCurrentUser();
  const search = useSearch({ from: '/_authenticated/administracao/mural' }) as any;
  const [activeTab, setActiveTab] = useState(search?.tab || "ativos");

  useEffect(() => {
    if (search?.tab) {
      setActiveTab(search.tab);
    }
  }, [search?.tab]);

  const isManagement = user?.perfil_codigo === 'MASTER' || user?.perfil_codigo === 'GESTOR' || user?.is_master;

  if (!isManagement) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold">Acesso Negado</h1>
        <p className="text-muted-foreground">Você não tem permissão para gerenciar o mural de avisos.</p>
      </div>
    );
  }


  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Megaphone className="h-8 w-8 text-primary" />
            Mural de Avisos
          </h1>
          <p className="text-muted-foreground">
            Gerencie avisos institucionais e comunicados para as unidades e profissionais.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <OfflineButton className="flex items-center gap-2" requireOnline>
              <Plus className="h-4 w-4" /> Novo Aviso
            </OfflineButton>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Novo Aviso</DialogTitle>
            </DialogHeader>
            <ClientOnly>
              <Suspense fallback={<div className="h-[400px] flex items-center justify-center">Carregando formulário...</div>}>
                <LazyAvisoForm onSuccess={() => setOpen(false)} dialogOpen={open} />
              </Suspense>
            </ClientOnly>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-lg border p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="ativos" className="gap-2">
              <Megaphone className="h-4 w-4" />
              Avisos Ativos
            </TabsTrigger>
            <TabsTrigger value="arquivo" className="gap-2">
              <Plus className="h-4 w-4 rotate-45" />
              Arquivo Histórico
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="ativos">
            <MuralAvisosList />
          </TabsContent>
          
          <TabsContent value="arquivo">
            <MuralArquivoHistorico />
          </TabsContent>
        </Tabs>
      </div>

    </div>
  );
}
