import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/hsm-stream')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Implementação temporária para validar o endpoint
        return new Response('Streaming endpoint scaffolded', { status: 200 });
      }
    }
  }
});
