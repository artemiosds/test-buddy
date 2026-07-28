/**
 * Runtime dos Provedores de IA — camada única e desacoplada.
 *
 * Toda IA implementa a mesma interface `AIProvider`:
 *   nome / modelo / testar() / processarPDF() / status() / retry()
 *
 * O Motor de Importação (layouts, AutoMap, match, consolidação, cálculo,
 * auditoria e exportação) não conhece provedor algum — fala apenas com esta
 * interface. Adicionar um provedor novo = nova entrada no catálogo.
 */

import { definicao, type Dialeto, type TipoProvedor } from "./catalog";

export type ProvedorRuntime = {
  id: string;
  tipo: TipoProvedor;
  nome: string;
  modelo: string;
  base_url: string | null;
  api_key: string | null;
  timeout_ms: number;
  tentativas: number;
  prioridade: number;
  extra: Record<string, string | number | boolean | null>;
};

export type ImagemPagina = { pagina: number; base64: string };

export type ResultadoTexto = {
  texto: string;
  ms: number;
  status: number;
  modelo: string;
};

export type ResultadoTeste = {
  ok: boolean;
  status: number;
  ms: number;
  modelo: string;
  mensagem: string;
};

export type StatusProvedor = "pronto" | "sem_chave" | "sem_modelo" | "sem_url";

export interface AIProvider {
  readonly id: string;
  readonly nome: string;
  readonly modelo: string;
  status(): StatusProvedor;
  testar(): Promise<ResultadoTeste>;
  processarPDF(req: {
    prompt: string;
    instrucao: string;
    paginas: ImagemPagina[];
  }): Promise<ResultadoTexto>;
  retry(): number;
}

/** Status HTTP que valem nova tentativa no mesmo provedor. */
const RETENTAVEIS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class ProviderError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly provedor: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export function mensagemAmigavel(status: number, detalhe: string, provedor: string): string {
  if (status === 0) return detalhe || `${provedor}: falha de rede.`;
  if (status === 408) return `${provedor}: tempo limite excedido.`;

  if (status === 401 || status === 403)
    return `${provedor}: API Key inválida ou sem permissão [${status}].`;
  if (status === 402) return `${provedor}: créditos esgotados.`;
  if (status === 404) return `${provedor}: modelo ou URL não encontrado [404].`;
  if (status === 429) return `${provedor}: limite de uso atingido (429).`;
  if (status === 503 || status === 529) return `${provedor}: modelo sobrecarregado (${status}).`;
  if (status >= 500) return `${provedor}: provedor instável [${status}].`;
  return `${provedor}: falha [${status}] ${detalhe.slice(0, 200)}`;
}

function baseUrl(p: ProvedorRuntime): string {
  let url = (p.base_url || definicao(p.tipo).baseUrlPadrao || "").trim();
  if (!url) return "";
  // Aceita URLs coladas sem esquema ("meu-gateway.com/v1").
  if (!/^https?:\/\//i.test(url)) url = `https://${url.replace(/^\/+/, "")}`;
  // Remove o caminho final do endpoint quando o usuário cola a URL completa.
  url = url.replace(/\/+$/, "");
  url = url.replace(/\/(chat\/completions|messages|completions)$/i, "");
  return url.replace(/\/+$/, "");
}

/** Erro de rede (DNS, TLS, host inacessível) traduzido para linguagem clara. */
function erroDeRede(e: unknown, url: string, provedor: string): ProviderError {
  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    return new ProviderError(0, `${provedor}: URL base inválida ("${url}").`, provedor);
  }
  const causa = e instanceof Error && e.cause instanceof Error ? e.cause.message : "";
  const detalhe = /ENOTFOUND|getaddrinfo|dns/i.test(causa)
    ? "endereço não encontrado (DNS)"
    : /ECONNREFUSED/i.test(causa)
      ? "conexão recusada"
      : /certificate|TLS|SSL/i.test(causa)
        ? "certificado TLS inválido"
        : /localhost|127\.0\.0\.1|:11434/.test(url)
          ? "endereço local não é acessível a partir do servidor"
          : "host inacessível a partir do servidor";
  return new ProviderError(
    0,
    `${provedor}: não foi possível conectar em ${host} — ${detalhe}. Confira a URL base.`,
    provedor,
  );
}

async function fetchComTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  provedor = "",
) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), Math.max(5000, timeoutMs));
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new ProviderError(408, "Tempo limite excedido.", provedor);
    }
    throw erroDeRede(e, url, provedor);
  } finally {
    clearTimeout(t);
  }
}


