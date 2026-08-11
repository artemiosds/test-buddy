import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // throw redirect({ to: "/analitico" });
  },
  component: DashboardDebugger,
});

function DashboardDebugger() {
  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="space-y-2 border-b pb-4">
          <h1 className="text-3xl font-bold text-slate-900">Auditoria Forense de Assinaturas</h1>
          <p className="text-slate-500">Inspecione os logs e reproduza o erro para identificar o campo UUID contaminado.</p>
        </header>

        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-sm font-bold">!</span>
            Evidência do Erro
          </h2>
          <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm">
            invalid input syntax for type uuid: "1c2e...-....png"
          </div>
        </section>

        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-xl font-semibold">Procedimento de Debug</h2>
          <ol className="list-decimal list-inside space-y-2 text-slate-600 text-sm">
            <li>Abra o console do desenvolvedor (F12).</li>
            <li>Navegue até <strong>Meu Perfil &gt; Assinatura</strong>.</li>
            <li>Realize um upload de assinatura (PNG/JPG).</li>
            <li>Clique em <strong>"Cadastrar assinatura"</strong>.</li>
            <li>Inspecione o log <code>[ASSINATURA FINAL PAYLOAD]</code>.</li>
            <li>Identifique qual campo UUID contém a extensão <code>.png</code>.</li>
          </ol>
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <h3 className="font-semibold text-blue-900 mb-1">Identidade (UUID)</h3>
            <p className="text-xs text-blue-700">id, usuario_id, unidade_id, secretaria_id, perfil_id</p>
          </div>
          <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
            <h3 className="font-semibold text-emerald-900 mb-1">Arquivo (TEXT)</h3>
            <p className="text-xs text-emerald-700">storage_path, arquivo_url</p>
          </div>
        </section>
      </div>
    </div>
  );
}
