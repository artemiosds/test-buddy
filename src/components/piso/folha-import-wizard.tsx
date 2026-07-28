import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Sparkles,
  UploadCloud,
} from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";

import { CAMPOS_SISTEMA, CAMPOS_CALCULADOS, type PisoDestino } from "@/lib/piso-mapping";
import { autoMapLayout, type LayoutFolha } from "@/lib/piso-layouts";
import { detectHeaderRow, buildRowsFromAoa, detectarCompetencia } from "@/lib/piso-heuristics";
import { resolveRows, type Mapeamento, type RawRow, type ResolvedRow } from "@/lib/piso-import";
import { LABEL_ISSUE, validarLinhas, type Issue } from "@/lib/piso-validacao";
import { bestFuzzy } from "@/lib/piso-fuzzy";
import {
  appendPisoLinhas,
  finalizeImportPiso,
  listMapeamentos,
  matchProfissionaisImport,
  saveMapeamento,
  startImportPiso,
} from "@/lib/piso-enfermagem.functions";
import { consolidarLotePiso, registrarAuditoriaImportacao } from "@/lib/piso-gestao.functions";
import { detectarLayout, mapearColunas, type LayoutVersaoResolvida } from "@/lib/layout-engine";
import {
  extrairTextoPdf,
  renderizarPaginasJpeg,
  sha256Arquivo,
  type CancelToken,
} from "@/lib/piso-fopag-pdf";
import {
  fopagParaAoa,
  parseFopagIA,
  parseFopagTexto,
  resumoCategorias,
  type FopagExtracao,
  type FopagFuncionario,
  janelasContinuas,
} from "@/lib/piso-fopag-parser";
import { extrairFopagPorIA } from "@/lib/piso-fopag-ia.functions";
import { ocrLocalPdf } from "@/lib/piso-ocr-local";
import {
  getExtracaoConfig,
  type ExtracaoConfigPublica,
} from "@/lib/piso-extracao-config.functions";

import { gerarPlanilhaOficialPiso } from "@/lib/piso-planilha.functions";
import { listVersoesAtivas, registrarUsoLayout } from "@/lib/layout-engine.functions";

const CHUNK = 100;
/** Páginas por chamada à IA de Visão (lotes pequenos = baixo consumo de memória). */
/** Limite técnico de páginas por requisição à IA (só usado se o PDF for grande). */
const MAX_PAGINAS_POR_JANELA = 12;

type OrigemDados = "excel" | "pdf";

/** Identificador curto do motor usado (auditoria/suporte). */
type MotorSlug = "pdfjs" | "tesseract" | "gemini" | "lovable";

/** Tempos por etapa do pipeline (identificação de gargalos). */
type Tempos = {
  abrirPdf: number;
  render: number;
  ocr: number;
  ia: number;
  parser: number;
  total: number;
};

/** Etapa do diagnóstico exibido quando algo falha. */
type PassoDiag = { ok: boolean; texto: string; detalhe?: string; sugestao?: string };

type FopagMeta = {
  promptVersao?: string | null;
  /** Rótulo amigável exibido ao usuário (ex.: "OCR Local (Tesseract)"). */
  metodo: string;
  /** Slug curto gravado na auditoria. */
  motor: MotorSlug;
  modelo: string | null;
  paginas: number;
  hash: string;
  duracaoMs: number;
  /** JSON bruto devolvido pela IA (auditoria/rastreabilidade). */
  brutoIA: string | null;
  /** SHA-256 do texto de cada página (detecta PDF alterado com o mesmo nome). */
  hashesPaginas?: string[];
  /** Páginas puladas por erro, sem abortar o documento. */
  paginasComErro?: { pagina: number; erro: string }[];
  tempos?: Tempos;
};


