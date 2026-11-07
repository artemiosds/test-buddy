import { useState } from "react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { extrairTextoPdf, renderizarPaginasJpeg } from "@/lib/piso-fopag-pdf";
import { ocrLocalPdf } from "@/lib/piso-ocr-local";
import { getExtracaoConfig } from "@/lib/piso-extracao-config.functions";
import { janelasContinuas, parseFopagTexto, parseFopagIA, type FopagExtracao } from "@/lib/piso-fopag-parser";
import { extrairFopagPorIA } from "@/lib/piso-fopag-ia.functions";
import {
  auditarPiso, carregarXlsx, extrairFopagPlanilha, extrairFopagPdf,
  extrairPrestadores, exportarPisoConferido,
  type AnalisePiso, type PendenciaPiso,
} from "@/lib/piso-conferencia-ministerio";
import type * as XLSX from "xlsx-js-style";
import { processarPrestadoresLote, baixarConsolidadoPrestadores } from "@/lib/piso-prestadores-lote";
import { criarPlanilhaFopagPdf } from "@/lib/piso-fopag-planilha-pdf";

type Progresso = { feito: number; total: number; etapa: string };
type EntradaFopag = { fontes: ReturnType<typeof extrairFopagPdf>["fontes"]; competencia: string | null };

async function lerPdf(file: File, competencia: string, usarIA: boolean): Promise<FopagExtracao> {
  if (file.size > 80 * 1024 * 1024) throw new Error(`PDF ${file.name} excede 80MB.`);
  const texto = await extrairTextoPdf(file);
  if (texto.paginasComErro.length)
    throw new Error(`PDF ${file.name}: ${texto.paginasComErro.length} página(s) não puderam ser lidas.`);
  const local = texto.pesquisavel ? parseFopagTexto(texto.paginas) : null;
  if (local?.funcionarios.length && !usarIA) return local;
  if (!usarIA) {
    // Mesmo motor local do assistente de importação: Tesseract em WASM.
    const config = await getExtracaoConfig();
    const ocr = await ocrLocalPdf(file, texto.numPages, { idioma: config.ocr_idioma });
    if (ocr.paginasComErro.length)
      throw new Error(`OCR local de ${file.name}: ${ocr.paginasComErro.length} página(s) com falha. Confira o documento.`);
    const extraido = parseFopagTexto(ocr.paginas);
    if (extraido.funcionarios.length) return extraido;
    throw new Error(`PDF ${file.name}: texto/OCR insuficiente. Autorize a IA externa para tentar a extração.`);
  }

  const janelas = janelasContinuas(texto.numPages, texto.paginas, 12);
  const payloads: { competencia?: string | null; funcionarios?: unknown[] }[] = [];
  for (const janela of janelas) {
    const paginas = await renderizarPaginasJpeg(file, janela);
    if (!paginas.length) throw new Error(`Nenhuma página renderizada: ${file.name}.`);
    // Motor externo já configurado com provedores ativos e failover.
    const retorno = await extrairFopagPorIA({
      data: { paginas, competencia_hint: competencia },
    });
    payloads.push({ competencia: retorno.competencia, funcionarios: retorno.funcionarios });
  }
  const extracao = parseFopagIA(payloads);
  if (!extracao.funcionarios.length) throw new Error(`A IA não extraiu profissionais: ${file.name}.`);
  return extracao;
}

