import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/validar/$id")({
  head: () => ({
    meta: [
      { title: "Validação de Documento — SMS Oriximiná" },
      {
        name: "description",
        content: "Verifique a autenticidade de um documento emitido pela Secretaria Municipal de Saúde.",
      },
    ],
  }),
  component: ValidarPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-red-600">Erro: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Documento não encontrado.</div>,
});

function ValidarPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["validar-doc", id],
    queryFn: async () => {
      // Consulta a VIEW pública restrita — NÃO expõe dados_json nem outros campos sensíveis.
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (col: string, val: string) => {
              maybeSingle: () => Promise<{
                data: {
                  id: string;
                  tipo: string;
                  descricao: string;
                  hash_conteudo: string;
                  assinado_por_nome: string | null;
                  assinado_em: string;
                } | null;
                error: Error | null;
              }>;
            };
          };
        };
      })
        .from("documentos_assinados_publico")
        .select("id, tipo, descricao, hash_conteudo, assinado_por_nome, assinado_em")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
        <header className="bg-emerald-700 text-white px-6 py-4 flex items-center gap-3">
          <ShieldCheck className="h-7 w-7" />
          <div>
            <h1 className="text-lg font-bold">Validação de Documento</h1>
            <p className="text-sm text-emerald-100">Prefeitura Municipal de Oriximiná — SMS</p>
          </div>
        </header>

        <div className="p-6 space-y-4">
          {isLoading ? (
            <p className="text-slate-500">Consultando…</p>
          ) : !data ? (
            <div className="flex items-start gap-3 rounded-md bg-red-50 border border-red-200 p-4">
              <XCircle className="h-6 w-6 text-red-600 shrink-0" />
              <div>
                <p className="font-semibold text-red-800">Documento não encontrado</p>
                <p className="text-sm text-red-700">
                  O identificador informado não corresponde a nenhum documento emitido oficialmente. Verifique
                  o ID impresso no PDF ou solicite reemissão.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 rounded-md bg-emerald-50 border border-emerald-200 p-4">
                <CheckCircle2 className="h-6 w-6 text-emerald-700 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-800">Documento autêntico</p>
                  <p className="text-sm text-emerald-700">
                    Este documento consta como emitido oficialmente pela SMS de Oriximiná.
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                <dt className="font-medium text-slate-600">Tipo</dt>
                <dd className="sm:col-span-2 text-slate-900">{data.tipo}</dd>

                <dt className="font-medium text-slate-600">Descrição</dt>
                <dd className="sm:col-span-2 text-slate-900">{data.descricao}</dd>

                <dt className="font-medium text-slate-600">Assinado por</dt>
                <dd className="sm:col-span-2 text-slate-900">{data.assinado_por_nome ?? "—"}</dd>

                <dt className="font-medium text-slate-600">Emitido em</dt>
                <dd className="sm:col-span-2 text-slate-900">
                  {new Date(data.assinado_em).toLocaleString("pt-BR")}
                </dd>

                <dt className="font-medium text-slate-600">Identificador</dt>
                <dd className="sm:col-span-2 font-mono text-xs text-slate-700 break-all">{data.id}</dd>

                <dt className="font-medium text-slate-600">Hash SHA-256</dt>
                <dd className="sm:col-span-2 font-mono text-xs text-slate-700 break-all">
                  {data.hash_conteudo}
                </dd>
              </dl>
            </>
          )}

          <div className="pt-4 border-t border-slate-200 text-xs text-slate-500">
            <Link to="/" className="text-emerald-700 hover:underline">
              ← Voltar ao portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
