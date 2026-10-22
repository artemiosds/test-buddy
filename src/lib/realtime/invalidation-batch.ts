/** Coalesce a burst without postponing its flush indefinitely. */
export function createInvalidationBatch(flush: (keys: readonly (readonly string[])[]) => void, delay = 250) {
  const pending = new Map<string, readonly string[]>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    add(keys: readonly (readonly string[])[]) {
      for (const key of keys) pending.set(JSON.stringify(key), key);
      if (timer !== undefined) return;
      timer = setTimeout(() => {
        timer = undefined;
        const keys = [...pending.values()];
        pending.clear();
        flush(keys);
      }, delay);
    },
    dispose() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      pending.clear();
    },
  };
}