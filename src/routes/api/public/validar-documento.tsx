import { createFileRoute } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, XCircle, FileSearch, ShieldCheck } from 'lucide-react'

export const Route = createFileRoute('/api/public/validar-documento')({
  component: ValidarDocumentoPage,
})

function ValidarDocumentoPage() {
  const [hash, setHash] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [erro, setErro] = useState<string | null>(null)

  const validar = async () => {
    if (!hash) return
    setLoading(true)
    setErro(null)
    setResultado(null)

    try {
      const { data, error } = await supabase
        .from('documentos_assinados')
        .select(`
          id,
          tipo_documento,
          created_at,
          metadata,
          pdf_storage_path
        `)
        .eq('id', hash) // O ID do documento é o hash/UUID usado no QR Code
        .single()

      if (error || !data) {
        setErro('Documento não encontrado ou código inválido.')
      } else {
        setResultado(data)
      }
    } catch (err) {
      setErro('Erro ao processar validação.')
    } finally {
      setLoading(false)
    }
  }

  // Auto-validar se vier na URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('codigo')
    if (code) {
      setHash(code)
      // Pequeno delay para garantir que o estado do hash foi atualizado
      setTimeout(() => {
        const btn = document.getElementById('btn-validar')
        btn?.click()
      }, 100)
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <ShieldCheck className="w-12 h-12 text-royal-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Validador de Documentos</h1>
          <p className="text-slate-500 text-sm">Portal de Autenticidade - SMS Oriximiná</p>
        </div>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-lg">Verificar Código</CardTitle>
            <CardDescription>
              Insira o código verificador (hash) presente no rodapé do documento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input 
                placeholder="Ex: 550e8400-e29b-41d4-a716-446655440000"
                value={hash}
                onChange={(e) => setHash(e.target.value)}
                className="font-mono text-sm"
              />
              <Button 
                id="btn-validar"
                onClick={validar} 
                disabled={loading || !hash}
                className="bg-royal-600 hover:bg-royal-700"
              >
                {loading ? '...' : <FileSearch className="w-4 h-4" />}
              </Button>
            </div>

            {erro && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                {erro}
              </div>
            )}

            {resultado && (
              <div className="p-4 bg-green-50 border border-green-100 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-green-700 font-semibold">
                  <CheckCircle2 className="w-5 h-5" />
                  Documento Autêntico
                </div>
                
                <div className="text-sm text-slate-600 space-y-1">
                  <p><strong>Tipo:</strong> {resultado.tipo_documento?.toUpperCase()}</p>
                  <p><strong>Emitido em:</strong> {new Date(resultado.created_at).toLocaleString('pt-BR')}</p>
                  <p><strong>ID:</strong> <span className="font-mono text-xs">{resultado.id}</span></p>
                </div>

                <Button 
                  variant="outline" 
                  className="w-full mt-2 border-green-200 text-green-700 hover:bg-green-100"
                  onClick={() => window.open(`/api/public/documento-pdf/${resultado.id}`, '_blank')}
                >
                  Visualizar Documento Original
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400">
          Este portal permite a qualquer cidadão verificar a integridade de documentos digitais emitidos pelo sistema HSM Gestão.
        </p>
      </div>
    </div>
  )
}
