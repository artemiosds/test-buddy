import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

export const Route = createFileRoute('/api/public/documento-pdf/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = params.id

        const { data: doc, error } = await supabaseAdmin
          .from('documentos_assinados')
          .select('pdf_storage_path')
          .eq('id', id)
          .single()

        if (error || !doc?.pdf_storage_path) {
          return new Response('PDF não encontrado', { status: 404 })
        }

        const { data, error: downloadError } = await supabaseAdmin.storage
          .from('documentos-assinados')
          .download(doc.pdf_storage_path)

        if (downloadError || !data) {
          return new Response('Erro ao baixar PDF do storage', { status: 500 })
        }

        return new Response(data, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="documento-${id}.pdf"`,
          },
        })
      },
    },
  },
})
