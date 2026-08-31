/**
 * Storage no Cloudflare R2 (API S3) — módulo SERVER-ONLY.
 *
 * Nunca importe este arquivo de componentes ou de código client-side: ele lê
 * as credenciais do R2 (`R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`,
 * `R2_SECRET_ACCESS_KEY`) do ambiente do servidor.
 *
 * Regras:
 * - Nenhum arquivo é servido por URL pública. Toda leitura usa URL assinada
 *   temporária (5 minutos por padrão).
 * - O upload nunca acontece com credencial no navegador: o servidor gera uma
 *   URL assinada de PUT e o navegador envia o arquivo direto para ela.
 * - Arquivos legados continuam no Supabase Storage; nada é migrado.
 */

import { AwsClient } from "aws4fetch";

/** Prefixo gravado em `documentos.storage_path` para arquivos no R2. */
export const R2_PREFIXO = "r2:";

/** Validade padrão das URLs assinadas de leitura (segundos). */
export const R2_LEITURA_SEGUNDOS = 300;

/** Validade da URL assinada de upload (segundos). */
export const R2_UPLOAD_SEGUNDOS = 600;

export function isCaminhoR2(valor: string | null | undefined): boolean {
  return !!valor && valor.startsWith(R2_PREFIXO);
}

/** Remove o prefixo `r2:` e devolve a chave real do objeto no bucket. */
export function chaveR2(valor: string): string {
  return isCaminhoR2(valor) ? valor.slice(R2_PREFIXO.length) : valor;
}

type ConfigR2 = {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function lerConfig(): ConfigR2 | null {
  const accountId = process.env["R2_ACCOUNT_ID"];
  const bucket = process.env["R2_BUCKET_NAME"];
  const accessKeyId = process.env["R2_ACCESS_KEY_ID"];
  const secretAccessKey = process.env["R2_SECRET_ACCESS_KEY"];
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { accountId, bucket, accessKeyId, secretAccessKey };
}

/** Provider desejado: `r2` (padrão) ou `supabase` (desliga o R2). */
export function providerConfigurado(): "r2" | "supabase" {
  const flag = (process.env["STORAGE_PROVIDER"] ?? "r2").trim().toLowerCase();
  return flag === "supabase" ? "supabase" : "r2";
}

/** true quando o R2 está habilitado e com todas as credenciais presentes. */
export function r2Disponivel(): boolean {
  return providerConfigurado() === "r2" && lerConfig() !== null;
}

function cliente(cfg: ConfigR2): AwsClient {
  return new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    service: "s3",
    region: "auto",
  });
}

function urlObjeto(cfg: ConfigR2, key: string): string {
  const partes = key
    .split("/")
    .filter(Boolean)
    .map((p) => encodeURIComponent(p))
    .join("/");
  return `https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}/${partes}`;
}

function exigirConfig(): ConfigR2 {
  const cfg = lerConfig();
  if (!cfg) throw new Error("Cloudflare R2 não configurado no servidor.");
  return cfg;
}

/** URL assinada de PUT para o navegador enviar o arquivo direto ao R2. */
export async function criarUrlUpload(
  key: string,
  mime: string,
  expiraEm: number = R2_UPLOAD_SEGUNDOS,
): Promise<string> {
  const cfg = exigirConfig();
  const alvo = new URL(urlObjeto(cfg, key));
  alvo.searchParams.set("X-Amz-Expires", String(expiraEm));
  const assinada = await cliente(cfg).sign(
    new Request(alvo.toString(), { method: "PUT", headers: { "content-type": mime } }),
    { aws: { signQuery: true, allHeaders: false } },
  );
  return assinada.url;
}

/** URL assinada de GET (curta duração) — nunca URL pública. */
export async function criarUrlLeitura(
  key: string,
  expiraEm: number = R2_LEITURA_SEGUNDOS,
): Promise<string | null> {
  const cfg = lerConfig();
  if (!cfg) return null;
  const alvo = new URL(urlObjeto(cfg, chaveR2(key)));
  alvo.searchParams.set("X-Amz-Expires", String(expiraEm));
  const assinada = await cliente(cfg).sign(new Request(alvo.toString(), { method: "GET" }), {
    aws: { signQuery: true },
  });
  return assinada.url;
}

/** Resultado tipado de uma tentativa de exclusão no R2. */
export type ResultadoRemocao = {
  ok: boolean;
  motivo: "removido" | "inexistente" | "retencao" | "indisponivel" | "erro";
  status?: number;
  detalhe?: string;
};

/** Detecta a recusa do bucket lock (retenção indefinida) do Cloudflare R2. */
function ehRetencao(status: number, corpo: string): boolean {
  if (status === 403 || status === 423) return true;
  return /ObjectLock|Retention|WORM|AccessDenied|InvalidRequest/i.test(corpo);
}

/**
 * Exclusão física de um objeto no R2.
 *
 * ATENÇÃO: o bucket opera com bloqueio indefinido (object lock). Esta função
 * NÃO deve ser chamada por nenhum fluxo automático de anexos — a remoção de
 * documentos é sempre soft-delete. Continua disponível apenas para o arquivo
 * descartável do diagnóstico e sempre devolve resultado tipado, nunca lança.
 */
