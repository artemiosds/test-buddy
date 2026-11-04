import { useState } from "react";
import { Cake, Copy, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAniversariantes } from "@/hooks/use-aniversariantes";
import { rotuloEmDias, type Aniversariante } from "@/lib/aniversariantes";

function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function Linha({ a, destaque }: { a: Aniversariante; destaque?: boolean }) {
  const detalhe = [a.cargo, a.setor, a.unidade].filter(Boolean).join(" · ");
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
        {iniciais(a.nome)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{a.nome}</p>
        {detalhe && <p className="truncate text-xs text-muted-foreground">{detalhe}</p>}
      </div>
      {destaque ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            navigator.clipboard?.writeText(
              `Feliz aniversário, ${a.nome.split(" ")[0]}! 🎉 A equipe da Saúde deseja um dia muito especial.`,
            );
            toast.success("Mensagem copiada");
          }}
        >
          <Copy className="mr-1 h-3.5 w-3.5" /> Parabéns
        </Button>
      ) : (
        <Badge variant="secondary" className="shrink-0 font-normal">{rotuloEmDias(a)}</Badge>
      )}
    </div>
  );
}

export function CardAniversariantes() {
  const { hoje, proximos, mes, isLoading } = useAniversariantes();
  const [aberto, setAberto] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Cake className="h-4 w-4 text-primary" /> Aniversariantes
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setAberto(true)} disabled={mes.length === 0}>
          Ver todos do mês ({mes.length})
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : hoje.length === 0 && proximos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum aniversariante nos próximos dias.</p>
        ) : (
          <>
            {hoje.length > 0 && (
              <div>
                <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  <PartyPopper className="h-3.5 w-3.5" /> Hoje
                </p>
                <div className="divide-y divide-border">{hoje.map((a) => <Linha key={a.id} a={a} destaque />)}</div>
              </div>
            )}
            {proximos.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Próximos 7 dias</p>
                <div className="divide-y divide-border">{proximos.map((a) => <Linha key={a.id} a={a} />)}</div>
              </div>
            )}
          </>
        )}
      </CardContent>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Aniversariantes do mês</DialogTitle></DialogHeader>
          <div className="divide-y divide-border">
            {mes.map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2">
                <span className="w-12 text-sm font-semibold tabular-nums text-primary">
                  {String(a.dia).padStart(2, "0")}/{String(a.mes).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{a.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">{[a.cargo, a.setor, a.unidade].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/** Pílula do cabeçalho: aparece só quando há aniversariante hoje. */
export function PilulaAniversariantesHoje() {
  const { hoje } = useAniversariantes();
  const [aberto, setAberto] = useState(false);
  if (hoje.length === 0) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="hidden items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/20 md:inline-flex"
      >
        🎉 {hoje.length} {hoje.length === 1 ? "aniversário hoje" : "aniversários hoje"}
      </button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader><DialogTitle>🎉 Aniversariantes de hoje</DialogTitle></DialogHeader>
          <div className="divide-y divide-border">{hoje.map((a) => <Linha key={a.id} a={a} destaque />)}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
