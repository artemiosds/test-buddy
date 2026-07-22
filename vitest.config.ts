import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Config isolado para testes unitários — não carrega TanStack Start/Nitro.
// - Arquivos .test.ts → lógica pura (Node).
// - Arquivos .test.tsx → hooks/adaptadores com @testing-library/react + msw (jsdom).
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: false,
    setupFiles: ["src/test/setup.ts"],
    environmentMatchGlobs: [
      ["src/**/*.test.tsx", "jsdom"],
      ["src/**/*.test.ts", "node"],
    ],
    env: {
      VITE_SUPABASE_URL: "http://supabase.test",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key",
    },
  },
});
