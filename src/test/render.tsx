import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderHookOptions, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function withQueryClient(client = makeQueryClient()) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { Wrapper, client };
}

export function renderHookWithQuery<TProps, TResult>(
  hook: (props: TProps) => TResult,
  options?: Omit<RenderHookOptions<TProps>, "wrapper"> & { client?: QueryClient },
) {
  const { Wrapper, client } = withQueryClient(options?.client);
  return { ...renderHook(hook, { ...options, wrapper: Wrapper }), client };
}

export { render };