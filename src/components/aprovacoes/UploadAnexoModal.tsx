import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OfflineButton } from "@/components/shared/OfflineButton";
import { AnexosEntidade } from "@/components/frequencias/anexos-entidade";
import { usePermissions } from "@/hooks/use-permissions";

interface UploadAnexoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entidadeId: string;
  subtipo: string;
  unidadeId: string;
  titulo?: string;
}

export function UploadAnexoModal({
  open,
  onOpenChange,
  entidadeId,
  subtipo,
  unidadeId,
  titulo = "Documentos Comprobatórios",
}: UploadAnexoModalProps) {
  const { has } = usePermissions();
  const canEdit = has("documento.upload");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            Gerencie os documentos e comprovantes vinculados a esta submissão.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <AnexosEntidade
            entidadeId={entidadeId}
            tipoEntidade="frequencia_submissao"
            subtipo={subtipo}
            unidadeId={unidadeId}
            canEdit={canEdit}
            mostrarLixeira={true}
            titulo="Arquivos da Folha"
          />
        </div>

        <DialogFooter>
          <OfflineButton variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </OfflineButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
