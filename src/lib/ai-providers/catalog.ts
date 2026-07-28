/**
 * Catálogo de provedores de IA (client-safe).
 *
 * Nenhuma chave, nenhum acesso de rede aqui — apenas metadados usados tanto
 * pela tela de administração quanto pelo runtime do servidor.
 *
 * Para adicionar um novo provedor basta acrescentar uma entrada aqui e, se
 * necessário, um novo dialeto em `runtime.server.ts`. O Motor de Importação
 * não muda.
 */

/** Protocolo HTTP usado na chamada de visão. */
export type Dialeto = "gemini" | "openai" | "anthropic";

export type TipoProvedor =
  | "gemini"
  | "openai"
  | "anthropic"
  | "openrouter"
  | "groq"
  | "azure_openai"
  | "bedrock"
  | "vertex"
  | "ollama"
  | "lovable"
  | "custom";

export type DefinicaoProvedor = {
  tipo: TipoProvedor;
  nome: string;
  fornecedor: string;
  dialeto: Dialeto;
  baseUrlPadrao: string;
  /** Sugestões de modelo — o campo continua livre para digitação. */
  modelos: string[];
  modeloPadrao: string;
  /** Alguns provedores não exigem chave (Ollama local, gateway Lovable). */
  exigeChave: boolean;
  descricao: string;
};

