import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import {
  listPisoReferencias,
  salvarPisoReferencia,
  excluirPisoReferencia,
} from "@/lib/piso-referencia.functions";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/_authenticated/piso-enfermagem/referencia")({
  component: ReferenciaPage,
  head: () => ({
    meta: [
      { title: "Tabela de Referência do Piso | Gestão SMS" },
      {
        name: "description",
        content:
          "Cadastro e manutenção dos valores de referência do Piso Nacional da Enfermagem por competência e categoria.",
      },
      { property: "og:title", content: "Tabela de Referência do Piso" },
      {
        property: "og:description",
        content: "Valores de referência do Piso Nacional da Enfermagem por competência.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const CATEGORIAS = [
  { value: "ENFERMEIRO", label: "Enfermeiro" },
  { value: "TECNICO_ENFERMAGEM", label: "Técnico de Enfermagem" },
  { value: "AUXILIAR_ENFERMAGEM", label: "Auxiliar de Enfermagem" },
] as const;

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);

function competenciaAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ReferenciaPage() {
  const listar = useServerFn(listPisoReferencias);
  const salvar = useServerFn(salvarPisoReferencia);
  const excluir = useServerFn(excluirPisoReferencia);
  const qc = useQueryClient();

  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [categoria, setCategoria] = useState<string>("ENFERMEIRO");
  const [valor, setValor] = useState("");
  const [jornada, setJornada] = useState("44");

  const { data, isLoading } = useQuery({
    queryKey: ["piso-referencias"],
    queryFn: () => listar({ data: {} }),
  });

  const rows = useMemo(() => data?.rows ?? [], [data]);

  const mSalvar = useMutation({
    mutationFn: () =>
      salvar({
        data: {
          competencia,
          categoria: categoria as (typeof CATEGORIAS)[number]["value"],
          valor_referencia: Number(valor.replace(",", ".")) || 0,
          jornada_base: Number(jornada) || 44,
        },
      }),
    onSuccess: () => {
      toast.success("Valor de referência salvo.");
      setValor("");
      qc.invalidateQueries({ queryKey: ["piso-referencias"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mExcluir = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Registro removido.");
      qc.invalidateQueries({ queryKey: ["piso-referencias"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/piso-enfermagem">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Piso
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Tabela de Referência do Piso Nacional da Enfermagem"
        description="Valores de referência por competência e categoria. O cálculo do complemento usa sempre o valor vigente da competência processada."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo valor / atualização</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="comp">Competência</Label>
            <Input
              id="comp"
              placeholder="2026-07"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="valor">Valor de referência</Label>
            <Input
              id="valor"
              inputMode="decimal"
              placeholder="4750,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jornada">Jornada base (h)</Label>
            <Input
              id="jornada"
              inputMode="numeric"
              value={jornada}
              onChange={(e) => setJornada(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              className="w-full"
              onClick={() => mSalvar.mutate()}
              disabled={mSalvar.isPending || !valor}
            >
              <Plus className="mr-2 h-4 w-4" /> Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Valores cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competência</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor de referência</TableHead>
                <TableHead className="text-right">Jornada base</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Carregando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Nenhum valor cadastrado.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.competencia}</TableCell>
                  <TableCell>
                    {CATEGORIAS.find((c) => c.value === r.categoria)?.label ?? r.categoria}
                  </TableCell>
                  <TableCell className="text-right">{brl(Number(r.valor_referencia))}</TableCell>
                  <TableCell className="text-right">{r.jornada_base}h</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => mExcluir.mutate(r.id)}
                      aria-label="Excluir valor de referência"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
