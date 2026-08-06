import { createFileRoute } from '@tanstack/react-router';
import { MuralAvisosList } from '@/components/mural/MuralAvisosList';
import { AvisoForm } from '@/components/mural/AvisoForm';
import { Button } from '@/components/ui/button';
import { Plus, Megaphone } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { useState } from 'react';
import { useCurrentUser } from '@/hooks/use-permissions';

export const Route = createFileRoute('/_authenticated/administracao/mural')({
  component: MuralAdminPage,
});

function MuralAdminPage() {
  const [open, setOpen] = useState(false);
  const { data: user } = useCurrentUser();

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
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Novo Aviso
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Novo Aviso</DialogTitle>
            </DialogHeader>
            <AvisoForm onSuccess={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-lg border p-6">
        <MuralAvisosList />
      </div>
    </div>
  );
}
