import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

export const Route = createFileRoute('/api/public/documento-pdf/$id')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const id = params.id

        // 1. Busca os metadados do documento (aceita o id ou o código de validação)
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        const base = supabaseAdmin
          .from('documentos_assinados')
          .select('documento_tipo, status, pdf_storage_path, metadata')
        const { data: doc, error } = await (uuidRe.test(id)
          ? base.eq('id', id)
          : base.eq('codigo_validacao', id)
        ).maybeSingle()

        if (error || !doc) {
          return new Response('Documento não encontrado', { status: 404 })
        }

        if (doc.status === 'revogado') {
          return new Response('Documento revogado', { status: 410 })
        }

        const storagePath =
          doc.pdf_storage_path ?? (doc.metadata as any)?.pdf_storage_path ?? null

        if (!storagePath) {
          return new Response('PDF original não disponível para este documento', { status: 404 })
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