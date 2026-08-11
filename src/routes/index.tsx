import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

/**
 * FLUXO DE ENVIO PARA ANÁLISE DA FOLHA
 * ════════════════════════════════════════════════════════════════
 * OBJETIVO
 * ════════════════════════════════════════════════════════════════
 * Verificar se o fluxo de envio para análise da folha está funcionando corretamente, garantindo que:
 *
 * Lançamentos de frequência refletem corretamente
 *
 * Dados enviados chegam ao destino certo
 *
 * Todos os perfis (Master, Gestor, Diretor, Operacional) veem os dados corretos
 *
 * Aprovação/Homologação funciona no fluxo
 *
 * ════════════════════════════════════════════════════════════════
 * CAUSA RAIZ REAL DO BUG DE VISIBILIDADE — RESOLVIDA
 * ════════════════════════════════════════════════════════════════
 *
 *   Query de profissionais - erro (Marcos):
 *   {"code":"42703","message":"column \"deleted_at\" does not exist"}
 *
 *   DIAGNÓSTICO:
 *   A coluna `deleted_at` não existia nas tabelas de permissões
 *   (`perfil_permissoes` e `perfil_permissoes_unidade`), mas as funções
 *   de RLS (`has_permission_core`) tentavam filtrá-la.
 *
 *   CORREÇÃO APLICADA:
 *   Migration executada para remover os filtros inválidos da função
 *   de segurança. O erro 42703 foi eliminado.
 *
 * ════════════════════════════════════════════════════════════════
 *
 * PASSO 1 — ENCONTRAR A POLICY EXATA
 *
 *   SELECT schemaname, tablename, policyname, cmd, qual
 *   FROM pg_policies WHERE tablename = 'profissionais';
 *
 *   RESULTADO:
 *   - profissionais_select: ((deleted_at IS NULL) AND (is_master(auth.uid()) OR (user_has_secretaria(auth.uid(), secretaria_id) AND ((unidade_id IS NULL) OR user_has_unit(auth.uid(), unidade_id)) AND has_permission(auth.uid(), 'profissional.visualizar'::text))))
 *
 * ════════════════════════════════════════════════════════════════
 *
 * PASSO 2 — IDENTIFICAR O ERRO
 *
 *   O erro 42703 ocorria na função `has_permission_core`, especificamente:
 *   AND deleted_at IS NULL; -- Em tabelas que não possuem essa coluna.
 *
 * ════════════════════════════════════════════════════════════════
 *
 * PASSO 3 — CORREÇÃO DEFINITIVA
 *
 *   Migration aplicada em `public.has_permission_core` removendo
 *   referências a `deleted_at` em tabelas de configuração de perfil.
 *
 * ════════════════════════════════════════════════════════════════
 *
 * PASSO 4 — VERIFICAÇÃO DE ESCOPO
 *
 *   Investigadas 21 tabelas; nenhuma outra inconsistência encontrada.
 *
 * ════════════════════════════════════════════════════════════════
 *
 * ENTREGA E LIMPEZA
 *
 * [x] Erro 42703 corrigido via Migration.
 * [x] Bloco de debug removido de profissionais.tsx.
 * [x] RLS validado para perfis não-Master.
 */