/** Rótulo humano de um modelo de IA: "gemini-3.6-flash" → "Gemini 3.6 Flash". */
function rotuloModelo(modelo: string | null): string {
  if (!modelo) return "IA de Visão";
  return modelo
    .split(/[-_/]/)
    .filter(Boolean)
    .map((p) => (/^\d/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}


/** Versão do pipeline de importação por PDF (auditoria). */
const PIPELINE_VERSAO = "fopag-pdf-1.1";

function fmtTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

type Passo = 1 | 2 | 3 | 4;

export function FolhaImportWizard({ layout }: { layout: LayoutFolha }) {
  const navigate = useNavigate();
  const [passo, setPasso] = useState<Passo>(1);
  const [file, setFile] = useState<File | null>(null);
  const [competencia, setCompetencia] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [aoa, setAoa] = useState<unknown[][]>([]);
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [mapeamento, setMapeamento] = useState<Mapeamento>({});
  const [resolved, setResolved] = useState<ResolvedRow[]>([]);
  const [nomeModelo, setNomeModelo] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [progresso, setProgresso] = useState({ ativo: false, total: 0, feito: 0 });
  const inicioRef = useRef(0);
  const [versaoId, setVersaoId] = useState<string | null>(null);
  const [origem, setOrigem] = useState<OrigemDados>("excel");
  const [fopag, setFopag] = useState<FopagExtracao | null>(null);
  const [fopagMeta, setFopagMeta] = useState<FopagMeta | null>(null);
  /** Campos corrigidos manualmente na pré-visualização (auditoria). */
  const [camposCorrigidos, setCamposCorrigidos] = useState(0);
  const [lendoPdf, setLendoPdf] = useState<{ ativo: boolean; etapa: string; feito: number; total: number }>(
    { ativo: false, etapa: "", feito: 0, total: 0 },
  );
  const [concluido, setConcluido] = useState<{ atualizados: number; pendencias: number } | null>(
    null,
  );
  const cancelRef = useRef<CancelToken>({ cancelado: false });
  /** Diagnóstico exibido quando nenhum motor local conseguiu ler o PDF. */
  const [falhaOcr, setFalhaOcr] = useState<{
    file: File;
    iaDisponivel: boolean;
    diagnostico: PassoDiag[];
  } | null>(null);

  const [motivoDeteccao, setMotivoDeteccao] = useState<string | null>(null);

  const versoesQ = useQuery({
    queryKey: ["layout-engine", "versoes", "piso"],
    queryFn: () => listVersoesAtivas({ data: { modulo: "piso" } }),
  });
  /** Motor de extração de PDF configurado pelo administrador. */
  const extracaoQ = useQuery({
    queryKey: ["piso-extracao-config"],
    queryFn: () => getExtracaoConfig(),
    staleTime: 60_000,
  });
  const versoes = (versoesQ.data?.versoes ?? []) as LayoutVersaoResolvida[];
  const versaoAtiva = versoes.find((v) => v.versao_id === versaoId) ?? null;

  /** Mapeia usando o layout do banco (Motor de Layouts); sem layout, usa o perfil em código. */
  function mapearComMotor(hs: string[], v: LayoutVersaoResolvida | null): Mapeamento {
    if (!v) return autoMapLayout(hs, layout);
    return mapearColunas(hs, v) as Mapeamento;
  }

  const tipoArquivo: "Excel" | "CSV" | "PDF" = useMemo(() => {
    const n = file?.name.toLowerCase() ?? "";
    if (n.endsWith(".pdf")) return "PDF";
    return n.endsWith(".csv") ? "CSV" : "Excel";
  }, [file]);

  const aceitaPdf = layout.tipo === "efetivos";

  async function handleFile(f: File) {
    if (f.size > 50 * 1024 * 1024) {
      toast.error("Arquivo excede o limite de 50 MB.");
      return;
    }
    const lower = f.name.toLowerCase();
    if (!/\.(xlsx|xls|csv)$/.test(lower)) {
      toast.error("Formato não suportado. Envie Excel (.xlsx/.xls) ou CSV.");
      return;
    }
    let matrix: unknown[][];
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
    } catch (err) {
      toast.error(`Falha ao ler o arquivo: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    if (matrix.length === 0) {
      toast.error("Arquivo sem linhas.");
      return;
    }
    const idx = detectHeaderRow(matrix);
    const { headers: hs, rows } = buildRowsFromAoa(matrix, idx);
    setFile(f);
    setAoa(matrix);
    setHeaderRowIndex(idx);
    setHeaders(hs);
    setRawRows(rows);

    const det = detectarLayout(versoes, f.name, hs);
    const escolhido = det.escolhido?.versao ?? null;
    setVersaoId(escolhido?.versao_id ?? null);
    setMotivoDeteccao(
      versoes.length === 0
        ? null
        : det.requerEscolha
          ? det.motivo === "empate"
            ? "Mais de um layout compatível: confirme qual utilizar."
            : det.motivo === "sem_candidato"
              ? "Nenhum layout cadastrado compatível: confira o mapeamento."
              : "Compatibilidade baixa com o layout sugerido: confira o mapeamento."
          : `Layout identificado automaticamente: ${escolhido?.layout_nome} (v${escolhido?.versao}).`,
    );
    setMapeamento(mapearComMotor(hs, escolhido));
    setResolved([]);

    // Competência: nome do arquivo → texto das primeiras linhas do documento
    const texto = matrix
      .slice(0, Math.min(idx + 1, 12))
      .map((l) => (Array.isArray(l) ? l.join(" ") : String(l)))
      .join(" ");
    const comp = detectarCompetencia(f.name) ?? detectarCompetencia(texto);
    if (comp) setCompetencia(comp);
    setPasso(2);
  }

  /** Aplica um AOA já pronto (Excel ou PDF) no mesmo fluxo do assistente. */
  function aplicarMatriz(f: File, matrix: unknown[][], compDetectada: string | null) {
    const idx = detectHeaderRow(matrix);
    const { headers: hs, rows } = buildRowsFromAoa(matrix, idx);
    setFile(f);
    setAoa(matrix);
    setHeaderRowIndex(idx);
    setHeaders(hs);
    setRawRows(rows);

    const det = detectarLayout(versoes, f.name, hs);
    const escolhido = det.escolhido?.versao ?? null;
    setVersaoId(escolhido?.versao_id ?? null);
    setMotivoDeteccao(
      versoes.length === 0
        ? null
        : escolhido
          ? `Layout identificado automaticamente: ${escolhido.layout_nome} (v${escolhido.versao}).`
          : "Nenhum layout cadastrado compatível: confira o mapeamento.",
    );
    setMapeamento(mapearComMotor(hs, escolhido));
    setResolved([]);
    if (compDetectada) setCompetencia(compDetectada);
    setPasso(2);
  }

  /** Reaplica a extração editada do PDF no mesmo pipeline (AOA → Motor de Layouts). */
  function reaplicarFopag(prox: FopagExtracao) {
    setFopag(prox);
    if (file) aplicarMatriz(file, fopagParaAoa(prox), prox.competencia ?? competencia ?? null);
  }

  function editarFuncionario(idx: number, patch: Partial<FopagFuncionario>) {
    if (!fopag) return;
    const funcionarios = fopag.funcionarios.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    setCamposCorrigidos((n) => n + 1);
    reaplicarFopag({ ...fopag, funcionarios });
  }

  function ignorarFuncionario(idx: number) {
    if (!fopag) return;
    const funcionarios = fopag.funcionarios.filter((_, i) => i !== idx);
    reaplicarFopag({ ...fopag, funcionarios, ignorados: fopag.ignorados + 1 });
  }

  /**
   * Pipeline PDF FOPAG com três motores:
   * 1) texto pesquisável (pdfjs, custo zero) → 2) OCR local no navegador
   * (custo zero, nada sai do dispositivo) → 3) IA de Visão (opcional).
   * O motor é escolhido pela configuração do administrador.
   */
  async function handleFilePdf(f: File, opts?: { forcarIa?: boolean }) {
    if (f.size > 80 * 1024 * 1024) {
      toast.error("PDF excede o limite de 80 MB.");
      return;
    }
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Envie um arquivo PDF (.pdf).");
      return;
    }
    cancelRef.current = { cancelado: false };
    const inicio = Date.now();
    setFopag(null);
    setFopagMeta(null);
    setFalhaOcr(null);
    setLendoPdf({ ativo: true, etapa: "Abrindo o PDF...", feito: 0, total: 1 });

    try {
      console.info("[PDF] Arquivo recebido no wizard:", f.name);
      // A leitura da configuração precisa estar dentro do try: quando ela falha
      // (permissão, rede), a promessa era rejeitada fora do bloco e a barra de
      // progresso ficava presa em "0 de 1 página(s)" para sempre.
      let cfg: ExtracaoConfigPublica;
      try {
        cfg = extracaoQ.data ?? (await getExtracaoConfig());
      } catch (e) {
        console.warn("[PDF] Falha ao ler a configuração de extração; usando padrão", e);
        cfg = {
          motor: "automatico",
          ia_fornecedor: "gemini",
          ia_modelo: "",
          ia_habilitada: false,
          ocr_idioma: "por",
          ia_configurada: false,
          chave_mascarada: null,
        };
      }
      const motorCfg = cfg.motor;
      const forcarIa = Boolean(opts?.forcarIa) && cfg.ia_configurada;
      const podeTexto = !forcarIa && (motorCfg === "automatico" || motorCfg === "texto");
      const podeOcr = !forcarIa && (motorCfg === "automatico" || motorCfg === "ocr_local");
      const podeIa =
        (forcarIa || motorCfg === "automatico" || motorCfg === "ia_visao") && cfg.ia_configurada;

      const diag: PassoDiag[] = [];
      const tempos: Tempos = { abrirPdf: 0, render: 0, ocr: 0, ia: 0, parser: 0, total: 0 };

      const hash = await sha256Arquivo(f);
      const texto = await extrairTextoPdf(
        f,
        (feito, total) =>
          setLendoPdf({
            ativo: true,
            etapa: `Lendo página ${feito} de ${total}`,
            feito,
            total,
          }),
        cancelRef.current,
        (numPages) =>
          setLendoPdf({
            ativo: true,
            etapa: `Lendo página 1 de ${numPages}`,
            feito: 0,
            total: numPages,
          }),
      );
      tempos.abrirPdf = texto.duracaoMs;
      diag.push({ ok: true, texto: "PDF aberto" });
      diag.push({ ok: true, texto: `${texto.numPages} página(s)` });
      if (texto.paginasComErro.length) {
        diag.push({
          ok: false,
          texto: `${texto.paginasComErro.length} página(s) puladas na leitura`,
          detalhe: texto.paginasComErro.map((p) => `p${p.pagina}: ${p.erro}`).join(" | "),
          sugestao: "As demais páginas foram processadas normalmente.",
        });
      } else {
        diag.push({ ok: true, texto: "Todas as páginas lidas" });
      }

      let extracao: FopagExtracao | null = null;
      let motor: MotorSlug = "pdfjs";
      let modelo: string | null = null;
      let brutoIA: string | null = null;
      let promptVersao: string | null = null;
      let paginasOcr: string[] | null = null;
      let paginasComErro = [...texto.paginasComErro];

      // Modo 1 — PDF com texto (padrão, custo zero).
      if (podeTexto && texto.pesquisavel) {
        const tp = Date.now();
        console.info("[Parser] Extraindo funcionários do texto pesquisável");
        extracao = parseFopagTexto(texto.paginas);
        tempos.parser += Date.now() - tp;
        console.info("[Parser] Funcionários encontrados:", extracao.funcionarios.length);
        diag.push({
          ok: extracao.funcionarios.length > 0,
          texto: `Texto pesquisável: ${extracao.funcionarios.length} funcionário(s)`,
        });
        if (extracao.funcionarios.length === 0) extracao = null;
      } else if (podeTexto) {
        diag.push({
          ok: false,
          texto: "PDF sem texto pesquisável",
          detalhe: "O documento aparenta ser digitalizado.",
        });
      }

      // Modo 2 — OCR local (custo zero, sem envio externo). Mesmo parser do Modo 1.
      if (!extracao && podeOcr) {
        setLendoPdf({
          ativo: true,
          etapa: "OCR local (o documento não sai do seu dispositivo)",
          feito: 0,
          total: texto.numPages,
        });
        try {
          const ocr = await ocrLocalPdf(
            f,
            texto.numPages,
            { idioma: cfg.ocr_idioma },
            (feito, total) =>
              setLendoPdf({
                ativo: true,
                etapa: `OCR local — página ${feito} de ${total}`,
                feito,
                total,
              }),
            cancelRef.current,
          );
          tempos.ocr += ocr.duracaoMs;
          paginasOcr = ocr.paginas;
          paginasComErro = [...paginasComErro, ...ocr.paginasComErro];
          const tp = Date.now();
          console.info("[Parser] Extraindo funcionários do texto do OCR");
          const candidato = parseFopagTexto(ocr.paginas);
          tempos.parser += Date.now() - tp;
          console.info("[Parser] Funcionários encontrados (OCR):", candidato.funcionarios.length);
          diag.push({
            ok: candidato.funcionarios.length > 0,
            texto: `OCR local (Tesseract): ${candidato.funcionarios.length} funcionário(s)`,
            detalhe: ocr.paginasComErro.length
              ? `${ocr.paginasComErro.length} página(s) falharam no OCR`
              : undefined,
            sugestao:
              candidato.funcionarios.length === 0
                ? "Verifique a resolução da digitalização ou use a IA de Visão."
                : undefined,
          });
          if (candidato.funcionarios.length > 0) {
            extracao = candidato;
            motor = "tesseract";
          }
        } catch (err) {
          if (cancelRef.current.cancelado) throw err;
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[OCR] OCR local falhou", err);
          diag.push({
            ok: false,
            texto: "OCR local falhou",
            detalhe: msg,
            sugestao: /idioma|pacote|language/i.test(msg)
              ? `Baixe/selecione outro pacote de idioma em Motor de Extração (atual: ${cfg.ocr_idioma}).`
              : "Tente novamente ou utilize a IA de Visão.",
          });
        }
      }

      if (!extracao && !podeIa) {
        setLendoPdf({ ativo: false, etapa: "", feito: 0, total: 0 });
        setFalhaOcr({ file: f, iaDisponivel: cfg.ia_configurada, diagnostico: diag });
        return;
      }

      // Modo 3 — IA de Visão (opcional, só quando configurada).
      if (!extracao) {
        motor = cfg.ia_fornecedor === "lovable" ? "lovable" : "gemini";
        const tIa = Date.now();

        const janelas = janelasContinuas(
          texto.numPages,
          paginasOcr ?? texto.paginas,
          MAX_PAGINAS_POR_JANELA,
        );
        const payloads: { competencia?: string | null; funcionarios?: unknown[] }[] = [];
        const brutos: string[] = [];
        const janelasComFalha: string[] = [];
        let processadas = 0;
        // O documento não é fatiado em blocos fixos: cada janela só termina numa
        // página que inicia um novo funcionário, então nenhum bloco é partido.
        for (const janela of janelas) {
          if (cancelRef.current.cancelado) throw new Error("Processamento cancelado pelo usuário.");
          setLendoPdf({
            ativo: true,
            etapa: `Reconhecendo com IA de Visão (página ${processadas + 1} de ${texto.numPages})`,
            feito: processadas,
            total: texto.numPages,
          });
          try {
            const tr = Date.now();
            const imagens = await renderizarPaginasJpeg(
              f,
              janela,
              undefined,
              undefined,
              cancelRef.current,
            );
            tempos.render += Date.now() - tr;
            const r = await extrairFopagPorIA({
              data: {
                paginas: imagens.filter((x) => x.base64),
                competencia_hint: competencia || null,
              },
            });
            modelo = r.modelo;
            promptVersao = r.promptVersao ?? null;
            brutos.push(r.bruto);
            payloads.push({ competencia: r.competencia, funcionarios: r.funcionarios });
          } catch (err) {
            // Uma janela que falha (503/429/timeout) não descarta o documento
            // inteiro: registramos o trecho e seguimos com as demais páginas.
            if (cancelRef.current.cancelado) throw err;
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[IA] Falha na janela", janela, msg);
            janelasComFalha.push(
              `páginas ${janela[0]}–${janela[janela.length - 1]}: ${msg.slice(0, 160)}`,
            );
            for (const p of janela) paginasComErro.push({ pagina: p, erro: msg });
          }
          processadas = Math.min(processadas + janela.length, texto.numPages);
          setLendoPdf({
            ativo: true,
            etapa: `Reconhecendo com IA de Visão (página ${processadas} de ${texto.numPages})`,
            feito: processadas,
            total: texto.numPages,
          });
        }
        const tp = Date.now();
        extracao = parseFopagIA(payloads);
        tempos.parser += Date.now() - tp;
        tempos.ia += Date.now() - tIa - (Date.now() - tp);
        brutoIA = brutos.length ? `[${brutos.join(",")}]` : null;
        diag.push({
          ok: extracao.funcionarios.length > 0,
          texto: `IA de Visão: ${extracao.funcionarios.length} funcionário(s)`,
        });
        if (janelasComFalha.length) {
          diag.push({
            ok: false,
            texto: `${janelasComFalha.length} trecho(s) não foram lidos pela IA`,
            detalhe: janelasComFalha.join(" | "),
            sugestao:
              "O provedor recusou ou demorou demais nesses trechos. Aguarde 1–2 minutos e reenvie, ou troque o modelo em Piso da Enfermagem › Motor de Extração. Os demais trechos foram aproveitados.",
          });
          if (extracao.funcionarios.length > 0) {
            toast.warning(
              `${janelasComFalha.length} trecho(s) falharam na IA. Confira os dados antes de importar.`,
            );
          }
        }
      }

      if (extracao!.funcionarios.length === 0) {
        toast.error("Nenhum profissional da enfermagem foi localizado neste PDF.");
        setLendoPdf({ ativo: false, etapa: "", feito: 0, total: 0 });
        setFalhaOcr({ file: f, iaDisponivel: cfg.ia_configurada, diagnostico: diag });
        return;
      }


      tempos.total = Date.now() - inicio;
      setFalhaOcr(null);
      setFopag(extracao!);
      setFopagMeta({
        metodo: motor === "pdfjs" ? "PDF pesquisável (pdfjs)" : motor === "tesseract" ? "OCR Local (Tesseract)" : rotuloModelo(modelo),
        motor,
        modelo,
        paginas: texto.numPages,
        hash,
        duracaoMs: tempos.total,
        brutoIA,
        promptVersao,
        hashesPaginas: texto.hashesPaginas,
        paginasComErro,
        tempos,
      });


      setLendoPdf({ ativo: false, etapa: "", feito: 0, total: 0 });
      aplicarMatriz(f, fopagParaAoa(extracao!), extracao!.competencia);
    } catch (err) {
      setLendoPdf({ ativo: false, etapa: "", feito: 0, total: 0 });
      const msg = err instanceof Error ? err.message : "Falha ao processar o PDF.";
      toast.error(msg);
      // Mesmo em falha inesperada mostramos o painel de diagnóstico com a causa,
      // permitindo reenviar o arquivo ou forçar a IA sem recomeçar do zero.
      if (!/cancelado pelo usuário/i.test(msg)) {
        setFalhaOcr({
          file: f,
          iaDisponivel: Boolean(extracaoQ.data?.ia_configurada),
          diagnostico: [
            { ok: false, texto: "Falha ao processar o PDF", detalhe: msg },
          ],
        });
      }
    }
  }

  function changeHeaderRow(newIdx: number) {
    if (aoa.length === 0) return;
    const { headers: hs, rows } = buildRowsFromAoa(aoa, newIdx);
    setHeaderRowIndex(newIdx);
    setHeaders(hs);
    setRawRows(rows);
    setMapeamento(mapearComMotor(hs, versoes.find((v) => v.versao_id === versaoId) ?? null));
  }

  const matchMut = useMutation({
    mutationFn: async () => {
      const col = (d: PisoDestino) =>
        Object.entries(mapeamento).find(([, v]) => v === d)?.[0] ?? null;
      const cpfCol = col("cpf");
      const matCol = col("matricula");
      const nomeCol = col("nome");
      const cpfs = cpfCol
        ? rawRows.map((r) => String(r[cpfCol] ?? "").replace(/\D+/g, "")).filter(Boolean)
        : [];
      const matriculas = matCol
        ? rawRows.map((r) => String(r[matCol] ?? "").trim()).filter(Boolean)
        : [];
      const nomes = nomeCol
        ? rawRows.map((r) => String(r[nomeCol] ?? "").trim()).filter(Boolean)
        : [];
      const maps = await matchProfissionaisImport({ data: { cpfs, matriculas, nomes } });
      const base = resolveRows(rawRows, mapeamento, {
        byCpf: maps.byCpf,
        byMatricula: maps.byMatricula,
      });
      const candidatos = maps.candidatos ?? [];
      const enriched = base.map((r) => {
        if (r.status_match !== "nao_localizado" || !r.nome) return r;
        const hit = bestFuzzy(r.nome, candidatos, 0.88);
        return hit ? { ...r, profissional_id: hit.id, status_match: "nome" as const } : r;
      });
      setResolved(enriched);
      setPasso(3);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao cruzar com o Cadastro"),
  });

  const validacao = useMemo(
    () => validarLinhas(resolved, { competencia: competencia || null, obrigatorios: layout.obrigatorios }),
    [resolved, competencia, layout],
  );

  const commitMut = useMutation({
    mutationFn: async () => {
      if (!competencia.trim()) throw new Error("Informe a competência.");
      inicioRef.current = Date.now();
      const nomeArquivo = file?.name ?? "sem-nome";
      const linhas = validacao.linhasValidas;
      const { historico_id } = await startImportPiso({
        data: {
          modelo: layout.modelo,
          nome_arquivo: nomeArquivo,
          tipo_arquivo: tipoArquivo,
          competencia,
          mapeamento: {
            ...(mapeamento as Record<string, string | null>),
            ...(fopagMeta
              ? {
                  __origem: "PDF FOPAG",
                  __metodo: fopagMeta.metodo,
                  __motor_extracao: fopagMeta.motor,
                  __modelo_ia: fopagMeta.modelo,
                  __paginas: String(fopagMeta.paginas),
                  __hash_sha256: fopagMeta.hash,
                  __confianca_media: fopag
                    ? `${Math.round(fopag.confiancaMedia * 100)}%`
                    : null,
                  __funcionarios_ignorados: String(fopag?.ignorados ?? 0),
                  __duracao_extracao_ms: String(fopagMeta.duracaoMs),
                  __tempo_abrir_pdf_ms: String(fopagMeta.tempos?.abrirPdf ?? 0),
                  __tempo_render_ms: String(fopagMeta.tempos?.render ?? 0),
                  __tempo_ocr_ms: String(fopagMeta.tempos?.ocr ?? 0),
                  __tempo_ia_ms: String(fopagMeta.tempos?.ia ?? 0),
                  __tempo_parser_ms: String(fopagMeta.tempos?.parser ?? 0),
                  __paginas_com_erro: fopagMeta.paginasComErro?.length
                    ? fopagMeta.paginasComErro.map((p) => `p${p.pagina}`).join(",")
                    : null,
                  __hash_paginas: fopagMeta.hashesPaginas?.length
                    ? fopagMeta.hashesPaginas.map((h, i) => `p${i + 1}:${h.slice(0, 16)}`).join(" ")
                    : null,
                  __abaixo_confianca_85: fopag
                    ? String(fopag.funcionarios.filter((x) => x.confianca < 0.85).length)
                    : null,

                  __pipeline_versao: PIPELINE_VERSAO,
                  __divergencias_financeiras: String(fopag?.comDivergencia ?? 0),
                  __cpf_invalido: String(fopag?.cpfInvalido ?? 0),
                  __prompt_versao: fopagMeta.promptVersao ?? null,
                  __confianca_minima: fopag ? `${Math.round(fopag.confiancaMinima * 100)}%` : null,
                  __confianca_por_pagina: fopag
                    ? fopag.confiancaPorPagina
                        .map((p) => `p${p.pagina}:${Math.round(p.confianca * 100)}%`)
                        .join(" ")
                    : null,
                  __correcoes_automaticas: String(fopag?.correcoesAutomaticas ?? 0),
                  __campos_corrigidos_manual: String(camposCorrigidos),
                  __rubricas_normalizadas: fopag?.rubricasNormalizadas.join(", ") ?? null,
                  __rubricas_nao_reconhecidas: fopag?.rubricasNaoReconhecidas.join(", ") ?? null,
                  __rubricas_ausentes: fopag?.rubricasAusentes.join(", ") ?? null,
                  __cargos_ignorados: fopag?.cargosIgnorados.join(", ") ?? null,
                  __pendencias_financeiras: fopag
                    ? fopag.funcionarios
                        .filter((f) => f.divergencias.length > 0)
                        .slice(0, 100)
                        .map((f) => `${f.cpf ?? f.nome}: ${f.divergencias.join(" ")}`)
                        .join(" | ")
                    : null,
                  __ia_json_bruto: fopagMeta.brutoIA ? fopagMeta.brutoIA.slice(0, 400_000) : null,
                }
              : {}),
          },
          total: resolved.length,
        },
      });
      setProgresso({ ativo: true, total: linhas.length, feito: 0 });

      let feito = 0;
      for (let i = 0; i < linhas.length; i += CHUNK) {
        const chunk = linhas.slice(i, i + CHUNK);
        await appendPisoLinhas({
          data: {
            historico_id,
            nome_arquivo: nomeArquivo,
            competencia,
            linhas: chunk,
          },
        });
        feito += chunk.length;
        setProgresso((p) => ({ ...p, feito }));
      }

      let atualizados = 0;
      let pendencias = 0;
      for (let i = 0; i < linhas.length; i += CHUNK) {
        const chunk = linhas.slice(i, i + CHUNK);
        const res = await consolidarLotePiso({
          data: {
            historico_id,
            competencia,
            tipo: layout.tipoPlanilha,
            origem_arquivo: nomeArquivo,
            layout_versao: versaoAtiva
              ? `${versaoAtiva.layout_nome} v${versaoAtiva.versao}`
              : null,
            linhas: chunk.map((r) => ({
              cpf: r.cpf,
              nome: r.nome,
              matricula: r.matricula,
              profissional_id: r.profissional_id,
              salario_base: r.salario_base,
              insalubridade: r.insalubridade,
              auxilio_financeiro: r.auxilio_financeiro ?? r.piso_complementacao,
              tempo_servico: r.tempo_servico,
              hora_extra_50: r.hora_extra_50,
              hora_extra_100: r.hora_extra_100,
              plantao: r.plantao,
              sobreaviso: r.sobreaviso,
              gratificacoes: r.gratificacao,
              vale_transporte: r.vale_transporte,
              inss: r.inss,
              irrf: r.irrf,
              total_descontos: r.total_descontos,
              total_proventos: r.total_proventos,
              valor_liquido: r.valor_liquido,
            })),
          },
        });
        atualizados += res.atualizados;
        pendencias += res.pendencias;
      }

      const rejeitados = resolved.length - linhas.length;
      await finalizeImportPiso({
        data: {
          historico_id,
          importados: atualizados,
          divergentes: rejeitados,
          naoLocalizados: validacao.resumo.naoLocalizados,
          cancelado: false,
        },
      });
      await registrarAuditoriaImportacao({
        data: {
          historico_id,
          tipo_planilha: layout.tipoPlanilha,
          atualizados,
          pendencias: pendencias + rejeitados,
          duracao_ms: Date.now() - inicioRef.current,
        },
      });
      if (versaoId) {
        await registrarUsoLayout({
          data: {
            layout_id: versaoAtiva?.layout_id ?? null,
            versao_id: versaoId,
            modulo: "piso",
            historico_id,
            nome_arquivo: nomeArquivo,
            competencia,
            total_linhas: resolved.length,
            duracao_ms: Date.now() - inicioRef.current,
          },
        });
      }
      setProgresso((p) => ({ ...p, ativo: false }));
      toast.success(
        `Folha de ${layout.label} importada: ${atualizados} atualizados, ${pendencias + rejeitados} pendências.`,
      );
      if (fopagMeta) setConcluido({ atualizados, pendencias: pendencias + rejeitados });
      else navigate({ to: "/piso-enfermagem" });
    },
    onError: (e: unknown) => {
      setProgresso((p) => ({ ...p, ativo: false }));
      toast.error(e instanceof Error ? e.message : "Falha ao importar a folha");
    },
  });

  const savedQ = useQuery({
    queryKey: ["piso", "mapeamentos", layout.modelo],
    queryFn: () => listMapeamentos({ data: { modelo: layout.modelo } }),
  });

  const saveMap = useMutation({
    mutationFn: async () => {
      const nome = nomeModelo.trim();
      if (!nome) throw new Error("Informe um nome para o modelo.");
      await saveMapeamento({
        data: { nome, modelo: layout.modelo, mapeamento: mapeamento as Record<string, string | null> },
      });
      setNomeModelo("");
      toast.success("Modelo de mapeamento salvo.");
      void savedQ.refetch();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao salvar modelo"),
  });

  const baixarFopagMut = useMutation({
    mutationFn: () =>
      gerarPlanilhaOficialPiso({
        data: { competencia, tipo: layout.tipo === "efetivos" ? "efetivos" : "contratados" },
      }),
    onSuccess: (r) => {
      const bin = atob(r.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao gerar a planilha FOPAG"),
  });

  const resumoFopag = fopag ? resumoCategorias(fopag) : null;

  const colsIssues: DataTableColumn<Issue>[] = [
    { key: "linha", header: "Linha", cell: (i) => i.linha },
    {
      key: "tipo",
      header: "Ocorrência",
      cell: (i) => <Badge variant="outline">{LABEL_ISSUE[i.tipo]}</Badge>,
    },
    { key: "cpf", header: "CPF", cell: (i) => i.cpf ?? "—" },
    { key: "nome", header: "Nome", cell: (i) => i.nome ?? "—" },
    { key: "mensagem", header: "Detalhe", cell: (i) => i.mensagem },
  ];

  const destinosDisponiveis = CAMPOS_SISTEMA.filter((c) => !CAMPOS_CALCULADOS.has(c.key));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title={`Importar ${layout.label}`}
        description={layout.descricao}
        actions={
          <Button variant="outline" onClick={() => navigate({ to: "/piso-enfermagem" })}>
            Voltar ao módulo
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 text-xs">
        {["1. Arquivo", "2. Mapeamento", "3. Validação", "4. Importação"].map((t, i) => (
          <Badge key={t} variant={passo === i + 1 ? "default" : "outline"}>
            {t}
          </Badge>
        ))}
      </div>

      {passo === 1 && (
        <div className="space-y-4">
          {aceitaPdf && (
            <div className="space-y-2 rounded-md border p-4">
              <Label>Origem dos dados</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={origem === "excel" ? "default" : "outline"}
                  onClick={() => setOrigem("excel")}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (.xlsx)
                </Button>
                <Button
                  type="button"
                  variant={origem === "pdf" ? "default" : "outline"}
                  onClick={() => setOrigem("pdf")}
                >
                  <FileText className="mr-2 h-4 w-4" /> PDF FOPAG (.pdf)
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                O PDF é lido automaticamente: texto pesquisável pelo leitor interno e, quando
                escaneado, por IA de Visão no servidor. Nenhum campo é preenchido manualmente.
              </p>
            </div>
          )}

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void (origem === "pdf" ? handleFilePdf(f) : handleFile(f));
            }}
            className={`flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed p-10 text-center ${
              dragOver ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            {origem === "pdf" ? (
              <FileText className="h-10 w-10 text-muted-foreground" />
            ) : (
              <UploadCloud className="h-10 w-10 text-muted-foreground" />
            )}
            <p className="text-sm text-muted-foreground">
              {origem === "pdf"
                ? "Arraste o PDF da FOPAG ou selecione um arquivo (.pdf)."
                : `Arraste a folha de ${layout.label.toLowerCase()} ou selecione um arquivo Excel (.xlsx, .xls) ou CSV.`}
            </p>
            <Input
              type="file"
              accept={origem === "pdf" ? ".pdf" : ".xlsx,.xls,.csv"}
              className="max-w-sm"
              disabled={lendoPdf.ativo}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void (origem === "pdf" ? handleFilePdf(f) : handleFile(f));
              }}
            />
          </div>

          {lendoPdf.ativo && (
            <div className="space-y-3 rounded-md border p-4">
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-primary" /> {lendoPdf.etapa}
              </div>
              <Progress
                value={lendoPdf.total ? Math.round((lendoPdf.feito / lendoPdf.total) * 100) : 0}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {lendoPdf.feito} de {lendoPdf.total} página(s)
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    cancelRef.current.cancelado = true;
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {falhaOcr && !lendoPdf.ativo && (
            <div className="space-y-3 rounded-md border border-amber-500/50 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Não foi possível extrair dados suficientes deste PDF
              </div>
              {falhaOcr.diagnostico.length > 0 && (
                <div className="rounded-md border bg-background p-3">
                  <p className="mb-1 text-xs font-medium">Diagnóstico</p>
                  <ul className="space-y-1 text-xs">
                    {falhaOcr.diagnostico.map((d, i) => (
                      <li key={i} className={d.ok ? "text-muted-foreground" : "text-destructive"}>
                        <span className="mr-1 font-mono">{d.ok ? "✓" : "✗"}</span>
                        {d.texto}
                        {d.detalhe && (
                          <span className="block pl-4 text-muted-foreground">
                            Motivo: {d.detalhe}
                          </span>
                        )}
                        {d.sugestao && (
                          <span className="block pl-4 text-muted-foreground">
                            Sugestão: {d.sugestao}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                O documento parece digitalizado e o OCR Local (Tesseract) não reconheceu os blocos
                de funcionários. Motivos possíveis:
              </p>

              <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                <li>baixa resolução da digitalização</li>
                <li>documento cortado nas margens</li>
                <li>imagem desfocada</li>
                <li>páginas invertidas ou de cabeça para baixo</li>
                <li>qualidade ruim de digitalização (ruído, sombras)</li>
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleFilePdf(falhaOcr.file)}
                >
                  Tentar novamente
                </Button>
                <Button
                  size="sm"
                  disabled={!falhaOcr.iaDisponivel}
                  onClick={() => void handleFilePdf(falhaOcr.file, { forcarIa: true })}
                >
                  <Sparkles className="mr-2 h-4 w-4" /> Usar IA
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setFalhaOcr(null)}>
                  Cancelar
                </Button>
              </div>
              {!falhaOcr.iaDisponivel && (
                <p className="text-[11px] text-muted-foreground">
                  A IA de Visão não está configurada. Habilite-a em Piso da Enfermagem › Motor de
                  Extração para usar esta opção.
                </p>
              )}
            </div>
          )}
        </div>
      )}


      {passo >= 2 && file && (
        <div className="grid gap-4 rounded-md border p-4 md:grid-cols-4">
          <Info label="Arquivo" value={file.name} icon />
          <Info label="Tamanho" value={fmtTamanho(file.size)} />
          <Info label="Linhas de dados" value={String(rawRows.length)} />
          <div className="space-y-1">
            <Label>Competência</Label>
            <Input
              value={competencia}
              placeholder="Ex.: Junho 2026"
              onChange={(e) => setCompetencia(e.target.value)}
            />
          </div>
        </div>
      )}

      {passo >= 2 && resumoFopag && fopagMeta && (
        <div className="space-y-3 rounded-md border p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            PDF processado — Motor utilizado:
            <Badge variant="secondary">{fopagMeta.metodo}</Badge>
            <Badge variant="outline">{fopagMeta.paginas} página(s)</Badge>
            <Badge variant="outline">{(fopagMeta.duracaoMs / 1000).toFixed(1)}s</Badge>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                resumoFopag.confiancaMedia >= 0.95
                  ? "border-emerald-500/50 text-emerald-600"
                  : resumoFopag.confiancaMedia >= 0.85
                    ? "border-amber-500/50 text-amber-600"
                    : "border-destructive/50 text-destructive"
              }`}
            >
              Confiança {Math.round(resumoFopag.confiancaMedia * 100)}%
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-6">
            <Kpi label="Funcionários" value={resumoFopag.total} />
            <Kpi label="Enfermeiros" value={resumoFopag.enfermeiros} />
            <Kpi label="Técnicos" value={resumoFopag.tecnicos} />
            <Kpi label="Auxiliares" value={resumoFopag.auxiliares} />
            <Kpi label="Ignorados (outros cargos)" value={resumoFopag.ignorados} tone="warn" />
            <Kpi label="CPF inválido/ausente" value={resumoFopag.cpfInvalido} tone="warn" />
            <Kpi
              label="Divergência financeira"
              value={resumoFopag.comDivergencia}
              tone="warn"
            />
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Confiança média</div>
              <div className="text-xl font-semibold">
                {Math.round(resumoFopag.confiancaMedia * 100)}%
              </div>
              <div className="text-[11px] text-muted-foreground">
                mínima {Math.round(resumoFopag.confiancaMinima * 100)}%
              </div>
            </div>
            <Kpi label="Correções automáticas" value={resumoFopag.correcoesAutomaticas} />
          </div>
          {resumoFopag.rubricasAusentes.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Rubricas ausentes em todo o documento: {resumoFopag.rubricasAusentes.join(", ")}.
            </p>
          )}
          {resumoFopag.rubricasNaoReconhecidas.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Rubricas não reconhecidas (registradas na auditoria):{" "}
              {resumoFopag.rubricasNaoReconhecidas.slice(0, 10).join(" · ")}
            </p>
          )}
          {fopag && fopag.confiancaPorPagina.length > 1 && (
            <p className="text-[11px] text-muted-foreground">
              Confiança por página:{" "}
              {fopag.confiancaPorPagina
                .slice(0, 20)
                .map((x) => `p${x.pagina} ${Math.round(x.confianca * 100)}%`)
                .join(" · ")}
            </p>
          )}
          {fopag && fopag.cargosIgnorados.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Cargos descartados: {fopag.cargosIgnorados.slice(0, 8).join(" · ")}
              {fopag.cargosIgnorados.length > 8 ? " …" : ""}
            </p>
          )}
          {fopag && fopag.comDivergencia > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
              <p className="mb-1 font-medium">
                Validação financeira cruzada: {fopag.comDivergencia} funcionário(s) com divergência
                — serão importados como pendência para conferência.
              </p>
              <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                {fopag.funcionarios
                  .filter((f) => f.divergencias.length > 0)
                  .slice(0, 5)
                  .map((f) => (
                    <li key={`${f.cpf}-${f.nome}`}>
                      {f.nome ?? f.cpf}: {f.divergencias[0]}
                    </li>
                  ))}
              </ul>
            </div>
          )}
          {fopagMeta.paginasComErro && fopagMeta.paginasComErro.length > 0 && (
            <p className="text-xs text-amber-600">
              {fopagMeta.paginasComErro.length} página(s) não puderam ser lidas e foram puladas:{" "}
              {fopagMeta.paginasComErro.map((p) => `p${p.pagina}`).join(", ")}. O restante do
              documento foi processado normalmente.
            </p>
          )}
          {fopagMeta.tempos && (
            <p className="text-[11px] text-muted-foreground">
              Tempos — abrir PDF {(fopagMeta.tempos.abrirPdf / 1000).toFixed(1)}s · renderização{" "}
              {(fopagMeta.tempos.render / 1000).toFixed(1)}s · OCR{" "}
              {(fopagMeta.tempos.ocr / 1000).toFixed(1)}s · IA{" "}
              {(fopagMeta.tempos.ia / 1000).toFixed(1)}s · parser{" "}
              {(fopagMeta.tempos.parser / 1000).toFixed(1)}s · total{" "}
              {(fopagMeta.tempos.total / 1000).toFixed(1)}s
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            SHA-256: {fopagMeta.hash} · Pipeline {PIPELINE_VERSAO} · Extração em{" "}
            {(fopagMeta.duracaoMs / 1000).toFixed(1)}s
          </p>
          {fopagMeta.hashesPaginas && fopagMeta.hashesPaginas.length > 0 && (
            <p className="break-all text-[11px] text-muted-foreground">
              SHA-256 por página:{" "}
              {fopagMeta.hashesPaginas
                .slice(0, 20)
                .map((h, i) => `p${i + 1}:${h.slice(0, 12)}`)
                .join(" · ")}
              {fopagMeta.hashesPaginas.length > 20 ? " …" : ""}
            </p>
          )}

        </div>
      )}

      {passo === 2 && fopag && fopag.funcionarios.length > 0 && (
        <div className="space-y-2 rounded-md border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4 text-primary" />
            Pré-visualização — edite, ignore e confirme antes de importar
            <Badge variant="outline">{fopag.funcionarios.length} profissionais</Badge>
            {camposCorrigidos > 0 && (
              <Badge variant="outline">{camposCorrigidos} campo(s) corrigido(s)</Badge>
            )}
          </div>
          <div className="max-h-[420px] overflow-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/60">
                <tr className="[&>th]:p-2 [&>th]:text-left">
                  <th>Nome</th>
                  <th>Cargo</th>
                  <th>CPF</th>
                  <th>Matrícula</th>
                  <th className="text-right">Proventos</th>
                  <th className="text-right">Descontos</th>
                  <th className="text-right">Líquido</th>
                  <th className="text-right">Rubricas</th>
                  <th>Confiança</th>
                  <th>Status / Pendências</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {fopag.funcionarios.slice(0, 300).map((f, idx) => (
                  <tr
                    key={`${f.cpf ?? f.nome}-${idx}`}
                    className={`border-t [&>td]:p-1.5 ${f.confianca < 0.85 ? "bg-amber-500/10" : ""}`}
                  >

                    <td>
                      <Input
                        className="h-7 w-52 text-xs"
                        value={f.nome ?? ""}
                        onChange={(e) => editarFuncionario(idx, { nome: e.target.value.toUpperCase() })}
                      />
                    </td>
                    <td>
                      <Input
                        className="h-7 w-44 text-xs"
                        value={f.cargo ?? ""}
                        onChange={(e) => editarFuncionario(idx, { cargo: e.target.value.toUpperCase() })}
                      />
                    </td>
                    <td>
                      <Input
                        className="h-7 w-32 text-xs"
                        value={f.cpf ?? ""}
                        onChange={(e) =>
                          editarFuncionario(idx, { cpf: e.target.value.replace(/\D+/g, "") || null })
                        }
                      />
                    </td>
                    <td>
                      <Input
                        className="h-7 w-24 text-xs"
                        value={f.matricula ?? ""}
                        onChange={(e) => editarFuncionario(idx, { matricula: e.target.value || null })}
                      />
                    </td>
                    <td className="text-right tabular-nums">
                      {f.rubricas.total_proventos.toFixed(2)}
                    </td>
                    <td className="text-right tabular-nums">
                      {f.rubricas.total_descontos.toFixed(2)}
                    </td>
                    <td className="text-right tabular-nums">
                      {f.rubricas.valor_liquido.toFixed(2)}
                    </td>
                    <td className="text-right tabular-nums">
                      {Object.values(f.rubricas).filter((v) => v !== 0).length}
                    </td>
                    <td
                      className={
                        f.confianca < 0.85 ? "font-medium text-amber-600" : "text-muted-foreground"
                      }
                      title={
                        f.confianca < 0.85
                          ? "Confiança abaixo de 85% — confira os dados antes de importar."
                          : undefined
                      }
                    >
                      {f.confianca < 0.85 ? "⚠ " : ""}
                      {Math.round(f.confianca * 100)}%
                    </td>

                    <td>
                      {f.divergencias.length > 0 ? (
                        <Badge
                          variant="outline"
                          className="text-amber-600"
                          title={f.divergencias.join(" ")}
                        >
                          Pendência: {f.divergencias[0].slice(0, 40)}…
                        </Badge>
                      ) : !f.cpf ? (
                        <Badge variant="outline" className="text-amber-600">
                          Sem CPF
                        </Badge>
                      ) : (
                        <Badge variant="outline">OK</Badge>
                      )}
                    </td>
                    <td>
                      <Button variant="ghost" size="sm" onClick={() => ignorarFuncionario(idx)}>
                        Ignorar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {fopag.funcionarios.length > 300 && (
            <p className="text-[11px] text-muted-foreground">
              Exibindo os 300 primeiros de {fopag.funcionarios.length} registros.
            </p>
          )}
        </div>
      )}

      {passo === 2 && (
        <div className="space-y-4 rounded-md border p-4">
          {versoes.length > 0 && (
            <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3">
              <div className="space-y-1">
                <Label>Layout de importação</Label>
                <Select
                  value={versaoId ?? "__none"}
                  onValueChange={(v) => {
                    const id = v === "__none" ? null : v;
                    setVersaoId(id);
                    const alvo = versoes.find((x) => x.versao_id === id) ?? null;
                    setMapeamento(mapearComMotor(headers, alvo));
                    setMotivoDeteccao(
                      alvo ? `Layout aplicado manualmente: ${alvo.layout_nome} (v${alvo.versao}).` : null,
                    );
                  }}
                >
                  <SelectTrigger className="w-80">
                    <SelectValue placeholder="Selecione o layout" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sem layout (mapeamento manual)</SelectItem>
                    {versoes.map((v) => (
                      <SelectItem key={v.versao_id} value={v.versao_id}>
                        {v.layout_nome} — v{v.versao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {motivoDeteccao && (
                <p className="pb-2 text-xs text-muted-foreground">{motivoDeteccao}</p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Linha do cabeçalho</Label>
              <Input
                type="number"
                min={1}
                className="w-32"
                value={headerRowIndex + 1}
                onChange={(e) => changeHeaderRow(Math.max(0, Number(e.target.value) - 1))}
              />
            </div>
            <div className="space-y-1">
              <Label>Salvar modelo de mapeamento</Label>
              <div className="flex gap-2">
                <Input
                  className="w-56"
                  placeholder="Nome do modelo"
                  value={nomeModelo}
                  onChange={(e) => setNomeModelo(e.target.value)}
                />
                <Button variant="outline" onClick={() => saveMap.mutate()}>
                  Salvar
                </Button>
              </div>
            </div>
            {(savedQ.data?.rows?.length ?? 0) > 0 && (
              <div className="space-y-1">
                <Label>Aplicar modelo salvo</Label>
                <Select
                  onValueChange={(id) => {
                    const m = savedQ.data?.rows?.find((r: any) => r.id === id);
                    if (m) {
                      setMapeamento(m.mapeamento as Mapeamento);
                      toast.success("Modelo aplicado.");
                    }
                  }}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedQ.data?.rows?.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {headers.map((h) => (
              <div key={h} className="space-y-1 rounded-md border p-2">
                <div className="truncate text-xs font-medium" title={h}>
                  {h || "(sem título)"}
                </div>
                <Select
                  value={mapeamento[h] ?? "__none"}
                  onValueChange={(v) =>
                    setMapeamento((prev) => ({
                      ...prev,
                      [h]: v === "__none" ? null : (v as PisoDestino),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Ignorar coluna</SelectItem>
                    {destinosDisponiveis.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPasso(1)}>
              Voltar
            </Button>
            <Button onClick={() => matchMut.mutate()} disabled={matchMut.isPending}>
              {matchMut.isPending ? "Cruzando com o Cadastro..." : "Validar e cruzar cadastro"}
            </Button>
          </div>
        </div>
      )}

      {passo === 3 && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-6">
            <Kpi label="Linhas" value={validacao.resumo.total} />
            <Kpi label="Válidas" value={validacao.resumo.validas} tone="ok" />
            <Kpi label="Bloqueadas" value={validacao.resumo.bloqueantes} tone="warn" />
            <Kpi label="CPF duplicado" value={validacao.resumo.duplicados} tone="warn" />
            <Kpi label="Não localizados" value={validacao.resumo.naoLocalizados} tone="warn" />
            <Kpi
              label="Competência diferente"
              value={validacao.resumo.competenciaDivergente}
              tone="warn"
            />
          </div>

          {validacao.issues.length > 0 ? (
            <div className="rounded-md border">
              <div className="flex items-center gap-2 border-b p-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Ocorrências encontradas — linhas bloqueadas viram pendências e não alteram o
                Cadastro.
              </div>
              <DataTable
                rows={validacao.issues.slice(0, 300)}
                columns={colsIssues}
                getRowKey={(i, idx) => `${i.linha}-${i.tipo}-${idx}`}

              />
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Nenhuma ocorrência: todas as
              linhas estão prontas para importação.
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPasso(2)}>
              Ajustar mapeamento
            </Button>
            <Button
              onClick={() => {
                setPasso(4);
                commitMut.mutate();
              }}
              disabled={validacao.linhasValidas.length === 0 || !competencia.trim()}
            >
              Importar {validacao.linhasValidas.length} linha(s)
            </Button>
          </div>
        </div>
      )}

      {passo === 4 && concluido && (
        <div className="space-y-3 rounded-md border p-4">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Importação concluída: {concluido.atualizados} registro(s) atualizado(s) e{" "}
            {concluido.pendencias} pendência(s).
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => baixarFopagMut.mutate()} disabled={baixarFopagMut.isPending}>
              <Download className="mr-2 h-4 w-4" />
              {baixarFopagMut.isPending ? "Gerando..." : "Baixar FOPAG"}
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/piso-enfermagem" })}>
              Voltar ao módulo
            </Button>
          </div>
        </div>
      )}

      {passo === 4 && !concluido && (
        <div className="space-y-3 rounded-md border p-4">
          <p className="text-sm text-muted-foreground">
            Atualizando apenas os dados financeiros da competência {competencia}. O cadastro dos
            profissionais não é alterado.
          </p>
          <Progress
            value={progresso.total ? Math.round((progresso.feito / progresso.total) * 100) : 0}
          />
          <p className="text-xs text-muted-foreground">
            {progresso.feito} de {progresso.total} linhas processadas
          </p>
        </div>
      )}
    </div>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon?: boolean }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-2 truncate text-sm" title={value}>
        {icon && <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`text-xl font-semibold ${
          tone === "ok" && value > 0
            ? "text-emerald-600 dark:text-emerald-400"
            : tone === "warn" && value > 0
              ? "text-amber-600 dark:text-amber-400"
              : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