// -----------------------------------------------------------------------------
// Implementação base — retry com backoff exponencial (2s, 4s, 8s, 16s)
// -----------------------------------------------------------------------------
abstract class ProviderBase implements AIProvider {
  constructor(protected readonly cfg: ProvedorRuntime) {}

  get id() {
    return this.cfg.id;
  }
  get nome() {
    return this.cfg.nome;
  }
  get modelo() {
    return this.cfg.modelo || definicao(this.cfg.tipo).modeloPadrao;
  }
  retry() {
    return Math.min(6, Math.max(1, this.cfg.tentativas || 3));
  }

  status(): StatusProvedor {
    const def = definicao(this.cfg.tipo);
    if (!this.modelo) return "sem_modelo";
    if (!baseUrl(this.cfg)) return "sem_url";
    if (def.exigeChave && !this.chave()) return "sem_chave";
    return "pronto";
  }

  protected chave(): string {
    if (this.cfg.tipo === "lovable") {
      return (this.cfg.api_key || process.env.LOVABLE_API_KEY || "").trim();
    }
    return (this.cfg.api_key || "").trim();
  }

  /** Requisição concreta de cada dialeto. */
  protected abstract requisicao(req: {
    prompt: string;
    instrucao: string;
    paginas: ImagemPagina[];
  }): { url: string; init: RequestInit };

  /** Extrai o texto da resposta bruta de cada dialeto. */
  protected abstract extrair(json: unknown): string;

  /** Ping curto (somente texto) para o botão "Testar conexão". */
  protected pingReq() {
    return this.requisicao({ prompt: "ping", instrucao: "ping", paginas: [] });
  }

  async testar(): Promise<ResultadoTeste> {
    const inicio = Date.now();
    const s = this.status();
    if (s !== "pronto") {
      const msg =
        s === "sem_chave"
          ? "Informe a API Key deste provedor."
          : s === "sem_modelo"
            ? "Informe o modelo."
            : "Informe a URL base.";
      return { ok: false, status: 0, ms: 0, modelo: this.modelo, mensagem: msg };
    }
    try {
      const { url, init } = this.pingReq();
      const resp = await fetchComTimeout(
        url,
        init,
        Math.min(30000, this.cfg.timeout_ms || 30000),
        this.nome,
      );
      const ms = Date.now() - inicio;
      if (resp.ok) {
        return { ok: true, status: 200, ms, modelo: this.modelo, mensagem: "Conectado" };
      }
      const detalhe = await resp.text();
      return {
        ok: false,
        status: resp.status,
        ms,
        modelo: this.modelo,
        mensagem: mensagemAmigavel(resp.status, detalhe, this.nome),
      };
    } catch (e) {
      const status = e instanceof ProviderError ? e.status : 0;
      const msg =
        e instanceof ProviderError
          ? status === 408
            ? `${this.nome}: tempo limite excedido.`
            : e.message
          : `${this.nome}: ${e instanceof Error ? e.message : "falha de rede"}`;
      return {
        ok: false,
        status,
        ms: Date.now() - inicio,
        modelo: this.modelo,
        mensagem: msg,
      };
    }

  }

  async processarPDF(req: {
    prompt: string;
    instrucao: string;
    paginas: ImagemPagina[];
  }): Promise<ResultadoTexto> {
    const s = this.status();
    if (s !== "pronto") {
      throw new ProviderError(0, `${this.nome}: configuração incompleta (${s}).`, this.nome);
    }
    const tentativas = this.retry();
    const inicio = Date.now();
    let ultimoStatus = 0;
    let ultimoDetalhe = "";

    for (let i = 0; i < tentativas; i++) {
      try {
        const { url, init } = this.requisicao(req);
        const resp = await fetchComTimeout(url, init, this.cfg.timeout_ms || 120000, this.nome);
        if (resp.ok) {
          const json = await resp.json();
          return {
            texto: this.extrair(json),
            ms: Date.now() - inicio,
            status: 200,
            modelo: this.modelo,
          };
        }
        ultimoStatus = resp.status;
        ultimoDetalhe = await resp.text();
        if (!RETENTAVEIS.has(resp.status)) break;
      } catch (e) {
        ultimoStatus = e instanceof ProviderError ? e.status : 0;
        ultimoDetalhe = e instanceof Error ? e.message : String(e);
        // Erro de rede/URL não se resolve com nova tentativa.
        if (ultimoStatus !== 408) break;
      }
      if (i < tentativas - 1) {
        // backoff exponencial: 2s, 4s, 8s, 16s (+ jitter)
        await dormir(2000 * Math.pow(2, i) + Math.random() * 400);
      }
    }
    throw new ProviderError(
      ultimoStatus,
      mensagemAmigavel(ultimoStatus, ultimoDetalhe, this.nome),
      this.nome,
    );
  }
}

