import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const MOTIVO_REABERTURA_MIN = 10;

/** Reabertura institucional de folha aprovada (Master/Gestor) com motivo auditado. */
export function ReabrirFolhaDialog({
  freqId,
  titulo,
  onClose,
}: {
  freqId: string | null;
  titulo?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const valido = motivo.trim().length >= MOTIVO_REABERTURA_MIN;

  async function confirmar() {
    if (!freqId || !valido) return;
    setEnviando(true);
    const { error } = await (supabase as any).rpc("reabrir_folha_aprovada", {
      _frequencia_id: freqId,
      _motivo: motivo.trim(),
    });
    setEnviando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Folha reaberta para retificação. Após os ajustes, aprove novamente.");
    setMotivo("");
    qc.invalidateQueries();
    onClose();
  }

  return (
    <Dialog open={!!freqId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reabrir folha aprovada para retificação</DialogTitle>
          <DialogDescription>
            {titulo ? `${titulo}. ` : ""}A folha voltará para "Em análise" e os campos serão liberados
            para correção. Será preciso aprovar novamente — o resumo financeiro será atualizado
            nessa nova aprovação, mantendo o histórico anterior.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo da retificação (obrigatório, registrado na trilha de auditoria)"
          rows={4}
        />
        <p className="text-xs text-muted-foreground">
          Mínimo de {MOTIVO_REABERTURA_MIN} caracteres.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!valido || enviando}>
            {enviando ? "Reabrindo..." : "Reabrir folha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
