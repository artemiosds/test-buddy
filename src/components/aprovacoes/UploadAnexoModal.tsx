import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MailWarning } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { OfflineButton } from "@/components/shared/OfflineButton";
import { AnexosEntidade } from "@/components/frequencias/anexos-entidade";
import { usePermissions } from "@/hooks/use-permissions";
import { solicitarReenvioAnexos } from "@/lib/reenvio-anexos.functions";

interface UploadAnexoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entidadeId: string;
  subtipo: string;
  unidadeId: string;
  setorId?: string | null;
  titulo?: string;
}

export function UploadAnexoModal({
  open,
  onOpenChange,
  entidadeId,
  subtipo,
  unidadeId,
  setorId,
  titulo = "Documentos Comprobatórios",
}: UploadAnexoModalProps) {
  const { has, hasAny } = usePermissions();
  const canEdit = has("documento.upload");
  const podeSolicitar = hasAny(["frequencia.aprovar"]);
  const [notificarEmail, setNotificarEmail] = useState(false);

  const solicitar = useServerFn(solicitarReenvioAnexos);
  const mSolicitar = useMutation({
    mutationFn: async () =>
      solicitar({
        data: {
          entidade_id: entidadeId,
          tipo_entidade: "frequencia_submissao" as const,
          subtipo,
          setor_id: setorId ?? undefined,
          notificar_email: notificarEmail,
        },
      }),
    onSuccess: (res) => {
      if (!res.ausentes.length) {
        toast.success("Nenhum anexo ausente — todos os documentos estão disponíveis.");
        return;
      }
      toast.success(
        `Reenvio solicitado a ${res.destinatarios} responsável(is) para ${res.ausentes.length} anexo(s).` +
          (notificarEmail ? ` E-mails enviados: ${res.emails}.` : ""),
      );
    },
    onError: (e: unknown) =>
      toast.error((e as Error)?.message ?? "Falha ao solicitar o reenvio dos anexos."),
  });

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
            setorId={setorId}
            canEdit={canEdit}
            mostrarLixeira={true}
            titulo="Arquivos da Folha"
          />
        </div>

        {podeSolicitar && (
          <div className="rounded-md border border-dashed border-amber-300 bg-amber-50/60 p-3">
            <div className="flex items-start gap-2">
              <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="flex-1 space-y-2">
                <p className="text-xs text-amber-800">
                  Se algum anexo aparecer como <strong>Arquivo indisponível</strong>, solicite o
                  reenvio ao diretor responsável.
                </p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="notificar-email-reenvio"
                    checked={notificarEmail}
                    onCheckedChange={(v) => setNotificarEmail(v === true)}
                  />
                  <Label htmlFor="notificar-email-reenvio" className="text-xs font-normal">
                    Notificar também por e-mail (opcional)
                  </Label>
                </div>
                <OfflineButton
                  requireOnline
                  variant="outline"
                  size="sm"
                  disabled={mSolicitar.isPending}
                  onClick={() => mSolicitar.mutate()}
                >
                  {mSolicitar.isPending ? "Solicitando…" : "Solicitar reenvio dos anexos ausentes"}
                </OfflineButton>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <OfflineButton variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </OfflineButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
