import { useState } from "react";
import { Cake, Copy, PartyPopper, Search } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAniversariantes } from "@/hooks/use-aniversariantes";
import { rotuloEmDias, type Aniversariante } from "@/lib/aniversariantes";

function normalizarBusca(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

async function copiarParabens(nome: string) {
  try {
    await navigator.clipboard.writeText(
      `Feliz aniversário, ${nome.split(/\s+/)[0]}! 🎉 A equipe da Saúde deseja um dia muito especial.`,
    );
    toast.success("Mensagem copiada");
  } catch {
    toast.error("Não foi possível copiar a mensagem");
  }
}

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
          onClick={() => void copiarParabens(a.nome)}
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
  const [busca, setBusca] = useState("");
  const termo = normalizarBusca(busca.trim());
  const aniversariantesFiltrados = termo
    ? mes.filter((a) => normalizarBusca([a.nome, a.cargo, a.setor, a.unidade].filter(Boolean).join(" ")).includes(termo))
    : mes;

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
      <Dialog open={aberto} onOpenChange={(open) => { setAberto(open); if (!open) setBusca(""); }}>
        <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-4 overflow-hidden p-4 sm:p-6">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>Aniversariantes do mês</DialogTitle>
          </DialogHeader>
          <div className="relative shrink-0">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar aniversariantes por nome, cargo, setor ou unidade"
              placeholder="Buscar nome, cargo ou unidade..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <p className="shrink-0 text-xs text-muted-foreground" aria-live="polite">
            {aniversariantesFiltrados.length} {aniversariantesFiltrados.length === 1 ? "aniversariante encontrado" : "aniversariantes encontrados"}
          </p>
          <div className="min-h-0 min-w-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto pr-1">
            {aniversariantesFiltrados.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum aniversariante encontrado.</p>
            ) : aniversariantesFiltrados.map((a) => (
              <div key={a.id} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-start">
                <Badge variant="secondary" className="w-fit shrink-0 font-semibold tabular-nums">
                  {String(a.dia).padStart(2, "0")}/{String(a.mes).padStart(2, "0")}
                </Badge>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="break-words text-sm font-semibold leading-relaxed">{a.nome}</p>
                  {a.cargo && <p className="break-words text-xs leading-relaxed text-muted-foreground"><span className="font-medium">Cargo:</span> {a.cargo}</p>}
                  {a.setor && <p className="break-words text-xs leading-relaxed text-muted-foreground"><span className="font-medium">Setor:</span> {a.setor}</p>}
                  {a.unidade && <p className="break-words text-xs leading-relaxed text-muted-foreground"><span className="font-medium">Unidade:</span> {a.unidade}</p>}
                </div>
                <Button type="button" size="sm" variant="outline" className="w-full shrink-0 sm:w-auto" onClick={() => void copiarParabens(a.nome)} aria-label={`Copiar mensagem de parabéns para ${a.nome}`}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Parabéns
                </Button>
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
