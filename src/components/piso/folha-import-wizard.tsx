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
  Loader2,
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

import { CAMPOS_SISTEMA, CAMPOS_CALCULADOS, parseNumeric, type PisoDestino } from "@/lib/piso-mapping";
import {
  carregarCamposCustom,
  chaveDeCampo,
  isCampoCustom,
  salvarCamposCustom,
  upsertCampoCustom,
  type CampoCustom,
  type TipoCampoCustom,
} from "@/lib/piso-campos-custom";
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
import {
  detectarLayout,
  mapearColunas,
  normalizarTexto as normalizarHeader,
  termosDoCampo,
  type LayoutVersaoResolvida,
} from "@/lib/layout-engine";
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

import {
  aprenderAliasCampo,
  listVersoesAtivas,
  registrarUsoLayout,
} from "@/lib/layout-engine.functions";
import {
  registrarConfirmacaoAlias,
  registrarUsoAliases,
  sugerirCamposIA,
} from "@/lib/layout-inteligencia.functions";
import { previsualizarReconhecimento } from "@/lib/layout-inteligencia";
import { gerarLayoutDeModelo } from "@/lib/layout-modelo.functions";
import {
  chaveColuna,
  colunasEstruturaisDoModelo,
  lerMapaModelo,
  type MapaModelo,
} from "@/lib/planilha-clone";
import { salvarModeloPlanilha } from "@/lib/planilha-modelos.functions";
import {
  aplicarTemplate,
  detectarTemplate,
  montarPlanilhaUbs,
  montarPlanilhaHmo,
  montarPlanilhaHmsds,
  montarPlanilhaCaps,
  montarPlanilhaPadraoAdm,
  ABA_HMO,
  ABA_HMSDS,
  ABA_CAPS,
  ABA_PADRAO_ADM,


  normalizarCabecalho,
  type DeteccaoTemplate,
} from "@/lib/import-templates";

import { ImportPreviewTable } from "@/components/piso/import-preview-table";
import { matematicaEstrutural, type RegraEstrutural } from "@/lib/matematica-modelo";
import {
  aplicarRegrasFormulas,
  descreverRegra,
  extrairRegrasDeColunas,
  lerRegrasDoConfig,
  regrasParaCampos,
  type RegraFormulaColuna,
} from "@/lib/layout-formulas";

const CHUNK = 100;

function mapearComTemplate(
  headers: string[],
  templateDet: DeteccaoTemplate | null,
  base: Mapeamento,
): Mapeamento {
  if (!templateDet) return base;
  const combinado: Mapeamento = { ...base };
  for (const header of headers) {
    const destino = templateDet.template.columnMap[normalizarCabecalho(header)];
    if (destino) combinado[header] = destino;
  }
  return combinado;
}
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

/**
 * Lê as fórmulas do Excel das primeiras linhas de dados (=H7+I7+J7+K7, =L7*5%…)
 * e devolve as regras por cabeçalho — insumo do aprendizado por modelo.
 */