export const PROVEDORES: DefinicaoProvedor[] = [
  {
    tipo: "gemini",
    nome: "Google Gemini",
    fornecedor: "Google AI",
    dialeto: "gemini",
    baseUrlPadrao: "https://generativelanguage.googleapis.com",
    modelos: ["gemini-3.6-flash", "gemini-3.1-pro", "gemini-2.5-flash", "gemini-2.5-pro"],
    modeloPadrao: "gemini-3.6-flash",
    exigeChave: true,
    descricao: "API nativa do Google AI Studio.",
  },
  {
    tipo: "openai",
    nome: "OpenAI",
    fornecedor: "OpenAI",
    dialeto: "openai",
    baseUrlPadrao: "https://api.openai.com/v1",
    modelos: ["gpt-4.1", "gpt-4o", "gpt-4o-mini", "gpt-5", "gpt-5-mini"],
    modeloPadrao: "gpt-4o",
    exigeChave: true,
    descricao: "Chat Completions com entrada de imagem.",
  },
  {
    tipo: "anthropic",
    nome: "Anthropic Claude",
    fornecedor: "Anthropic",
    dialeto: "anthropic",
    baseUrlPadrao: "https://api.anthropic.com/v1",
    modelos: ["claude-4-opus", "claude-4-sonnet", "claude-3.7-sonnet"],
    modeloPadrao: "claude-4-sonnet",
    exigeChave: true,
    descricao: "API Messages da Anthropic.",
  },
  {
    tipo: "openrouter",
    nome: "OpenRouter",
    fornecedor: "OpenRouter",
    dialeto: "openai",
    baseUrlPadrao: "https://openrouter.ai/api/v1",
    modelos: [
      "openai/gpt-5",
      "google/gemini-3.6-flash",
      "anthropic/claude-4-sonnet",
      "deepseek/deepseek-chat",
      "qwen/qwen3",
      "meta/llama-4",
    ],
    modeloPadrao: "google/gemini-3.6-flash",
    exigeChave: true,
    descricao: "Qualquer modelo disponível no catálogo do OpenRouter.",
  },
  {
    tipo: "groq",
    nome: "Groq",
    fornecedor: "Groq",
    dialeto: "openai",
    baseUrlPadrao: "https://api.groq.com/openai/v1",
    modelos: ["llama-4", "deepseek", "qwen", "mixtral"],
    modeloPadrao: "llama-4",
    exigeChave: true,
    descricao: "Inferência de baixa latência.",
  },
  {
    tipo: "azure_openai",
    nome: "Azure OpenAI",
    fornecedor: "Microsoft Azure",
    dialeto: "openai",
    baseUrlPadrao: "https://SEU-RECURSO.openai.azure.com/openai/v1",
    modelos: ["gpt-4o", "gpt-4o-mini", "gpt-4.1"],
    modeloPadrao: "gpt-4o",
    exigeChave: true,
    descricao: "Informe a URL do seu recurso (deployment) na Azure.",
  },
  {
    tipo: "bedrock",
    nome: "AWS Bedrock",
    fornecedor: "Amazon Web Services",
    dialeto: "openai",
    baseUrlPadrao: "https://bedrock-runtime.us-east-1.amazonaws.com/openai/v1",
    modelos: ["anthropic.claude-sonnet-4", "meta.llama4", "amazon.nova-pro"],
    modeloPadrao: "anthropic.claude-sonnet-4",
    exigeChave: true,
    descricao: "Endpoint compatível com OpenAI do Bedrock.",
  },
  {
    tipo: "vertex",
    nome: "Vertex AI",
    fornecedor: "Google Cloud",
    dialeto: "openai",
    baseUrlPadrao:
      "https://us-central1-aiplatform.googleapis.com/v1/projects/SEU-PROJETO/locations/us-central1/endpoints/openapi",
    modelos: ["google/gemini-3.6-flash", "google/gemini-2.5-pro"],
    modeloPadrao: "google/gemini-3.6-flash",
    exigeChave: true,
    descricao: "Endpoint OpenAPI do Vertex AI (token de acesso como chave).",
  },
  {
    tipo: "ollama",
    nome: "Ollama (Servidor Local)",
    fornecedor: "Ollama",
    dialeto: "openai",
    baseUrlPadrao: "http://localhost:11434/v1",
    modelos: ["llama3", "qwen3", "deepseek", "phi4", "gemma3"],
    modeloPadrao: "llama3",
    exigeChave: false,
    descricao: "Servidor local — o documento não sai da rede interna.",
  },
  {
    tipo: "lovable",
    nome: "Lovable AI Gateway",
    fornecedor: "Lovable",
    dialeto: "openai",
    baseUrlPadrao: "https://ai.gateway.lovable.dev/v1",
    modelos: [
      "openai/gpt-5.6-sol",
      "google/gemini-3.6-flash",
      "openai/gpt-5.4-mini",
      "google/gemini-3.1-pro-preview",
    ],
    modeloPadrao: "openai/gpt-5.6-sol",
    exigeChave: false,
    descricao: "Usa a chave já provisionada no ambiente (LOVABLE_API_KEY).",
  },
  {
    tipo: "custom",
    nome: "Provedor Personalizado",
    fornecedor: "Personalizado",
    dialeto: "openai",
    baseUrlPadrao: "",
    modelos: [],
    modeloPadrao: "",
    exigeChave: false,
    descricao: "Qualquer endpoint compatível com OpenAI Chat Completions.",
  },
];

export function definicao(tipo: string): DefinicaoProvedor {
  return PROVEDORES.find((p) => p.tipo === tipo) ?? PROVEDORES[PROVEDORES.length - 1];
}

export type MetricasProvedor = {
  execucoes: number;
  sucessos: number;
  falhas: number;
  timeouts: number;
  erros_429: number;
  erros_503: number;
  pdfs: number;
  tempo_medio_ms: number | null;
  tempo_min_ms: number | null;
  tempo_max_ms: number | null;
  confianca_media: number | null;
  ultima_utilizacao: string | null;
  ultimo_erro: string | null;
};

export type ProvedorPublico = {
  id: string;
  tipo: TipoProvedor;
  nome: string;
  modelo: string;
  base_url: string | null;
  timeout_ms: number;
  tentativas: number;
  prioridade: number;
  ativo: boolean;
  extra: Record<string, string | number | boolean | null>;
  tem_chave: boolean;
  chave_final4: string | null;
  metricas: MetricasProvedor;
};

export type IaConfig = { modo: "automatico" | "manual"; provedor_id: string | null };
