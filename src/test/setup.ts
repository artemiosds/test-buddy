// Setup global de testes: MSW + polyfills para jsdom.
// Handlers padrão vazios; cada teste registra via `server.use(...)`.
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw-server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());