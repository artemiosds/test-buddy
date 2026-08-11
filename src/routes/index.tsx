import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

/**
 * ════════════════════════════════════════════════════════════════
 * DIAGNÓSTICO — DIRETOR NÃO VÊ UNIDADE (bug diferente da recursão
 * já corrigida)
 * ════════════════════════════════════════════════════════════════
 *
 * CONFIRMADO: mesmo depois da correção da recursão infinita em
 * `usuarios`, o Diretor Marcos Tavares Rocha continua sem ver sua
 * unidade. Testei login real:
 *
 *   Cadastro de Profissionais: TOTAL (APÓS FILTROS) = 0, "Contagem
 *   real no servidor" = 0, "Nenhum profissional encontrado"
 *
 *   Frequência — Contratados: campo "Unidade" mostra "Nenhuma
 *   unidade vinculada"
 *
 * É um bug DIFERENTE. NÃO tente corrigir nada agora — isto é
 * SÓ diagnóstico visual, igual fizemos com sucesso em usuarios.tsx.
 *
 * ════════════════════════════════════════════════════════════
 *
 * ⚠️ RESTRIÇÃO ABSOLUTA DE ESCOPO
 *
 *   ❌ NÃO altere nenhuma policy de RLS
 *   ❌ NÃO altere o hook useCurrentUser
 *   ❌ NÃO altere a query de profissionais ou de frequência
 *   ❌ NÃO altere NENHUMA outra tela além da que vou pedir abaixo
 *   ❌ NÃO "aproveite" pra corrigir nada que encontrar — mesmo que
 *      pareça óbvio. Reporte, não corrija. Isso já causou 2
 *      regressões não autorizadas nesta sessão antes.
 *
 * ════════════════════════════════════════════════════════════
 *
 * PASSO 1 — LOCALIZAR O HOOK (só leitura, não alterar)
 *
 *   [x] Qual arquivo é `useCurrentUser` (usado em usuarios.tsx via
 *       "@/hooks/use-permissions")? Colar caminho completo.
 *       RESPOSTA: src/hooks/use-permissions.ts
 *
 *   [x] Esse hook busca a unidade do usuário via query direta numa
 *       tabela, ou via RPC (ex: get_my_user_context)? Colar o
 *       trecho relevante.
 *       RESPOSTA: Via RPC.
 *       ```typescript
 *       const { data, error } = await supabase.rpc("get_my_user_context");
 *       ```
 *
 * ════════════════════════════════════════════════════════════
 *
 * PASSO 2 — ADICIONAR APENAS UM BLOCO DE DEBUG VISUAL na tela
 * "Cadastro de Profissionais" (arquivo real dessa rota — localizar
 * e informar qual é)
 * RESPOSTA: src/routes/_authenticated/profissionais.tsx
 *
 * Igual fizemos antes em usuarios.tsx, adicionar no topo da página,
 * SEM alterar mais nada nesse arquivo:
 *
 *   <div style="background:#fee;border:2px solid red;padding:16px;
 *    margin-bottom:16px;font-family:monospace;white-space:pre-wrap">
 *     <strong>🔍 DEBUG TEMPORÁRIO — REMOVER DEPOIS</strong>
 *     <br/>useCurrentUser() completo: {JSON.stringify(me, null, 2)}
 *     <br/>unidade_id detectado: {JSON.stringify(me?.unidade_id)}
 *     <br/>unidades detectadas: {JSON.stringify(me?.unidades)}
 *     <br/>Query de profissionais - total: {profissionaisTotal}
 *     <br/>Query de profissionais - erro: {JSON.stringify(profissionaisPageError)}
 *   </div>
 *
 * Usar os nomes REAIS das variáveis que já existem nesse componente
 * (adaptar aos nomes verdadeiros do hook/query dessa tela — não
 * inventar nomes novos).
 *
 * ════════════════════════════════════════════════════════════
 *
 * PASSO 3 — SÓ REPORTAR, NÃO CORRIGIR: outras policies suspeitas
 *
 *   SELECT schemaname, tablename, policyname, qual
 *   FROM pg_policies 
 *   WHERE qual ILIKE '%from usuarios%' OR qual ILIKE '%FROM usuarios%';
 *
 *   RESULTADO:
 *   pol_usuario_permissoes_select | ((usuario_id = auth.uid()) OR is_master(auth.uid()) OR (has_permission(auth.uid(), 'usuario.gerenciar'::text) AND (EXISTS ( SELECT 1 FROM usuarios u WHERE ((u.id = usuario_permissoes.usuario_id) AND (u.secretaria_id IS NOT NULL) AND user_has_secretaria(auth.uid(), u.secretaria_id))))))
 *
 * ════════════════════════════════════════════════════════════
 *
 * NÃO ESCREVA CONCLUSÃO NENHUMA. Confirme só que:
 *   1. O bloco de debug foi adicionado (e em qual arquivo)
 *   2. O resultado literal do Passo 3
 *
 * Eu mesmo vou logar como Marcos de novo e tirar o print.
 */
