import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

export const Route = createFileRoute('/api/public/hsm-stream')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const encoder = new TextEncoder();
        
        // Em um cenário real, aqui leríamos o body para pegar o texto, conversaId, etc.
        // e passaríamos para a lógica de IA que suporta streaming.
        
        const stream = new ReadableStream({
          async start(controller) {
            const send = (data: any) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            try {
              // Simulando a resposta imediata para saudações ou transição para tools
              send({ type: 'status', message: 'Iniciando processamento HSM Expert...' });
              
              const body = await request.json().catch(() => ({}));
              const texto = body.texto?.toLowerCase() || "";
              
              // Lógica de "Olá" instantâneo no Streaming
              if (texto === "olá" || texto === "oi" || texto === "bom dia" || texto === "boa tarde") {
                const saudacao = "Olá! Como posso ajudar você hoje com a Gestão da Saúde e os dados da sua unidade?";
                send({ type: 'content', chunk: saudacao });
                send({ type: 'status', message: 'Resposta concluída.' });
                controller.close();
                return;
              }

              // Feedback visual imediato se for uma consulta complexa
              send({ type: 'content', chunk: "_Analisando os dados da unidade e processando sua solicitação..._\n\n" });
              
              // Simulação da resolução da IA/Tool
              await new Promise(r => setTimeout(r, 800));
              
              const chunks = [
                "Localizei os dados solicitados. ",
                "A performance foi otimizada via execução paralela no backend. ",
                "\n\nPosso ajudar com mais alguma análise?"
              ];

              for (const chunk of chunks) {
                send({ type: 'content', chunk });
                await new Promise(r => setTimeout(r, 50));
              }
              
              send({ type: 'status', message: 'Resposta concluída.' });
              controller.close();
            } catch (err) {
              send({ type: 'error', message: err instanceof Error ? err.message : 'Erro no streaming' });
              controller.close();
            }
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      }
    }
  }
});
