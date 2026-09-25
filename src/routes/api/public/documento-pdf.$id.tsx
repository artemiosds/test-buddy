import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/documento-pdf/$id')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const id = params.id
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

        // 1. Busca os metadados do documento (aceita o id ou o código de validação)
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        const base = supabaseAdmin
          .from('documentos_assinados')
          .select('documento_tipo, status, pdf_storage_path, metadata, assinado_por_id')
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

        // 2. O original nunca é público: somente o autor ou um Master pode acessá-lo.
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
          return new Response('Acesso negado: autenticação obrigatória.', { status: 401 });
        }
        const token = authHeader.slice('Bearer '.length);
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
          return new Response('Sessão inválida ou expirada.', { status: 403 });
        }
        const { data: masterRole } = await supabaseAdmin
          .from('user_roles')
          .select('user_id')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();
        if (doc.assinado_por_id !== user.id && !masterRole) {
          return new Response('Acesso negado: somente o autor ou administrador Master.', { status: 403 });
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