function formulasDaPlanilha(
  ws: XLSX.WorkSheet,
  headers: string[],
  headerRowIndex: number,
): RegraFormulaColuna[] {
  const encontradas = new Map<number, string>();
  for (let linha = headerRowIndex + 1; linha <= headerRowIndex + 6; linha++) {
    for (let col = 0; col < headers.length; col++) {
      if (encontradas.has(col)) continue;
      const ref = XLSX.utils.encode_cell({ r: linha, c: col });
      const celula = (ws as Record<string, any>)[ref];
      if (celula?.f) encontradas.set(col, String(celula.f));
    }
  }
  const celulas = Array.from(encontradas.entries()).map(([colunaIndice, formula]) => ({
    colunaIndice,
    formula,
  }));
  return extrairRegrasDeColunas(celulas, headers);
}

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
  /** Colunas que o usuário marcou como "Ignorar coluna" (não contam na compatibilidade). */
  const [colunasIgnoradas, setColunasIgnoradas] = useState<string[]>([]);
  /** Campos personalizados criados pelo usuário para este modelo de folha. */
  const [camposCustom, setCamposCustom] = useState<CampoCustom[]>(() =>
    carregarCamposCustom(layout.modelo),
  );
  /** Header cuja criação de campo personalizado está aberta. */
  const [criandoEm, setCriandoEm] = useState<string | null>(null);
  const [novoLabel, setNovoLabel] = useState("");
  const [novoTipo, setNovoTipo] = useState<TipoCampoCustom>("valor");
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
  /** Template institucional detectado (padrão Strategy: UBS, Educação…). */
  const [templateDet, setTemplateDet] = useState<DeteccaoTemplate | null>(null);
  /** Fórmulas lidas do Excel do arquivo atual (aprendizado por modelo de referência). */
  const [formulasModelo, setFormulasModelo] = useState<RegraFormulaColuna[]>([]);
  /** Arquivo .xlsx original — base da exportação "espelho fiel" do modelo. */
  const [arquivoBuf, setArquivoBuf] = useState<ArrayBuffer | null>(null);
  /** Planilha modelo escolhida para o CLONE (estrutura + receita de cada célula). */
  const [modeloBuf, setModeloBuf] = useState<ArrayBuffer | null>(null);
  const [modeloNome, setModeloNome] = useState("");
  /** Matemática estrutural lida da planilha modelo enviada (dinâmica por modelo). */
  const [matModelo, setMatModelo] = useState<RegraEstrutural[]>([]);
  const [matModeloErro, setMatModeloErro] = useState<string | null>(null);
  /** Resumo do modelo lido (colunas, cabeçalho, colunas calculadas) + nome para salvar. */
  const [modeloResumo, setModeloResumo] = useState<{
    aba: string;
    linhaCabecalho: number;
    colunas: string[];
    estruturais: string[];
    linhas: number;
  } | null>(null);
  const [modeloSalvarNome, setModeloSalvarNome] = useState("");
  /** Id do modelo salvo no cadastro (amarra a importação a este modelo). */
  const [modeloSalvoId, setModeloSalvoId] = useState<string | null>(null);
  /** Fórmulas lidas da planilha MODELO (por cabeçalho) — base do cálculo. */
  const [formulasDoModelo, setFormulasDoModelo] = useState<RegraFormulaColuna[]>([]);
  const [arquivoMesNome, setArquivoMesNome] = useState("");
  const [cloneEtapa, setCloneEtapa] = useState<1 | 2 | 3>(1);
  const [clonePreview, setClonePreview] = useState<{
    aba: string;
    cabecalho: string[];
    linhas: unknown[][];
    totalLinhas: number;
    formulas: number;
  } | null>(null);
  const [nomeLayoutIA, setNomeLayoutIA] = useState("");


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
  /**
   * Regras matemáticas lidas EXCLUSIVAMENTE do modelo enviado (UBS, H.M.O, CER,
   * CAPS…). Nada de matemática fixa em código: se o modelo não tem PLANTÃO,
   * GRAT. INCENTIVO ou ISS, essas regras simplesmente não existem aqui.
   */
  const regrasAprendidas = useMemo(
    () => lerRegrasDoConfig((versaoAtiva?.config ?? null) as Record<string, unknown> | null),
    [versaoAtiva],
  );


  /**
   * Regras do MODELO anexado (ex.: SAUDE - UBS'S): as fórmulas escritas nas
   * células do modelo, traduzidas para campos internos pelo mapeamento. É esta
   * matemática que vale ao clicar em "Validar e cruzar cadastro".
   */
  const regrasDoModelo = useMemo(
    () => regrasParaCampos(formulasDoModelo, mapeamento as Record<string, string | null>),
    [formulasDoModelo, mapeamento],
  );

  /**
   * Só recalcula o que a própria planilha calcula: campos cuja coluna é uma
   * fórmula no arquivo do mês, ou que nem existem no arquivo. Valores digitados
   * (ex.: insalubridade informada pelo RH) nunca são sobrescritos.
   * O modelo anexado tem precedência sobre o layout salvo.
   */
  const regrasAplicaveis = useMemo(() => {
    const calculadas = new Set(
      formulasModelo.map((f) => mapeamento[f.coluna] ?? null).filter(Boolean) as string[],
    );
    const presentes = new Set(Object.values(mapeamento).filter(Boolean) as string[]);
    const doLayout = regrasAprendidas.filter(
      (r) => calculadas.has(r.destino) || !presentes.has(r.destino),
    );
    const destinosModelo = new Set(regrasDoModelo.map((r) => r.destino));
    return [...regrasDoModelo, ...doLayout.filter((r) => !destinosModelo.has(r.destino))];
  }, [regrasAprendidas, regrasDoModelo, formulasModelo, mapeamento]);



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

  // Leitura de PDF (texto pesquisável → OCR local → IA de Visão) vale para
  // efetivos e contratados: o pipeline é o mesmo e o mapeamento das colunas
  // extraídas usa os aliases do layout selecionado.
  const aceitaPdf = true;

  async function handleFile(f: File) {
    const lower = f.name.toLowerCase();
    // PDF solto no modo Excel: encaminha para o pipeline de extração em vez de recusar.
    if (lower.endsWith(".pdf")) {
      setOrigem("pdf");
      await handleFilePdf(f);
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      toast.error("Arquivo excede o limite de 50 MB.");
      return;
    }
    if (!/\.(xlsx|xls|csv)$/.test(lower)) {
      toast.error("Formato não suportado. Envie Excel (.xlsx/.xls), CSV ou PDF.");
      return;
    }
    let matrix: unknown[][];
    let ws: XLSX.WorkSheet | null = null;
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellFormula: true });
      ws = wb.Sheets[wb.SheetNames[0]];
      matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
      // Guarda o arquivo original para a exportação "espelho fiel" do modelo.
      setArquivoBuf(lower.endsWith(".xlsx") ? buf.slice(0) : null);
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
    setFormulasModelo(ws ? formulasDaPlanilha(ws, hs, idx) : []);
    setNomeLayoutIA("");

    // Padrão Strategy: reconhece o modelo institucional do arquivo do RH.
    const tpl = detectarTemplate(f.name, hs);
    setTemplateDet(tpl);
    if (tpl)
      toast.success(
        `Modelo reconhecido: ${tpl.template.nome} — as regras de cálculo do modelo serão aplicadas.`,
      );

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
    setMapeamento(mapearComTemplate(hs, tpl, mapearComMotor(hs, escolhido)));
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
    const tpl = detectarTemplate(file?.name ?? "", hs);
    setTemplateDet(tpl);
    setMapeamento(
      mapearComTemplate(
        hs,
        tpl,
        mapearComMotor(hs, versoes.find((v) => v.versao_id === versaoId) ?? null),
      ),
    );
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
      const base = resolveRows(
        rawRows,
        mapeamento,
        { byCpf: maps.byCpf, byMatricula: maps.byMatricula },
        { numericos: customNumericos },
      );
      const candidatos = maps.candidatos ?? [];
      const enriched = base.map((r) => {
        if (r.status_match !== "nao_localizado" || !r.nome) return r;
        const hit = bestFuzzy(r.nome, candidatos, 0.88);
        return hit ? { ...r, profissional_id: hit.id, status_match: "nome" as const } : r;
      });
      // Aplica a matemática aprendida do modelo (BRUTO, ISS, TOTAL, LÍQUIDO…),
      // garantindo que o resultado importado bata com o da planilha.
      const comFormulas = regrasAplicaveis.length
        ? (aplicarRegrasFormulas(
            enriched as unknown as Record<string, unknown>[],
            regrasAplicaveis,
          ) as unknown as ResolvedRow[])
        : enriched;
      const comTemplate = templateDet
        ? (aplicarTemplate(templateDet.template, comFormulas as unknown as Record<string, unknown>[]) as unknown as ResolvedRow[])
        : comFormulas;
      setResolved(comTemplate);
      if (regrasAplicaveis.length)
        toast.success(
          `${regrasAplicaveis.length} regra(s) do modelo aplicadas aos valores calculados.`,
        );
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
          modelo_planilha_id: modeloSalvoId,
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
            detalhes: {
              reconhecimento_pct: reconhecimentoRef.current.pct,
              mapeamento_manual_pct: reconhecimentoRef.current.manualPct,
              colunas: reconhecimentoRef.current.total,
            },
          },
        });
        void registrarUsoAliases({
          data: {
            modulo: versaoAtiva?.modulo || "piso",
            pares: Object.entries(mapeamento)
              .filter(([, v]) => !!v)
              .slice(0, 200)
              .map(([alias, campo]) => ({ campo_interno: String(campo), alias })),
          },
        }).catch(() => undefined);
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

  // O gerador de cabeçalho fixo (FOPAG) foi aposentado no fluxo final: ele
  // emitia colunas escritas em código e perdia colunas do modelo (GRAT.INCENTIVO).
  // O arquivo final agora sai sempre do motor de clone da planilha modelo.



  /**
   * ESPELHO FIEL DO MODELO (engenharia reversa): exporta o mesmo arquivo, com a
   * mesma estrutura, ordem de colunas, cabeçalhos e formatação — apenas com as
   * fórmulas do modelo reaplicadas em todas as linhas de dados (ativas).
   * Nada é adicionado, removido, renomeado ou reposicionado.
   */
  const espelhoMut = useMutation({
    mutationFn: async () => {
      if (!arquivoBuf) throw new Error("Envie um arquivo .xlsx para gerar o espelho do modelo.");
      const { gerarPlanilhaEspelho } = await import("@/lib/planilha-espelho");
      return gerarPlanilhaEspelho(arquivoBuf.slice(0));
    },
    onSuccess: ({ blob, resumo }) => {
      const base = (file?.name ?? "planilha").replace(/\.[a-z0-9]+$/i, "");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${base} - FORMULAS.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        `Cópia fiel: ${resumo.totalFormulas} fórmula(s) copiadas célula a célula em ${resumo.totalLinhas} linha(s).`,
      );
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao gerar o espelho do modelo"),
  });

  /**
   * CLONE DE PLANILHA MODELO: usa o arquivo enviado no passo 1 como dados do mês
   * e a planilha modelo escolhida aqui como fonte da estrutura. Para cada pessoa
   * (casada por CPF, depois nome, depois cargo) o sistema copia a receita da
   * célula do modelo: fórmula igual onde o modelo tem fórmula, valor fixo do mês
   * onde o modelo tem valor digitado. Nada é recalculado por regra geral.
   */
  /** Salva o .xlsx modelo no cadastro para uso nos downloads das Importações. */
  type ArgsSalvarModelo = {
    buf: ArrayBuffer;
    nomeArquivo: string;
    nome: string;
    resumo: NonNullable<typeof modeloResumo>;
  };

  const salvarModeloMut = useMutation({
    mutationFn: async (args?: ArgsSalvarModelo) => {
      const buf = args?.buf ?? modeloBuf;
      const resumo = args?.resumo ?? modeloResumo;
      const nome = (args?.nome ?? modeloSalvarNome).trim();
      const nomeArquivo = args?.nomeArquivo ?? modeloNome;
      if (!buf) throw new Error("Anexe a planilha modelo (.xlsx).");
      if (!resumo) throw new Error("Não foi possível ler a planilha modelo.");
      const bytes = new Uint8Array(buf.slice(0));
      let bin = "";
      for (let i = 0; i < bytes.length; i += 8192)
        bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return salvarModeloPlanilha({
        data: {
          nome,
          descricao: `Modelo lido de ${nomeArquivo} — aba ${resumo.aba}, cabeçalho na linha ${resumo.linhaCabecalho}.`,
          modulo: "piso",
          vinculo: layout.tipo,
          nome_arquivo: nomeArquivo,
          aba: resumo.aba,
          linha_cabecalho: resumo.linhaCabecalho,
          colunas: resumo.colunas,
          colunas_estruturais: resumo.estruturais,
          arquivo_base64: btoa(bin),
          padrao: true,
        },
      });
    },
    onSuccess: (r: { id?: string; nome?: string } | null) => {
      if (r?.id) setModeloSalvoId(r.id);
      toast.success(
        `Modelo "${r?.nome ?? modeloSalvarNome}" salvo como padrão de ${layout.label}. ` +
          "Os cálculos da importação e os downloads passam a seguir este modelo.",
      );
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao salvar o modelo de planilha."),
  });

  const cloneMut = useMutation({
    mutationFn: async () => {
      if (!arquivoBuf) throw new Error("Envie a planilha .xlsx do mês.");
      if (!modeloBuf) throw new Error("Selecione a planilha modelo (.xlsx).");
      const { clonarPlanilhaModelo } = await import("@/lib/planilha-clone");
      return clonarPlanilhaModelo(modeloBuf.slice(0), arquivoBuf.slice(0));
    },
    onSuccess: ({ blob, resumo }) => {
      const base = (arquivoMesNome || "planilha").replace(/\.[a-z0-9]+$/i, "");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${base} - GERADO.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        `Clone concluído: ${resumo.registros} linha(s) — ${resumo.casadosPorCpf} por CPF, ` +
          `${resumo.casadosPorNome} por nome. ` +
          `${resumo.formulasCopiadas} fórmula(s) e ${resumo.valoresFixosCopiados} valor(es) fixo(s) copiados.`,
      );
      // Relatório de divergência: nada passa silencioso.
      if (resumo.colunasModeloSemDado.length > 0) {
        toast.warning(
          `Colunas do modelo sem dado no arquivo do mês: ${resumo.colunasModeloSemDado.join(", ")}. ` +
            "Elas foram mantidas na estrutura, mas ficaram vazias.",
          { duration: 12000 },
        );
      }
      if (resumo.linhasSemCasamento.length > 0) {
        const nomes = resumo.linhasSemCasamento.map((l) => l.nome || `linha ${l.linha}`);
        toast.warning(
          `${resumo.linhasSemCasamento.length} pessoa(s) sem correspondência no modelo ` +
            `(${nomes.slice(0, 5).join(", ")}${nomes.length > 5 ? "…" : ""}). ` +
            "Receberam só as colunas calculadas do modelo; nenhuma receita de outra pessoa foi herdada.",
          { duration: 12000 },
        );
      }

    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao clonar a planilha modelo"),
  });

  async function gerarModeloClone(f: File) {
    if (!f.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("O motor de clonagem exige uma planilha .xlsx.");
      return;
    }
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellFormula: true });
      const nomeAba = wb.SheetNames[0];
      const ws = wb.Sheets[nomeAba];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
      const idx = detectHeaderRow(matrix);
      const cabecalho = (matrix[idx] ?? []).map((v) => String(v ?? ""));
      let formulas = 0;
      for (const [ref, celula] of Object.entries(ws as Record<string, any>)) {
        if (!ref.startsWith("!") && celula?.f) formulas += 1;
      }
      setModeloBuf(buf.slice(0));
      setModeloNome(f.name);
      setClonePreview({
        aba: nomeAba,
        cabecalho,
        linhas: matrix.slice(idx + 1, idx + 6),
        totalLinhas: Math.max(0, matrix.length - idx - 1),
        formulas,
      });
      setArquivoBuf(null);
      setArquivoMesNome("");
      setCloneEtapa(2);
      toast.success("Modelo gerado. Estrutura e receitas das células foram preservadas.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler a planilha modelo.");
    }
  }

  async function selecionarArquivoMes(f: File) {
    if (!f.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("O arquivo do mês deve estar no formato .xlsx.");
      return;
    }
    setArquivoBuf((await f.arrayBuffer()).slice(0));
    setArquivoMesNome(f.name);
    setCloneEtapa(3);
  }

  function baixarModeloClonado() {
    if (!modeloBuf) return;
    const blob = new Blob([modeloBuf.slice(0)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${modeloNome.replace(/\.xlsx$/i, "")} - MODELO CLONADO.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Exporta as linhas validadas nas colunas fiéis do modelo detectado
   * (UBS = 16 colunas; H.M.O = 14 colunas; H.M.S.D.S = 16 colunas), com as
   * fórmulas vivas.
   */
  function baixarPlanilhaTemplate() {
    const id = templateDet?.template.id;
    const linhasCalc = validacao.linhasValidas as unknown as Record<string, unknown>[];
    const aoaSaida =
      id === "HMSDS_SAUDE"
        ? montarPlanilhaHmsds(linhasCalc)
        : id === "HMO_SAUDE"
          ? montarPlanilhaHmo(linhasCalc)
          : id === "CAPS_SAUDE"
            ? montarPlanilhaCaps(linhasCalc)
            : id === "PADRAO_ADM"
              ? montarPlanilhaPadraoAdm(linhasCalc)
              : montarPlanilhaUbs(linhasCalc);

    const ws: XLSX.WorkSheet = {};
    let maxCol = 0;
    aoaSaida.forEach((linha, r) => {
      linha.forEach((valor, c) => {
        maxCol = Math.max(maxCol, c);
        const ref = XLSX.utils.encode_cell({ r, c });
        if (valor && typeof valor === "object" && "f" in (valor as object)) {
          ws[ref] = { t: "n", f: (valor as { f: string }).f, z: "#,##0.00" };
        } else if (typeof valor === "number") {
          ws[ref] = { t: "n", v: valor, z: "#,##0.00" };
        } else {
          ws[ref] = { t: "s", v: String(valor ?? "") };
        }
      });
    });
    ws["!ref"] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: aoaSaida.length - 1, c: maxCol },
    });
    ws["!cols"] = [{ wch: 38 }, { wch: 16 }, { wch: 30 }, { wch: 24 }].concat(
      Array.from({ length: maxCol - 3 }, () => ({ wch: 14 })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      id === "HMSDS_SAUDE"
        ? ABA_HMSDS
        : id === "HMO_SAUDE"
          ? ABA_HMO
          : id === "CAPS_SAUDE"
            ? ABA_CAPS
            : id === "PADRAO_ADM"
              ? ABA_PADRAO_ADM
              : "UBS (3)",
    );


    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PLANILHA-CONTRATADOS-${(competencia || "SEM-COMPETENCIA").replace(/\//g, "-")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }



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

  /**
   * Autoaprendizado do motor: ao mapear manualmente um cabeçalho desconhecido,
   * oferece salvá-lo como sinônimo permanente do campo no layout ativo.
   */
  function sugerirAprenderAlias(header: string, destino: string) {
    const v = versaoAtiva;
    if (!v || !header.trim()) return;
    const campo = v.campos.find((c) => c.campo_interno === destino);
    if (!campo) return;
    const norm = normalizarHeader(header);
    if (!norm || termosDoCampo(campo).includes(norm)) return;

    // Aprendizado por confirmação: cada mapeamento manual conta um voto;
    // com 3 confirmações de usuários diferentes o sinônimo é promovido.
    void registrarConfirmacaoAlias({
      data: {
        modulo: v.modulo || "piso",
        campo_interno: destino,
        alias: header,
        origem: "manual",
      },
    })
      .then((r) => {
        if (r.promover) {
          toast("Este cabeçalho já foi confirmado por 3 pessoas. Adicionar ao catálogo?", {
            description: `"${header}" → ${campo.label ?? destino}`,
            action: { label: "Adicionar", onClick: () => salvarAlias(v, destino, header, campo.label) },
          });
          return;
        }
        toast("Deseja adicionar este cabeçalho como sinônimo permanente deste campo?", {
          description: `"${header}" → ${campo.label ?? destino} · ${r.confirmacoes}/${r.limiar} confirmações`,
          action: { label: "Salvar sinônimo", onClick: () => salvarAlias(v, destino, header, campo.label) },
        });
      })
      .catch(() => {
        toast("Deseja adicionar este cabeçalho como sinônimo permanente deste campo?", {
          description: `"${header}" → ${campo.label ?? destino}`,
          action: { label: "Salvar sinônimo", onClick: () => salvarAlias(v, destino, header, campo.label) },
        });
      });
  }

  function salvarAlias(
    v: { versao_id: string; modulo: string },
    destino: string,
    header: string,
    label?: string | null,
  ) {
    void aprenderAliasCampo({
      data: {
        versao_id: v.versao_id,
        campo_interno: destino,
        alias: header,
        modulo: v.modulo || "piso",
      },
    })
      .then(() =>
        toast.success(`Sinônimo salvo — o motor reconhecerá "${header}" como ${label ?? destino}.`),
      )
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : "Falha ao salvar o sinônimo"),
      );
  }

  const destinosDisponiveis = CAMPOS_SISTEMA.filter((c) => !CAMPOS_CALCULADOS.has(c.key));

  /** Rótulo de um destino, considerando também os campos personalizados. */
  function labelDoDestino(key: string): string {
    return (
      CAMPOS_SISTEMA.find((c) => c.key === key)?.label ??
      camposCustom.find((c) => c.key === key)?.label ??
      key
    );
  }

  /** Chaves personalizadas que devem ser lidas como valor monetário. */
  const customNumericos = useMemo(
    () => camposCustom.filter((c) => c.tipo === "valor").map((c) => c.key),
    [camposCustom],
  );

  /** Heurística: a coluna parece conter valores numéricos? */
  function colunaParecerValor(header: string): boolean {
    const amostra = rawRows.slice(0, 20).map((r) => r[header]);
    const preenchidos = amostra.filter((v) => v != null && v !== "");
    if (preenchidos.length === 0) return false;
    const numericos = preenchidos.filter((v) => parseNumeric(v) != null).length;
    return numericos / preenchidos.length >= 0.7;
  }

  /**
   * Cria um campo interno novo a partir do título da coluna e já o vincula.
   * Resolve o caso "coluna sem destino no catálogo" sem depender de suporte.
   */
  function criarCampoPersonalizado(header: string, label: string, tipo: TipoCampoCustom) {
    const nome = label.trim();
    if (!nome) {
      toast.error("Informe o nome do campo.");
      return;
    }
    const key = chaveDeCampo(nome);
    const campo: CampoCustom = { key, label: nome, tipo };
    setCamposCustom((prev) => {
      const next = upsertCampoCustom(prev, campo);
      salvarCamposCustom(layout.modelo, next);
      return next;
    });
    setMapeamento((prev) => ({ ...prev, [header]: key }));
    setColunasIgnoradas((prev) => prev.filter((x) => x !== header));
    setCriandoEm(null);
    setNovoLabel("");
    if (versaoAtiva) sugerirAprenderAlias(header, key);
    toast.success(`Campo "${nome}" criado e vinculado à coluna "${header}".`);
  }

  /** Cria campos automaticamente para todas as colunas ainda sem destino. */
  function criarCamposParaColunasSemMapeamento() {
    const pendentes = headers.filter(
      (h) => !mapeamento[h] && !colunasIgnoradas.includes(h) && h.trim(),
    );
    if (pendentes.length === 0) {
      toast.message("Nenhuma coluna sem mapeamento.");
      return;
    }
    const novos: CampoCustom[] = pendentes.map((h) => ({
      key: chaveDeCampo(h),
      label: h.trim(),
      tipo: colunaParecerValor(h) ? "valor" : "texto",
    }));
    setCamposCustom((prev) => {
      let next = prev;
      for (const c of novos) next = upsertCampoCustom(next, c);
      salvarCamposCustom(layout.modelo, next);
      return next;
    });
    setMapeamento((prev) => {
      const next = { ...prev };
      pendentes.forEach((h, i) => {
        next[h] = novos[i].key;
      });
      return next;
    });
    toast.success(`${pendentes.length} campo(s) criado(s) a partir dos títulos das colunas.`);
  }

  /** Pré-visualização: quanto do arquivo o motor entendeu antes de importar. */
  const reconhecimento = useMemo(
    () =>
      previsualizarReconhecimento(
        headers,
        mapeamento as Record<string, string | null>,
        (versaoAtiva as any) ?? null,
        (campo) => labelDoDestino(campo),
        colunasIgnoradas,
      ),
    [headers, mapeamento, versaoAtiva, colunasIgnoradas, camposCustom],
  );

  /** Snapshot do reconhecimento para registrar métricas ao final da importação. */
  const reconhecimentoRef = useRef({ pct: 0, manualPct: 0, total: 0 });
  reconhecimentoRef.current = {
    pct: reconhecimento.percentual,
    manualPct: reconhecimento.relevantes
      ? Math.round((reconhecimento.naoReconhecidas / reconhecimento.relevantes) * 100)
      : 0,
    total: reconhecimento.total,
  };

  const iaMut = useMutation({
    mutationFn: () =>
      sugerirCamposIA({
        data: {
          headers: reconhecimento.linhas
            .filter((l) => l.status === "nao_reconhecido" && l.header.trim())
            .map((l) => l.header)
            .slice(0, 60),
          modulo: versaoAtiva?.modulo || "piso",
        },
      }),
    onSuccess: (r) => {
      if (r.erro) {
        toast.error(r.erro);
        return;
      }
      const validos = new Set(destinosDisponiveis.map((c) => c.key));
      const usados = new Set(Object.values(mapeamento).filter(Boolean) as string[]);
      let aplicadas = 0;
      setMapeamento((prev) => {
        const next = { ...prev };
        for (const s of r.sugestoes) {
          if (!validos.has(s.campo as PisoDestino) || usados.has(s.campo)) continue;
          if (next[s.header]) continue;
          next[s.header] = s.campo as PisoDestino;
          usados.add(s.campo);
          aplicadas += 1;
        }
        return next;
      });
      toast[aplicadas ? "success" : "message"](
        aplicadas
          ? `IA sugeriu ${aplicadas} mapeamento(s). Revise antes de continuar.`
          : "A IA não encontrou correspondências novas.",
      );
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao consultar a IA"),
  });

  /**
   * Aprendizado por Modelo de Referência: a IA lê cabeçalhos, amostras e as
   * fórmulas do Excel e cria um layout completo — sem mapeamento manual.
   */
  const modeloMut = useMutation({
    mutationFn: () =>
      gerarLayoutDeModelo({
        data: {
          nome: nomeLayoutIA.trim() || `Modelo ${layout.label} — ${file?.name ?? "planilha"}`,
          modulo: "piso",
          tipo: layout.tipo,
          nome_arquivo: file?.name ?? "",
          headers: headers.filter((h) => String(h).trim()).slice(0, 120),
          amostra: rawRows
            .slice(0, 3)
            .map((r) => headers.map((h) => String(r[h] ?? "").slice(0, 200))),
          formulas: formulasModelo.map((f) => ({
            coluna: f.coluna,
            expressao: f.expressao.slice(0, 400),
            constante: f.constante,
            termos: f.termos,
          })),
          usar_ia: true,
        },
      }),
    onSuccess: async (r) => {
      const { data } = await versoesQ.refetch();
      const nova = (data?.versoes ?? []).find((v: any) => v.versao_id === r.versao_id) ?? null;
      setVersaoId(r.versao_id);
      if (nova) setMapeamento(mapearComMotor(headers, nova as LayoutVersaoResolvida));
      setMotivoDeteccao(
        `Layout gerado pela IA a partir deste arquivo: ${r.campos} campo(s) e ${r.regras.length} regra(s) de cálculo aprendidas.`,
      );
      if (r.erro_ia) toast.warning(r.erro_ia);
      toast.success(
        `Layout criado automaticamente — ${r.campos} campos e ${r.regras.length} fórmulas aprendidas.`,
      );
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao gerar o layout automático"),
  });



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
              accept={origem === "pdf" ? ".pdf" : ".xlsx,.xls,.csv,.pdf"}
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
          {/* Aprendizado por Modelo de Referência (aditivo aos layouts manuais) */}
          <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                Aprender este arquivo como modelo
              </div>
              <Badge variant="outline">
                {formulasModelo.length} fórmula(s) detectada(s) no Excel
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              A IA lê os cabeçalhos e as fórmulas da planilha modelo e cria o layout de importação
              sozinha — sem mapear coluna por coluna. Nos próximos meses, o sistema reconhece a
              planilha e aplica a mesma matemática (BRUTO, ISS, LÍQUIDO).
            </p>
            {arquivoBuf && (
              <div className="space-y-2 rounded-md border bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">
                  <strong>Cópia fiel do modelo (motor de cópia):</strong> exporta este mesmo arquivo com
                  estrutura, ordem das colunas, cabeçalhos e formatação idênticos. O sistema lê a
                  fórmula exata de CADA célula, linha por linha, e devolve a mesma fórmula na mesma
                  célula. Linha com valor fixo continua fixa; nenhuma regra geral é criada, nada é
                  deduzido, adicionado, removido, renomeado ou reposicionado.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => espelhoMut.mutate()}
                  disabled={espelhoMut.isPending}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {espelhoMut.isPending
                    ? "Gerando cópia..."
                    : "Baixar planilha do modelo (cópia fiel das fórmulas)"}
                </Button>
              </div>
            )}

            {/* CLONE DE PLANILHA MODELO — sem aprendizado de matemática. */}
            <div className="space-y-2 rounded-md border bg-background/60 p-3">
              <p className="text-xs font-medium">Clone de planilha modelo</p>
              <p className="text-xs text-muted-foreground">
                Escolha a planilha modelo (o arquivo do mês anterior, já conferido). O sistema grava
                um mapa de referência linha a linha e coluna a coluna com a fórmula exata ou o valor
                fixo de cada célula e aplica essa mesma receita nos dados do arquivo enviado no passo
                1 (casamento por CPF, depois nome, depois cargo). Nada é recalculado por regra geral:
                onde o modelo tem <code>=BASE*20%</code> sai a mesma fórmula; onde o modelo tem 517,20
                digitado, sai 517,20.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="file"
                  accept=".xlsx"
                  className="w-72"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const buf = await f.arrayBuffer();
                    setModeloBuf(buf);
                    setModeloNome(f.name);
                    const nomeSugerido = f.name
                      .replace(/\.[a-z0-9]+$/i, "")
                      .replace(/[^\w\s'.-]+/g, " ")
                      .trim();
                    setModeloSalvarNome(nomeSugerido);
                    // Painel de matemática e resumo: lidos DESTE modelo, nada fixo.
                    setMatModelo([]);
                    setMatModeloErro(null);
                    setModeloResumo(null);
                    setModeloSalvoId(null);
                    setFormulasDoModelo([]);
                    try {
                      const ExcelJS = (await import("exceljs")).default ?? (await import("exceljs"));
                      const wb = new (ExcelJS as any).Workbook();
                      await wb.xlsx.load(buf.slice(0));
                      const ws = wb.worksheets[0];
                      if (!ws) throw new Error("A planilha modelo não tem abas legíveis.");
                      const mapa: MapaModelo = lerMapaModelo(ws);
                      setMatModelo(matematicaEstrutural(mapa));
                      const estr = colunasEstruturaisDoModelo(mapa);
                      const resumo = {
                        aba: mapa.aba,
                        linhaCabecalho: mapa.linhaCabecalho,
                        colunas: Array.from(mapa.titulos.values()),
                        estruturais: Array.from(estr).map((c) => mapa.titulos.get(c) ?? ""),
                        linhas: mapa.linhas.length,
                      };
                      setModeloResumo(resumo);

                      // Fórmulas do MODELO por cabeçalho: é a matemática que vale
                      // ao clicar em "Validar e cruzar cadastro".
                      const wbX = XLSX.read(buf.slice(0), { type: "array", cellFormula: true });
                      const wsX = wbX.Sheets[wbX.SheetNames[0]];
                      const headersX: string[] = [];
                      for (let c = 1; c <= mapa.ultimaColuna; c += 1)
                        headersX.push(mapa.titulos.get(c) ?? "");
                      setFormulasDoModelo(
                        wsX ? formulasDaPlanilha(wsX, headersX, mapa.linhaCabecalho - 1) : [],
                      );

                      // Salva automaticamente como modelo padrão deste vínculo.
                      salvarModeloMut.mutate({
                        buf: buf.slice(0),
                        nomeArquivo: f.name,
                        nome: nomeSugerido || f.name,
                        resumo,
                      });
                    } catch (err) {
                      setMatModeloErro(err instanceof Error ? err.message : String(err));
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cloneMut.mutate()}
                  disabled={cloneMut.isPending || !modeloBuf || !arquivoBuf}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {cloneMut.isPending
                    ? "Clonando..."
                    : !modeloBuf
                      ? "Anexe a planilha modelo"
                      : !arquivoBuf
                        ? "Falta a planilha do mês (passo 1)"
                        : "Gerar planilha clonada do modelo"}
                </Button>
              </div>
              {modeloNome && (
                <p className="text-xs text-muted-foreground">Modelo: {modeloNome}</p>
              )}

              {/* Modelo lido: resumo + salvar no cadastro (usado nos downloads). */}
              {modeloResumo && (
                <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                  <p className="text-xs">
                    Modelo lido: aba <strong>{modeloResumo.aba}</strong>, cabeçalho na linha{" "}
                    <strong>{modeloResumo.linhaCabecalho}</strong>,{" "}
                    <strong>{modeloResumo.colunas.length}</strong> colunas e{" "}
                    <strong>{modeloResumo.linhas}</strong> linhas de referência.
                    {modeloResumo.estruturais.length > 0 && (
                      <>
                        {" "}
                        Colunas calculadas pelo modelo:{" "}
                        <strong>{modeloResumo.estruturais.join(", ")}</strong>.
                      </>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Salve como modelo oficial para que os downloads em{" "}
                    <strong>Importações</strong> saiam com esta mesma estrutura, em vez do formato
                    antigo do sistema.
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label>Nome do modelo de planilha</Label>
                      <Input
                        className="w-64"
                        placeholder="UBS"
                        value={modeloSalvarNome}
                        onChange={(ev) => setModeloSalvarNome(ev.target.value)}
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() => salvarModeloMut.mutate(undefined)}
                      disabled={salvarModeloMut.isPending || modeloSalvarNome.trim().length < 2}
                    >
                      {salvarModeloMut.isPending ? "Salvando..." : "Salvar modelo de planilha"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label>Nome do modelo</Label>
                <Input
                  className="w-72"
                  placeholder={`Modelo ${layout.label}`}
                  value={nomeLayoutIA}
                  onChange={(e) => setNomeLayoutIA(e.target.value)}
                />
              </div>
              <Button
                onClick={() => modeloMut.mutate()}
                disabled={modeloMut.isPending || headers.length === 0}
              >
                {modeloMut.isPending
                  ? "Gerando layout..."
                  : "Gerar layout automático a partir deste arquivo"}
              </Button>
            </div>
            {matModelo.length > 0 && (
              <div className="space-y-1 rounded-md border bg-background p-2">
                <div className="text-xs font-medium">
                  Matemática aplicada na importação — lida do modelo
                  {modeloNome ? ` ${modeloNome}` : ""} ({matModelo.length}):
                </div>
                <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                  {matModelo.map((r) => (
                    <li key={r.coluna}>{r.descricao}</li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground">
                  Este resumo é gerado automaticamente para cada modelo enviado (UBS, H.M.O, CER,
                  CAPS…). Somente colunas calculadas pelo próprio modelo aparecem aqui; colunas com
                  valor digitado em alguma linha (ex.: insalubridade, auxílio transporte) são
                  copiadas exatamente como estão.
                </p>
              </div>
            )}
            {matModelo.length === 0 && !matModeloErro && modeloNome && (
              <p className="text-[11px] text-muted-foreground">
                O modelo {modeloNome} não tem colunas calculadas por fórmula — todos os valores serão
                copiados célula a célula, exatamente como estão no modelo.
              </p>
            )}

            {matModeloErro && (
              <p className="text-[11px] text-destructive">
                Não foi possível ler a matemática do modelo: {matModeloErro}
              </p>
            )}

          </div>

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

          <div className="space-y-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium">
                Compatibilidade do layout:{" "}
                <span
                  className={
                    reconhecimento.percentual >= 80
                      ? "text-emerald-600"
                      : reconhecimento.percentual >= 50
                        ? "text-amber-600"
                        : "text-destructive"
                  }
                >
                  {reconhecimento.percentual}%
                </span>{" "}
                <span className="text-muted-foreground">
                  ({reconhecimento.reconhecidas} de {reconhecimento.relevantes} campos relevantes
                  reconhecidos
                  {reconhecimento.ignoradas > 0
                    ? ` · ${reconhecimento.ignoradas} coluna(s) ignorada(s)`
                    : ""}
                  {reconhecimento.vazias > 0 ? ` · ${reconhecimento.vazias} vazia(s)` : ""})
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => iaMut.mutate()}
                disabled={iaMut.isPending || reconhecimento.naoReconhecidas === 0}
              >
                {iaMut.isPending ? "Consultando IA..." : "Sugerir com IA"}
              </Button>
            </div>
            <Progress value={reconhecimento.percentual} />
            {reconhecimento.compativel ? (
              <p className="text-xs text-emerald-600">
                ✔ Layout totalmente compatível — todas as colunas necessárias foram identificadas.
                {reconhecimento.ignoradas > 0
                  ? ` ${reconhecimento.ignoradas} coluna(s) foram ignoradas conforme configuração do layout.`
                  : ""}
              </p>
            ) : null}
            {reconhecimento.naoReconhecidas > 0 && (
              <p className="text-xs text-muted-foreground">
                {reconhecimento.naoReconhecidas} coluna(s) sem correspondência:{" "}
                {reconhecimento.linhas
                  .filter((l) => l.status === "nao_reconhecido")
                  .slice(0, 8)
                  .map((l) => l.header || "(sem título)")
                  .join(", ")}
              </p>
            )}
            {reconhecimento.obrigatoriosAusentes > 0 && (
              <p className="text-xs text-destructive">
                Campos obrigatórios ausentes:{" "}
                {reconhecimento.camposFaltando
                  .filter((c) => c.estado === "obrigatorio")
                  .map((c) => c.label)
                  .join(", ")}
              </p>
            )}
            <div className="grid gap-x-6 gap-y-1 pt-1 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex justify-between">
                <span>Campos reconhecidos</span>
                <span className="font-medium text-foreground">{reconhecimento.reconhecidas}</span>
              </div>
              <div className="flex justify-between">
                <span>Obrigatórios ausentes</span>
                <span className="font-medium text-foreground">
                  {reconhecimento.obrigatoriosAusentes}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Opcionais ausentes</span>
                <span className="font-medium text-foreground">
                  {reconhecimento.opcionaisAusentes}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Colunas ignoradas</span>
                <span className="font-medium text-foreground">{reconhecimento.ignoradas}</span>
              </div>
              <div className="flex justify-between">
                <span>Sem correspondência</span>
                <span className="font-medium text-foreground">
                  {reconhecimento.naoReconhecidas}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Compatibilidade</span>
                <span className="font-medium text-foreground">{reconhecimento.percentual}%</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Nenhuma coluna precisa ficar "Sem mapeamento": crie o campo interno direto aqui.
            </p>
            <Button variant="outline" size="sm" onClick={criarCamposParaColunasSemMapeamento}>
              <Sparkles className="mr-2 h-4 w-4" /> Criar campos para colunas sem mapeamento
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {headers.map((h) => (
              <div key={h} className="space-y-1 rounded-md border p-2">
                <div className="truncate text-xs font-medium" title={h}>
                  {h || "(sem título)"}
                </div>
                <Select
                  value={
                    mapeamento[h] ?? (colunasIgnoradas.includes(h) ? "__ignorar" : "__none")
                  }
                  onValueChange={(v) => {
                    if (v === "__novo") {
                      setCriandoEm(h);
                      setNovoLabel(h.trim());
                      setNovoTipo(colunaParecerValor(h) ? "valor" : "texto");
                      return;
                    }
                    const ignorar = v === "__ignorar";
                    const semDestino = ignorar || v === "__none";
                    setMapeamento((prev) => ({
                      ...prev,
                      [h]: semDestino ? null : v,
                    }));
                    setColunasIgnoradas((prev) =>
                      ignorar ? [...new Set([...prev, h])] : prev.filter((x) => x !== h),
                    );
                    if (!semDestino) sugerirAprenderAlias(h, v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sem mapeamento</SelectItem>
                    <SelectItem value="__ignorar">Ignorar coluna</SelectItem>
                    <SelectItem value="__novo">+ Criar campo personalizado…</SelectItem>
                    {destinosDisponiveis.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {c.label}
                      </SelectItem>
                    ))}
                    {camposCustom.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {c.label} (personalizado)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {isCampoCustom(mapeamento[h]) && criandoEm !== h && (
                  <p className="text-[11px] text-muted-foreground">
                    Campo personalizado —{" "}
                    {camposCustom.find((c) => c.key === mapeamento[h])?.tipo === "valor"
                      ? "lido como valor (R$)"
                      : "lido como texto"}
                  </p>
                )}

                {criandoEm === h && (
                  <div className="space-y-2 rounded-md border bg-muted/40 p-2">
                    <Input
                      value={novoLabel}
                      placeholder="Nome do campo (ex.: Grat. Incentivo)"
                      onChange={(e) => setNovoLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") criarCampoPersonalizado(h, novoLabel, novoTipo);
                      }}
                    />
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={novoTipo === "valor" ? "default" : "outline"}
                        onClick={() => setNovoTipo("valor")}
                      >
                        Valor (R$)
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={novoTipo === "texto" ? "default" : "outline"}
                        onClick={() => setNovoTipo("texto")}
                      >
                        Texto
                      </Button>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        onClick={() => criarCampoPersonalizado(h, novoLabel, novoTipo)}
                      >
                        Criar e vincular
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setCriandoEm(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>


          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPasso(1)}>
              Voltar
            </Button>
            <Button onClick={() => matchMut.mutate()} disabled={matchMut.isPending}>
              {matchMut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cruzando com o Cadastro...
                </>
              ) : (
                "Validar e cruzar cadastro"
              )}
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

          <div className="grid gap-3 md:grid-cols-3">
            <Kpi label="Registros lidos" value={rawRows.length} />
            <Kpi label="Registros validados" value={validacao.linhasValidas.length} tone="ok" />
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Valor total da folha calculada</div>
              <div className="text-lg font-semibold">
                {validacao.linhasValidas
                  .reduce((s, r) => s + (r.valor_liquido ?? 0), 0)
                  .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            </div>
          </div>

          {templateDet && (
            <div className="rounded-md border p-3 text-sm">
              <div className="font-medium">
                Modelo aplicado: {templateDet.template.nome}
              </div>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                {templateDet.template.descricaoRegras.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          <ImportPreviewTable
            rows={resolved}
            issues={validacao.issues}
            templateId={templateDet?.template.id}
          />



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
              disabled={
                validacao.linhasValidas.length === 0 ||
                !competencia.trim() ||
                commitMut.isPending
              }
            >
              {commitMut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando...
                </>
              ) : (
                `Importar ${validacao.linhasValidas.length} linha(s)`
              )}

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
            {arquivoBuf && modeloBuf && (
              <Button onClick={() => cloneMut.mutate()} disabled={cloneMut.isPending}>
                <Download className="mr-2 h-4 w-4" />
                {cloneMut.isPending ? "Clonando..." : "Baixar planilha clonada do modelo"}
              </Button>
            )}
            {arquivoBuf && (
              <Button
                variant="secondary"
                onClick={() => espelhoMut.mutate()}
                disabled={espelhoMut.isPending}
              >
                <Download className="mr-2 h-4 w-4" />
                {espelhoMut.isPending ? "Gerando..." : "Baixar planilha do modelo (cópia fiel)"}
              </Button>
            )}
            {(templateDet?.template.id === "UBS_SAUDE" ||
              templateDet?.template.id === "HMO_SAUDE" ||
              templateDet?.template.id === "CAPS_SAUDE" ||
              templateDet?.template.id === "PADRAO_ADM" ||
              templateDet?.template.id === "HMSDS_SAUDE") && (
              <Button variant="secondary" onClick={baixarPlanilhaTemplate}>
                <Download className="mr-2 h-4 w-4" />
                {templateDet?.template.id === "HMO_SAUDE"
                  ? "Baixar planilha do modelo (14 colunas)"
                  : templateDet?.template.id === "CAPS_SAUDE" ||
                      templateDet?.template.id === "PADRAO_ADM"
                    ? "Baixar planilha do modelo (13 colunas)"
                    : "Baixar planilha do modelo (16 colunas)"}
              </Button>

            )}




            <Button variant="outline" onClick={() => navigate({ to: "/piso-enfermagem" })}>
              Voltar ao módulo
            </Button>
          </div>
        </div>
      )}

      {passo === 4 && !concluido && (
        <div className="space-y-3 rounded-md border p-4">
          <p className="text-sm text-muted-foreground">
            LEMBRANDO O SISTEMA TEM USAR O BANCO DE DADOS DO CADASTRO DO PROFISSIONAL, QUANDO IMPORTA O ARQUIVO MESMO ASSIM O SISTEMA TEM ANALISAR OS NOMES, CPF, LOTAÇÃO CARGO.
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
