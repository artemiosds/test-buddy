import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

type Options = {
  /** Só agenda/executa quando true (folha editável). */
  enabled: boolean;
  /** Executa a gravação das linhas pendentes. Deve resolver após confirmação do servidor. */
  run: () => Promise<boolean>;
  /** Debounce em ms (padrão 900). */
  delay?: number;
  /** Recebe a falha real do backend para feedback ao usuário. */
  onError?: (error: unknown) => void;
};

/**
 * Autosalvamento em segundo plano com debounce e fila SERIAL.
 *
 * Garantias:
 * - nunca executa duas gravações simultâneas;
 * - se houver nova alteração durante uma gravação, processa outra rodada depois;
 * - "saved" só é publicado quando toda a fila foi confirmada pelo backend;
 * - em falha, mantém a fila pendente para retry;
 * - flush() aguarda a confirmação real e retorna true/false.
 */
export function useAutosaveFolha({ enabled, run, delay = 900, onError }: Options) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");

  const runRef = useRef(run);
  runRef.current = run;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);
  const processingRef = useRef<Promise<boolean> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /**
   * Drena a fila até não existir mais alteração pendente.
   * Chamadas concorrentes aguardam a MESMA promise.
   */
  const drain = useCallback(async (): Promise<boolean> => {
    if (!enabledRef.current) return true;
    if (processingRef.current) return processingRef.current;
    if (!pendingRef.current) return true;

    const work = (async () => {
      setStatus("saving");

      while (enabledRef.current && pendingRef.current) {
        // A rodada atual consome o pendente. Se o usuário editar enquanto
        // run() estiver aguardando o servidor, schedule/flush marca true outra vez.
        pendingRef.current = false;

        try {
          const persisted = await runRef.current();
          if (!persisted) {
            throw new Error("O servidor não confirmou a persistência das alterações.");
          }
        } catch (error) {
          console.error("AUTOSAVE: falha ao salvar", error);
          // Mantém a alteração na fila para retry; nada é descartado.
          pendingRef.current = true;
          setStatus("error");
          onErrorRef.current?.(error);
          return false;
        }
      }

      setStatus("saved");
      return true;
    })();

    processingRef.current = work;
    try {
      return await work;
    } finally {
      if (processingRef.current === work) processingRef.current = null;
    }
  }, []);

  const schedule = useCallback(() => {
    if (!enabledRef.current) return;
    pendingRef.current = true;
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void drain();
    }, delay);
  }, [clearTimer, delay, drain]);

  /**
   * Grava imediatamente e AGUARDA o backend.
   * É seguro chamar enquanto outra gravação está em andamento: a mesma fila
   * serial será drenada antes de resolver.
   */
  const flush = useCallback(async (): Promise<boolean> => {
    if (!enabledRef.current) return true;
    clearTimer();

    // Se já existe uma gravação em voo, apenas aguarda a mesma promise.
    // Uma nova edição ocorrida durante o envio é marcada por schedule()/flush()
    // através do pendingRef e será processada na próxima volta da fila.
    if (processingRef.current) return processingRef.current;

    // flush() também é o gatilho imediato usado pelos campos numéricos.
    // Sem esta marcação, a linha podia ficar _dirty sem iniciar o autosave,
    // mantendo o badge em "idle".
    pendingRef.current = true;
    return drain();
  }, [clearTimer, drain]);

  const retry = useCallback(async (): Promise<boolean> => {
    return flush();
  }, [flush]);

  /**
   * Usado somente quando o próprio usuário confirma sair mesmo após uma falha.
   * Não apaga estado da tela; apenas impede uma tentativa automática posterior
   * de um contexto (competência/unidade/setor) que já foi abandonado.
   */
  const discardPending = useCallback(() => {
    clearTimer();
    pendingRef.current = false;
    setStatus("idle");
  }, [clearTimer]);

  const hasPending = useCallback(
    () => pendingRef.current || processingRef.current !== null,
    [],
  );

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { status, schedule, flush, retry, discardPending, hasPending };
}
