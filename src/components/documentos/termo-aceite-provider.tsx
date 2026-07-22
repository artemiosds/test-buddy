import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollText, AlertTriangle } from "lucide-react";

export type TermoAceiteInfo = {
  nome?: string | null;
  cargo?: string | null;
  unidade?: string | null;
  documento?: string;
};

type PedirTermo = (info?: TermoAceiteInfo) => Promise<boolean>;

const TermoAceiteContext = createContext<PedirTermo | null>(null);

export function TermoAceiteProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; info: TermoAceiteInfo } | null>(null);
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const [c3, setC3] = useState(false);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const pedir = useCallback<PedirTermo>((info) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setC1(false);
      setC2(false);
      setC3(false);
      setState({ open: true, info: info ?? {} });
    });
  }, []);

  const close = (result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setState((s) => (s ? { ...s, open: false } : s));
  };

  const value = useMemo(() => pedir, [pedir]);
  const info = state?.info ?? {};
  const allChecked = c1 && c2 && c3;

  return (
    <TermoAceiteContext.Provider value={value}>
      {children}
      <Dialog
        open={!!state?.open}
        onOpenChange={(o) => {
          if (!o) close(false);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-primary" /> Termo de Responsabilidade
            </DialogTitle>
            <DialogDescription>
              Antes de emitir e assinar eletronicamente este documento, confirme os itens abaixo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="rounded-md border bg-muted/40 p-3">
              <p>
                <span className="font-medium">Signatário:</span> {info.nome ?? "—"}
              </p>
              {info.cargo && (
                <p>
                  <span className="font-medium">Cargo/Perfil:</span> {info.cargo}
                </p>
              )}
              {info.unidade && (
                <p>
                  <span className="font-medium">Unidade:</span> {info.unidade}
                </p>
              )}
              {info.documento && (
                <p>
                  <span className="font-medium">Documento:</span> {info.documento}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="font-medium">DECLARO QUE:</p>
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox checked={c1} onCheckedChange={(v) => setC1(v === true)} />
                <span>Estou autorizado(a) a assinar este documento.</span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox checked={c2} onCheckedChange={(v) => setC2(v === true)} />
                <span>Os dados apresentados conferem com a realidade.</span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox checked={c3} onCheckedChange={(v) => setC3(v === true)} />
                <span>Assumo responsabilidade pelo conteúdo aqui firmado.</span>
              </label>
            </div>

            <p className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-2">
              Esta assinatura eletrônica tem validade conforme a{" "}
              <strong>Lei nº 14.063/2020, Art. 4º, I</strong>
              &nbsp;(assinatura eletrônica simples), acompanhada de trilha de auditoria (IP,
              timestamp e hash SHA-256).
            </p>

            {!allChecked && (
              <div className="flex items-start gap-2 rounded-md bg-warning-soft border border-warning/30 p-2 text-xs text-warning-soft-foreground">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Marque todas as caixas para continuar.</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button disabled={!allChecked} onClick={() => close(true)}>
              Aceito e assino
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TermoAceiteContext.Provider>
  );
}

export function useTermoAceite(): PedirTermo {
  const ctx = useContext(TermoAceiteContext);
  if (!ctx) throw new Error("useTermoAceite deve ser usado dentro de TermoAceiteProvider");
  return ctx;
}