function salvarArquivo(bytes: Uint8Array, nome: string) {
  const copia = new Uint8Array(bytes.byteLength);
  copia.set(bytes);
  const url = URL.createObjectURL(new Blob([copia], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function PisoConferenciaWizard() {
  const [competencia, setCompetencia] = useState("");
  const [fopag, setFopag] = useState<File[]>([]);
  const [prestadores, setPrestadores] = useState<File[]>([]);
  const [consolidadoPrestadores, setConsolidadoPrestadores] = useState<Uint8Array | null>(null);
  const [rascunhoFopag, setRascunhoFopag] = useState<Uint8Array | null>(null);
  const [modelo, setModelo] = useState<File | null>(null);
  const [usarIA, setUsarIA] = useState(false);
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const [analise, setAnalise] = useState<AnalisePiso | null>(null);
  const [modeloLido, setModeloLido] = useState<XLSX.WorkBook | null>(null);
  const [confirmado, setConfirmado] = useState(false);

  const bloqueios = analise?.pendencias.filter(p => p.tipo === "bloqueio") ?? [];
  const avisos = analise?.pendencias.filter(p => p.tipo === "aviso") ?? [];
  const pronto = !!analise && !bloqueios.length && confirmado && !!modeloLido;

  async function analisar() {
    setAnalise(null);
    setModeloLido(null);
    setConfirmado(false);
    setConsolidadoPrestadores(null);
    setRascunhoFopag(null);
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(competencia)) {
      toast.error("Informe a competência no formato AAAA-MM.");
      return;
    }
    if (!fopag.length || !prestadores.length || !modelo) {
      toast.error("Anexe FOPAG, Prestadores e o modelo original do Ministério.");
      return;
    }
    const somentePlanilha = fopag.length === 1 && /\.xlsx$/i.test(fopag[0].name);
    const somentePdf = fopag.length === 3 && fopag.every(f => /\.pdf$/i.test(f.name));
    if (!somentePlanilha && !somentePdf) {
      toast.error("Envie uma planilha FOPAG .xlsx ou exatamente os 3 PDFs da folha.");
      return;
    }
    setProgresso({ etapa: "Conferindo documentos e competência", feito: 0, total: 4 });
    try {
      const pendencias: PendenciaPiso[] = [];
      let origem: EntradaFopag;
      if (somentePlanilha) {
        const wb = carregarXlsx(await fopag[0].arrayBuffer());
        origem = extrairFopagPlanilha(wb, pendencias);
      } else {
        const resultados: FopagExtracao[] = [];
        for (const pdf of fopag) {
          setProgresso(p => p ? ({ ...p, etapa: `Extraindo ${pdf.name}` }) : null);
          resultados.push(await lerPdf(pdf, competencia, usarIA));
        }
        origem = extrairFopagPdf(resultados, pendencias);
        try {
          setRascunhoFopag(criarPlanilhaFopagPdf(resultados, competencia));
        } catch (e) {
          pendencias.push({tipo:"aviso", mensagem:`Rascunho FOPAG não disponível: ${e instanceof Error?e.message:String(e)}`});
        }
      }
      setProgresso({ etapa: "Conferindo Prestadores", feito: 1, total: 4 });
      let origemPrest: { fontes: ReturnType<typeof extrairPrestadores>["fontes"]; competencia: string | null };
      if (prestadores.length === 1) {
        const unico = carregarXlsx(await prestadores[0].arrayBuffer());
        if (unico.SheetNames.some(nome => /CONSOLIDADO_GERAL/i.test(nome))) {
          origemPrest = extrairPrestadores(unico, pendencias);
        } else {
          const resultadoLote = processarPrestadoresLote(
            [{nome: prestadores[0].name, workbook: unico}], competencia, pendencias,
          );
          origemPrest = resultadoLote;
          setConsolidadoPrestadores(baixarConsolidadoPrestadores(resultadoLote.workbook));
        }
      } else {
        const arquivos = [];
        for (const arquivo of prestadores) {
          if (!/\.xlsx$/i.test(arquivo.name)) throw new Error("Os Prestadores devem estar em arquivos .xlsx.");
          arquivos.push({nome: arquivo.name, workbook: carregarXlsx(await arquivo.arrayBuffer())});
        }
        const resultadoLote = processarPrestadoresLote(arquivos, competencia, pendencias);
        origemPrest = resultadoLote;
        setConsolidadoPrestadores(baixarConsolidadoPrestadores(resultadoLote.workbook));
      }
      setProgresso({ etapa: "Validando arquivo original do Ministério", feito: 2, total: 4 });
      const ministerio = carregarXlsx(await modelo.arrayBuffer());
      const resultado = auditarPiso({
        competencia, fopag: origem.fontes, prestadores: origemPrest.fontes,
        competenciaFopag: origem.competencia, competenciaPrestadores: origemPrest.competencia,
        modelo: ministerio, pendencias,
      });
      setModeloLido(ministerio);
      setAnalise(resultado);
      setProgresso({ etapa: "Conciliação concluída", feito: 4, total: 4 });
      if (resultado.pendencias.some(p => p.tipo === "bloqueio"))
        toast.warning("Conciliação com pendências: a planilha oficial não será liberada.");
      else toast.success("Conciliação concluída. Confira os avisos e confirme a exportação.");
    } catch (e) {
      setProgresso(null);
      toast.error(e instanceof Error ? e.message : "Não foi possível analisar os documentos.");
    }
  }

  function baixar() {
    if (!pronto || !modeloLido || !analise) return;
    try {
      const bytes = exportarPisoConferido(modeloLido, analise);
      salvarArquivo(bytes, `piso-enfermagem_${competencia.replace("-", "_")}_CONFERIDO.xlsx`);
      toast.success("Arquivo gerado a partir do modelo fornecido.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar planilha.");
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Conciliação FOPAG → Prestadores → Ministério</CardTitle>
          <CardDescription>
            Utilize o Motor de Extração e os provedores externos cadastrados para ler PDFs; os cálculos
            e o cruzamento por CPF são determinísticos. Nada é gravado no banco nesta etapa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Competência (AAAA-MM)</span>
            <Input type="month" value={competencia} onChange={e => setCompetencia(e.target.value)}
              className="max-w-xs" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">FOPAG — 3 PDFs ou planilha de cálculo .xlsx</span>
            <Input type="file" accept=".pdf,.xlsx" multiple
              onChange={e => setFopag(Array.from(e.target.files ?? []))} />
            <span className="block text-xs text-muted-foreground">{fopag.map(f => f.name).join(" · ") || "Nenhum arquivo selecionado"}</span>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Prestadores — consolidado ou planilhas de cada unidade (.xlsx)</span>
            <Input type="file" accept=".xlsx" multiple onChange={e => setPrestadores(Array.from(e.target.files ?? []))} />
            <span className="block text-xs text-muted-foreground">{prestadores.length} arquivo(s) selecionado(s).</span>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Modelo ORIGINAL do Ministério (.xlsx)</span>
            <Input type="file" accept=".xlsx" onChange={e => setModelo(e.target.files?.[0] ?? null)} />
          </label>
          <label className="flex gap-2 items-center text-sm">
            <input type="checkbox" checked={usarIA} onChange={e => setUsarIA(e.target.checked)} />
            Autorizo o envio das páginas dos PDFs à IA externa configurada (substitui a leitura local)
          </label>
          <div className="flex gap-3 items-center flex-wrap">
            <Button onClick={() => void analisar()} disabled={!!progresso && progresso.feito < progresso.total}>
              {progresso?.feito !== progresso?.total && progresso ? "Processando..." : "Analisar e conciliar"}
            </Button>
            {progresso && <span className="text-sm text-muted-foreground">{progresso.etapa}</span>}
          </div>
        </CardContent>
      </Card>
      {analise && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado da auditoria</CardTitle>
            <CardDescription>Esta etapa não altera dados históricos nem aprova CPFs automaticamente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <Badge variant="secondary">Origem: {analise.fontes.length}</Badge>
              <Badge variant="secondary">Modelo: {analise.totalModelo}</Badge>
              <Badge variant="secondary">Correspondências: {analise.encontrados}</Badge>
              <Badge variant={bloqueios.length ? "destructive" : "secondary"}>Bloqueios: {bloqueios.length}</Badge>
              <Badge variant="secondary">Avisos: {avisos.length}</Badge>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2 text-sm" role="status">
              {analise.pendencias.map((p, i) => (
                <p key={i} className={p.tipo === "bloqueio" ? "text-destructive" : "text-amber-600"}>
                  {p.tipo === "bloqueio" ? "Bloqueio" : "Aviso"}: {p.mensagem}
                </p>
              ))}
              {!analise.pendencias.length && <p>Sem divergências identificadas.</p>}
            </div>
            <label className="flex gap-2 items-start text-sm">
              <input type="checkbox" checked={confirmado} disabled={bloqueios.length > 0}
                onChange={e => setConfirmado(e.target.checked)} />
              Confirmei a competência, os totais e a correspondência dos documentos de origem com o modelo.
            </label>
            <div className="flex flex-wrap gap-2">
              {rascunhoFopag && (
                <Button variant="outline" onClick={() => salvarArquivo(rascunhoFopag,
                  `RASCUNHO_CALCULO_PISO_FOPAG_${competencia.replace("-", "_")}.xlsx`)}>
                  Baixar FOPAG para conferência (rascunho)
                </Button>
              )}
              {consolidadoPrestadores && (
                <Button variant="outline" onClick={() => salvarArquivo(consolidadoPrestadores,
                  `PRESTADORES_ENFERMAGEM_${competencia.replace("-", "_")}_COMPLETO.xlsx`)}>
                  Baixar Prestadores consolidados (auditoria)
                </Button>
              )}
              <Button onClick={baixar} disabled={!pronto}>
                Baixar modelo ministerial preenchido (G, I, K)
              </Button>
            </div>
            {!!bloqueios.length && <p className="text-xs text-muted-foreground">
              Corrija os arquivos de origem ou o modelo e execute a auditoria novamente. Nenhum CPF, CNES ou CBO é substituído automaticamente.
            </p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
