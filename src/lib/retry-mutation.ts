/**
 * Retry automático com backoff exponencial para mutações críticas — Sublote 8A.
 *
 * Uso pretendido: apenas em mutações IDEMPOTENTES (updates de status, rotação de
 * códigos, alteração de metadados). Nunca em INSERT que possa causar duplicata
 * observável pelo usuário (ex.: criar pendência, registrar assinatura, gravar
 * resposta) — nesses casos a falha deve ser propagada de imediato.
 *
 * Estratégia:
 *  - até 3 tentativas totais (1 inicial + 2 retries automáticos)
 *  - delays: 1s, 2s, 4s (`base * 2^attempt`, capped em 8s)
 *  - toast informativo com contador "Tentando novamente (N de MAX)…"
 *  - falha definitiva → toast de erro + `logger.error` com `requestId`
 *
 * Não usamos `retry`/`retryDelay` da TanStack Query porque precisamos exibir o
 * toast intermediário e emitir logs por transição — os callbacks nativos não
 * expõem esse hook. Definimos `retry: false` para não duplicar tentativas.
 */
import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { logger } from "./logger";

export interface RetryConfig {
  /** Nome estável da operação para telemetria (ex.: "frequencia.alterar_status"). */
  operation: string;
  /** Total de tentativas (inicial + retries). Default 3. */
  attempts?: number;
  /** Delay base em ms. Default 1000. */
  baseDelayMs?: number;
  /** Delay máximo em ms. Default 8000. */
  maxDelayMs?: number;
  /** Mostrar toast intermediário. Default true. */
  showToast?: boolean;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function randomRequestId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    // ignore
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Envolve uma função assíncrona com retry+backoff.
 * Exportado para uso fora de hooks (ex.: chamadas soltas ou testes).
 */
export function withRetry<TVars, TData>(
  fn: (vars: TVars) => Promise<TData>,
  config: RetryConfig,
): (vars: TVars) => Promise<TData> {
  const attempts = Math.max(1, config.attempts ?? 3);
  const base = config.baseDelayMs ?? 1000;
  const max = config.maxDelayMs ?? 8000;
  const showToast = config.showToast !== false;
  return async (vars: TVars) => {
    let toastId: string | number | undefined;
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await fn(vars);
        if (toastId !== undefined) toast.dismiss(toastId);
        if (i > 0) {
          logger.info(`${config.operation}.retry_sucesso`, {
            operation: config.operation,
            tentativa: i + 1,
          });
        }
        return res;
      } catch (err) {
        lastErr = err;
        const isLast = i === attempts - 1;
        if (isLast) {
          if (toastId !== undefined) toast.dismiss(toastId);
          const requestId = randomRequestId();
          logger.error(`${config.operation}.retry_esgotado`, {
            requestId,
            operation: config.operation,
            tentativas: attempts,
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }
        const delay = Math.min(base * 2 ** i, max);
        logger.warn(`${config.operation}.retry`, {
          operation: config.operation,
          tentativa: i + 1,
          proxima_em_ms: delay,
          error: err instanceof Error ? err.message : String(err),
        });
        if (showToast) {
          toastId = toast.loading(
            `Tentando novamente… (tentativa ${i + 2} de ${attempts})`,
            toastId !== undefined ? { id: toastId } : undefined,
          );
        }
        await sleep(delay);
      }
    }
    // Inalcançável, mas mantém o tipo de retorno satisfeito.
    throw lastErr;
  };
}

export type UseRetryMutationOptions<TData, TVars> = Omit<
  UseMutationOptions<TData, Error, TVars>,
  "mutationFn" | "retry" | "retryDelay"
> & {
  mutationFn: (vars: TVars) => Promise<TData>;
  retry: RetryConfig;
};

/**
 * Variante de `useMutation` com retry+backoff embutido.
 * Aplicar apenas quando a operação for idempotente.
 */
export function useRetryMutation<TData, TVars = void>(
  options: UseRetryMutationOptions<TData, TVars>,
): UseMutationResult<TData, Error, TVars> {
  const { mutationFn, retry, ...rest } = options;
  return useMutation<TData, Error, TVars>({
    ...rest,
    retry: false,
    mutationFn: withRetry(mutationFn, retry),
  });
}
