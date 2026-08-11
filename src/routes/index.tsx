// INVESTIGAÇÃO EM CURSO: Erro de sintaxe UUID "pessoal" no módulo de assinaturas.

/**
 * PASSO 1 — LOCALIZAÇÃO DO INSERT
 * 
 * Componente "Minha assinatura": src/routes/_authenticated/meu-perfil.assinatura.tsx
 * Componente "Institucionais": src/routes/_authenticated/assinaturas.tsx (NovaAssinaturaDialog)
 * 
 * Trecho do Payload (MinhaAssinaturaPage):
 * ```typescript
 * const payloadAssinatura = {
 *   tipo: "assinatura",
 *   titular_nome: titularNome.trim(),
 *   titular_cargo: titularCargo.trim() || null,
 *   storage_path: path,
 *   mime_type: "image/png",
 *   usuario_id: me.id,
 *   unidade_id: (unidadeReal && unidadeReal !== "") ? unidadeReal : null,
 *   secretaria_id: null,
 *   perfil_id: (me.perfil_id && me.perfil_id !== "") ? me.perfil_id : null,
 *   is_pessoal: true,
 *   ativa: true,
 *   // ... campos de posição ...
 * };
 * ```
 * 
 * PASSO 2 — ESTRUTURA DA TABELA (assinaturas_institucionais)
 * 
 * - id: uuid
 * - usuario_id: uuid
 * - unidade_id: uuid
 * - secretaria_id: uuid
 * - perfil_id: uuid
 * - tipo: USER-DEFINED (Enum tipo_assinatura: 'assinatura', 'carimbo', 'logo')
 * - titular_nome: text
 * - storage_path: text
 * - is_pessoal: boolean
 * - alinhamento: text
 * 
 * PASSO 3 — HIPÓTESE DA CAUSA RAIZ
 * 
 * O valor "pessoal" está sendo injetado em uma coluna UUID. 
 * Candidatos prováveis: 
 * 1. `storage_path` começa com "pessoal/", mas é TEXT, então não causaria erro UUID.
 * 2. O erro `invalid input syntax for type uuid: "pessoal"` sugere que a string EXATA "pessoal" foi enviada.
 * 3. No arquivo `src/routes/_authenticated/meu-perfil.assinatura.tsx`, notei que o `path` do storage é:
 *    `const path = \`pessoal/\${me.id}/\${unidSeg}/\${crypto.randomUUID()}.\${ext}\`;`
 * 
 * Se o erro ocorre no INSERT, algum campo UUID está recebendo "pessoal".
 * Verifiquei o código e adicionei logs de debug. Aguardando captura do payload real.
 */

import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: () => (
    <div className="p-8 font-sans max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4 text-primary">Diagnóstico de Assinaturas</h1>
      <div className="bg-slate-50 border rounded-lg p-6 space-y-4">
        <p className="text-lg">
          O sistema está em modo de investigação para capturar o payload exato que causa o erro 
          <code className="bg-red-100 px-1 rounded text-red-700 mx-1">invalid input syntax for type uuid: "pessoal"</code>.
        </p>
        
        <div className="bg-white border rounded p-4">
          <h2 className="font-semibold mb-2">Instruções para o Usuário:</h2>
          <ol className="list-decimal ml-5 space-y-2">
            <li>Vá para a página de <strong>Assinaturas</strong>.</li>
            <li>Tente cadastrar uma nova assinatura (seja na aba "Minha assinatura" ou "Institucionais").</li>
            <li>Quando o erro ocorrer, abra o <strong>Console do Navegador (F12)</strong>.</li>
            <li>Procure por uma mensagem começando com <code>DEBUG PAYLOAD ASSINATURA</code>.</li>
            <li>Copie o JSON que aparecer lá e cole aqui no chat.</li>
          </ol>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
          <p className="text-sm">
            <strong>Nota Técnica:</strong> Já verifiquei a estrutura da tabela e o código. 
            O campo "tipo" é um enum, e "unidade_id", "secretaria_id" e "perfil_id" são UUIDs. 
            O valor "pessoal" não deveria estar indo para nenhum desses campos no INSERT.
          </p>
        </div>
      </div>
    </div>
  )
});
