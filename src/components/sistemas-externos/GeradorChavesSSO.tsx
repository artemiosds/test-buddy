import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Key, Copy, Check, RefreshCw } from "lucide-react";
import { obterNovasChavesSSO } from "@/lib/sso-admin.functions";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

export function GeradorChavesSSO() {
  const [loading, setLoading] = useState(false);
  const [chaves, setChaves] = useState<{ publicKeyPem: string; privateKeyPem: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleGerar = async () => {
    setLoading(true);
    try {
      const result = await obterNovasChavesSSO();
      setChaves(result);
      toast.success("Novo par de chaves RSA gerado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao gerar chaves: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
    toast.success(`${type === 'public' ? 'Chave Pública' : 'Chave Privada'} copiada!`);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Key className="mr-2 h-4 w-4" />
          Gerar Chaves RSA
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Gerador de Chaves RSA para SSO</DialogTitle>
          <DialogDescription>
            Gere um novo par de chaves RS256 de 2048 bits. A chave privada deve ser configurada no ambiente (Vercel) e a pública no sistema de destino.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Button 
            onClick={handleGerar} 
            disabled={loading} 
            className="w-full"
          >
            {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Gerar Novo Par de Chaves
          </Button>

          {chaves && (
            <div className="grid gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Chave Pública (Configure no Destino)</label>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(chaves.publicKeyPem, 'public')}>
                    {copied === 'public' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Textarea 
                  readOnly 
                  value={chaves.publicKeyPem} 
                  className="font-mono text-xs h-[120px] bg-muted"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-destructive">Chave Privada (Configure no Vercel - SSO_PRIVATE_KEY)</label>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(chaves.privateKeyPem, 'private')}>
                    {copied === 'private' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Textarea 
                  readOnly 
                  value={chaves.privateKeyPem} 
                  className="font-mono text-xs h-[120px] bg-muted border-destructive/20"
                />
                <p className="text-[10px] text-muted-foreground">
                  Aviso: Nunca compartilhe sua chave privada. Ela deve ser guardada em segredo absoluto.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
