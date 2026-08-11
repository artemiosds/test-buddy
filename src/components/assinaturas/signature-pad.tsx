import { useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Trash2, Check } from "lucide-react";

interface SignaturePadProps {
  onConfirm: (blob: Blob) => void;
  onCancel?: () => void;
}

export function SignaturePad({ onConfirm, onCancel }: SignaturePadProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);

  const clear = () => {
    sigCanvas.current?.clear();
  };

  const confirm = () => {
    if (sigCanvas.current?.isEmpty()) return;
    
    // Get the base64 string and convert to blob
    const dataUrl = sigCanvas.current?.getTrimmedCanvas().toDataURL("image/png");
    if (!dataUrl) return;

    fetch(dataUrl)
      .then((res) => res.blob())
      .then((blob) => {
        onConfirm(blob);
      });
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg bg-white overflow-hidden">
        <SignatureCanvas
          ref={sigCanvas}
          penColor="black"
          canvasProps={{
            className: "w-full h-64 cursor-crosshair",
          }}
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={clear} className="flex-1">
          <Trash2 className="mr-2 h-4 w-4" />
          Limpar
        </Button>
        <Button size="sm" onClick={confirm} className="flex-1">
          <Check className="mr-2 h-4 w-4" />
          Usar esta Assinatura
        </Button>
      </div>
    </div>
  );
}
