import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

export const Route = createFileRoute('/api/public/documento-pdf/$id')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const id = params.id

        // 1. Busca os metadados do documento
        const { data: doc, error } = await supabaseAdmin
          .from('documentos_assinados')
          .select('documento_tipo, metadata')
          .eq('id', id)
          .single()

        const storagePath = (doc?.metadata as any)?.pdf_storage_path;

        if (error || !storagePath) {
          return new Response('PDF não encontrado', { status: 404 })
        }

        // 2. Valida se o documento exige autenticação (LGPD)
        // Documentos de Frequência, Folha e Piso contêm CPFs e dados salariais sensíveis.
        const tiposSensiveis = ['frequencia', 'folha_efetivos', 'folha_contratados', 'piso'];
        const isSensivel = tiposSensiveis.includes(doc.documento_tipo);

        if (isSensivel) {
          // Verifica se o usuário está autenticado
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) {
             return new Response('Acesso negado: Este documento contém dados sensíveis e exige autenticação.', { status: 401 });
          }
          
          const token = authHeader.replace('Bearer ', '');
          const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
          
          if (authError || !user) {
            return new Response('Sessão inválida ou expirada.', { status: 403 });
          }
        }

        // 3. Download do PDF do storage
        const { data, error: downloadError } = await supabaseAdmin.storage
          .from('documentos-assinados')
          .download(storagePath)

        if (downloadError || !data) {
          return new Response('Erro ao baixar PDF do storage', { status: 500 })
        }

        return new Response(data, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="documento-${id}.pdf"`,
            'Cache-Control': 'private, max-age=3600'
          },
        })
      },
    },
  },
})