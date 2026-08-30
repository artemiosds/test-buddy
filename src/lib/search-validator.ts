import { z } from "zod";

/**
 * Helper local que substitui `@tanstack/zod-adapter` (removido por conflito
 * de peer dependency: o adapter exige `zod@^3.23.8` e o projeto usa zod 4).
 *
 * O TanStack Router aceita schemas Standard Schema diretamente em
 * `validateSearch` — o zod 4 já implementa `~standard`, então basta passar o
 * próprio schema. Este arquivo mantém apenas o `fallback` do adapter.
 */

/** Equivalente ao `fallback(schema, valor)` do adapter: em caso de falha, usa o valor padrão. */
export function fallback<S extends z.ZodType>(schema: S, valor: z.input<S>): S {
  return schema.catch(valor as z.output<S>) as unknown as S;
}
