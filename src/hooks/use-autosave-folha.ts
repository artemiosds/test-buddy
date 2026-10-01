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
   * Marca uma NOVA edição para gravação imediata e aguarda o backend.
   * Se já houver uma rodada em voo, a nova alteração fica pendente e será
   * processada logo depois, sem concorrência.
   */
  const saveNow = useCallback(async (): Promise<boolean> => {
    if (!enabledRef.current) return true;
    clearTimer();
    pendingRef.current = true;
    if (processingRef.current) return processingRef.current;
    return drain();
  }, [clearTimer, drain]);

  /**
   * Apenas drena/aguarda o que já está pendente.
   * Usado antes de navegar, trocar contexto, salvar manualmente ou enviar.
   * Não cria rodada extra quando uma gravação já está em andamento.
   */
  const flush = useCallback(async (): Promise<boolean> => {
    if (!enabledRef.current) return true;
    clearTimer();
    if (processingRef.current) return processingRef.current;
    if (!pendingRef.current) return true;
    return drain();
  }, [clearTimer, drain]);

  const retry = useCallback(async (): Promise<boolean> => {
    // Após erro pendingRef permanece true.
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

  return { status, schedule, saveNow, flush, retry, discardPending, hasPending };
}
