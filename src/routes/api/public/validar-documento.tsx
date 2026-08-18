import { createFileRoute } from "@tanstack/react-router";
import { useSearch, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, FileCheck, Calendar, User, Search, ExternalLink, Hash, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/api/public/validar-documento")({
  component: ValidarDocumentoPage,
});

function ValidarDocumentoPage() {
  const search = useSearch({ strict: false }) as { codigo?: string };
  const [inputHash, setInputHash] = useState(search.codigo || "");
  const [hashToSearch, setHashToSearch] = useState(search.codigo || "");

  const { data: doc, isLoading, error } = useQuery({
    queryKey: ["validar-documento", hashToSearch],
    queryFn: async () => {
      if (!hashToSearch) return null;
      const { data, error } = await supabase
        .from("documentos_assinados")
        .select("*")
        .or(`codigo_validacao.eq."${hashToSearch}",id.eq."${hashToSearch}"`)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!hashToSearch,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setHashToSearch(inputHash);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 font-sans">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header Institucional */}
        <div className="bg-slate-900 text-white p-8 text-center space-y-4">
          <div className="flex justify-center mb-2">
            <ShieldCheck className="w-16 h-16 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Portal de Autenticidade Digital</h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Verifique a validade jurídica de documentos emitidos pela Secretaria Municipal de Saúde de Oriximiná.
          </p>
        </div>

        <div className="p-8 space-y-8">
          {/* Busca */}
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Código de Autenticidade (Hash)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    value={inputHash}
                    onChange={(e) => setInputHash(e.target.value)}
                    placeholder="Ex: 550e8400-e29b-41d4-a716-446655440000"
                    className="pl-10 h-12 text-lg font-mono border-slate-300 focus:ring-blue-500 rounded-xl"
                  />
                </div>
                <Button type="submit" className="h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex gap-2">
                  <Search className="w-4 h-4" />
                  Validar
                </Button>
              </div>
            </div>
          </form>

          {/* Resultado */}
          {isLoading && (
            <div className="flex flex-col items-center py-12 text-slate-400 gap-3">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p>Consultando base de dados oficial...</p>
            </div>
          )}

          {doc && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-6 flex items-start gap-4">
                <div className="bg-emerald-500 p-2 rounded-full">
                  <FileCheck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-emerald-900 font-bold text-lg">Documento Autêntico</h3>
                  <p className="text-emerald-700 text-sm">
                    Este documento foi emitido pelo sistema oficial e não sofreu alterações desde sua assinatura.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-slate-600">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Data de Emissão</p>
                      <p className="font-medium">
                        {doc.assinado_em 
                          ? format(new Date(doc.assinado_em), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
                          : "Data não disponível"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <User className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Assinado por</p>
                      <p className="font-medium">{doc.nome_assinante || "Assinatura Institucional"}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-slate-600">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Tipo de Documento</p>
                      <p className="font-medium capitalize">{doc.documento_tipo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <ExternalLink className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Código de Validação</p>
                      <p className="font-mono text-[11px] break-all">{doc.codigo_validacao}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Visualização restrita: apenas para documentos que não contenham dados sensíveis
                  ou para usuários autenticados (verificado no servidor) */}
              <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col items-center gap-4 text-center">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-xs max-w-sm">
                  <p className="font-semibold mb-1">Nota sobre Privacidade (LGPD):</p>
                  <p>Por segurança, documentos contendo dados pessoais sensíveis (como CPFs ou salários) exigem autenticação para visualização completa.</p>
                </div>

                {doc.id && (
                  <a href={`/api/public/documento-pdf/${doc.id}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="gap-2 border-slate-300 hover:bg-slate-50 rounded-xl px-8 h-12">
                      <ExternalLink className="w-4 h-4" />
                      Visualizar Documento Original
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}

          {hashToSearch && !doc && !isLoading && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center space-y-3 animate-in shake duration-500">
              <div className="flex justify-center">
                <div className="bg-red-100 p-3 rounded-full text-red-600">
                  <Search className="w-8 h-8" />
                </div>
              </div>
              <h3 className="text-red-900 font-bold text-lg">Documento Não Encontrado</h3>
              <p className="text-red-700 text-sm max-w-sm mx-auto">
                O código informado não corresponde a nenhum documento registrado em nossa base oficial. Verifique se o código está correto.
              </p>
            </div>
          )}
        </div>
      </div>
      
      <p className="mt-8 text-slate-400 text-xs text-center max-w-md">
        HSM Gestão © {new Date().getFullYear()} - Sistema de Gestão da Saúde de Oriximiná.
        <br />
        A autenticidade digital garante a integridade e a origem dos documentos públicos.
      </p>
    </div>
  );
}
