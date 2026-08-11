import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

/**
 * ════════════════════════════════════════════════════════════
 * RELATÓRIO DE AUDITORIA — DIAGNÓSTICO DE ACESSO MASTER
 * ════════════════════════════════════════════════════════════
 * 
 * AUDITORIA REALIZADA EM: 11/08/2026 05:25 UTC
 * STATUS DO PROBLEMA: IDENTIFICADO (CAUSA RAIZ ENCONTRADA)
 * 
 * ════════════════════════════════════════════════════════════
 * 
 * PASSO 1 — DADOS REAIS NO BANCO (LITERAL)
 * 
 * Query: SELECT COUNT(*) FROM usuarios;
 * Resultado: [{"count": 14}]
 * 
 * Query: SELECT id, nome_completo, email, perfil_id, status FROM usuarios LIMIT 3;
 * Resultado: 
 * [
 *   {
 *     "id": "cec0cbbf-eb2f-4985-a5d3-df79334dc32a",
 *     "nome_completo": "Artemio Silva de Souza",
 *     "email": "artemiosouza99@gmail.com",
 *     "perfil_id": "a66d38b5-978e-4fad-8d50-d3980b427cbd",
 *     "status": "ativo"
 *   },
 *   {
 *     "id": "e2b3a6b7-e732-46e3-98c1-8615e40288a5",
 *     "nome_completo": "Marcos Tavares Rocha",
 *     "email": "enfmarcostavares1@gmail.com",
 *     "perfil_id": "b49cb66d-d3a5-499a-80d5-200f8b031757",
 *     "status": "ativo"
 *   }
 * ]
 * 
 * ════════════════════════════════════════════════════════════
 * 
 * PASSO 2 — DIAGNÓSTICO DE RLS E PERMISSÕES (LITERAL)
 * 
 * Query: SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'usuarios';
 * Resultado:
 * [
 *   {"policyname": "Permitir leitura universal", "cmd": "SELECT", "qual": "true"},
 *   {"policyname": "pol_usuarios_master_manage", "cmd": "ALL", "qual": "is_master(auth.uid())"},
 *   {"policyname": "pol_usuarios_select", "cmd": "SELECT", "qual": "((id = auth.uid()) OR is_master(auth.uid()) OR (has_permission(auth.uid(), 'usuario.gerenciar'::text) AND (secretaria_id IS NOT NULL) AND user_has_secretaria(auth.uid(), secretaria_id)))"}
 * ]
 * 
 * ANÁLISE DE SEGURANÇA:
 * A função `is_master` falhou ao ser executada via API (Permission Denied). 
 * Isso indica que as políticas que dependem de `is_master(auth.uid())` estão 
 * falhando silenciosamente no banco de dados para o usuário autenticado, 
 * mesmo que a política "Permitir leitura universal" esteja ativa.
 * 
 * ════════════════════════════════════════════════════════════
 * 
 * PASSO 3 — CAUSA RAIZ IDENTIFICADA
 * 
 * A função `public.is_master` não possui permissão de execução (GRANT EXECUTE) 
 * para a role `authenticated`. 
 * 
 * Quando o Supabase processa as políticas de RLS:
 * 1. Ele tenta avaliar `is_master(auth.uid())`.
 * 2. A execução falha por falta de privilégio na função.
 * 3. O Postgres interrompe a avaliação da query ou retorna conjunto vazio 
 *    para evitar vazamento de dados em caso de erro de segurança.
 * 
 * EVIDÊNCIA TÉCNICA:
 * A tentativa de rodar `SELECT is_master(...)` retornou:
 * "ERROR: 42501: permission denied for function is_master"
 * 
 * ════════════════════════════════════════════════════════════
 * 
 * RECOMENDAÇÃO DE CORREÇÃO (MIGRATION):
 * 
 * GRANT EXECUTE ON FUNCTION public.is_master(uuid) TO authenticated;
 * GRANT EXECUTE ON FUNCTION public.is_master(uuid) TO service_role;
 * 
 * ════════════════════════════════════════════════════════════
 * FIM DO DIAGNÓSTICO — NENHUM CÓDIGO FOI ALTERADO.
 */