export async function removerArquivo(key: string): Promise<ResultadoRemocao> {
  const cfg = lerConfig();
  if (!cfg) return { ok: false, motivo: "indisponivel" };
  try {
    const res = await cliente(cfg).fetch(urlObjeto(cfg, chaveR2(key)), { method: "DELETE" });
    if (res.status === 404) return { ok: true, motivo: "inexistente", status: 404 };
    if (res.ok) return { ok: true, motivo: "removido", status: res.status };
    const corpo = await res.text().catch(() => "");
    if (ehRetencao(res.status, corpo)) {
      console.warn("[storage-r2] exclusão recusada por retenção do bucket:", {
        key: chaveR2(key),
        status: res.status,
      });
      return { ok: false, motivo: "retencao", status: res.status, detalhe: corpo.slice(0, 300) };
    }
    console.error("[storage-r2] falha ao excluir objeto:", { key: chaveR2(key), status: res.status });
    return { ok: false, motivo: "erro", status: res.status, detalhe: corpo.slice(0, 300) };
  } catch (e) {
    console.error("[storage-r2] erro de rede ao excluir objeto:", (e as Error)?.message);
    return { ok: false, motivo: "erro", detalhe: (e as Error)?.message };
  }
}

/**
 * HEAD no R2 para saber se o binário ainda existe.
 * Usado na listagem para não entregar link que abriria erro `NoSuchKey`.
 * Em caso de indisponibilidade do R2 assume `true` (não esconde o anexo).
 */
export async function objetoExisteR2(key: string): Promise<boolean> {
  const cfg = lerConfig();
  if (!cfg) return true;
  try {
    const res = await cliente(cfg).fetch(urlObjeto(cfg, chaveR2(key)), { method: "HEAD" });
    return res.status !== 404;
  } catch {
    return true;
  }
}

/**
 * Confere no R2 se o objeto existe e respeita o limite de tamanho.
 * O objeto NUNCA é apagado aqui (bucket com retenção): quando inválido, o
 * upload é apenas rejeitado e o ocorrido registrado em log.
 */
export async function validarObjeto(
  key: string,
  limiteBytes: number,
): Promise<{ ok: true; tamanho: number }> {
  const cfg = exigirConfig();
  const res = await cliente(cfg).fetch(urlObjeto(cfg, chaveR2(key)), { method: "HEAD" });
  if (!res.ok) {
    throw new Error(`Arquivo não encontrado no R2 após o envio (${res.status}).`);
  }
  const tamanho = Number(res.headers.get("content-length") ?? 0);
  if (tamanho <= 0) {
    console.warn("[storage-r2] objeto vazio mantido por retenção:", { key: chaveR2(key) });
    throw new Error("Arquivo vazio.");
  }
  if (tamanho > limiteBytes) {
    console.warn("[storage-r2] objeto acima do limite mantido por retenção:", {
      key: chaveR2(key),
      tamanho,
    });
    throw new Error("Arquivo maior que o limite permitido.");
  }
  return { ok: true, tamanho };
}


type SupabaseLike = {
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (
        path: string,
        expiresIn: number,
      ) => Promise<{ data: { signedUrl: string } | null }>;
      remove: (paths: string[]) => Promise<{ error: { message: string } | null }>;
    };
  };
};

/**
 * URL de visualização retrocompatível:
 * - `r2:...`  -> URL assinada do Cloudflare R2 (5 min)
 * - demais    -> URL assinada do Supabase Storage (comportamento legado)
 */
export async function assinarUrlDocumento(
  supabase: SupabaseLike,
  storagePath: string | null | undefined,
  opcoes?: { bucket?: string; expiraEm?: number },
): Promise<string | null> {
  const alvo = (storagePath ?? "").trim();
  if (!alvo) return null;
  if (/^https?:\/\//i.test(alvo)) return alvo;
  const expiraEm = opcoes?.expiraEm ?? R2_LEITURA_SEGUNDOS;
  if (isCaminhoR2(alvo)) {
    try {
      return await criarUrlLeitura(alvo, expiraEm);
    } catch {
      return null;
    }
  }
  const { data } = await supabase.storage
    .from(opcoes?.bucket ?? "documentos")
    .createSignedUrl(alvo, expiraEm);
  return data?.signedUrl ?? null;
}

/**
 * Remoção de binário do destino legado.
 *
 * Para caminhos `r2:` a exclusão é PROIBIDA (bucket com retenção indefinida):
 * a função apenas registra em log e devolve `retencao`, sem tocar no objeto.
 */
export async function removerDocumento(
  supabase: SupabaseLike,
  storagePath: string,
  bucket = "documentos",
): Promise<ResultadoRemocao> {
  if (isCaminhoR2(storagePath)) {
    console.warn("[storage-r2] exclusão ignorada (retenção indefinida):", {
      key: chaveR2(storagePath),
    });
    return { ok: false, motivo: "retencao" };
  }
  const { error } = await supabase.storage.from(bucket).remove([storagePath]);
  if (error) {
    console.error("[storage] falha ao excluir no Supabase Storage:", error.message);
    return { ok: false, motivo: "erro", detalhe: error.message };
  }
  return { ok: true, motivo: "removido" };
}

