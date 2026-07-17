import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Config isolado para testes unitários — não carrega TanStack Start/Nitro.
// Usado somente para lógica pura (agregações, regras de alerta) sem
// dependências de rede, DOM ou SSR.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
});