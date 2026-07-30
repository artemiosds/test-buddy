import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Cpu, Loader2 } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/toast";
import {
  getExtracaoConfig,
  salvarExtracaoConfig,
  type MotorExtracao,
} from "@/lib/piso-extracao-config.functions";
import { IaProvedoresManager } from "@/components/piso/ia-provedores-manager";

export const Route = createFileRoute("/_authenticated/piso-enfermagem/extracao")({
  component: ExtracaoConfigPage,
  head: () => ({
    meta: [
      { title: "Motor de Extração de PDF | Piso da Enfermagem" },
      {
        name: "description",
        content:
          "Configure o motor de extração dos PDFs da FOPAG: PDF pesquisável, OCR local ou IA de Visão opcional.",
      },
      { property: "og:title", content: "Motor de Extração de PDF | Piso da Enfermagem" },
      {
        property: "og:description",
        content: "Escolha entre PDF pesquisável, OCR local e IA de Visão para importar a FOPAG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const MOTORES: { valor: MotorExtracao; titulo: string; desc: string }[] = [
  {
    valor: "automatico",
    titulo: "Automático (recomendado)",
    desc: "Tenta PDF pesquisável (pdfjs-dist) → OCR Local (Tesseract) → IA de Visão (se configurada).",
  },
  {
    valor: "texto",
    titulo: "PDF pesquisável (pdfjs-dist)",
    desc: "Apenas texto digital do PDF. Custo zero.",
  },
  {
    valor: "ocr_local",
    titulo: "OCR Local (Tesseract)",
    desc: "Reconhecimento em WebAssembly no próprio navegador. Custo zero e sem envio externo.",
  },
  {
    valor: "ia_visao",
    titulo: "IA de Visão",
    desc: "Opcional. Exige provedor e API Key configurados.",
  },
];

function ExtracaoConfigPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["piso-extracao-config"],
    queryFn: () => getExtracaoConfig(),
  });

  const [motor, setMotor] = useState<MotorExtracao>("automatico");
  const [idioma, setIdioma] = useState("por");

  useEffect(() => {
    if (!data) return;
    setMotor(data.motor);
    setIdioma(data.ocr_idioma);
  }, [data]);

  const salvar = useMutation({
    mutationFn: () =>
      salvarExtracaoConfig({
        data: {
          motor,
          ia_fornecedor: data?.ia_fornecedor ?? "gemini",
          ia_modelo: data?.ia_modelo ?? "gemini-3.6-flash",
          ia_habilitada: data?.ia_habilitada ?? false,
          ocr_idioma: idioma,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["piso-extracao-config"] });
      toast.success("Configuração salva.");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao salvar a configuração."),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Motor de Extração de PDF"
        description="Define como o sistema lê os PDFs da FOPAG antes de entrar no pipeline de importação."
        actions={
          <Button variant="outline" asChild>
            <Link to="/piso-enfermagem">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" /> Motor de Extração PDF
          </CardTitle>
          <CardDescription>
            No modo automático o documento nunca sai do dispositivo enquanto houver texto
            pesquisável ou OCR local suficiente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={motor} onValueChange={(v) => setMotor(v as MotorExtracao)}>
            {MOTORES.map((m) => (
              <label
                key={m.valor}
                htmlFor={`motor-${m.valor}`}
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
              >
                <RadioGroupItem id={`motor-${m.valor}`} value={m.valor} className="mt-1" />
                <span>
                  <span className="block text-sm font-medium">{m.titulo}</span>
                  <span className="block text-xs text-muted-foreground">{m.desc}</span>
                </span>
              </label>
            ))}
          </RadioGroup>

          <div className="max-w-xs space-y-2">
            <Label htmlFor="idioma">Idioma do OCR local</Label>
            <Select value={idioma} onValueChange={setIdioma}>
              <SelectTrigger id="idioma">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="por">Português</SelectItem>
                <SelectItem value="eng">Inglês</SelectItem>
                <SelectItem value="por+eng">Português + Inglês</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <IaProvedoresManager />

      <div className="flex justify-end">
        <Button disabled={isLoading || salvar.isPending} onClick={() => salvar.mutate()}>
          {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar configuração
        </Button>
      </div>
    </div>
  );
}