// -----------------------------------------------------------------------------
// Dialeto Google Gemini (API nativa)
// -----------------------------------------------------------------------------
class GeminiProvider extends ProviderBase {
  protected requisicao(req: { prompt: string; instrucao: string; paginas: ImagemPagina[] }) {
    const url = `${baseUrl(this.cfg)}/v1beta/models/${encodeURIComponent(this.modelo)}:generateContent`;
    return {
      url,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.chave() },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.prompt }] },
          contents: [
            {
              role: "user",
              parts: [
                { text: req.instrucao },
                ...req.paginas.map((p) => ({
                  inlineData: { mimeType: "image/jpeg", data: p.base64 },
                })),
              ],
            },
          ],
          ...(req.paginas.length
            ? { generationConfig: { responseMimeType: "application/json" } }
            : {}),
        }),
      } as RequestInit,
    };
  }

  protected extrair(json: unknown): string {
    const j = json as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  }
}

// -----------------------------------------------------------------------------
// Dialeto OpenAI Chat Completions (OpenAI, OpenRouter, Groq, Azure, Bedrock,
// Vertex, Ollama, Lovable Gateway e personalizados)
// -----------------------------------------------------------------------------
class OpenAICompatProvider extends ProviderBase {
  protected requisicao(req: { prompt: string; instrucao: string; paginas: ImagemPagina[] }) {
    const chave = this.chave();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.cfg.tipo === "lovable") {
      headers["Lovable-API-Key"] = chave;
    } else if (chave) {
      headers.Authorization = `Bearer ${chave}`;
      if (this.cfg.tipo === "azure_openai") headers["api-key"] = chave;
    }

    const conteudo: unknown[] = [
      { type: "text", text: req.instrucao },
      ...req.paginas.map((p) => ({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${p.base64}` },
      })),
    ];

    const body: Record<string, unknown> = {
      model: this.modelo,
      messages: [
        { role: "system", content: req.prompt },
        { role: "user", content: req.paginas.length ? conteudo : req.instrucao },
      ],
    };
    if (req.paginas.length) body.response_format = { type: "json_object" };
    if (/^openai\/gpt-5\.6/.test(this.modelo) || this.cfg.tipo === "lovable") {
      body.reasoning_effort = "none";
    }

    return {
      url: `${baseUrl(this.cfg)}/chat/completions`,
      init: { method: "POST", headers, body: JSON.stringify(body) } as RequestInit,
    };
  }

  protected extrair(json: unknown): string {
    const j = json as { choices?: { message?: { content?: string } }[] };
    return j.choices?.[0]?.message?.content ?? "";
  }
}

// -----------------------------------------------------------------------------
// Dialeto Anthropic Messages
// -----------------------------------------------------------------------------
class AnthropicProvider extends ProviderBase {
  protected requisicao(req: { prompt: string; instrucao: string; paginas: ImagemPagina[] }) {
    return {
      url: `${baseUrl(this.cfg)}/messages`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.chave(),
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.modelo,
          max_tokens: 8192,
          system: req.prompt,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: req.instrucao },
                ...req.paginas.map((p) => ({
                  type: "image",
                  source: { type: "base64", media_type: "image/jpeg", data: p.base64 },
                })),
              ],
            },
          ],
        }),
      } as RequestInit,
    };
  }

  protected extrair(json: unknown): string {
    const j = json as { content?: { type?: string; text?: string }[] };
    return (j.content ?? []).map((c) => c.text ?? "").join("");
  }
}

const FABRICAS: Record<Dialeto, new (cfg: ProvedorRuntime) => AIProvider> = {
  gemini: GeminiProvider,
  openai: OpenAICompatProvider,
  anthropic: AnthropicProvider,
};

/** Fábrica única: transforma a linha do banco em um `AIProvider`. */
export function criarProvider(cfg: ProvedorRuntime): AIProvider {
  const Classe = FABRICAS[definicao(cfg.tipo).dialeto];
  return new Classe(cfg);
}
