import { setupServer } from "msw/node";

// Servidor MSW compartilhado. Handlers são registrados por teste via server.use().
export const server = setupServer();
